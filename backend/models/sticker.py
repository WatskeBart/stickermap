import re
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

EXTRA_INFO_MAX_LENGTH = 256

_BLANK_LINE_RUN = re.compile(r"\n{3,}")


def normalise_extra_info(value: Optional[str]) -> Optional[str]:
    """Trim, normalise newlines and collapse blank-line runs. Empty becomes NULL.

    Runs *after* the max_length constraint, so an over-long payload is still a 422
    even when the excess is whitespace.
    """
    if value is None:
        return None
    cleaned = _BLANK_LINE_RUN.sub("\n\n", value.replace("\r\n", "\n").replace("\r", "\n")).strip()
    return cleaned or None


class StickerLocation(BaseModel):
    lon: float
    lat: float


class StickerData(BaseModel):
    location: StickerLocation
    poster: str
    uploader: str
    post_date: str
    image: str
    thumbnail: Optional[str] = None
    category_id: Optional[int] = None
    private: Optional[bool] = False
    extra_info: Optional[str] = Field(default=None, max_length=EXTRA_INFO_MAX_LENGTH)

    @field_validator("extra_info")
    @classmethod
    def _clean_extra_info(cls, value: Optional[str]) -> Optional[str]:
        return normalise_extra_info(value)


class CreateStickersRequest(BaseModel):
    stickers: list[StickerData]


class UpdateStickerRequest(BaseModel):
    poster: Optional[str] = None
    post_date: Optional[str] = None
    location: Optional[StickerLocation] = None
    uploader: Optional[str] = None
    category_id: Optional[int] = None
    private: Optional[bool] = None
    # Only fields present in the payload are applied (`model_dump(exclude_unset=True)`),
    # so sending `""` (or an explicit `null`) clears the note; omitting it leaves it as-is.
    extra_info: Optional[str] = Field(default=None, max_length=EXTRA_INFO_MAX_LENGTH)

    @field_validator("extra_info")
    @classmethod
    def _clean_extra_info(cls, value: Optional[str]) -> Optional[str]:
        return normalise_extra_info(value)


class RotateRequest(BaseModel):
    direction: Literal["cw", "ccw", "180"]


class ReviewReportRequest(BaseModel):
    status: Literal["confirmed", "dismissed"]


class CreateCategoryRequest(BaseModel):
    name: str


class UpdateCategoryRequest(BaseModel):
    name: Optional[str] = None
    approved: Optional[bool] = None
    archived: Optional[bool] = None
