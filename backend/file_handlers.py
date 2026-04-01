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
    def extract(filepath: str) -> dict:
        """Extract GPS data from image, return empty dict if not present"""
        try:
            with open(filepath, "rb") as f:
                tags = exifread.process_file(f, details=False)

                gps_latitude = tags.get("GPS GPSLatitude")
                gps_latitude_ref = tags.get("GPS GPSLatitudeRef")
                gps_longitude = tags.get("GPS GPSLongitude")
                gps_longitude_ref = tags.get("GPS GPSLongitudeRef")
                gps_date = tags.get("GPS GPSDate")
                gps_time = tags.get("GPS GPSTimeStamp")

                if not all([gps_latitude, gps_longitude, gps_time]):
                    return {}
                if not (gps_latitude_ref
                        and gps_latitude_ref.values
                        and gps_longitude_ref
                        and gps_longitude_ref.values
                        and gps_date and gps_date.values):
                    return {}

                lat_value = GPSExtractor.convert_to_degrees(gps_latitude)
                if gps_latitude_ref.values != "N":
                    lat_value = -lat_value

                lon_value = GPSExtractor.convert_to_degrees(gps_longitude)
                if gps_longitude_ref.values != "E":
                    lon_value = -lon_value

                date_str = GPSExtractor.convert_to_date_str(gps_date)
                time_str = GPSExtractor.convert_to_time_str(gps_time)

                f.close()

                return {
                    "latitude": lat_value,
                    "longitude": lon_value,
                    "DateTimestamp": f"{date_str} {time_str}",
                }
        except Exception as e:
            logger.error("Failed to extract GPS data from %s: %s", filepath, e)
            raise ValueError(f"Error: {str(e)}")
