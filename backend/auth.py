from datetime import datetime, timedelta
from typing import Optional

import jwt
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.algorithms import RSAAlgorithm
from jwt.exceptions import PyJWTError

from environment import Config
from logger import get_logger

logger = get_logger(__name__)

security = HTTPBearer(auto_error=False)

# Role constants (sm- prefix avoids collision with Keycloak built-in roles)
ROLE_VIEWER = "sm-viewer"
ROLE_UPLOADER = "sm-uploader"
ROLE_EDITOR = "sm-editor"
ROLE_ADMIN = "sm-admin"

ALL_ROLES = [ROLE_ADMIN, ROLE_EDITOR, ROLE_UPLOADER, ROLE_VIEWER]


def get_user_roles(user: dict) -> list[str]:
    """Extract realm roles from decoded JWT token."""
    realm_access = user.get("realm_access", {})
    return realm_access.get("roles", [])


def get_user_identity(user: dict) -> str:
    """Extract user identity from JWT for ownership tracking."""
    return user.get("preferred_username", "unknown")


class KeycloakPublicKeyManager:
    """Manages fetching and caching of Keycloak public keys for JWT validation"""

    def __init__(self):
        self._keys = None
        self._last_fetch = None
        self._ttl = timedelta(hours=1)

    def get_public_keys(self):
        """Fetch public keys from Keycloak JWKS endpoint with caching"""
        if self._keys and self._last_fetch:
            if datetime.now() - self._last_fetch < self._ttl:
                return self._keys

        # Use internal URL for fetching keys (container-to-container communication)
        url = f"{Config.KEYCLOAK_INTERNAL_URL}/realms/{Config.KEYCLOAK_REALM}/protocol/openid-connect/certs"

        try:
            logger.debug("Fetching Keycloak public keys from %s", url)
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            self._keys = response.json()
            self._last_fetch = datetime.now()
            logger.info("Keycloak public keys fetched successfully")
            return self._keys
        except requests.RequestException as e:
            logger.error("Failed to fetch Keycloak public keys: %s", e)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to fetch Keycloak public keys: {str(e)}",
            )


key_manager = KeycloakPublicKeyManager()


def decode_token(token: str) -> dict:
    """Decode and validate JWT token using Keycloak public keys"""
    try:
        # Get public keys from Keycloak
        jwks = key_manager.get_public_keys()

        # Decode token header to get the key ID
        unverified_header = jwt.get_unverified_header(token)

        # Find the matching public key
        rsa_key = None
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = key
                break

        if not rsa_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unable to find appropriate signing key",
            )

        # Decode and validate the token
        public_key = RSAAlgorithm.from_jwk(rsa_key)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=Config.KEYCLOAK_CLIENT_ID,
            issuer=f"{Config.KEYCLOAK_URL}/realms/{Config.KEYCLOAK_REALM}",
        )
        return payload

    except PyJWTError as e:
        logger.warning("JWT validation failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """Extract and validate user from Bearer token"""
    if not credentials:
        return None

    token = credentials.credentials
    return decode_token(token)


async def require_auth(
    current_user: Optional[dict] = Depends(get_current_user),
) -> dict:
    """Require authentication for protected endpoints."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return current_user


def require_role(role: str):
    """FastAPI dependency factory that requires a specific realm role."""

    async def role_dependency(
        current_user: Optional[dict] = Depends(get_current_user),
    ) -> dict:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check if user has the required role
        user_roles = get_user_roles(current_user)
        if role not in user_roles:
            logger.warning(
                "Access denied: required role '%s' not in user roles %s", role, user_roles
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {role}",
            )

        return current_user

    return role_dependency
