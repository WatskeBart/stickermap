"""Tests for models.py – Pydantic model validation."""

import pytest
from pydantic import ValidationError

from models import CreateStickersRequest, StickerData, StickerLocation, UpdateStickerRequest


# ── StickerLocation ───────────────────────────────────────────────────────────

class TestStickerLocation:
    def test_valid_coordinates(self):
        loc = StickerLocation(lon=13.4, lat=52.5)
        assert loc.lon == 13.4
        assert loc.lat == 52.5

    def test_negative_coordinates(self):
        loc = StickerLocation(lon=-74.006, lat=-33.9)
        assert loc.lon == pytest.approx(-74.006)
        assert loc.lat == pytest.approx(-33.9)

    def test_zero_coordinates(self):
        loc = StickerLocation(lon=0.0, lat=0.0)
        assert loc.lon == 0.0
        assert loc.lat == 0.0

    def test_rejects_missing_lon(self):
        with pytest.raises(ValidationError):
            StickerLocation(lat=52.5)  # type: ignore[call-arg]

    def test_rejects_missing_lat(self):
        with pytest.raises(ValidationError):
            StickerLocation(lon=13.4)  # type: ignore[call-arg]

    def test_rejects_non_numeric_values(self):
        with pytest.raises(ValidationError):
            StickerLocation(lon="not-a-number", lat=52.5)  # type: ignore[arg-type]


# ── StickerData ───────────────────────────────────────────────────────────────

class TestStickerData:
    def _valid(self) -> dict:
        return {
            "location": {"lon": 13.4, "lat": 52.5},
            "poster": "Artist",
            "uploader": "user1",
            "post_date": "2024-01-01T00:00:00Z",
            "image": "photo.jpg",
        }

    def test_valid_sticker_data(self):
        sticker = StickerData(**self._valid())
        assert sticker.poster == "Artist"
        assert sticker.location.lon == pytest.approx(13.4)

    def test_rejects_missing_required_field(self):
        data = self._valid()
        del data["poster"]
        with pytest.raises(ValidationError):
            StickerData(**data)

    def test_rejects_missing_image(self):
        data = self._valid()
        del data["image"]
        with pytest.raises(ValidationError):
            StickerData(**data)


# ── CreateStickersRequest ─────────────────────────────────────────────────────

class TestCreateStickersRequest:
    def _sticker(self) -> dict:
        return {
            "location": {"lon": 4.9, "lat": 52.37},
            "poster": "Test",
            "uploader": "tester",
            "post_date": "2024-06-01",
            "image": "img.png",
        }

    def test_single_sticker(self):
        req = CreateStickersRequest(stickers=[self._sticker()])
        assert len(req.stickers) == 1

    def test_multiple_stickers(self):
        req = CreateStickersRequest(stickers=[self._sticker(), self._sticker()])
        assert len(req.stickers) == 2

    def test_empty_list_is_valid(self):
        req = CreateStickersRequest(stickers=[])
        assert req.stickers == []

    def test_rejects_missing_stickers_key(self):
        with pytest.raises(ValidationError):
            CreateStickersRequest()  # type: ignore[call-arg]


# ── UpdateStickerRequest ──────────────────────────────────────────────────────

class TestUpdateStickerRequest:
    def test_all_fields_optional(self):
        req = UpdateStickerRequest()
        assert req.poster is None
        assert req.post_date is None
        assert req.location is None
        assert req.uploader is None

    def test_partial_update_poster_only(self):
        req = UpdateStickerRequest(poster="New Artist")
        assert req.poster == "New Artist"
        assert req.uploader is None

    def test_partial_update_location_only(self):
        req = UpdateStickerRequest(location={"lon": 5.0, "lat": 53.0})
        assert req.location is not None
        assert req.location.lon == pytest.approx(5.0)

    def test_full_update(self):
        req = UpdateStickerRequest(
            poster="X",
            post_date="2024-12-31",
            location={"lon": 0.0, "lat": 0.0},
            uploader="admin",
        )
        assert req.poster == "X"
        assert req.uploader == "admin"

    def test_model_dump_excludes_none(self):
        req = UpdateStickerRequest(poster="Only Poster")
        dumped = req.model_dump(exclude_none=True)
        assert "poster" in dumped
        assert "uploader" not in dumped
        assert "location" not in dumped
