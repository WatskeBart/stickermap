import logging

from environment import Config


def setup_logging() -> None:
    """Configure root logger once at application startup."""
    level = getattr(logging, Config.LOG_LEVEL, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def get_logger(name: str) -> logging.Logger:
    """Return a module-level logger. Call with get_logger(__name__)."""
    return logging.getLogger(name)
