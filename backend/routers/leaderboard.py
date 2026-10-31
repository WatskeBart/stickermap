from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from core.auth import ROLE_VIEWER, require_role
from core.config import Config
from dependencies import get_db

router = APIRouter()


def _period_start(period: str) -> datetime | None:
    """First instant of the current year or half-year, naive UTC like post_date. None means all time."""
    now = datetime.now(UTC)
    if period == "year":
        return datetime(now.year, 1, 1)
    if period == "half":
        return datetime(now.year, 1 if now.month <= 6 else 7, 1)
    return None


@router.get("/leaderboard/distance")
def get_distance_leaderboard(
    period: Literal["all", "year", "half"] = "all",
    conn=Depends(get_db),
    current_user: dict = Depends(require_role(ROLE_VIEWER)),
):
    """
    Top 10 posters ranked by their farthest sticker from HQ (HQ_LAT/HQ_LON), one entry per poster.
    `year` and `half` only count stickers whose post_date falls in the current year or half-year,
    so stickers with an unknown date only count for `all`. Archived stickers never count.
    """
    hq_lat, hq_lon = Config.HQ_LAT, Config.HQ_LON
    since = _period_start(period)
    cursor = conn.cursor()
    try:
        cursor.execute(t"""
            SELECT id, poster, ST_Y(location::geometry), ST_X(location::geometry), distance_m
            FROM (
                SELECT DISTINCT ON (s.poster)
                    s.id,
                    s.poster,
                    s.location,
                    ST_Distance(s.location, ST_SetSRID(ST_MakePoint({hq_lon}, {hq_lat}), 4326)::geography) AS distance_m
                FROM stickers s
                WHERE s.archived = FALSE
                  AND s.location IS NOT NULL
                  AND COALESCE(TRIM(s.poster), '') <> ''
                  AND ({since}::timestamp IS NULL OR s.post_date >= {since})
                ORDER BY s.poster, distance_m DESC, s.id
            ) best
            ORDER BY distance_m DESC, poster
            LIMIT 10
        """)
        rows = cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()

    return {
        "hq": {"lat": hq_lat, "lon": hq_lon},
        "period": period,
        "since": since.date().isoformat() if since else None,
        "entries": [
            {
                "rank": rank,
                "sticker_id": r[0],
                "poster": r[1],
                "lat": r[2],
                "lon": r[3],
                "distance_m": round(r[4]),
            }
            for rank, r in enumerate(rows, start=1)
        ],
    }
