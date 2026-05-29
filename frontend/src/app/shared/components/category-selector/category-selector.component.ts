import {
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CategoryService } from '../../../core/services/category.service';
import type { Category } from '../../../core/models/category.model';

/**
 * Shared dropdown to pick (or propose) a sticker category.
 * - Binds the selected category id via two-way model().
 * - Editor/admin sees pending categories; uploader-only sees approved+non-archived (server filters this).
 * - "Add new category" inline creator sends a creation request and selects the new id (pending approval).
 */
@Component({
  selector: 'app-category-selector',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './category-selector.component.html',
  styleUrl: './category-selector.component.scss',
})
export class CategorySelectorComponent implements OnInit {
  readonly categoryId = model<number | null>(null);
  readonly allowCreate = input(true);
  /** Translation key for the field label (default: the shared "Category" label). */
  readonly label = input('categorySelector.label');

  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly showCreateForm = signal(false);
  readonly newCategoryName = signal('');

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.loading.set(true);
    this.categoryService
      .listCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.categories.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  onSelect(value: number | null): void {
    this.categoryId.set(value);
  }

  clear(): void {
    this.categoryId.set(null);
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
    this.newCategoryName.set('');
  }

  cancelCreate(): void {
    this.showCreateForm.set(false);
    this.newCategoryName.set('');
  }

  submitCreate(): void {
    const name = this.newCategoryName().trim();
    if (!name) {
      this.snackBar.open(this.translate.instant('categorySelector.enterName'), this.translate.instant('common.close'), { duration: 3000 });
      return;
    }
    this.creating.set(true);
    this.categoryService
      .createCategory(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (category) => {
          this.creating.set(false);
          this.showCreateForm.set(false);
          this.newCategoryName.set('');
          const current = this.categories();
          if (!current.find((c) => c.id === category.id)) {
            this.categories.set([...current, category].sort((a, b) => a.name.localeCompare(b.name)));
          }
          this.categoryId.set(category.id);
          const msg = this.translate.instant(
            category.approved ? 'categorySelector.created' : 'categorySelector.createdPending',
          );
          this.snackBar.open(msg, this.translate.instant('common.close'), { duration: 4000 });
        },
        error: (err) => {
          this.creating.set(false);
          this.snackBar.open(
            this.translate.instant('categorySelector.createFailed', { detail: err.error?.detail ?? err.message }),
            this.translate.instant('common.close'),
            { duration: 5000 },
          );
        },
      });
  }
}
