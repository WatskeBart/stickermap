import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CategoryService } from '../../core/services/category.service';
import { AuthService } from '../../core/services/auth.service';
import type { Category } from '../../core/models/category.model';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    TranslatePipe,
  ],
  templateUrl: './category-management.component.html',
  styleUrl: './category-management.component.scss',
})
export class CategoryManagementComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly isAdmin = computed(() => this.authService.isAdmin());

  readonly loading = signal(false);
  readonly rows = signal<Category[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly editingName = signal('');
  readonly newCategoryName = signal('');
  readonly creating = signal(false);
  readonly iconUploadingId = signal<number | null>(null);

  readonly displayedColumns = ['icon', 'name', 'status', 'created_by', 'actions'];

  readonly dataSource = new MatTableDataSource<Category>([]);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.categoryService
      .listCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.dataSource.data = rows;
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.snackBar.open(
            this.translate.instant('categoryManagement.loadFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  createCategory(): void {
    const name = this.newCategoryName().trim();
    if (!name) return;
    this.creating.set(true);
    this.categoryService
      .createCategory(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.creating.set(false);
          this.newCategoryName.set('');
          this.snackBar.open(this.translate.instant('categoryManagement.created'), this.translate.instant('common.close'), { duration: 3000 });
          this.load();
        },
        error: (err) => {
          this.creating.set(false);
          this.snackBar.open(
            this.translate.instant('categoryManagement.createFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  startEdit(c: Category): void {
    this.editingId.set(c.id);
    this.editingName.set(c.name);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingName.set('');
  }

  saveRename(c: Category): void {
    const name = this.editingName().trim();
    if (!name || name === c.name) {
      this.cancelEdit();
      return;
    }
    this.categoryService
      .updateCategory(c.id, { name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelEdit();
          this.load();
          this.snackBar.open(this.translate.instant('categoryManagement.renamed'), this.translate.instant('common.close'), { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open(
            this.translate.instant('categoryManagement.renameFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  approve(c: Category): void {
    this.categoryService
      .updateCategory(c.id, { approved: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.load();
          this.snackBar.open(this.translate.instant('categoryManagement.approved'), this.translate.instant('common.close'), { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open(
            this.translate.instant('categoryManagement.approveFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  toggleArchive(c: Category): void {
    const archived = c.archived_at == null;
    this.categoryService
      .updateCategory(c.id, { archived })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.load();
          this.snackBar.open(
            this.translate.instant(archived ? 'categoryManagement.deactivated' : 'categoryManagement.activated'),
            this.translate.instant('common.close'),
            { duration: 3000 },
          );
        },
        error: (err) => {
          this.snackBar.open(
            this.translate.instant('categoryManagement.updateFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  onIconSelected(event: Event, c: Category): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.iconUploadingId.set(c.id);
    this.categoryService
      .uploadIcon(c.id, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.iconUploadingId.set(null);
          this.load();
          this.snackBar.open(this.translate.instant('categoryManagement.iconUploaded'), this.translate.instant('common.close'), { duration: 3000 });
        },
        error: (err) => {
          this.iconUploadingId.set(null);
          this.snackBar.open(
            this.translate.instant('categoryManagement.iconUploadFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  removeIcon(c: Category): void {
    if (!c.icon_filename) return;
    this.categoryService
      .deleteIcon(c.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.load();
          this.snackBar.open(this.translate.instant('categoryManagement.iconRemoved'), this.translate.instant('common.close'), { duration: 3000 });
        },
        error: (err) => {
          this.snackBar.open(
            this.translate.instant('categoryManagement.iconRemoveFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }
}
