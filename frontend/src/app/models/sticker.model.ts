export interface GPSInfo {
  latitude?: number;
  longitude?: number;
  DateTimestamp?: string;
}

export interface UploadResponse {
  message: string;
  filename: string;
  gps_info: GPSInfo | { [key: string]: string };
}

export interface StickerLocation {
  lon: number;
  lat: number;
}

export interface StickerData {
  location: StickerLocation;
  poster: string;
  uploader: string;
  post_date: string;
  image: string;
}

export interface CreateStickersRequest {
  stickers: StickerData[];
}

export interface UpdateStickerRequest {
  poster?: string;
  post_date?: string;
  location?: StickerLocation;
  uploader?: string;
}
