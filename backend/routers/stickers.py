import csv
import io
import json
import os
import secrets
from datetime import UTC, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status

from core.auth import ROLE_ADMIN, ROLE_EDITOR, ROLE_UPLOADER, ROLE_VIEWER, get_current_user, get_user_identity, get_user_roles, require_role
from core.config import Config
from core.logger import get_logger
from dependencies import get_db
from file_handlers import FileValidator, GPSExtractor, ImageProcessor, rotate_image_file
from models.sticker import CreateStickersRequest, RotateRequest, UpdateStickerRequest

logger = get_logger(__name__)
router = APIRouter()


@router.get("/")
def index():
    return {"message": "Welcome to the StickerMap API!"}


@router.post("/upload")
async def upload(
    file: UploadFile = File(...), current_user: dict = Depends(require_role(ROLE_UPLOADER))
):
    """Upload and validate image file"""
    if file.content_type is None:
        raise HTTPException(status_code=400, detail="File content type is missing")
    if file.filename is None:
        raise HTTPException(status_code=400, detail="File name is missing")
    FileValidator.validate_mime(file.content_type)

    contents = await file.read()

    FileValidator.validate_size(contents)

    FileValidator.validate_content(contents)

    upload_dir = os.getenv("UPLOAD_DIR", "uploads")
    Path(upload_dir).mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    random_suffix = secrets.token_hex(4)
    base_name = f"{timestamp}_{random_suffix}"

    img_format = Config.IMAGE_FORMAT
    ext = "jpg" if img_format == "JPEG" else img_format.lower()
    filename = f"{base_name}.{ext}"
    thumb_filename = f"{base_name}_thumb.{ext}"
    raw_path = os.path.join(upload_dir, f"{base_name}.tmp")
    file_path = os.path.join(upload_dir, filename)
    thumb_path = os.path.join(upload_dir, thumb_filename)

    try:
        # Write raw bytes temporarily so GPSExtractor can read the file
        with open(raw_path, "wb") as f:
            f.write(contents)

        gps_info = GPSExtractor.extract(raw_path)

        full_bytes, thumb_bytes = ImageProcessor.process(
            contents,
            max_size=Config.IMAGE_MAX_SIZE,
            thumbnail_size=Config.THUMBNAIL_SIZE,
            fmt=img_format,
            quality=Config.IMAGE_QUALITY,
        )

        with open(file_path, "wb") as f:
            f.write(full_bytes)
        with open(thumb_path, "wb") as f:
            f.write(thumb_bytes)

        return {
            "message": f"Successfully uploaded {file.filename}",
            "filename": filename,
            "thumbnail": thumb_filename,
            "gps_info": gps_info,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    finally:
        if os.path.exists(raw_path):
            os.remove(raw_path)
        await file.close()


@router.post("/create_sticker", status_code=201)
def create_sticker(
    request: CreateStickersRequest,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_UPLOADER)),
):
    """Create sticker(s) in database"""
    uploaded_by = get_user_identity(current_user)
    cursor = conn.cursor()
    try:
        for sticker in request.stickers:
            lon, lat = sticker.location.lon, sticker.location.lat
            poster, uploader, post_date = sticker.poster, sticker.uploader, sticker.post_date
            upload_date = datetime.now(UTC).replace(microsecond=0)
            image = sticker.image
            category_id = sticker.category_id
            cursor.execute(t"""
                INSERT INTO stickers (location, poster, uploader, post_date, upload_date, image, uploaded_by, category_id)
                VALUES (
                    ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326),
                    {poster}, {uploader}, {post_date}, {upload_date}, {image}, {uploaded_by}, {category_id}
                )
                RETURNING *;
                """)
        conn.commit()
        return {"message": "Sticker(s) successfully added"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()


@router.get("/get_all_stickers")
def get_all_stickers(
    conn=Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
):
    """Retrieve all stickers. Metadata fields are omitted for non-viewers; only id, location, and image are returned."""
    is_viewer = ROLE_VIEWER in get_user_roles(current_user) if current_user else False
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT
                s.id,
                ST_AsGeoJSON(s.location),
                s.poster,
                s.uploader,
                s.post_date,
                s.upload_date,
                s.image,
                s.uploaded_by,
                s.updated_at,
                (SELECT COUNT(*) FROM removal_reports rr
                WHERE rr.sticker_id = s.id AND rr.review_status = 'pending') AS removal_count,
                s.archived,
                s.category_id,
                c.name,
                c.icon_filename
            FROM stickers s
            LEFT JOIN categories c ON c.id = s.category_id
        """)
        rows = cursor.fetchall()
        if not is_viewer:
            rows = [
                (r[0], r[1], None, None, None, None, r[6], None, None, 0, r[10], r[11], r[12], r[13])
                for r in rows
            ]
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.get("/get_sticker/{id}")
def get_sticker(id: int, conn=Depends(get_db), current_user: dict = Depends(require_role(ROLE_UPLOADER))):
    """Retrieve single sticker by ID. Requires sm-uploader role (used only in edit flows)."""
    cursor = conn.cursor()
    try:
        cursor.execute(
            t"""
            SELECT s.id, ST_AsGeoJSON(s.location), s.poster, s.uploader, s.post_date,
                s.upload_date, s.image, s.uploaded_by, s.updated_at,
                s.category_id, c.name, c.icon_filename
            FROM stickers s
            LEFT JOIN categories c ON c.id = s.category_id
            WHERE s.id = {id}
            """
        )
        sticker = cursor.fetchone()
        if not sticker:
            raise HTTPException(status_code=404, detail="Sticker not found")
        return sticker
    finally:
        cursor.close()


@router.get("/uploaders")
def get_uploaders(conn=Depends(get_db), current_user: dict = Depends(require_role(ROLE_UPLOADER))):
    """Get list of all unique uploaders in the database. Requires sm-uploader role (used only in edit flows)."""
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT DISTINCT uploader FROM stickers WHERE uploader IS NOT NULL ORDER BY uploader"
        )
        uploaders = [row[0] for row in cursor.fetchall()]
        return {"uploaders": uploaders}
    finally:
        cursor.close()


@router.patch("/sticker/{sticker_id}", status_code=200)
def update_sticker(
    sticker_id: int,
    request: UpdateStickerRequest,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_UPLOADER)),
):
    """
    Update a sticker. Uploaders can update their own sticker's poster, post_date, location.
    Editors can update any sticker's poster, post_date, location.
    Admins can additionally update uploader or remove sticker.
    Image filenames are immutable.
    """
    user_roles = get_user_roles(current_user)
    user_id = get_user_identity(current_user)

    # Determine allowed fields based on role
    admin_only_fields = {"uploader"}
    update_data = request.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Check for admin-only fields when user is not admin
    if ROLE_ADMIN not in user_roles:
        forbidden_fields = set(update_data.keys()) & admin_only_fields
        if forbidden_fields:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Only admins can modify: {', '.join(forbidden_fields)}",
            )

    cursor = conn.cursor()
    try:
        # Check if sticker exists and get ownership info
        cursor.execute(t"SELECT id, uploaded_by FROM stickers WHERE id = {sticker_id}")
        sticker_row = cursor.fetchone()
        if not sticker_row:
            raise HTTPException(status_code=404, detail="Sticker not found")

        # Ownership check: uploaders can only edit their own stickers
        is_editor = ROLE_EDITOR in user_roles
        is_admin = ROLE_ADMIN in user_roles
        if not (is_editor or is_admin):
            sticker_uploaded_by = sticker_row[1]
            if sticker_uploaded_by != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only edit your own stickers",
                )

        # Build dynamic SQL UPDATE
        set_clauses = []
        params = []

        if "poster" in update_data:
            set_clauses.append("poster = %s")
            params.append(update_data["poster"])

        if "post_date" in update_data:
            set_clauses.append("post_date = %s")
            params.append(update_data["post_date"])

        if "location" in update_data:
            set_clauses.append(
                "location = ST_SetSRID(ST_MakePoint(%s, %s), 4326)"
            )
            params.extend(
                [update_data["location"]["lon"], update_data["location"]["lat"]]
            )

        if "uploader" in update_data:
            set_clauses.append("uploader = %s")
            params.append(update_data["uploader"])

        if "category_id" in update_data:
            set_clauses.append("category_id = %s")
            params.append(update_data["category_id"])

        set_clauses.append("updated_at = NOW()")
        params.append(sticker_id)

        query = (
            f"UPDATE stickers SET {', '.join(set_clauses)} WHERE id = %s RETURNING id, updated_at"
        )
        cursor.execute(query, tuple(params))
        row = cursor.fetchone()
        conn.commit()

        return {"message": f"Sticker {sticker_id} updated successfully", "updated_at": row[1]}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()


@router.get("/stats")
def get_stats(
    conn=Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
):
    """Get sticker statistics. Name fields are omitted for non-viewers."""
    is_viewer = ROLE_VIEWER in get_user_roles(current_user) if current_user else False
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM stickers WHERE archived = FALSE")
        total = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM stickers WHERE archived = FALSE AND DATE_TRUNC('month', upload_date) = DATE_TRUNC('month', NOW())"
        )
        stickers_this_month = cursor.fetchone()[0]

        cursor.execute(
            "SELECT poster, COUNT(*) as cnt FROM stickers WHERE archived = FALSE GROUP BY poster ORDER BY cnt DESC LIMIT 1"
        )
        top_row = cursor.fetchone()
        top_poster = {"name": top_row[0], "count": top_row[1]} if (top_row and is_viewer) else None

        cursor.execute(
            "SELECT MAX(uploader), COUNT(*) as cnt FROM stickers WHERE archived = FALSE AND uploaded_by IS NOT NULL GROUP BY uploaded_by ORDER BY cnt DESC LIMIT 1"
        )
        top_uploader_row = cursor.fetchone()
        top_uploader = {"name": top_uploader_row[0], "count": top_uploader_row[1]} if (top_uploader_row and is_viewer) else None

        cursor.execute("SELECT COUNT(DISTINCT uploaded_by) FROM stickers WHERE archived = FALSE AND uploaded_by IS NOT NULL")
        total_uploaders = cursor.fetchone()[0]

        cursor.execute(
            "SELECT poster, upload_date FROM stickers WHERE archived = FALSE ORDER BY upload_date DESC LIMIT 1"
        )
        last_row = cursor.fetchone()

        cursor.execute("SELECT COUNT(*) FROM stickers WHERE archived = TRUE")
        archived_stickers = cursor.fetchone()[0]

        return {
            "total_stickers": total,
            "stickers_this_month": stickers_this_month,
            "top_poster": top_poster,
            "top_uploader": top_uploader,
            "total_uploaders": total_uploaders,
            "last_sticker_date": str(last_row[1].date()) if last_row else None,
            "last_sticker_poster": last_row[0] if (last_row and is_viewer) else None,
            "archived_stickers": archived_stickers,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.get("/stickers/export")
def export_stickers(
    format: Optional[str] = Query(default=None, description="Export format: 'geojson' (default) or 'csv'"),
    request: Request = None,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Export all stickers as GeoJSON FeatureCollection or flat CSV. Requires sm-editor role."""
    fmt = (format or "").strip().lower()
    if not fmt:
        accept = request.headers.get("accept", "") if request else ""
        fmt = "csv" if "text/csv" in accept else "geojson"
    if fmt not in ("geojson", "csv"):
        raise HTTPException(status_code=400, detail="format must be 'geojson' or 'csv'")

    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT
                s.id,
                ST_AsGeoJSON(s.location),
                s.poster,
                s.uploader,
                s.post_date,
                s.upload_date,
                s.image,
                s.uploaded_by,
                s.archived,
                s.category_id,
                c.name
            FROM stickers s
            LEFT JOIN categories c ON c.id = s.category_id
            ORDER BY s.id
        """)
        rows = cursor.fetchall()
    finally:
        cursor.close()

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "poster", "uploader", "post_date", "upload_date", "latitude", "longitude", "image", "archived", "category"])
        for r in rows:
            geom = json.loads(r[1])
            lon, lat = geom["coordinates"][0], geom["coordinates"][1]
            writer.writerow([r[0], r[2], r[3], str(r[4]) if r[4] else None, str(r[5]) if r[5] else None, lat, lon, r[6], r[8], r[10]])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=stickers.csv"},
        )

    features = []
    for r in rows:
        geom = json.loads(r[1])
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "id": r[0],
                "poster": r[2],
                "uploader": r[3],
                "post_date": str(r[4]) if r[4] else None,
                "upload_date": str(r[5]) if r[5] else None,
                "image": r[6],
                "uploaded_by": r[7],
                "archived": r[8],
                "category_id": r[9],
                "category_name": r[10],
            },
        })
    return Response(
        content=json.dumps({"type": "FeatureCollection", "features": features}),
        media_type="application/geo+json",
        headers={"Content-Disposition": "attachment; filename=stickers.geojson"},
    )


@router.patch("/stickers/{sticker_id}/rotate", status_code=200)
def rotate_sticker(
    sticker_id: int,
    request: RotateRequest,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_UPLOADER)),
):
    """Rotate a sticker image 90° CW/CCW or 180°. Owner or editor required."""
    user_roles = get_user_roles(current_user)
    user_id = get_user_identity(current_user)

    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id, image, uploaded_by FROM stickers WHERE id = {sticker_id}")
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Sticker not found")

        image_filename = row[1]
        uploaded_by = row[2]

        is_editor = ROLE_EDITOR in user_roles
        is_admin = ROLE_ADMIN in user_roles
        if not (is_editor or is_admin) and uploaded_by != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only rotate your own stickers",
            )

        if not image_filename:
            raise HTTPException(status_code=400, detail="Sticker has no image")

        upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        image_path = os.path.join(upload_dir, image_filename)
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Image file not found")

        degrees = {"cw": -90, "ccw": 90, "180": 180}[request.direction]
        base, ext = os.path.splitext(image_filename)
        thumb_path = os.path.join(upload_dir, f"{base}_thumb{ext}")
        rotate_image_file(image_path, thumb_path, degrees, quality=Config.IMAGE_QUALITY)

        cursor.execute(
            t"""
            UPDATE stickers SET updated_at = NOW()
            WHERE id = {sticker_id}
            RETURNING id, ST_AsGeoJSON(location), poster, uploader, post_date, upload_date, image, uploaded_by, updated_at, category_id
            """
        )
        updated_row = cursor.fetchone()
        conn.commit()
        return updated_row
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Rotation failed: {str(e)}")
    finally:
        cursor.close()


@router.delete("/sticker/{sticker_id}", status_code=200)
def delete_sticker(
    sticker_id: int,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_ADMIN)),
):
    """Delete a sticker. Admin only."""
    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id, image FROM stickers WHERE id = {sticker_id}")
        sticker = cursor.fetchone()
        if not sticker:
            raise HTTPException(status_code=404, detail="Sticker not found")

        cursor.execute(t"DELETE FROM stickers WHERE id = {sticker_id}")
        conn.commit()

        # Remove associated image file and thumbnail
        image_filename = sticker[1]
        if image_filename:
            upload_dir = os.getenv("UPLOAD_DIR", "uploads")
            image_path = os.path.join(upload_dir, image_filename)
            if os.path.exists(image_path):
                os.remove(image_path)
            base, ext = os.path.splitext(image_filename)
            thumb_path = os.path.join(upload_dir, f"{base}_thumb{ext}")
            if os.path.exists(thumb_path):
                os.remove(thumb_path)

        return {"message": f"Sticker {sticker_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()


@router.patch("/stickers/{sticker_id}/archive", status_code=200)
def archive_sticker(
    sticker_id: int,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Archive a sticker directly. Editor/admin only."""
    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id, archived FROM stickers WHERE id = {sticker_id}")
        sticker = cursor.fetchone()
        if not sticker:
            raise HTTPException(status_code=404, detail="Sticker not found")
        if sticker[1]:
            raise HTTPException(status_code=409, detail="Sticker is already archived")

        cursor.execute(t"UPDATE stickers SET archived = TRUE WHERE id = {sticker_id}")
        conn.commit()
        return {"message": f"Sticker {sticker_id} archived successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()


@router.patch("/stickers/{sticker_id}/unarchive", status_code=200)
def unarchive_sticker(
    sticker_id: int,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Unarchive a sticker, making it visible on the map again. Editor/admin only."""
    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id, archived FROM stickers WHERE id = {sticker_id}")
        sticker = cursor.fetchone()
        if not sticker:
            raise HTTPException(status_code=404, detail="Sticker not found")
        if not sticker[1]:
            raise HTTPException(status_code=409, detail="Sticker is not archived")

        cursor.execute(t"UPDATE stickers SET archived = FALSE WHERE id = {sticker_id}")
        conn.commit()
        return {"message": f"Sticker {sticker_id} unarchived successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
