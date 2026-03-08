import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_DBNAME = os.getenv("DB_DBNAME", "stickermap")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

    # Keycloak Configuration
    KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "")
    # Internal URL for fetching JWKS (container-to-container)
    KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", KEYCLOAK_URL)
    KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "")
    KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "")
    KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")

    # CORS Configuration
    CORS_ALLOWED_ORIGINS = [
        origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "*").split(",")
    ]
    CORS_ALLOWED_METHODS = [
        method.strip() for method in os.getenv("CORS_ALLOWED_METHODS", "*").split(",")
    ]
    CORS_ALLOWED_HEADERS = [
        header.strip() for header in os.getenv("CORS_ALLOWED_HEADERS", "*").split(",")
    ]
    CORS_ALLOW_CREDENTIALS = (
        os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
    )

    @staticmethod
    def validate_db():
        required = ["DB_HOST", "DB_DBNAME", "DB_USER", "DB_PASSWORD"]
        missing = [key for key in required if not getattr(Config, key)]
        if missing:
            raise ValueError(f"Missing required env vars: {', '.join(missing)}")

    @staticmethod
    def validate_keycloak():
        """Validate Keycloak configuration"""
        required = ["KEYCLOAK_URL", "KEYCLOAK_REALM", "KEYCLOAK_CLIENT_ID"]
        missing = [key for key in required if not getattr(Config, key)]
        if missing:
            raise ValueError(f"Missing Keycloak config: {', '.join(missing)}")
