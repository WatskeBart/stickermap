import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { StickerService } from '../services/sticker.service';
import type { ParsedSticker, UpdateStickerRequest } from '../models/sticker.model';

export interface EditDialogData {
  sticker: ParsedSticker;
  isAdmin: boolean;
}

export interface EditDialogResult {
  updated: boolean;
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
    MatProgressSpinnerModule,
  ],
  templateUrl: './edit-sticker-dialog.component.html',
})
export class EditStickerDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<EditStickerDialogComponent>);
  data: EditDialogData = inject(MAT_DIALOG_DATA);
  private stickerService = inject(StickerService);
  private snackBar = inject(MatSnackBar);

  saving = signal(false);
  uploaderList = signal<string[]>([]);

  poster = signal('');
  postDate = signal('');
  lat = signal(0);
  lon = signal(0);
  uploader = signal('');

  ngOnInit(): void {
    const s = this.data.sticker;
    this.poster.set(s.poster);
    this.postDate.set(s.post_date);
    this.lat.set(s.lat);
    this.lon.set(s.lon);
    this.uploader.set(s.uploader);

    if (this.data.isAdmin) {
      this.stickerService.getUploaders().subscribe({
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

    if (Object.keys(updates).length === 0) {
      this.snackBar.open('Geen wijzigingen gedetecteerd', 'Sluiten', { duration: 3000 });
      return;
    }

    this.saving.set(true);
    this.stickerService.updateSticker(s.id, updates).subscribe({
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

  cancel(): void {
    this.dialogRef.close({ updated: false } satisfies EditDialogResult);
  }
}
