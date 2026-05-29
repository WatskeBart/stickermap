import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StickerService } from '../../../core/services/sticker.service';

export interface ReportRemovalDialogData {
  stickerId: number;
  poster: string;
}

export interface ReportRemovalDialogResult {
  reported: boolean;
}

@Component({
  selector: 'app-report-removal-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './report-removal-dialog.component.html',
  styleUrl: './report-removal-dialog.component.scss',
})
export class ReportRemovalDialogComponent {
  private stickerService = inject(StickerService);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  readonly data = inject<ReportRemovalDialogData>(MAT_DIALOG_DATA);
  private dialogRef = inject<MatDialogRef<ReportRemovalDialogComponent, ReportRemovalDialogResult>>(MatDialogRef);

  submitting = signal(false);
  proofFile = signal<File | null>(null);
  errorMessage = signal<string | null>(null);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.proofFile.set(input.files[0]);
      this.errorMessage.set(null);
    }
  }

  clearFile(): void {
    this.proofFile.set(null);
  }

  submit(): void {
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.stickerService
      .submitRemovalReport(this.data.stickerId, this.proofFile() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close({ reported: true });
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err.error?.detail ?? this.translate.instant('reportRemoval.failed'));
        },
      });
  }
}
