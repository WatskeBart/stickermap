import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { UploadResponse, StickerData, CreateStickersRequest, UpdateStickerRequest, StickerStats } from '../models/sticker.model';

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

  rotateSticker(id: number, direction: 'cw' | 'ccw' | '180'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/stickers/${id}/rotate`, { direction });
  }

  getStats(): Observable<StickerStats> {
    return this.http.get<StickerStats>(`${this.apiUrl}/stats`);
  }
}
