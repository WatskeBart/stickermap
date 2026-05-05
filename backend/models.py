from typing import Literal, Optional

from pydantic import BaseModel


class StickerLocation(BaseModel):
    lon: float
    lat: float


class StickerData(BaseModel):
    location: StickerLocation
    poster: str
    uploader: str
    post_date: str
    image: str


class CreateStickersRequest(BaseModel):
    stickers: list[StickerData]


class UpdateStickerRequest(BaseModel):
    poster: Optional[str] = None
    post_date: Optional[str] = None
    location: Optional[StickerLocation] = None
    uploader: Optional[str] = None


class RotateRequest(BaseModel):
    direction: Literal["cw", "ccw", "180"]
