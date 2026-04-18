"""Tests for auth.py – role helpers, identity extraction, and require_role dependency."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException

from auth import (
    ROLE_ADMIN,
    ROLE_EDITOR,
    ROLE_UPLOADER,
    ROLE_VIEWER,
    KeycloakPublicKeyManager,
    get_user_identity,
    get_user_roles,
    require_role,
)
from conftest import make_user


# ── get_user_roles ────────────────────────────────────────────────────────────

class TestGetUserRoles:
    def test_returns_roles_from_resource_access(self):
        user = make_user([ROLE_VIEWER, ROLE_UPLOADER])
        assert get_user_roles(user) == [ROLE_VIEWER, ROLE_UPLOADER]

    def test_returns_empty_list_when_no_resource_access(self):
        assert get_user_roles({}) == []

    def test_returns_empty_list_when_client_key_missing(self):
        user = {"resource_access": {}}
        assert get_user_roles(user) == []

    def test_returns_empty_list_for_empty_roles(self):
        user = make_user([])
        assert get_user_roles(user) == []


# ── get_user_identity ─────────────────────────────────────────────────────────

class TestGetUserIdentity:
    def test_returns_preferred_username(self):
        user = {"preferred_username": "alice"}
        assert get_user_identity(user) == "alice"

    def test_returns_unknown_when_missing(self):
        assert get_user_identity({}) == "unknown"

    def test_returns_empty_string_username(self):
        user = {"preferred_username": ""}
        assert get_user_identity(user) == ""


# ── require_role dependency ───────────────────────────────────────────────────

class TestRequireRole:
    """require_role returns an async dependency; run it directly with pytest-asyncio."""

    @pytest.mark.asyncio
    async def test_allows_user_with_required_role(self):
        user = make_user([ROLE_UPLOADER])
        dep = require_role(ROLE_UPLOADER)

        # Simulate FastAPI resolving get_current_user → user
        result = await dep(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_allows_admin_when_admin_required(self):
        user = make_user([ROLE_ADMIN])
        dep = require_role(ROLE_ADMIN)
        result = await dep(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_raises_403_when_role_missing(self):
        user = make_user([ROLE_VIEWER])
        dep = require_role(ROLE_UPLOADER)

        with pytest.raises(HTTPException) as exc_info:
            await dep(current_user=user)

        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_raises_401_when_no_user(self):
        dep = require_role(ROLE_VIEWER)

        with pytest.raises(HTTPException) as exc_info:
            await dep(current_user=None)

        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_allows_user_with_editor_role(self):
        user = make_user([ROLE_EDITOR])
        dep = require_role(ROLE_EDITOR)
        result = await dep(current_user=user)
        assert result == user

    @pytest.mark.asyncio
    async def test_role_check_is_exact(self):
        """viewer role does NOT satisfy uploader requirement (no hierarchy in backend)."""
        user = make_user([ROLE_VIEWER])
        dep = require_role(ROLE_UPLOADER)

        with pytest.raises(HTTPException) as exc_info:
            await dep(current_user=user)

        assert exc_info.value.status_code == 403


# ── KeycloakPublicKeyManager ──────────────────────────────────────────────────

class TestKeycloakPublicKeyManager:
    def test_fetches_keys_on_first_call(self):
        manager = KeycloakPublicKeyManager()
        mock_response = MagicMock()
        mock_response.json.return_value = {"keys": [{"kid": "abc"}]}

        with patch("auth.requests.get", return_value=mock_response) as mock_get:
            keys = manager.get_public_keys()

        mock_get.assert_called_once()
        assert keys == {"keys": [{"kid": "abc"}]}

    def test_returns_cached_keys_within_ttl(self):
        manager = KeycloakPublicKeyManager()
        mock_response = MagicMock()
        mock_response.json.return_value = {"keys": []}

        with patch("auth.requests.get", return_value=mock_response) as mock_get:
            manager.get_public_keys()
            manager.get_public_keys()

        # Second call should use cache — only one HTTP request made
        assert mock_get.call_count == 1

    def test_raises_503_when_keycloak_unreachable(self):
        import requests as req_lib

        manager = KeycloakPublicKeyManager()

        with patch("auth.requests.get", side_effect=req_lib.RequestException("timeout")):
            with pytest.raises(HTTPException) as exc_info:
                manager.get_public_keys()

        assert exc_info.value.status_code == 503
