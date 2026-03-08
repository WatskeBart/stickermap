import psycopg

from environment import Config
from logger import get_logger

logger = get_logger(__name__)


class DatabaseManager:
    """Manages database connections"""

    @staticmethod
    def get_connection():
        logger.debug(
            "Opening database connection to %s:%s/%s",
            Config.DB_HOST, Config.DB_PORT, Config.DB_DBNAME,
        )
        return psycopg.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            dbname=Config.DB_DBNAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            connect_timeout=3,
        )
