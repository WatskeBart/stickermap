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
  ],
  templateUrl: './category-selector.component.html',
  styleUrl: './category-selector.component.scss',
})
export class CategorySelectorComponent implements OnInit {
  readonly categoryId = model<number | null>(null);
  readonly allowCreate = input(true);
  readonly label = input('Categorie');

  private readonly categoryService = inject(CategoryService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

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
      this.snackBar.open('Vul een naam in', 'Sluiten', { duration: 3000 });
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
          const msg = category.approved
            ? 'Categorie aangemaakt.'
            : 'Categorie aangemaakt — wacht op goedkeuring door een admin.';
          this.snackBar.open(msg, 'Sluiten', { duration: 4000 });
        },
        error: (err) => {
          this.creating.set(false);
          this.snackBar.open(
            `Aanmaken mislukt: ${err.error?.detail ?? err.message}`,
            'Sluiten',
            { duration: 5000 },
          );
        },
      });
  }
}
