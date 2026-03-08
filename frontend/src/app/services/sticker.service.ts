import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root'
})
export class StickerService {
  private apiUrl = '/api/v1';

  constructor(private http: HttpClient) { }

  uploadImage(file: File, uploader: string): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploader', uploader);

    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData);
  }

  createSticker(stickerData: StickerData): Observable<any> {
    const request: CreateStickersRequest = {
      stickers: [stickerData]
    };
    return this.http.post(`${this.apiUrl}/create_sticker`, request);
  }

  getAllStickers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/get_all_stickers`);
  }

  getSticker(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/get_sticker/${id}`);
  }

  updateSticker(id: number, data: UpdateStickerRequest): Observable<any> {
    return this.http.patch(`${this.apiUrl}/sticker/${id}`, data);
  }

  deleteSticker(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sticker/${id}`);
  }

  getUploaders(): Observable<{ uploaders: string[] }> {
    return this.http.get<{ uploaders: string[] }>(`${this.apiUrl}/uploaders`);
  }
}
