import os
import uuid
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps

from core.auth import ROLE_ADMIN, require_role
from core.config import Config
from core.connections import get_pool
from core.logger import get_logger
from file_handlers import ImageProcessor

logger = get_logger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

_jobs: dict[str, dict] = {}


def _new_job() -> tuple[str, dict]:
    job_id = str(uuid.uuid4())
    job: dict = {
        "status": "running",
        "processed": 0,
        "total": 0,
        "errors": [],
        "started_at": datetime.now(UTC).isoformat(),
        "finished_at": None,
    }
    _jobs[job_id] = job
    return job_id, job


def _finish_job(job: dict) -> None:
    job["status"] = "error" if job["errors"] else "done"
    job["finished_at"] = datetime.now(UTC).isoformat()


@router.get("/stats")
def get_admin_stats(_: dict = Depends(require_role(ROLE_ADMIN))):
    """Return health counts for the admin dashboard."""
    upload_dir = Config.UPLOAD_DIR
    with get_pool().connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id, image, thumbnail FROM stickers")
            rows = cursor.fetchall()
            total = len(rows)
            missing_thumb_db = sum(1 for _, __, t in rows if not t)
            missing_full_file = sum(
                1 for _, img, __ in rows
                if img and not os.path.exists(os.path.join(upload_dir, img))
            )
            missing_thumb_file = sum(
                1 for _, __, t in rows
                if t and not os.path.exists(os.path.join(upload_dir, t))
            )
            cursor.execute("SELECT COUNT(*) FROM stickers WHERE location IS NULL")
            missing_gps = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM stickers WHERE archived = TRUE")
            archived = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM stickers WHERE private = TRUE")
            private = cursor.fetchone()[0]
            return {
                "total_stickers": total,
                "missing_thumbnail_db": missing_thumb_db,
                "missing_thumbnail_file": missing_thumb_file,
                "missing_full_image_file": missing_full_file,
                "missing_gps": missing_gps,
                "archived": archived,
                "private": private,
            }
        finally:
            cursor.close()


@router.get("/audit")
def get_admin_audit(_: dict = Depends(require_role(ROLE_ADMIN))):
    """List stickers whose image or thumbnail files are missing from disk."""
    upload_dir = Config.UPLOAD_DIR
    with get_pool().connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id, image, thumbnail FROM stickers ORDER BY id")
            rows = cursor.fetchall()
            result = []
            for sid, image, thumbnail in rows:
                missing_image = bool(image and not os.path.exists(os.path.join(upload_dir, image)))
                missing_thumbnail = bool(thumbnail and not os.path.exists(os.path.join(upload_dir, thumbnail)))
                if missing_image or missing_thumbnail:
                    result.append({
                        "id": sid,
                        "image": image,
                        "thumbnail": thumbnail,
                        "missing_image": missing_image,
                        "missing_thumbnail": missing_thumbnail,
                    })
            return result
        finally:
            cursor.close()


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str, _: dict = Depends(require_role(ROLE_ADMIN))):
    if job_id not in _jobs:
        return JSONResponse(status_code=404, content={"detail": "Job not found"})
    return _jobs[job_id]


# ---------- generate-thumbnails ----------

def _task_generate_thumbnails(job: dict, upload_dir: str) -> None:
    try:
        with get_pool().connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, image, thumbnail FROM stickers")
            rows = cursor.fetchall()

            to_process = [
                (sid, img)
                for sid, img, thumb in rows
                if img and (not thumb or not os.path.exists(os.path.join(upload_dir, thumb)))
            ]
            job["total"] = len(to_process)

            fmt = Config.IMAGE_FORMAT
            ext = "jpg" if fmt == "JPEG" else fmt.lower()

            for sid, image_filename in to_process:
                try:
                    image_path = os.path.join(upload_dir, image_filename)
                    if not os.path.exists(image_path):
                        job["errors"].append(f"Sticker {sid}: image file not found")
                        job["processed"] += 1
                        continue

                    with open(image_path, "rb") as f:
                        image_bytes = f.read()

                    img = Image.open(BytesIO(image_bytes))
                    img = ImageOps.exif_transpose(img)
                    if fmt.upper() == "JPEG" and img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")

                    thumb = img.copy()
                    thumb.thumbnail((Config.THUMBNAIL_SIZE, Config.THUMBNAIL_SIZE), Image.LANCZOS)
                    save_kwargs: dict = {"format": fmt}
                    if fmt.upper() in ("JPEG", "WEBP"):
                        save_kwargs["quality"] = Config.IMAGE_QUALITY
                        save_kwargs["optimize"] = True
                    thumb_buf = BytesIO()
                    thumb.save(thumb_buf, **save_kwargs)

                    base_name = Path(image_filename).stem
                    thumb_filename = f"{base_name}_thumb.{ext}"
                    thumb_path = os.path.join(upload_dir, thumb_filename)
                    with open(thumb_path, "wb") as f:
                        f.write(thumb_buf.getvalue())

                    cursor.execute(t"UPDATE stickers SET thumbnail = {thumb_filename} WHERE id = {sid}")
                    conn.commit()
                    job["processed"] += 1

                except Exception as e:
                    job["errors"].append(f"Sticker {sid}: {e}")
                    job["processed"] += 1

            cursor.close()
    except Exception as e:
        job["errors"].append(str(e))

    _finish_job(job)


@router.post("/jobs/generate-thumbnails", status_code=202)
def start_generate_thumbnails(
    background_tasks: BackgroundTasks,
    _: dict = Depends(require_role(ROLE_ADMIN)),
):
    job_id, job = _new_job()
    background_tasks.add_task(_task_generate_thumbnails, job, Config.UPLOAD_DIR)
    return {"job_id": job_id}


# ---------- compress-images ----------

def _task_compress_images(job: dict, upload_dir: str) -> None:
    """Re-compress only images whose longest edge exceeds IMAGE_MAX_SIZE."""
    try:
        with get_pool().connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, image FROM stickers WHERE image IS NOT NULL")
            rows = cursor.fetchall()

            max_size = Config.IMAGE_MAX_SIZE
            to_process = []
            for sid, image_filename in rows:
                image_path = os.path.join(upload_dir, image_filename)
                if not os.path.exists(image_path):
                    continue
                try:
                    with Image.open(image_path) as img:
                        w, h = img.size
                    if max(w, h) > max_size:
                        to_process.append((sid, image_filename))
                except Exception:
                    pass

            job["total"] = len(to_process)
            fmt = Config.IMAGE_FORMAT
            ext = "jpg" if fmt == "JPEG" else fmt.lower()

            for sid, image_filename in to_process:
                try:
                    image_path = os.path.join(upload_dir, image_filename)
                    with open(image_path, "rb") as f:
                        image_bytes = f.read()

                    full_bytes, thumb_bytes = ImageProcessor.process(
                        image_bytes,
                        max_size=max_size,
                        thumbnail_size=Config.THUMBNAIL_SIZE,
                        fmt=fmt,
                        quality=Config.IMAGE_QUALITY,
                    )
                    with open(image_path, "wb") as f:
                        f.write(full_bytes)

                    base_name = Path(image_filename).stem
                    thumb_filename = f"{base_name}_thumb.{ext}"
                    thumb_path = os.path.join(upload_dir, thumb_filename)
                    with open(thumb_path, "wb") as f:
                        f.write(thumb_bytes)

                    # Only update DB if thumbnail was previously missing
                    cursor.execute(
                        t"UPDATE stickers SET thumbnail = {thumb_filename} WHERE id = {sid} AND thumbnail IS NULL"
                    )
                    conn.commit()
                    job["processed"] += 1

                except Exception as e:
                    job["errors"].append(f"Sticker {sid}: {e}")
                    job["processed"] += 1

            cursor.close()
    except Exception as e:
        job["errors"].append(str(e))

    _finish_job(job)


@router.post("/jobs/compress-images", status_code=202)
def start_compress_images(
    background_tasks: BackgroundTasks,
    _: dict = Depends(require_role(ROLE_ADMIN)),
):
    job_id, job = _new_job()
    background_tasks.add_task(_task_compress_images, job, Config.UPLOAD_DIR)
    return {"job_id": job_id}


# ---------- strip-exif ----------

def _task_strip_exif(job: dict, upload_dir: str) -> None:
    """Re-save all images without EXIF metadata. Regenerates thumbnails."""
    try:
        with get_pool().connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, image, thumbnail FROM stickers WHERE image IS NOT NULL")
            rows = cursor.fetchall()
            job["total"] = len(rows)

            fmt = Config.IMAGE_FORMAT

            for sid, image_filename, thumb_filename in rows:
                try:
                    image_path = os.path.join(upload_dir, image_filename)
                    if not os.path.exists(image_path):
                        job["errors"].append(f"Sticker {sid}: image file not found")
                        job["processed"] += 1
                        continue

                    img = Image.open(image_path)
                    img = ImageOps.exif_transpose(img)
                    if fmt.upper() == "JPEG" and img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")

                    save_kwargs: dict = {"format": fmt}
                    if fmt.upper() in ("JPEG", "WEBP"):
                        save_kwargs["quality"] = Config.IMAGE_QUALITY
                        save_kwargs["optimize"] = True

                    # Save full image without EXIF (Pillow strips EXIF by default)
                    img.save(image_path, **save_kwargs)

                    if thumb_filename:
                        thumb_path = os.path.join(upload_dir, thumb_filename)
                        thumb = img.copy()
                        thumb.thumbnail((Config.THUMBNAIL_SIZE, Config.THUMBNAIL_SIZE), Image.LANCZOS)
                        thumb_buf = BytesIO()
                        thumb.save(thumb_buf, **save_kwargs)
                        with open(thumb_path, "wb") as f:
                            f.write(thumb_buf.getvalue())

                    job["processed"] += 1

                except Exception as e:
                    job["errors"].append(f"Sticker {sid}: {e}")
                    job["processed"] += 1

            cursor.close()
    except Exception as e:
        job["errors"].append(str(e))

    _finish_job(job)


@router.post("/jobs/strip-exif", status_code=202)
def start_strip_exif(
    background_tasks: BackgroundTasks,
    _: dict = Depends(require_role(ROLE_ADMIN)),
):
    job_id, job = _new_job()
    background_tasks.add_task(_task_strip_exif, job, Config.UPLOAD_DIR)
    return {"job_id": job_id}


# ---------- cleanup-orphans ----------

def _task_cleanup_orphans(job: dict, upload_dir: str) -> None:
    """Delete files in uploads/ not referenced by any sticker or report."""
    try:
        with get_pool().connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT image, thumbnail FROM stickers")
            sticker_files = {f for row in cursor.fetchall() for f in row if f}
            cursor.execute("SELECT proof_image FROM removal_reports WHERE proof_image IS NOT NULL")
            report_files = {row[0] for row in cursor.fetchall()}
            referenced = sticker_files | report_files

            try:
                all_files = [f.name for f in Path(upload_dir).iterdir() if f.is_file()]
            except Exception as e:
                job["errors"].append(f"Could not list upload dir: {e}")
                _finish_job(job)
                return

            orphans = [f for f in all_files if f not in referenced]
            job["total"] = len(orphans)

            for filename in orphans:
                try:
                    os.remove(os.path.join(upload_dir, filename))
                    job["processed"] += 1
                except Exception as e:
                    job["errors"].append(f"{filename}: {e}")
                    job["processed"] += 1

            cursor.close()
    except Exception as e:
        job["errors"].append(str(e))

    _finish_job(job)


@router.post("/jobs/cleanup-orphans", status_code=202)
def start_cleanup_orphans(
    background_tasks: BackgroundTasks,
    _: dict = Depends(require_role(ROLE_ADMIN)),
):
    job_id, job = _new_job()
    background_tasks.add_task(_task_cleanup_orphans, job, Config.UPLOAD_DIR)
    return {"job_id": job_id}
