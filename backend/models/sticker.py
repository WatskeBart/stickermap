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
    thumbnail: Optional[str] = None
    category_id: Optional[int] = None
    private: Optional[bool] = False


class CreateStickersRequest(BaseModel):
    stickers: list[StickerData]


class UpdateStickerRequest(BaseModel):
    poster: Optional[str] = None
    post_date: Optional[str] = None
    location: Optional[StickerLocation] = None
    uploader: Optional[str] = None
    category_id: Optional[int] = None
    private: Optional[bool] = None


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
