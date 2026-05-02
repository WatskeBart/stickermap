import threading

from psycopg_pool import ConnectionPool

from environment import Config
from logger import get_logger

logger = get_logger(__name__)

_pool: ConnectionPool | None = None
_pool_lock = threading.Lock()


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                conninfo = (
                    f"host={Config.DB_HOST} port={Config.DB_PORT} "
                    f"dbname={Config.DB_DBNAME} user={Config.DB_USER} "
                    f"password={Config.DB_PASSWORD} connect_timeout=3"
                )
                logger.info(
                    "Opening database connection pool to %s:%s/%s (min=2, max=10)",
                    Config.DB_HOST, Config.DB_PORT, Config.DB_DBNAME,
                )
                _pool = ConnectionPool(conninfo, min_size=2, max_size=10)
    return _pool
