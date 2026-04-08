import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { StickerService } from '../../../core/services/sticker.service';

export interface DeleteDialogData {
  stickerId: number;
  poster: string;
}

export interface DeleteDialogResult {
  deleted: boolean;
}

@Component({
  selector: 'app-delete-sticker-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './delete-sticker-dialog.component.html',
})
export class DeleteStickerDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<DeleteStickerDialogComponent>);
  data: DeleteDialogData = inject(MAT_DIALOG_DATA);
  private stickerService = inject(StickerService);
  private destroyRef = inject(DestroyRef);

  deleting = signal(false);

  ngOnInit(): void {}

  confirmDelete(): void {
    this.deleting.set(true);
    this.stickerService.deleteSticker(this.data.stickerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.deleting.set(false);
        this.dialogRef.close({ deleted: true } satisfies DeleteDialogResult);
      },
      error: (err: unknown) => {
        console.error('Delete failed:', err);
        this.deleting.set(false);
        this.dialogRef.close({ deleted: false } satisfies DeleteDialogResult);
      },
    });
  }

  cancel(): void {
    this.dialogRef.close({ deleted: false } satisfies DeleteDialogResult);
  }
}
