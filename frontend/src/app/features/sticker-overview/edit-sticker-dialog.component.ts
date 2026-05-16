import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { StickerService } from '../../core/services/sticker.service';
import type { ParsedSticker, UpdateStickerRequest } from '../../core/models/sticker.model';
import { CategorySelectorComponent } from '../../shared/components/category-selector/category-selector.component';

export interface EditDialogData {
  sticker: ParsedSticker;
  isAdmin: boolean;
  canArchive: boolean;
}

export interface EditDialogResult {
  updated: boolean;
  archived?: boolean;
}

@Component({
  selector: 'app-edit-sticker-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCheckboxModule,
    CategorySelectorComponent,
  ],
  templateUrl: './edit-sticker-dialog.component.html',
  styleUrl: './edit-sticker-dialog.component.scss',
})
export class EditStickerDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<EditStickerDialogComponent>);
  data: EditDialogData = inject(MAT_DIALOG_DATA);
  private stickerService = inject(StickerService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  saving = signal(false);
  archiving = signal(false);
  rotating = signal<'cw' | 'ccw' | null>(null);
  hasRotated = signal(false);
  imageUrl = signal('');
  uploaderList = signal<string[]>([]);

  poster = signal('');
  postDate = signal('');
  lat = signal(0);
  lon = signal(0);
  uploader = signal('');
  categoryId = signal<number | null>(null);
  isPrivate = signal(false);

  ngOnInit(): void {
    const s = this.data.sticker;
    this.imageUrl.set(s.imageUrl);
    this.poster.set(s.poster);
    this.postDate.set(s.post_date);
    this.lat.set(s.lat);
    this.lon.set(s.lon);
    this.uploader.set(s.uploader);
    this.categoryId.set(s.category_id);
    this.isPrivate.set(s.private ?? false);

    if (this.data.isAdmin) {
      this.stickerService.getUploaders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => this.uploaderList.set(res.uploaders),
        error: (err) => console.error('Uploaders ophalen mislukt:', err),
      });
    }
  }

  save(): void {
    const s = this.data.sticker;
    const updates: UpdateStickerRequest = {};

    if (this.poster() !== s.poster) updates.poster = this.poster();
    if (this.postDate() !== s.post_date) updates.post_date = this.postDate();
    if (this.lat() !== s.lat || this.lon() !== s.lon) {
      updates.location = { lat: this.lat(), lon: this.lon() };
    }
    if (this.data.isAdmin && this.uploader() !== s.uploader) {
      updates.uploader = this.uploader();
    }
    if (this.categoryId() !== s.category_id) {
      updates.category_id = this.categoryId();
    }
    if (this.isPrivate() !== s.private) {
      updates.private = this.isPrivate();
    }

    if (Object.keys(updates).length === 0) {
      if (this.hasRotated()) {
        this.dialogRef.close({ updated: true } satisfies EditDialogResult);
      } else {
        this.snackBar.open('Geen wijzigingen gedetecteerd', 'Sluiten', { duration: 3000 });
      }
      return;
    }

    this.saving.set(true);
    this.stickerService.updateSticker(s.id, updates).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.close({ updated: true } satisfies EditDialogResult);
      },
      error: (err: any) => {
        this.saving.set(false);
        this.snackBar.open(
          `Bijwerken mislukt: ${err.error?.detail || err.message}`,
          'Sluiten',
          { duration: 5000 },
        );
      },
    });
  }

  rotate(direction: 'cw' | 'ccw'): void {
    this.rotating.set(direction);
    this.stickerService.rotateSticker(this.data.sticker.id, direction)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rotating.set(null);
          this.hasRotated.set(true);
          const base = this.imageUrl().split('?')[0];
          this.imageUrl.set(`${base}?t=${Date.now()}`);
        },
        error: (err: any) => {
          this.rotating.set(null);
          this.snackBar.open(
            `Roteren mislukt: ${err.error?.detail || err.message}`,
            'Sluiten',
            { duration: 5000 },
          );
        },
      });
  }

  archive(): void {
    this.archiving.set(true);
    this.stickerService.archiveSticker(this.data.sticker.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.archiving.set(false);
          this.dialogRef.close({ updated: true, archived: true } satisfies EditDialogResult);
        },
        error: (err: any) => {
          this.archiving.set(false);
          this.snackBar.open(
            `Archiveren mislukt: ${err.error?.detail || err.message}`,
            'Sluiten',
            { duration: 5000 },
          );
        },
      });
  }

  cancel(): void {
    this.dialogRef.close({ updated: this.hasRotated() } satisfies EditDialogResult);
  }
}
