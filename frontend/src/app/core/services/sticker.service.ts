import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { UploadResponse, StickerData, CreateStickersRequest, UpdateStickerRequest, StickerStats, RemovalReport, AdminStats, AdminAuditItem, AdminJob, MaintenanceJobType, StickerRow, StickerDetailRow, StickerRotateRow, MessageResponse, UpdateStickerResponse, SubmitReportResponse } from '../models/sticker.model';

@Injectable({
  providedIn: 'root'
})
export class StickerService {
  private http = inject(HttpClient);

  private apiUrl = '/api/v1';

  uploadImage(file: File, uploader: string): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploader', uploader);

    return this.http.post<UploadResponse>(`${this.apiUrl}/upload`, formData);
  }

  createSticker(stickerData: StickerData): Observable<MessageResponse> {
    const request: CreateStickersRequest = {
      stickers: [stickerData]
    };
    return this.http.post<MessageResponse>(`${this.apiUrl}/create_sticker`, request);
  }

  getAllStickers(): Observable<StickerRow[]> {
    return this.http.get<StickerRow[]>(`${this.apiUrl}/get_all_stickers`);
  }

  getSticker(id: number): Observable<StickerDetailRow> {
    return this.http.get<StickerDetailRow>(`${this.apiUrl}/get_sticker/${id}`);
  }

  updateSticker(id: number, data: UpdateStickerRequest): Observable<UpdateStickerResponse> {
    return this.http.patch<UpdateStickerResponse>(`${this.apiUrl}/sticker/${id}`, data);
  }

  deleteSticker(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.apiUrl}/sticker/${id}`);
  }

  getUploaders(): Observable<{ uploaders: string[] }> {
    return this.http.get<{ uploaders: string[] }>(`${this.apiUrl}/uploaders`);
  }

  rotateSticker(id: number, direction: 'cw' | 'ccw' | '180'): Observable<StickerRotateRow> {
    return this.http.patch<StickerRotateRow>(`${this.apiUrl}/stickers/${id}/rotate`, { direction });
  }

  getStats(): Observable<StickerStats> {
    return this.http.get<StickerStats>(`${this.apiUrl}/stats`);
  }

  submitRemovalReport(stickerId: number, proofImage?: File): Observable<SubmitReportResponse> {
    const formData = new FormData();
    if (proofImage) {
      formData.append('proof_image', proofImage);
    }
    return this.http.post<SubmitReportResponse>(`${this.apiUrl}/stickers/${stickerId}/reports`, formData);
  }

  getPendingReportsCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.apiUrl}/reports/pending`);
  }

  getStickerReports(stickerId: number): Observable<RemovalReport[]> {
    return this.http.get<RemovalReport[]>(`${this.apiUrl}/stickers/${stickerId}/reports`);
  }

  reviewReport(reportId: number, status: 'confirmed' | 'dismissed'): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/reports/${reportId}/review`, { status });
  }

  archiveSticker(id: number): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/stickers/${id}/archive`, {});
  }

  unarchiveSticker(id: number): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/stickers/${id}/unarchive`, {});
  }

  exportStickers(format: 'geojson' | 'csv'): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/stickers/export`, {
      params: { format },
      responseType: 'blob',
    });
  }

  getAdminStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.apiUrl}/admin/stats`);
  }

  getAdminAudit(): Observable<AdminAuditItem[]> {
    return this.http.get<AdminAuditItem[]>(`${this.apiUrl}/admin/audit`);
  }

  startMaintenanceJob(type: MaintenanceJobType): Observable<{ job_id: string }> {
    return this.http.post<{ job_id: string }>(`${this.apiUrl}/admin/jobs/${type}`, {});
  }

  getAdminJobStatus(jobId: string): Observable<AdminJob> {
    return this.http.get<AdminJob>(`${this.apiUrl}/admin/jobs/${jobId}`);
  }
}
