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
  extra_info?: string | null;
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
  extra_info?: string;
}

export const EXTRA_INFO_MAX_LENGTH = 256;

/** Shape of the `ST_AsGeoJSON(location)` string once parsed. */
export interface StickerPointGeoJson {
  type: 'Point';
  coordinates: [lon: number, lat: number];
}

/**
 * The sticker endpoints return raw psycopg rows, which serialise to JSON arrays
 * rather than objects. They are modelled as labelled tuples so the column order
 * stays documented and index access is type-checked.
 *
 * Metadata columns are null for unauthenticated/non-viewer callers — the backend
 * blanks them out before returning (see `get_all_stickers` in routers/stickers.py).
 */
export type StickerRow = [
  id: number,
  locationGeoJson: string,
  poster: string | null,
  uploader: string | null,
  post_date: string | null,
  upload_date: string | null,
  image: string,
  uploaded_by: string | null,
  updated_at: string | null,
  removal_count: number,
  archived: boolean,
  category_id: number | null,
  category_name: string | null,
  category_icon_filename: string | null,
  isPrivate: boolean,
  extra_info: string | null,
];

/** Row shape of `GET /get_sticker/{id}` — no removal count or archived flag. */
export type StickerDetailRow = [
  id: number,
  locationGeoJson: string,
  poster: string,
  uploader: string,
  post_date: string,
  upload_date: string,
  image: string,
  uploaded_by: string,
  updated_at: string | null,
  category_id: number | null,
  category_name: string | null,
  category_icon_filename: string | null,
  isPrivate: boolean,
  extra_info: string | null,
];

/** Row returned by `PATCH /stickers/{id}/rotate`. */
export type StickerRotateRow = [
  id: number,
  locationGeoJson: string,
  poster: string,
  uploader: string,
  post_date: string,
  upload_date: string,
  image: string,
  uploaded_by: string,
  updated_at: string,
  category_id: number | null,
];

/** Generic `{ "message": ... }` acknowledgement returned by mutating endpoints. */
export interface MessageResponse {
  message: string;
}

export interface UpdateStickerResponse extends MessageResponse {
  updated_at: string;
}

export interface SubmitReportResponse extends MessageResponse {
  report_id: number;
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
  /** Null for non-viewers — the backend blanks metadata out for unauthenticated callers. */
  poster: string | null;
  uploader: string | null;
  post_date: string | null;
  upload_date: string | null;
  extra_info: string | null;
  image: string;
  uploaded_by: string | null;
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
