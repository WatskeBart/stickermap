export interface GPSInfo {
  latitude?: number;
  longitude?: number;
  DateTimestamp?: string;
  date_source?: 'gps' | 'exif';
}

export interface UploadResponse {
  message: string;
  filename: string;
  thumbnail: string;
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
  thumbnail?: string | null;
  category_id?: number | null;
  private?: boolean;
}

export interface CreateStickersRequest {
  stickers: StickerData[];
}

export interface UpdateStickerRequest {
  poster?: string;
  post_date?: string;
  location?: StickerLocation;
  uploader?: string;
  category_id?: number | null;
  private?: boolean;
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
  canArchive: boolean;
  category_id: number | null;
  category_name: string | null;
  category_icon_url: string | null;
  private: boolean;
}

export interface AdminStats {
  total_stickers: number;
  missing_thumbnail_db: number;
  missing_thumbnail_file: number;
  missing_full_image_file: number;
  missing_gps: number;
  archived: number;
  private: number;
}

export interface AdminAuditItem {
  id: number;
  image: string;
  thumbnail: string | null;
  missing_image: boolean;
  missing_thumbnail: boolean;
}

export type JobStatus = 'running' | 'done' | 'error';

export interface AdminJob {
  status: JobStatus;
  processed: number;
  total: number;
  errors: string[];
  started_at: string;
  finished_at: string | null;
}

export type MaintenanceJobType = 'generate-thumbnails' | 'compress-images' | 'strip-exif' | 'cleanup-orphans';

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
