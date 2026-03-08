"""Tests for file_handlers.py – FileValidator and GPSExtractor."""

import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from PIL import Image

from file_handlers import FileValidator, GPSExtractor, MAX_FILE_SIZE


# ── Helpers ───────────────────────────────────────────────────────────────────

def _png_bytes(width: int = 10, height: int = 10) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height)).save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, format="JPEG")
    return buf.getvalue()


class _MockRatio:
    """Minimal stand-in for exifread.utils.Ratio."""
    def __init__(self, num: int, den: int):
        self.num = num
        self.den = den


class _MockGPSValue:
    """Minimal stand-in for an exifread IfdTag with DMS coordinates."""
    def __init__(self, d: tuple, m: tuple, s: tuple):
        self.values = [_MockRatio(*d), _MockRatio(*m), _MockRatio(*s)]


class _MockStringValue:
    """Stand-in for a tag whose value is a plain string (e.g. LatitudeRef)."""
    def __init__(self, val: str):
        self.values = val


# ── FileValidator.validate_mime ───────────────────────────────────────────────

class TestFileValidatorMime:
    @pytest.mark.parametrize("mime", [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
    ])
    def test_accepts_valid_mime_types(self, mime):
        FileValidator.validate_mime(mime)  # should not raise

    @pytest.mark.parametrize("mime", [
        "image/bmp",
        "application/pdf",
        "text/plain",
        "image/tiff",
    ])
    def test_rejects_invalid_mime_types(self, mime):
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_mime(mime)
        assert exc_info.value.status_code == 400


# ── FileValidator.validate_size ───────────────────────────────────────────────

class TestFileValidatorSize:
    def test_accepts_file_within_limit(self):
        content = b"x" * (MAX_FILE_SIZE - 1)
        FileValidator.validate_size(content)  # should not raise

    def test_accepts_file_exactly_at_limit(self):
        content = b"x" * MAX_FILE_SIZE
        FileValidator.validate_size(content)  # should not raise

    def test_rejects_file_exceeding_limit(self):
        content = b"x" * (MAX_FILE_SIZE + 1)
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_size(content)
        assert exc_info.value.status_code == 400


# ── FileValidator.validate_content ───────────────────────────────────────────

class TestFileValidatorContent:
    def test_accepts_valid_png(self):
        FileValidator.validate_content(_png_bytes())  # should not raise

    def test_accepts_valid_jpeg(self):
        FileValidator.validate_content(_jpeg_bytes())  # should not raise

    def test_rejects_random_bytes(self):
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_content(b"not an image at all!")
        assert exc_info.value.status_code == 400

    def test_rejects_empty_bytes(self):
        with pytest.raises(HTTPException) as exc_info:
            FileValidator.validate_content(b"")
        assert exc_info.value.status_code == 400


# ── GPSExtractor.convert_to_degrees ──────────────────────────────────────────

class TestConvertToDegrees:
    def test_whole_degrees_only(self):
        value = _MockGPSValue((52, 1), (0, 1), (0, 1))
        assert GPSExtractor.convert_to_degrees(value) == pytest.approx(52.0)

    def test_degrees_and_minutes(self):
        value = _MockGPSValue((52, 1), (30, 1), (0, 1))
        assert GPSExtractor.convert_to_degrees(value) == pytest.approx(52.5)

    def test_degrees_minutes_seconds(self):
        # 1° 0' 36" = 1 + 36/3600 = 1.01°
        value = _MockGPSValue((1, 1), (0, 1), (36, 1))
        assert GPSExtractor.convert_to_degrees(value) == pytest.approx(1.01)

    def test_rational_denominator(self):
        # 10/2 degrees = 5°
        value = _MockGPSValue((10, 2), (0, 1), (0, 1))
        assert GPSExtractor.convert_to_degrees(value) == pytest.approx(5.0)


# ── GPSExtractor.convert_to_time_str ─────────────────────────────────────────

class TestConvertToTimeStr:
    def test_midnight(self):
        value = _MockGPSValue((0, 1), (0, 1), (0, 1))
        assert GPSExtractor.convert_to_time_str(value) == "00:00:00"

    def test_noon(self):
        value = _MockGPSValue((12, 1), (0, 1), (0, 1))
        assert GPSExtractor.convert_to_time_str(value) == "12:00:00"

    def test_with_minutes_and_seconds(self):
        value = _MockGPSValue((9, 1), (5, 1), (3, 1))
        assert GPSExtractor.convert_to_time_str(value) == "09:05:03"


# ── GPSExtractor.convert_to_date_str ─────────────────────────────────────────

class TestConvertToDateStr:
    def test_converts_colon_separated_date(self):
        value = MagicMock()
        value.values = "2024:01:15"
        assert GPSExtractor.convert_to_date_str(value) == "2024-01-15"

    def test_converts_year_month_day(self):
        value = MagicMock()
        value.values = "1999:12:31"
        assert GPSExtractor.convert_to_date_str(value) == "1999-12-31"


# ── GPSExtractor.extract ──────────────────────────────────────────────────────

class TestGPSExtractorExtract:
    def test_returns_empty_dict_when_no_gps_tags(self, tmp_path):
        img_path = str(tmp_path / "no_gps.png")
        Image.new("RGB", (10, 10)).save(img_path, format="PNG")

        result = GPSExtractor.extract(img_path)
        assert result == {}

    def test_returns_gps_dict_when_tags_present(self, tmp_path):
        img_path = str(tmp_path / "gps.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        lat = _MockGPSValue((52, 1), (30, 1), (0, 1))
        lon = _MockGPSValue((13, 1), (24, 1), (0, 1))
        lat_ref = _MockStringValue("N")
        lon_ref = _MockStringValue("E")
        date_tag = MagicMock()
        date_tag.values = "2024:06:01"
        time_tag = _MockGPSValue((10, 1), (30, 1), (0, 1))

        fake_tags = {
            "GPS GPSLatitude": lat,
            "GPS GPSLatitudeRef": lat_ref,
            "GPS GPSLongitude": lon,
            "GPS GPSLongitudeRef": lon_ref,
            "GPS GPSDate": date_tag,
            "GPS GPSTimeStamp": time_tag,
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["latitude"] == pytest.approx(52.5)
        assert result["longitude"] == pytest.approx(13.4)
        assert result["DateTimestamp"] == "2024-06-01 10:30:00"

    def test_south_latitude_is_negated(self, tmp_path):
        img_path = str(tmp_path / "south.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        lat = _MockGPSValue((33, 1), (0, 1), (0, 1))
        lat_ref = _MockStringValue("S")
        lon = _MockGPSValue((18, 1), (0, 1), (0, 1))
        lon_ref = _MockStringValue("E")
        date_tag = MagicMock()
        date_tag.values = "2024:01:01"
        time_tag = _MockGPSValue((0, 1), (0, 1), (0, 1))

        fake_tags = {
            "GPS GPSLatitude": lat,
            "GPS GPSLatitudeRef": lat_ref,
            "GPS GPSLongitude": lon,
            "GPS GPSLongitudeRef": lon_ref,
            "GPS GPSDate": date_tag,
            "GPS GPSTimeStamp": time_tag,
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["latitude"] == pytest.approx(-33.0)

    def test_west_longitude_is_negated(self, tmp_path):
        img_path = str(tmp_path / "west.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        lat = _MockGPSValue((40, 1), (0, 1), (0, 1))
        lat_ref = _MockStringValue("N")
        lon = _MockGPSValue((74, 1), (0, 1), (0, 1))
        lon_ref = _MockStringValue("W")
        date_tag = MagicMock()
        date_tag.values = "2024:01:01"
        time_tag = _MockGPSValue((0, 1), (0, 1), (0, 1))

        fake_tags = {
            "GPS GPSLatitude": lat,
            "GPS GPSLatitudeRef": lat_ref,
            "GPS GPSLongitude": lon,
            "GPS GPSLongitudeRef": lon_ref,
            "GPS GPSDate": date_tag,
            "GPS GPSTimeStamp": time_tag,
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["longitude"] == pytest.approx(-74.0)
