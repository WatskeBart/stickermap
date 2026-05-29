import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StickerService } from '../../core/services/sticker.service';
import type { RemovalReport } from '../../core/models/sticker.model';

export interface ReviewReportsDialogData {
  stickerId: number;
  poster: string;
}

export interface ReviewReportsDialogResult {
  changed: boolean;
}

@Component({
  selector: 'app-review-reports-dialog',
  standalone: true,
  imports: [
    SlicePipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatChipsModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './review-reports-dialog.component.html',
  styleUrl: './review-reports-dialog.component.scss',
})
export class ReviewReportsDialogComponent implements OnInit {
  private stickerService = inject(StickerService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  readonly data = inject<ReviewReportsDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject<MatDialogRef<ReviewReportsDialogComponent, ReviewReportsDialogResult>>(MatDialogRef);

  isLoading = signal(true);
  reports = signal<RemovalReport[]>([]);
  reviewingId = signal<number | null>(null);
  hasChanged = signal(false);
  fullSizeUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.loadReports();
  }

  private loadReports(): void {
    this.isLoading.set(true);
    this.stickerService
      .getStickerReports(this.data.stickerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reports) => {
          this.reports.set(reports);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  review(reportId: number, status: 'confirmed' | 'dismissed'): void {
    this.reviewingId.set(reportId);
    this.stickerService
      .reviewReport(reportId, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.hasChanged.set(true);
          this.reviewingId.set(null);
          this.loadReports();
        },
        error: () => {
          this.reviewingId.set(null);
        },
      });
  }

  close(): void {
    this.dialogRef.close({ changed: this.hasChanged() });
  }

  openFullSize(url: string): void {
    this.fullSizeUrl.set(url);
  }

  closeFullSize(): void {
    this.fullSizeUrl.set(null);
  }

  statusLabel(status: string): string {
    const key =
      status === 'pending'
        ? 'reviewReports.statusPending'
        : status === 'confirmed'
          ? 'reviewReports.statusConfirmed'
          : 'reviewReports.statusDismissed';
    return this.translate.instant(key);
  }

  pendingReports(): RemovalReport[] {
    return this.reports().filter((r) => r.review_status === 'pending');
  }

  reviewedReports(): RemovalReport[] {
    return this.reports().filter((r) => r.review_status !== 'pending');
  }
}
