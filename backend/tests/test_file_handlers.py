"""Tests for file_handlers.py – FileValidator and GPSExtractor."""

import io
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from PIL import Image

from file_handlers import FileValidator, GPSExtractor, ImageProcessor, MAX_FILE_SIZE, strip_exif


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

    def test_returns_exif_date_without_gps_location(self, tmp_path):
        """No GPS coordinates, but Image DateTime present — returns date only."""
        img_path = str(tmp_path / "no_gps_with_date.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        exif_dt = MagicMock()
        exif_dt.values = "2024:03:09 00:41:50"

        fake_tags = {"Image DateTime": exif_dt}

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert "latitude" not in result
        assert "longitude" not in result
        assert result["DateTimestamp"] == "2024-03-09 00:41:50"
        assert result["date_source"] == "exif"

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
        assert result["date_source"] == "gps"

    def test_returns_coords_without_timestamp_when_no_date_tags(self, tmp_path):
        """GPS location found but no date anywhere — returns coords only."""
        img_path = str(tmp_path / "no_date.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        lat = _MockGPSValue((52, 1), (30, 1), (0, 1))
        lon = _MockGPSValue((13, 1), (24, 1), (0, 1))

        fake_tags = {
            "GPS GPSLatitude": lat,
            "GPS GPSLatitudeRef": _MockStringValue("N"),
            "GPS GPSLongitude": lon,
            "GPS GPSLongitudeRef": _MockStringValue("E"),
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["latitude"] == pytest.approx(52.5)
        assert result["longitude"] == pytest.approx(13.4)
        assert "DateTimestamp" not in result
        assert "date_source" not in result

    def test_falls_back_to_exif_datetime_original(self, tmp_path):
        """GPS present but no GPS date — falls back to EXIF DateTimeOriginal."""
        img_path = str(tmp_path / "exif_date.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        exif_dt = MagicMock()
        exif_dt.values = "2023:11:20 15:45:30"

        fake_tags = {
            "GPS GPSLatitude": _MockGPSValue((52, 1), (0, 1), (0, 1)),
            "GPS GPSLatitudeRef": _MockStringValue("N"),
            "GPS GPSLongitude": _MockGPSValue((5, 1), (0, 1), (0, 1)),
            "GPS GPSLongitudeRef": _MockStringValue("E"),
            "EXIF DateTimeOriginal": exif_dt,
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["DateTimestamp"] == "2023-11-20 15:45:30"
        assert result["date_source"] == "exif"

    def test_falls_back_to_exif_datetime_digitized(self, tmp_path):
        """Falls back to EXIF DateTimeDigitized when DateTimeOriginal is absent."""
        img_path = str(tmp_path / "digitized.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        exif_dt = MagicMock()
        exif_dt.values = "2022:07:04 08:00:00"

        fake_tags = {
            "GPS GPSLatitude": _MockGPSValue((48, 1), (0, 1), (0, 1)),
            "GPS GPSLatitudeRef": _MockStringValue("N"),
            "GPS GPSLongitude": _MockGPSValue((2, 1), (0, 1), (0, 1)),
            "GPS GPSLongitudeRef": _MockStringValue("E"),
            "EXIF DateTimeDigitized": exif_dt,
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["DateTimestamp"] == "2022-07-04 08:00:00"
        assert result["date_source"] == "exif"

    def test_falls_back_to_image_datetime(self, tmp_path):
        """Falls back to Image DateTime as last resort."""
        img_path = str(tmp_path / "image_dt.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        exif_dt = MagicMock()
        exif_dt.values = "2021:03:15 12:00:00"

        fake_tags = {
            "GPS GPSLatitude": _MockGPSValue((51, 1), (0, 1), (0, 1)),
            "GPS GPSLatitudeRef": _MockStringValue("N"),
            "GPS GPSLongitude": _MockGPSValue((4, 1), (0, 1), (0, 1)),
            "GPS GPSLongitudeRef": _MockStringValue("E"),
            "Image DateTime": exif_dt,
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["DateTimestamp"] == "2021-03-15 12:00:00"
        assert result["date_source"] == "exif"

    def test_gps_timestamp_takes_priority_over_exif(self, tmp_path):
        """GPS date/time takes priority even when EXIF tags are also present."""
        img_path = str(tmp_path / "both.jpg")
        Image.new("RGB", (10, 10)).save(img_path, format="JPEG")

        gps_date = MagicMock()
        gps_date.values = "2024:06:01"
        exif_dt = MagicMock()
        exif_dt.values = "2020:01:01 00:00:00"

        fake_tags = {
            "GPS GPSLatitude": _MockGPSValue((52, 1), (0, 1), (0, 1)),
            "GPS GPSLatitudeRef": _MockStringValue("N"),
            "GPS GPSLongitude": _MockGPSValue((13, 1), (0, 1), (0, 1)),
            "GPS GPSLongitudeRef": _MockStringValue("E"),
            "GPS GPSDate": gps_date,
            "GPS GPSTimeStamp": _MockGPSValue((10, 1), (0, 1), (0, 1)),
            "EXIF DateTimeOriginal": exif_dt,
        }

        with patch("file_handlers.exifread.process_file", return_value=fake_tags):
            result = GPSExtractor.extract(img_path)

        assert result["DateTimestamp"] == "2024-06-01 10:00:00"
        assert result["date_source"] == "gps"

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


# ── ImageProcessor ───────────────────────────────────────────────────────────

class TestImageProcessor:
    def test_output_is_jpeg_by_default(self):
        full, thumb = ImageProcessor.process(_jpeg_bytes())
        assert Image.open(io.BytesIO(full)).format == "JPEG"
        assert Image.open(io.BytesIO(thumb)).format == "JPEG"

    def test_full_image_not_upscaled(self):
        """A 10×10 image must not be enlarged."""
        full, _ = ImageProcessor.process(_jpeg_bytes(), max_size=1920)
        img = Image.open(io.BytesIO(full))
        assert img.size == (10, 10)

    def test_full_image_downscaled_to_max_size(self):
        """Longest edge is reduced to max_size."""
        buf = io.BytesIO()
        Image.new("RGB", (3000, 2000)).save(buf, format="JPEG")
        full, _ = ImageProcessor.process(buf.getvalue(), max_size=1920)
        img = Image.open(io.BytesIO(full))
        assert max(img.size) == 1920

    def test_thumbnail_fits_within_thumbnail_size(self):
        buf = io.BytesIO()
        Image.new("RGB", (3000, 2000)).save(buf, format="JPEG")
        _, thumb = ImageProcessor.process(buf.getvalue(), thumbnail_size=400)
        img = Image.open(io.BytesIO(thumb))
        assert max(img.size) == 400

    def test_thumbnail_smaller_than_full(self):
        buf = io.BytesIO()
        Image.new("RGB", (3000, 2000)).save(buf, format="JPEG")
        full, thumb = ImageProcessor.process(buf.getvalue(), max_size=1920, thumbnail_size=400)
        full_img = Image.open(io.BytesIO(full))
        thumb_img = Image.open(io.BytesIO(thumb))
        assert max(thumb_img.size) < max(full_img.size)

    def test_rgba_png_converted_for_jpeg(self):
        """RGBA PNG input must not raise when output format is JPEG."""
        buf = io.BytesIO()
        Image.new("RGBA", (100, 100)).save(buf, format="PNG")
        full, thumb = ImageProcessor.process(buf.getvalue(), fmt="JPEG")
        assert Image.open(io.BytesIO(full)).mode == "RGB"

    def test_webp_output_format(self):
        full, thumb = ImageProcessor.process(_jpeg_bytes(), fmt="WEBP")
        assert Image.open(io.BytesIO(full)).format == "WEBP"

    def test_exif_not_preserved(self):
        """Processed output must not carry EXIF data."""
        img = Image.new("RGB", (10, 10))
        exif = img.getexif()
        exif[0x010F] = "TestCamera"
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif.tobytes())
        full, _ = ImageProcessor.process(buf.getvalue())
        result = Image.open(io.BytesIO(full))
        assert not result.info.get("exif")

    def test_aspect_ratio_preserved_for_full(self):
        buf = io.BytesIO()
        Image.new("RGB", (3000, 1000)).save(buf, format="JPEG")
        full, _ = ImageProcessor.process(buf.getvalue(), max_size=1920)
        img = Image.open(io.BytesIO(full))
        assert abs(img.width / img.height - 3.0) < 0.01


# ── strip_exif ────────────────────────────────────────────────────────────────

class TestStripExif:
    def test_strips_exif_from_jpeg(self, tmp_path):
        img = Image.new("RGB", (10, 10))
        exif = img.getexif()
        exif[0x010F] = "TestCamera"  # ImageDescription / Make tag
        img_path = str(tmp_path / "with_exif.jpg")
        img.save(img_path, format="JPEG", exif=exif.tobytes())

        with Image.open(img_path) as before:
            assert before.info.get("exif")

        strip_exif(img_path)

        with Image.open(img_path) as after:
            assert not after.info.get("exif")

    def test_preserves_image_dimensions(self, tmp_path):
        img = Image.new("RGB", (20, 30))
        img_path = str(tmp_path / "dims.jpg")
        img.save(img_path, format="JPEG")

        strip_exif(img_path)

        with Image.open(img_path) as after:
            assert after.size == (20, 30)

    def test_works_on_png(self, tmp_path):
        img = Image.new("RGB", (10, 10))
        img_path = str(tmp_path / "image.png")
        img.save(img_path, format="PNG")

        strip_exif(img_path)  # should not raise

        with Image.open(img_path) as after:
            assert after.size == (10, 10)
