"""
Shared fixtures and test setup for backend tests.

Env vars must be set before any backend module is imported because environment.py
reads them at class-definition time and main.py validates them at module level.
"""

import io
import os
from unittest.mock import MagicMock, patch

# ── Environment setup (must precede all backend imports) ─────────────────────
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_PORT", "5432")
os.environ.setdefault("DB_DBNAME", "testdb")
os.environ.setdefault("DB_USER", "testuser")
os.environ.setdefault("DB_PASSWORD", "testpass")
os.environ.setdefault("KEYCLOAK_URL", "http://keycloak:8080")
os.environ.setdefault("KEYCLOAK_REALM", "stickermap")
os.environ.setdefault("KEYCLOAK_CLIENT_ID", "stickermap-client")

import pytest
from fastapi.testclient import TestClient
from PIL import Image

# ── App import ────────────────────────────────────────────────────────────────
from main import app


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_user(roles: list[str], username: str = "testuser") -> dict:
    """Build a minimal decoded-JWT dict with the given client roles."""
    client_id = os.environ.get("KEYCLOAK_CLIENT_ID", "stickermap-client")
    return {
        "preferred_username": username,
        "resource_access": {client_id: {"roles": roles}},
    }


def make_png_bytes(width: int = 10, height: int = 10) -> bytes:
    """Return bytes for a tiny valid PNG image."""
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def client() -> TestClient:
    """Plain test client with no dependency overrides."""
    # Clear any overrides left by previous tests
    app.dependency_overrides.clear()
    return TestClient(app)


@pytest.fixture
def mock_db():
    """A mock psycopg connection + cursor ready to be configured per test."""
    cursor = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value = cursor
    return conn, cursor


