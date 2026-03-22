"""Tests for main.py API endpoints using FastAPI's TestClient with mocked dependencies."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from auth import ROLE_ADMIN, ROLE_EDITOR, ROLE_UPLOADER, ROLE_VIEWER, get_current_user
from conftest import make_user, make_png_bytes
from main import app, get_db


# ── Dependency override helpers ───────────────────────────────────────────────

def _override_db(conn):
    def _get_db():
        yield conn
    return _get_db


def _mock_conn(rows=None, fetchone_row=None):
    """Build a mock psycopg connection + cursor."""
    cursor = MagicMock()
    cursor.fetchall.return_value = rows or []
    cursor.fetchone.return_value = fetchone_row
    conn = MagicMock()
    conn.cursor.return_value = cursor
    return conn, cursor


# ── Session-level fixtures ────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_overrides():
    """
    Always reset dependency overrides after each test so tests don't bleed
    into each other.  get_db is always mocked so the real DB is never touched.
    """
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def db():
    """A fresh mock DB connection + cursor, with get_db wired in."""
    conn, cursor = _mock_conn()
    app.dependency_overrides[get_db] = _override_db(conn)
    return conn, cursor


def set_user(user):
    """Override get_current_user to return *user* (or None for anonymous)."""
    app.dependency_overrides[get_current_user] = lambda: user


# ── GET /api/v1/ ──────────────────────────────────────────────────────────────

class TestIndex:
    def test_returns_welcome_message(self):
        with TestClient(app) as client:
            resp = client.get("/api/v1/")
        assert resp.status_code == 200
        assert "message" in resp.json()


# ── GET /api/v1/get_all_stickers ──────────────────────────────────────────────

class TestGetAllStickers:
    def test_returns_list(self, db):
        conn, cursor = db
        cursor.fetchall.return_value = [
            (1, '{"type":"Point","coordinates":[13.4,52.5]}', "Artist",
            "user1", "2024-01-01", "2024-01-02", "img.jpg", "user1"),
        ]
        with TestClient(app) as client:
            resp = client.get("/api/v1/get_all_stickers")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_returns_empty_list_when_no_stickers(self, db):
        with TestClient(app) as client:
            resp = client.get("/api/v1/get_all_stickers")
        assert resp.status_code == 200
        assert resp.json() == []


# ── GET /api/v1/get_sticker/{id} ──────────────────────────────────────────────

class TestGetSticker:
    def test_returns_sticker_when_found(self, db):
        conn, cursor = db
        set_user(make_user([ROLE_UPLOADER]))
        cursor.fetchone.return_value = (
            1, '{"type":"Point","coordinates":[13.4,52.5]}',
            "Artist", "user1", "2024-01-01", "2024-01-02", "img.jpg", "user1",
        )
        with TestClient(app) as client:
            resp = client.get("/api/v1/get_sticker/1")
        assert resp.status_code == 200

    def test_returns_404_when_not_found(self, db):
        conn, cursor = db
        set_user(make_user([ROLE_UPLOADER]))
        cursor.fetchone.return_value = None
        with TestClient(app) as client:
            resp = client.get("/api/v1/get_sticker/999")
        assert resp.status_code == 404


# ── GET /api/v1/uploaders ─────────────────────────────────────────────────────

class TestGetUploaders:
    def test_returns_uploader_list(self, db):
        conn, cursor = db
        set_user(make_user([ROLE_UPLOADER]))
        cursor.fetchall.return_value = [("alice",), ("bob",)]
        with TestClient(app) as client:
            resp = client.get("/api/v1/uploaders")
        assert resp.status_code == 200
        assert resp.json() == {"uploaders": ["alice", "bob"]}

    def test_returns_empty_uploaders_list(self, db):
        set_user(make_user([ROLE_UPLOADER]))
        with TestClient(app) as client:
            resp = client.get("/api/v1/uploaders")
        assert resp.status_code == 200
        assert resp.json() == {"uploaders": []}


# ── POST /api/v1/upload ───────────────────────────────────────────────────────

class TestUpload:
    def test_returns_401_without_auth(self, db):
        set_user(None)
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/upload",
                files={"file": ("test.png", make_png_bytes(), "image/png")},
            )
        assert resp.status_code == 401

    def test_upload_valid_png_returns_200(self, db, tmp_path):
        set_user(make_user([ROLE_UPLOADER]))
        with (
            patch("main.os.getenv", return_value=str(tmp_path)),
            patch("main.GPSExtractor.extract", return_value={}),
        ):
            with TestClient(app) as client:
                resp = client.post(
                    "/api/v1/upload",
                    files={"file": ("photo.png", make_png_bytes(), "image/png")},
                )
        assert resp.status_code == 200
        data = resp.json()
        assert "filename" in data
        assert "gps_info" in data

    def test_upload_invalid_mime_returns_400(self, db):
        set_user(make_user([ROLE_UPLOADER]))
        with TestClient(app) as client:
            resp = client.post(
                "/api/v1/upload",
                files={"file": ("doc.pdf", b"%PDF-1.4 fake", "application/pdf")},
            )
        assert resp.status_code == 400


# ── POST /api/v1/create_sticker ───────────────────────────────────────────────

class TestCreateSticker:
    _payload = {
        "stickers": [{
            "location": {"lon": 13.4, "lat": 52.5},
            "poster": "Artist",
            "uploader": "user1",
            "post_date": "2024-01-01T00:00:00Z",
            "image": "photo.jpg",
        }]
    }

    def test_returns_401_without_auth(self, db):
        set_user(None)
        with TestClient(app) as client:
            resp = client.post("/api/v1/create_sticker", json=self._payload)
        assert resp.status_code == 401

    def test_creates_sticker_with_uploader_role(self, db):
        set_user(make_user([ROLE_UPLOADER], username="user1"))
        with TestClient(app) as client:
            resp = client.post("/api/v1/create_sticker", json=self._payload)
        assert resp.status_code == 201
        assert resp.json()["message"] == "Sticker(s) successfully added"

    def test_returns_403_with_viewer_role(self, db):
        set_user(make_user([ROLE_VIEWER]))
        with TestClient(app) as client:
            resp = client.post("/api/v1/create_sticker", json=self._payload)
        assert resp.status_code == 403


# ── PATCH /api/v1/sticker/{id} ───────────────────────────────────────────────

class TestUpdateSticker:
    def test_returns_401_without_auth(self, db):
        set_user(None)
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/1", json={"poster": "New"})
        assert resp.status_code == 401

    def test_uploader_can_edit_own_sticker(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = (1, "owner")
        set_user(make_user([ROLE_UPLOADER], username="owner"))
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/1", json={"poster": "Updated"})
        assert resp.status_code == 200

    def test_uploader_cannot_edit_others_sticker(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = (1, "actualowner")
        set_user(make_user([ROLE_UPLOADER], username="nottheowner"))
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/1", json={"poster": "Sneaky"})
        assert resp.status_code == 403

    def test_editor_can_edit_any_sticker(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = (1, "someoneelse")
        set_user(make_user([ROLE_UPLOADER, ROLE_EDITOR], username="editor"))
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/1", json={"poster": "Editor edit"})
        assert resp.status_code == 200

    def test_uploader_cannot_change_uploader_field(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = (1, "owner")
        set_user(make_user([ROLE_UPLOADER], username="owner"))
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/1", json={"uploader": "hackedin"})
        assert resp.status_code == 403

    def test_admin_can_change_uploader_field(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = (1, "owner")
        set_user(make_user([ROLE_UPLOADER, ROLE_EDITOR, ROLE_ADMIN], username="admin"))
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/1", json={"uploader": "newuploader"})
        assert resp.status_code == 200

    def test_returns_400_when_no_fields_provided(self, db):
        set_user(make_user([ROLE_UPLOADER], username="owner"))
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/1", json={})
        assert resp.status_code == 400

    def test_returns_404_when_sticker_not_found(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = None
        set_user(make_user([ROLE_UPLOADER], username="owner"))
        with TestClient(app) as client:
            resp = client.patch("/api/v1/sticker/999", json={"poster": "X"})
        assert resp.status_code == 404


# ── DELETE /api/v1/sticker/{id} ──────────────────────────────────────────────

class TestDeleteSticker:
    def test_returns_401_without_auth(self, db):
        set_user(None)
        with TestClient(app) as client:
            resp = client.delete("/api/v1/sticker/1")
        assert resp.status_code == 401

    def test_returns_403_with_non_admin_role(self, db):
        set_user(make_user([ROLE_UPLOADER]))
        with TestClient(app) as client:
            resp = client.delete("/api/v1/sticker/1")
        assert resp.status_code == 403

    def test_admin_can_delete_sticker(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = (1, None)
        set_user(make_user([ROLE_ADMIN], username="admin"))
        with TestClient(app) as client:
            resp = client.delete("/api/v1/sticker/1")
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"]

    def test_returns_404_when_sticker_not_found(self, db):
        conn, cursor = db
        cursor.fetchone.return_value = None
        set_user(make_user([ROLE_ADMIN], username="admin"))
        with TestClient(app) as client:
            resp = client.delete("/api/v1/sticker/999")
        assert resp.status_code == 404

    def test_deletes_associated_image_file(self, db, tmp_path):
        img_file = tmp_path / "sticker.jpg"
        img_file.write_bytes(b"fake image")

        conn, cursor = db
        cursor.fetchone.return_value = (1, "sticker.jpg")
        set_user(make_user([ROLE_ADMIN], username="admin"))

        with patch("main.os.getenv", return_value=str(tmp_path)):
            with TestClient(app) as client:
                resp = client.delete("/api/v1/sticker/1")

        assert resp.status_code == 200
        assert not img_file.exists()
