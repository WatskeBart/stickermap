export interface GPSInfo {
  latitude?: number;
  longitude?: number;
  DateTimestamp?: string;
  date_source?: 'gps' | 'exif';
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

export interface StickerStats {
  total_stickers: number;
  stickers_this_month: number;
  top_poster: { name: string; count: number } | null;
  top_uploader: { name: string; count: number } | null;
  total_uploaders: number;
  last_sticker_date: string | null;
  last_sticker_poster: string | null;
  archived_stickers: number;
}

export interface ParsedSticker {
  id: number;
  lat: number;
  lon: number;
  poster: string;
  uploader: string;
  post_date: string;
  upload_date: string;
  image: string;
  uploaded_by: string;
  imageUrl: string;
  canEdit: boolean;
  canDelete: boolean;
  removalCount: number;
  archived: boolean;
  canReport: boolean;
  canUnarchive: boolean;
}

export interface RemovalReport {
  id: number;
  sticker_id: number;
  reported_by: string;
  reported_at: string;
  proof_image: string | null;
  proof_image_url: string | null;
  reviewed_by: string | null;
  review_status: 'pending' | 'confirmed' | 'dismissed';
  reviewed_at: string | null;
}
