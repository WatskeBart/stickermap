import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { StickerService } from '../../../core/services/sticker.service';
import type { UpdateStickerRequest } from '../../../core/models/sticker.model';
import { CategorySelectorComponent } from '../../../shared/components/category-selector/category-selector.component';
import { isEpochSentinel, formatDateForInput, formatDateForBackend } from '../../../shared/utils/date-utils';

@Component({
  selector: 'app-edit-sticker-modal',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    CategorySelectorComponent,
    TranslatePipe,
  ],
  templateUrl: './edit-sticker-modal.component.html',
  styleUrl: './edit-sticker-modal.component.scss',
})
export class EditStickerModalComponent {
  readonly stickerId = input<number | null>(null);
  readonly isAdmin = input(false);
  readonly selectedLocation = input<{ lat: number; lon: number } | null>(null);

  readonly modalClosed = output<void>();
  readonly stickersChanged = output<void>();
  readonly locationSelectionStarted = output<void>();
  readonly locationSelectionCancelled = output<void>();

  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);

  editingSticker = signal<any>(null);
  editForm = signal<{
    poster: string;
    post_date: string;
    location: { lat: number; lon: number };
    uploader: string;
    category_id: number | null;
  } | null>(null);
  editCategoryId = signal<number | null>(null);
  editIsPrivate = signal(false);
  editSaving = signal(false);
  selectingLocation = signal(false);
  editImageUrl = signal('');
  editRotating = signal<'cw' | 'ccw' | null>(null);
  editHasRotated = signal(false);
  editPostDateInput = signal('');
  editDateUnknown = signal(false);
  uploaderList = signal<string[]>([]);
  private editPreviousPostDateInput = signal('');

  constructor(private stickerService: StickerService) {
    effect(() => {
      const id = this.stickerId();
      if (id !== null) {
        this.fetchAndOpen(id);
      } else {
        this.resetState();
      }
    });

    effect(() => {
      const loc = this.selectedLocation();
      if (loc === null) return;
      const form = this.editForm();
      if (form) {
        this.editForm.set({ ...form, location: loc });
        this.selectingLocation.set(false);
      }
    });
  }

  private fetchAndOpen(stickerId: number): void {
    this.stickerService.getUploaders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => this.uploaderList.set(response.uploaders),
      error: (err) => console.error('Failed to fetch uploaders:', err),
    });

    this.stickerService.getSticker(stickerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (sticker: any) => {
        const geom = JSON.parse(sticker[1]);
        this.editImageUrl.set(`/uploads/${sticker[6]}`);
        this.editHasRotated.set(false);
        this.editRotating.set(null);
        const categoryId: number | null = sticker[9] ?? null;
        const isPrivate: boolean = sticker[12] ?? false;
        this.editingSticker.set({
          id: sticker[0],
          poster: sticker[2],
          uploader: sticker[3],
          post_date: sticker[4],
          upload_date: sticker[5],
          image: sticker[6],
          uploaded_by: sticker[7],
          location: { lat: geom.coordinates[1], lon: geom.coordinates[0] },
          category_id: categoryId,
          private: isPrivate,
        });
        this.editForm.set({
          poster: sticker[2],
          post_date: sticker[4],
          location: { lat: geom.coordinates[1], lon: geom.coordinates[0] },
          uploader: sticker[3],
          category_id: categoryId,
        });
        const unknown = isEpochSentinel(sticker[4]);
        this.editDateUnknown.set(unknown);
        this.editPostDateInput.set(unknown ? '1970-01-01T00:00' : formatDateForInput(sticker[4]));
        this.editCategoryId.set(categoryId);
        this.editIsPrivate.set(isPrivate);
      },
      error: (err: any) => console.error('Failed to fetch sticker:', err),
    });
  }

  private resetState(): void {
    this.editingSticker.set(null);
    this.editForm.set(null);
    this.editCategoryId.set(null);
    this.editIsPrivate.set(false);
    this.editSaving.set(false);
    this.selectingLocation.set(false);
    this.editRotating.set(null);
    this.editHasRotated.set(false);
    this.editPostDateInput.set('');
    this.editDateUnknown.set(false);
    this.editPreviousPostDateInput.set('');
  }

  close(): void {
    this.modalClosed.emit();
  }

  saveEdit(): void {
    const sticker = this.editingSticker();
    const form = this.editForm();
    if (!sticker || !form) return;

    this.editSaving.set(true);
    const updates: UpdateStickerRequest = {};

    if (form.poster !== sticker.poster) updates.poster = form.poster;
    const newPostDate = this.editDateUnknown()
      ? '1970-01-01 00:00:00'
      : formatDateForBackend(this.editPostDateInput());
    if (newPostDate !== sticker.post_date) updates.post_date = newPostDate;
    if (form.location.lat !== sticker.location.lat || form.location.lon !== sticker.location.lon) {
      updates.location = form.location;
    }
    if (this.isAdmin() && form.uploader !== sticker.uploader) {
      updates.uploader = form.uploader;
    }
    if (this.editCategoryId() !== sticker.category_id) updates.category_id = this.editCategoryId();
    if (this.editIsPrivate() !== sticker.private) updates.private = this.editIsPrivate();

    if (Object.keys(updates).length === 0) {
      if (this.editHasRotated()) {
        this.editSaving.set(false);
        this.modalClosed.emit();
        this.stickersChanged.emit();
        this.snackBar.open(this.translate.instant('editSticker.updated'), this.translate.instant('common.close'), { duration: 3000 });
      } else {
        this.snackBar.open(this.translate.instant('editSticker.noChanges'), this.translate.instant('common.close'), { duration: 3000 });
        this.editSaving.set(false);
      }
      return;
    }

    this.stickerService
      .updateSticker(sticker.id, updates)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.editSaving.set(false);
          this.modalClosed.emit();
          this.stickersChanged.emit();
          this.snackBar.open(this.translate.instant('editSticker.updated'), this.translate.instant('common.close'), { duration: 3000 });
        },
        error: (err: any) => {
          this.editSaving.set(false);
          this.snackBar.open(
            this.translate.instant('editSticker.updateFailed', { detail: err.error?.detail || err.message }),
            this.translate.instant('common.close'),
            { duration: 5000, panelClass: ['snackbar-error'] },
          );
        },
      });
  }

  onDateUnknownChange(checked: boolean): void {
    if (checked) {
      this.editPreviousPostDateInput.set(this.editPostDateInput());
      this.editPostDateInput.set('1970-01-01T00:00');
    } else {
      this.editPostDateInput.set(this.editPreviousPostDateInput());
    }
    this.editDateUnknown.set(checked);
  }

  startLocationSelection(): void {
    this.selectingLocation.set(true);
    this.locationSelectionStarted.emit();
  }

  cancelLocationSelection(): void {
    this.selectingLocation.set(false);
    this.locationSelectionCancelled.emit();
  }

  rotateEdit(direction: 'cw' | 'ccw'): void {
    const sticker = this.editingSticker();
    if (!sticker) return;
    this.editRotating.set(direction);
    this.stickerService
      .rotateSticker(sticker.id, direction)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.editRotating.set(null);
          this.editHasRotated.set(true);
          const base = this.editImageUrl().split('?')[0];
          this.editImageUrl.set(`${base}?t=${Date.now()}`);
        },
        error: (err: any) => {
          this.editRotating.set(null);
          this.snackBar.open(
            this.translate.instant('editSticker.rotateFailed', { detail: err.error?.detail || err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }
}
