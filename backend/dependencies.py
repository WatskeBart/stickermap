from core.connections import get_pool


def get_db():
    with get_pool().connection() as conn:
        yield conn
