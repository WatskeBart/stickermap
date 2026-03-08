import exifread


def _convert_to_degress(value):
    """
    Helper function to convert the GPS coordinates stored in the EXIF to degrees in float format
    :param value:
    :type value: exifread.utils.Ratio
    :rtype: float
    """
    d = float(value.values[0].num) / float(value.values[0].den)
    m = float(value.values[1].num) / float(value.values[1].den)
    s = float(value.values[2].num) / float(value.values[2].den)

    return d + (m / 60.0) + (s / 3600.0)


def _convert_to_time_str(value):
    """
    Helper function to convert the GPS time stored in the EXIF to time string format
    :param value:
    :rtype: str
    """
    hour = int(float(value.values[0].num) / float(value.values[0].den))
    minute = int(float(value.values[1].num) / float(value.values[1].den))
    second = int(float(value.values[2].num) / float(value.values[2].den))

    return f"{hour:02d}{minute:02d}{second:02d}"


def _convert_to_date_str(value):
    """
    Helper function to convert the GPS date stored in the EXIF to datetime string format
    :param value:
    :rtype: str
    """
    date_str = str(value.values)
    year, month, day = date_str.split(":")
    return f"{year}{month}{day}"


def getGPS(filepath):
    """
    returns gps data if present other wise returns empty dictionary
    """
    with open(filepath, "rb") as f:
        tags = exifread.process_file(f)
        gps_date = tags.get("GPS GPSDate")
        gps_time = tags.get("GPS GPSTimeStamp")
        latitude = tags.get("GPS GPSLatitude")
        latitude_ref = tags.get("GPS GPSLatitudeRef")
        longitude = tags.get("GPS GPSLongitude")
        longitude_ref = tags.get("GPS GPSLongitudeRef")
        if latitude:
            lat_value = _convert_to_degress(latitude)
            if latitude_ref.values != "N":
                lat_value = -lat_value
        else:
            return {}
        if longitude:
            lon_value = _convert_to_degress(longitude)
            if longitude_ref.values != "E":
                lon_value = -lon_value
        else:
            return {}
        if gps_date:
            date_str = _convert_to_date_str(gps_date)
        else:
            return {}
        if gps_time:
            time_str = _convert_to_time_str(gps_time)
        else:
            return {}
        return {
            "latitude": lat_value,
            "longitude": lon_value,
            "DateTime": date_str + "_" + time_str,
        }


file_path = "datasets/exif_test-image.jpg"
gps = getGPS(file_path)
print(gps)
