import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from core.auth import ROLE_ADMIN, ROLE_EDITOR, ROLE_UPLOADER, get_current_user, get_user_identity, get_user_roles, require_role
from core.logger import get_logger
from dependencies import get_db
from file_handlers import CategoryIconValidator
from models.sticker import CreateCategoryRequest, UpdateCategoryRequest

logger = get_logger(__name__)
router = APIRouter()


def _category_icon_dir() -> str:
    upload_root = os.getenv("UPLOAD_DIR", "uploads")
    icon_dir = os.path.join(upload_root, "categories")
    Path(icon_dir).mkdir(parents=True, exist_ok=True)
    return icon_dir


def _serialize_category(row) -> dict:
    return {
        "id": row[0],
        "name": row[1],
        "icon_filename": row[2],
        "icon_url": f"/uploads/categories/{row[2]}" if row[2] else None,
        "approved": row[3],
        "created_by": row[4],
        "created_at": str(row[5]) if row[5] else None,
        "updated_at": str(row[6]) if row[6] else None,
        "archived_at": str(row[7]) if row[7] else None,
    }


@router.get("/categories")
def list_categories(
    conn=Depends(get_db),
    current_user: dict | None = Depends(get_current_user),
):
    """List categories. Non-editors see only approved + non-archived. Editors/admins see everything."""
    user_roles = get_user_roles(current_user) if current_user else []
    is_moderator = ROLE_EDITOR in user_roles or ROLE_ADMIN in user_roles
    cursor = conn.cursor()
    try:
        if is_moderator:
            cursor.execute("""
                SELECT id, name, icon_filename, approved, created_by, created_at, updated_at, archived_at
                FROM categories
                ORDER BY archived_at NULLS FIRST, approved DESC, name ASC
            """)
        else:
            cursor.execute("""
                SELECT id, name, icon_filename, approved, created_by, created_at, updated_at, archived_at
                FROM categories
                WHERE approved = TRUE AND archived_at IS NULL
                ORDER BY name ASC
            """)
        rows = cursor.fetchall()
        return [_serialize_category(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()


@router.post("/categories", status_code=201)
def create_category(
    request: CreateCategoryRequest,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_UPLOADER)),
):
    """Create a new category (pending approval). Uploaders+ can propose categories."""
    user_roles = get_user_roles(current_user)
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if len(name) > 255:
        raise HTTPException(status_code=400, detail="Name is too long (max 255)")

    created_by = get_user_identity(current_user)
    is_moderator = ROLE_EDITOR in user_roles or ROLE_ADMIN in user_roles
    cursor = conn.cursor()
    try:
        cursor.execute(t"""
            INSERT INTO categories (name, approved, created_by)
            VALUES ({name}, {is_moderator}, {created_by})
            RETURNING id, name, icon_filename, approved, created_by, created_at, updated_at, archived_at
        """)
        row = cursor.fetchone()
        conn.commit()
        return _serialize_category(row)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        msg = str(e)
        if "categories_name_key" in msg or "duplicate key" in msg.lower():
            raise HTTPException(status_code=409, detail="Een categorie met deze naam bestaat al")
        raise HTTPException(status_code=500, detail=f"Database error: {msg}")
    finally:
        cursor.close()


@router.patch("/categories/{category_id}", status_code=200)
def update_category(
    category_id: int,
    request: UpdateCategoryRequest,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Update a category. Rename/archive: editor+. Approval: admin only."""
    user_roles = get_user_roles(current_user)
    is_admin = ROLE_ADMIN in user_roles
    data = request.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "approved" in data and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can approve categories",
        )

    cursor = conn.cursor()
    try:
        cursor.execute(t"SELECT id FROM categories WHERE id = {category_id}")
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Category not found")

        set_clauses = []
        params: list = []
        if "name" in data:
            name = data["name"].strip()
            if not name:
                raise HTTPException(status_code=400, detail="Name cannot be empty")
            if len(name) > 255:
                raise HTTPException(status_code=400, detail="Name is too long (max 255)")
            set_clauses.append("name = %s")
            params.append(name)
        if "approved" in data:
            set_clauses.append("approved = %s")
            params.append(bool(data["approved"]))
        if "archived" in data:
            if data["archived"]:
                set_clauses.append("archived_at = NOW()")
            else:
                set_clauses.append("archived_at = NULL")
        set_clauses.append("updated_at = NOW()")
        params.append(category_id)

        query = (
            f"UPDATE categories SET {', '.join(set_clauses)} WHERE id = %s "
            f"RETURNING id, name, icon_filename, approved, created_by, created_at, updated_at, archived_at"
        )
        cursor.execute(query, tuple(params))
        row = cursor.fetchone()
        conn.commit()
        return _serialize_category(row)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        msg = str(e)
        if "categories_name_key" in msg or "duplicate key" in msg.lower():
            raise HTTPException(status_code=409, detail="Een categorie met deze naam bestaat al")
        raise HTTPException(status_code=500, detail=f"Database error: {msg}")
    finally:
        cursor.close()


@router.post("/categories/{category_id}/icon", status_code=200)
async def upload_category_icon(
    category_id: int,
    file: UploadFile = File(...),
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Upload (or replace) a category icon. SVG preferred, PNG fallback."""
    if file.content_type is None:
        raise HTTPException(status_code=400, detail="File content type is missing")
    contents = await file.read()
    ext = CategoryIconValidator.validate(file.content_type, contents)
    await file.close()

    cursor = conn.cursor()
    try:
        cursor.execute(
            t"SELECT id, icon_filename FROM categories WHERE id = {category_id}"
        )
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Category not found")
        old_filename = existing[1]

        icon_dir = _category_icon_dir()
        new_filename = f"{category_id}.{ext}"
        new_path = os.path.join(icon_dir, new_filename)
        with open(new_path, "wb") as f:
            f.write(contents)

        if old_filename and old_filename != new_filename:
            old_path = os.path.join(icon_dir, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    logger.warning("Failed to remove old category icon %s", old_path)

        cursor.execute(t"""
            UPDATE categories
            SET icon_filename = {new_filename}, updated_at = NOW()
            WHERE id = {category_id}
            RETURNING id, name, icon_filename, approved, created_by, created_at, updated_at, archived_at
        """)
        row = cursor.fetchone()
        conn.commit()
        return _serialize_category(row)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Icon upload failed: {str(e)}")
    finally:
        cursor.close()


@router.delete("/categories/{category_id}/icon", status_code=200)
def delete_category_icon(
    category_id: int,
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_EDITOR)),
):
    """Remove the icon from a category."""
    cursor = conn.cursor()
    try:
        cursor.execute(
            t"SELECT id, icon_filename FROM categories WHERE id = {category_id}"
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Category not found")
        old_filename = row[1]
        if old_filename:
            icon_dir = _category_icon_dir()
            old_path = os.path.join(icon_dir, old_filename)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    logger.warning("Failed to remove category icon %s", old_path)

        cursor.execute(t"""
            UPDATE categories SET icon_filename = NULL, updated_at = NOW()
            WHERE id = {category_id}
            RETURNING id, name, icon_filename, approved, created_by, created_at, updated_at, archived_at
        """)
        updated = cursor.fetchone()
        conn.commit()
        return _serialize_category(updated)
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cursor.close()
