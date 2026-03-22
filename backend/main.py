import os
import secrets
import uvicorn
from datetime import UTC, datetime
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from logger import get_logger, setup_logging
from auth import ROLE_ADMIN, ROLE_EDITOR, ROLE_UPLOADER, ROLE_VIEWER, get_current_user, get_user_identity, get_user_roles, require_role
from connections import DatabaseManager
from environment import Config
from file_handlers import FileValidator, GPSExtractor
from models import CreateStickersRequest, UpdateStickerRequest

load_dotenv()

setup_logging()
logger = get_logger(__name__)

Config.validate_db()
Config.validate_keycloak()

url_prefix = "/api/v1"

app = FastAPI(
    title="StickerMap API",
    version="1.3.2",
    debug=True,
    docs_url=url_prefix + "/docs",
    redoc_url=url_prefix + "/redoc",
)

# Configure CORS from environment variables
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ALLOWED_ORIGINS,
    allow_credentials=Config.CORS_ALLOW_CREDENTIALS,
    allow_methods=Config.CORS_ALLOWED_METHODS,
    allow_headers=Config.CORS_ALLOWED_HEADERS,
)

router = APIRouter(prefix=url_prefix)


def get_db():
    conn = DatabaseManager.get_connection()
    try:
        yield conn
    finally:
        conn.close()


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
    filename = f"{timestamp}_{random_suffix}.{file.filename.split('.')[-1]}"
    file_path = os.path.join(upload_dir, filename)

    try:
        with open(file_path, "wb") as f:
            f.write(contents)

        gps_info = GPSExtractor.extract(file_path)

        return {
            "message": f"Successfully uploaded {file.filename}",
            "filename": filename,
            "gps_info": gps_info,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    finally:
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
            cursor.execute(t"""
                INSERT INTO stickers (location, poster, uploader, post_date, upload_date, image, uploaded_by)
                VALUES (
                    ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326),
                    {poster}, {uploader}, {post_date}, {upload_date}, {image}, {uploaded_by}
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
    """Retrieve all stickers. Poster, uploader and uploaded_by fields are omitted for non-viewers."""
    is_viewer = ROLE_VIEWER in get_user_roles(current_user) if current_user else False
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, ST_AsGeoJSON(location), poster, uploader, post_date, upload_date, image, uploaded_by FROM stickers"
        )
        rows = cursor.fetchall()
        if not is_viewer:
            rows = [(r[0], r[1], None, None, r[4], r[5], r[6], None) for r in rows]
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
            t"SELECT id, ST_AsGeoJSON(location), poster, uploader, post_date, upload_date, image, uploaded_by FROM stickers WHERE id = {id}"
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
    update_data = request.model_dump(exclude_none=True)

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

        params.append(sticker_id)

        query = (
            f"UPDATE stickers SET {', '.join(set_clauses)} WHERE id = %s RETURNING id"
        )
        cursor.execute(query, tuple(params))
        conn.commit()

        return {"message": f"Sticker {sticker_id} updated successfully"}
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
        cursor.execute("SELECT COUNT(*) FROM stickers")
        total = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM stickers WHERE DATE_TRUNC('month', upload_date) = DATE_TRUNC('month', NOW())"
        )
        stickers_this_month = cursor.fetchone()[0]

        cursor.execute(
            "SELECT poster, COUNT(*) as cnt FROM stickers GROUP BY poster ORDER BY cnt DESC LIMIT 1"
        )
        top_row = cursor.fetchone()
        top_poster = {"name": top_row[0], "count": top_row[1]} if (top_row and is_viewer) else None

        cursor.execute(
            "SELECT uploaded_by, COUNT(*) as cnt FROM stickers WHERE uploaded_by IS NOT NULL GROUP BY uploaded_by ORDER BY cnt DESC LIMIT 1"
        )
        top_uploader_row = cursor.fetchone()
        top_uploader = {"name": top_uploader_row[0], "count": top_uploader_row[1]} if (top_uploader_row and is_viewer) else None

        cursor.execute("SELECT COUNT(DISTINCT uploaded_by) FROM stickers WHERE uploaded_by IS NOT NULL")
        total_uploaders = cursor.fetchone()[0]

        cursor.execute(
            "SELECT poster, upload_date FROM stickers ORDER BY upload_date DESC LIMIT 1"
        )
        last_row = cursor.fetchone()

        return {
            "total_stickers": total,
            "stickers_this_month": stickers_this_month,
            "top_poster": top_poster,
            "top_uploader": top_uploader,
            "total_uploaders": total_uploaders,
            "last_sticker_date": str(last_row[1].date()) if last_row else None,
            "last_sticker_poster": last_row[0] if (last_row and is_viewer) else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
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

        # Remove associated image file
        image_filename = sticker[1]
        if image_filename:
            image_path = os.path.join(
                os.getenv("UPLOAD_DIR", "uploads"), image_filename
            )
            if os.path.exists(image_path):
                os.remove(image_path)

        return {"message": f"Sticker {sticker_id} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()


app.include_router(router)

# Mount uploads directory for serving static files
upload_dir = os.getenv("UPLOAD_DIR", "uploads")
Path(upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5555)
