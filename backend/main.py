import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import Config
from core.logger import get_logger, setup_logging
from routers import admin, categories, reports, stickers

load_dotenv()

setup_logging()
logger = get_logger(__name__)

Config.validate_db()
Config.validate_keycloak()

url_prefix = "/api/v1"

app = FastAPI(
    title="StickerMap API",
    version="1.17.0",
    debug=True,
    docs_url=url_prefix + "/docs",
    redoc_url=url_prefix + "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ALLOWED_ORIGINS,
    allow_credentials=Config.CORS_ALLOW_CREDENTIALS,
    allow_methods=Config.CORS_ALLOWED_METHODS,
    allow_headers=Config.CORS_ALLOWED_HEADERS,
)

app.include_router(stickers.router, prefix=url_prefix)
app.include_router(reports.router, prefix=url_prefix)
app.include_router(categories.router, prefix=url_prefix)
app.include_router(admin.router, prefix=url_prefix)

upload_dir = os.getenv("UPLOAD_DIR", "uploads")
Path(upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

