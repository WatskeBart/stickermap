import json
import logging
import os

import psycopg
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

load_dotenv()
logger.info("Environment variables loaded from .env file")

dataset_path = os.getenv("DATASET_PATH")


def get_db_connection():
    logger.debug("Validating database environment variables...")
    required_keys = ["DB_HOST", "DB_PORT", "DB_DBNAME", "DB_USER", "DB_PASSWORD"]

    missing_keys = [key for key in required_keys if not os.getenv(key)]
    if missing_keys:
        logger.error(f"Missing required environment variables: {', '.join(missing_keys)}")
        raise ValueError("Missing required database environment variables")

    logger.debug(f"Connecting to database at {os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_DBNAME')}")
    logger.debug(f"Using database user: {os.getenv('DB_USER')}")

    try:
        conn = psycopg.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_DBNAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            connect_timeout=3,
        )
        logger.info("Successfully connected to database")
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {e}")
        raise


def migrate_json_to_db():
    """Migrate stickers from JSON file to PostgreSQL"""
    logger.info("Starting sticker data migration...")

    # Read JSON file
    json_file_path = dataset_path + "/stickers.json"
    logger.debug(f"Reading sticker data from: {json_file_path}")

    with open(json_file_path, "r") as file:
        data = json.load(file)

    sticker_count = len(data["stickers"])
    logger.info(f"Loaded {sticker_count} stickers from JSON file")

    conn = get_db_connection()
    cur = conn.cursor()

    logger.debug("Beginning sticker insertion...")
    for idx, sticker in enumerate(data["stickers"], 1):
        if idx % 10 == 0 or idx == 1:
            logger.debug(f"Inserting sticker {idx}/{sticker_count}")

        cur.execute(
            """
            INSERT INTO stickers (location, poster, uploader, post_date, upload_date, image)
            VALUES (
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s, %s, %s, %s
            );
        """,
            (
                sticker["location"]["lon"],
                sticker["location"]["lat"],
                sticker["poster"],
                sticker["uploader"],
                sticker["post_date"],
                sticker["upload_date"],
                sticker["image"],
            ),
        )

    logger.debug("Committing transaction...")
    conn.commit()
    logger.debug("Closing database cursor and connection...")
    cur.close()
    conn.close()
    logger.info(f"✓ Successfully migrated {sticker_count} stickers to database")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Starting StickerMap Data Migration")
    logger.info("=" * 60)
    try:
        migrate_json_to_db()
    except Exception as e:
        logger.error(f"Data migration failed: {e}")
        raise
