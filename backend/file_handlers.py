from io import BytesIO

import exifread
from fastapi import HTTPException
from PIL import Image

from logger import get_logger

logger = get_logger(__name__)

ALLOWED_FORMATS = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB


class FileValidator:
    """Validates uploaded files"""

    @staticmethod
    def validate_mime(content_type: str):
        if content_type not in ALLOWED_FORMATS:
            logger.warning("Rejected upload with invalid MIME type: %s", content_type)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file format. Allowed formats: {', '.join(ALLOWED_FORMATS)}",
            )

    @staticmethod
    def validate_size(file_content: bytes):
        if len(file_content) == 0:
            raise HTTPException(
                status_code=400,
                detail="File is empty"
            )
        if len(file_content) > MAX_FILE_SIZE:
            logger.warning("Rejected upload exceeding size limit: %d bytes", len(file_content))
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed size of 16MB",
            )

    @staticmethod
    def validate_content(file_content: bytes):
        """Validate actual image content, not just MIME type"""
        try:
            img = Image.open(BytesIO(file_content))
            img.verify()
            logger.debug("Image content validation passed")
        except Exception as e:
            logger.warning("Image content validation failed: %s", e)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image file: {str(e)}"
            )


class ImageProcessor:
    """Resizes, compresses, and generates thumbnails for uploaded images."""

    @staticmethod
    def process(
        image_bytes: bytes,
        max_size: int = 1920,
        thumbnail_size: int = 400,
        fmt: str = "JPEG",
        quality: int = 85,
    ) -> tuple[bytes, bytes]:
        """Resize and compress image, then generate a thumbnail.

        Returns (full_image_bytes, thumbnail_bytes). EXIF data is not preserved.
        """
        img = Image.open(BytesIO(image_bytes))

        if fmt.upper() == "JPEG" and img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        img.thumbnail((max_size, max_size), Image.LANCZOS)

        save_kwargs: dict = {"format": fmt}
        if fmt.upper() in ("JPEG", "WEBP"):
            save_kwargs["quality"] = quality
            save_kwargs["optimize"] = True

        full_buf = BytesIO()
        img.save(full_buf, **save_kwargs)

        thumb = img.copy()
        thumb.thumbnail((thumbnail_size, thumbnail_size), Image.LANCZOS)
        thumb_buf = BytesIO()
        thumb.save(thumb_buf, **save_kwargs)

        logger.debug(
            "Processed image: full=%d bytes, thumbnail=%d bytes",
            full_buf.tell(),
            thumb_buf.tell(),
        )
        return full_buf.getvalue(), thumb_buf.getvalue()


def strip_exif(filepath: str) -> None:
    """Strip all EXIF metadata from an image file in-place using Pillow."""
    img = Image.open(filepath)
    fmt = img.format
    img.save(filepath, format=fmt)
    logger.debug("Stripped EXIF metadata from %s", filepath)


class GPSExtractor:
    """Extracts GPS data from image EXIF"""

    @staticmethod
    def convert_to_degrees(value):
        """Convert GPS coordinates to decimal degrees"""
        d = float(value.values[0].num) / float(value.values[0].den)
        m = float(value.values[1].num) / float(value.values[1].den)
        s = float(value.values[2].num) / float(value.values[2].den)
        return d + (m / 60.0) + (s / 3600.0)

    @staticmethod
    def convert_to_time_str(value):
        """Convert GPS time to string format HH:MM:SS"""
        hour = int(float(value.values[0].num) / float(value.values[0].den))
        minute = int(float(value.values[1].num) / float(value.values[1].den))
        second = int(float(value.values[2].num) / float(value.values[2].den))
        return f"{hour:02d}:{minute:02d}:{second:02d}"

    @staticmethod
    def convert_to_date_str(value):
        """Convert GPS date to string format YYYY-MM-DD"""
        date_str = str(value.values)
        year, month, day = date_str.split(":")
        return f"{year}-{month}-{day}"

    @staticmethod
    def _parse_exif_datetime(tag) -> str | None:
        """Parse a standard EXIF datetime tag (format: '2024:01:15 14:30:00') to 'YYYY-MM-DD HH:MM:SS'."""
        try:
            dt_str = str(tag.values)
            date_part, time_part = dt_str.split(" ", 1)
            year, month, day = date_part.split(":")
            return f"{year}-{month}-{day} {time_part}"
        except Exception:
            return None

    @staticmethod
    def extract(filepath: str) -> dict:
        """Extract GPS location and datetime from image EXIF.

        GPS coordinates are optional. Date/time is always extracted
        independently, even when no GPS location is present.
        Date/time priority: GPS timestamp > EXIF DateTimeOriginal >
        EXIF DateTimeDigitized > Image DateTime.
        Returns empty dict only when no usable data is found at all.
        """
        try:
            with open(filepath, "rb") as f:
                tags = exifread.process_file(f, details=False)

                result: dict = {}

                # Extract GPS coordinates if present
                gps_latitude = tags.get("GPS GPSLatitude")
                gps_latitude_ref = tags.get("GPS GPSLatitudeRef")
                gps_longitude = tags.get("GPS GPSLongitude")
                gps_longitude_ref = tags.get("GPS GPSLongitudeRef")

                has_gps_location = bool(
                    gps_latitude and gps_longitude
                    and gps_latitude_ref and gps_latitude_ref.values
                    and gps_longitude_ref and gps_longitude_ref.values
                )

                if has_gps_location:
                    lat_value = GPSExtractor.convert_to_degrees(gps_latitude)
                    if gps_latitude_ref.values != "N":
                        lat_value = -lat_value
                    lon_value = GPSExtractor.convert_to_degrees(gps_longitude)
                    if gps_longitude_ref.values != "E":
                        lon_value = -lon_value
                    result["latitude"] = lat_value
                    result["longitude"] = lon_value

                    gps_date = tags.get("GPS GPSDate")
                    gps_time = tags.get("GPS GPSTimeStamp")
                    if gps_date and gps_date.values and gps_time:
                        try:
                            date_str = GPSExtractor.convert_to_date_str(gps_date)
                            time_str = GPSExtractor.convert_to_time_str(gps_time)
                            result["DateTimestamp"] = f"{date_str} {time_str}"
                            result["date_source"] = "gps"
                            return result
                        except Exception:
                            logger.debug("GPS date/time parsing failed for %s, trying EXIF fallback", filepath)

                for tag_name in ("EXIF DateTimeOriginal", "EXIF DateTimeDigitized", "Image DateTime"):
                    exif_dt = tags.get(tag_name)
                    if exif_dt and exif_dt.values:
                        parsed = GPSExtractor._parse_exif_datetime(exif_dt)
                        if parsed:
                            result["DateTimestamp"] = parsed
                            result["date_source"] = "exif"
                            logger.debug("Used %s for datetime of %s", tag_name, filepath)
                            break

                return result
        except Exception as e:
            logger.error("Failed to extract GPS data from %s: %s", filepath, e)
            raise ValueError(f"Error: {str(e)}")
