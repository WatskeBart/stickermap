import os
import secrets
from datetime import UTC, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from core.auth import ROLE_EDITOR, ROLE_VIEWER, get_user_identity, require_role
from core.config import Config
from dependencies import get_db
from file_handlers import FileValidator, ImageProcessor
from models.sticker import ReviewReportRequest

router = APIRouter()


@router.post("/stickers/{sticker_id}/reports", status_code=201)
async def submit_removal_report(
    sticker_id: int,
    proof_image: Optional[UploadFile] = File(default=None),
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_VIEWER)),
):
    """Submit a removal report for a sticker. Each user can report a sticker at most once."""
    reported_by = get_user_identity(current_user)
    proof_filename = None

    if proof_image and proof_image.filename:
        if proof_image.content_type is None:
            raise HTTPException(status_code=400, detail="File content type is missing")
        FileValidator.validate_mime(proof_image.content_type)
        contents = await proof_image.read()
        FileValidator.validate_size(contents)
        FileValidator.validate_content(contents)

        upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        Path(upload_dir).mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        random_suffix = secrets.token_hex(4)
        base_name = f"proof_{timestamp}_{random_suffix}"
        img_format = Config.IMAGE_FORMAT
        ext = "jpg" if img_format == "JPEG" else img_format.lower()
        proof_filename = f"{base_name}.{ext}"
        file_path = os.path.join(upload_dir, proof_filename)
        full_bytes, _ = ImageProcessor.process(
            contents,
            max_size=Config.IMAGE_MAX_SIZE,
            thumbnail_size=Config.THUMBNAIL_SIZE,
            fmt=img_format,
            quality=Config.IMAGE_QUALITY,
        )
        with open(file_path, "wb") as f:
            f.write(full_bytes)
        await proof_image.close()

    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id, archived FROM stickers WHERE id = {sticker_id}")
        sticker = cursor.fetchone()
        if not sticker:
            raise HTTPException(status_code=404, detail="Sticker not found")
        if sticker[1]:
            raise HTTPException(status_code=409, detail="Sticker is already archived")

        reported_at = datetime.now(UTC).replace(microsecond=0)
        cursor.execute(t"""
            INSERT INTO removal_reports (sticker_id, reported_by, reported_at, proof_image)
            VALUES ({sticker_id}, {reported_by}, {reported_at}, {proof_filename})
            RETURNING id
        """)
        report_id = cursor.fetchone()[0]
        conn.commit()
        return {"message": "Report submitted", "report_id": report_id}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        if "uq_report_per_user_sticker" in str(e):
            raise HTTPException(status_code=409, detail="Je hebt deze sticker al eerder gemeld")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()


@router.get("/reports/pending")
def get_pending_reports_count(
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Get count of stickers with unreviewed removal reports. Editor/admin only."""
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT COUNT(DISTINCT sticker_id) FROM removal_reports WHERE review_status = 'pending'"
        )
        count = cursor.fetchone()[0]
        return {"count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.get("/stickers/{sticker_id}/reports")
def get_sticker_reports(
    sticker_id: int,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Get removal reports for a sticker. Editor/admin only."""
    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id FROM stickers WHERE id = {sticker_id}")
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Sticker not found")

        cursor.execute(t"""
            SELECT id, sticker_id, reported_by, reported_at, proof_image,
                reviewed_by, review_status, reviewed_at
            FROM removal_reports
            WHERE sticker_id = {sticker_id}
            ORDER BY reported_at DESC
        """)
        reports = cursor.fetchall()
        return [
            {
                "id": r[0],
                "sticker_id": r[1],
                "reported_by": r[2],
                "reported_at": str(r[3]) if r[3] else None,
                "proof_image": r[4],
                "proof_image_url": f"/uploads/{r[4]}" if r[4] else None,
                "reviewed_by": r[5],
                "review_status": r[6],
                "reviewed_at": str(r[7]) if r[7] else None,
            }
            for r in reports
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.patch("/reports/{report_id}/review", status_code=200)
def review_removal_report(
    report_id: int,
    request: ReviewReportRequest,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Review a removal report: confirm (archives sticker) or dismiss. Editor/admin only."""
    reviewer = get_user_identity(current_user)
    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id, sticker_id, review_status FROM removal_reports WHERE id = {report_id}")
        report = cursor.fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if report[2] != "pending":
            raise HTTPException(status_code=409, detail="Report has already been reviewed")

        sticker_id = report[1]
        reviewed_at = datetime.now(UTC).replace(microsecond=0)
        cursor.execute(t"""
            UPDATE removal_reports
            SET review_status = {request.status}, reviewed_by = {reviewer}, reviewed_at = {reviewed_at}
            WHERE id = {report_id}
        """)

        if request.status == "confirmed":
            cursor.execute(t"UPDATE stickers SET archived = TRUE WHERE id = {sticker_id}")
        elif request.status == "dismissed":
            cursor.execute(t"""
                SELECT COUNT(*) FROM removal_reports
                WHERE sticker_id = {sticker_id} AND review_status = 'pending'
            """)
            remaining_pending = cursor.fetchone()[0]
            if remaining_pending == 0:
                cursor.execute(t"UPDATE stickers SET archived = FALSE WHERE id = {sticker_id}")

        conn.commit()
        return {"message": f"Report {report_id} {request.status}"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
