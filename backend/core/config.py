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
    IMAGE_FORMAT = os.getenv("IMAGE_FORMAT", "JPEG").upper()  # JPEG, WEBP, or PNG
    IMAGE_QUALITY = int(os.getenv("IMAGE_QUALITY", "85"))
    IMAGE_MAX_SIZE = int(os.getenv("IMAGE_MAX_SIZE", "1920"))
    THUMBNAIL_SIZE = int(os.getenv("THUMBNAIL_SIZE", "400"))

    # HQ: the point distances are measured from, and where the map starts when nothing else is known.
    # Defaults to the Onze Lieve Vrouwetoren in Amersfoort, the origin of the Dutch national grid (RD).
    HQ_LAT = float(os.getenv("HQ_LAT", "52.155174"))
    HQ_LON = float(os.getenv("HQ_LON", "5.387206"))

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

    @staticmethod
    def validate_hq():
        """Validate the HQ coordinates the distance leaderboard measures from"""
        if not (-90 <= Config.HQ_LAT <= 90 and -180 <= Config.HQ_LON <= 180):
            raise ValueError(f"HQ_LAT/HQ_LON out of range: {Config.HQ_LAT}, {Config.HQ_LON}")
