import os

import psycopg
from dotenv import load_dotenv

from logger import get_logger

logger = get_logger(__name__)

load_dotenv()
logger.info("Environment variables loaded from .env file")


def get_db_connection():
    logger.debug("Validating database environment variables...")
    required_keys = ["DB_HOST", "DB_PORT", "DB_DBNAME", "DB_USER", "DB_PASSWORD"]

    missing_keys = [key for key in required_keys if not os.getenv(key)]
    if missing_keys:
        logger.error(
            f"Missing required environment variables: {', '.join(missing_keys)}"
        )
        raise ValueError("Missing required database environment variables")

    logger.debug(
        f"Connecting to database at {os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_DBNAME')}"
    )
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


def check_database_initialized():
    """Check if the database has been initialized by checking if stickers table exists"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        logger.debug("Checking if 'stickers' table exists...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'stickers'
            );
        """)

        exists = cur.fetchone()[0]
        cur.close()
        conn.close()

        logger.debug(f"Table exists: {exists}")
        return exists
    except psycopg.OperationalError:
        raise
    except Exception as e:
        logger.error(f"Error checking database initialization: {e}")
        return False


def drop_database():
    """Drop all tables and indexes"""
    logger.warning("Dropping existing database tables...")

    conn = get_db_connection()
    cur = conn.cursor()

    logger.debug("Dropping 'stickers' table...")
    cur.execute("DROP TABLE IF EXISTS stickers CASCADE;")
    logger.info("Table 'stickers' dropped successfully")

    conn.commit()
    cur.close()
    conn.close()
    logger.info("✓ Database drop completed successfully")


def create_table():
    """Create the stickers table with PostGIS geometry"""
    logger.info("Starting database table creation...")

    conn = get_db_connection()
    cur = conn.cursor()

    logger.debug("Creating 'stickers' table if it doesn't exist...")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS stickers (
            id SERIAL PRIMARY KEY,
            location GEOGRAPHY(POINT, 4326),
            poster VARCHAR(255),
            uploader VARCHAR(255),
            post_date TIMESTAMP,
            upload_date TIMESTAMP,
            image VARCHAR(500),
            uploaded_by VARCHAR(255)
        );
    """)
    logger.info("Table 'stickers' created successfully")

    # Migration: add uploaded_by column if it doesn't exist (for existing deployments)
    cur.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'stickers' AND column_name = 'uploaded_by'
            ) THEN
                ALTER TABLE stickers ADD COLUMN uploaded_by VARCHAR(255);
            END IF;
        END $$;
    """)

    logger.debug("Creating spatial index on location column...")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_stickers_location
        ON stickers USING GIST(location);
    """)
    logger.info("Spatial index 'idx_stickers_location' created successfully")

    logger.debug("Committing transaction...")
    conn.commit()
    logger.debug("Closing database cursor and connection...")
    cur.close()
    conn.close()
    logger.info("✓ Database setup completed successfully")


def initialize_database():
    """Initialize database based on environment variables"""
    init_new_database = os.getenv("INIT_NEW_DATABASE", "false").lower() == "true"

    if init_new_database:
        logger.warning("INIT_NEW_DATABASE is set to true - dropping existing database")
        drop_database()
        create_table()
    else:
        try:
            initialized = check_database_initialized()
        except psycopg.OperationalError as e:
            logger.error(f"Cannot reach database, aborting initialization: {e}")
            raise

        if not initialized:
            logger.info("Database not initialized - running setup")
            create_table()
        else:
            logger.info("Database already initialized - skipping setup")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Starting StickerMap Database Setup")
    logger.info("=" * 60)
    try:
        initialize_database()
    except Exception as e:
        logger.error(f"Database setup failed: {e}")
        raise
