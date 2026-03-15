import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { forkJoin } from 'rxjs';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

import { Router } from '@angular/router';
import { StickerService } from '../services/sticker.service';
import { AuthService } from '../services/auth.service';
import type { ParsedSticker } from '../models/sticker.model';
import {
  DeleteStickerDialogComponent,
  type DeleteDialogData,
  type DeleteDialogResult,
} from '../map/delete-sticker-dialog.component';
import {
  EditStickerDialogComponent,
  type EditDialogData,
  type EditDialogResult,
} from './edit-sticker-dialog.component';
import {
  BulkDeleteDialogComponent,
  type BulkDeleteDialogData,
} from './bulk-delete-dialog.component';

@Component({
  selector: 'app-sticker-overview',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './sticker-overview.component.html',
  styleUrl: './sticker-overview.component.scss',
})
export class StickerOverviewComponent implements OnInit {
  private readonly sort = viewChild(MatSort);
  private readonly paginator = viewChild(MatPaginator);

  private stickerService = inject(StickerService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  private readonly _ = effect(() => {
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.paginator = this.paginator() ?? null;
  });

  isLoading = signal(false);
  dataSource = new MatTableDataSource<ParsedSticker>([]);
  selection = new SelectionModel<ParsedSticker>(true, []);
  hasSelection = signal(false);
  filterValue = signal('');
  fullSizeImageUrl = signal<string | null>(null);

  isAuthenticated = computed(() => this.authService.isAuthenticated());
  isAdmin = computed(() => this.authService.isAdmin());
  isUploader = computed(() => this.authService.isUploader());
  isEditor = computed(() => this.authService.isEditor());
  currentUser = computed(() => this.authService.getUserInfo()?.preferred_username ?? null);
  bulkDeleteEnabled = computed(() => this.isAdmin() && this.hasSelection());

  displayedColumns = computed<string[]>(() => {
    const base: string[] = ['thumbnail', 'poster', 'uploader', 'post_date', 'upload_date', 'location', 'view-on-map'];
    if (this.isAuthenticated()) base.push('actions');
    return this.isAdmin() ? ['select', ...base] : base;
  });

  ngOnInit(): void {
    this.selection.changed.subscribe(() => {
      this.hasSelection.set(this.selection.hasValue());
    });
    this.dataSource.filterPredicate = (data: ParsedSticker, filter: string) => {
      const normalized = filter.trim().toLowerCase();
      return (
        data.poster.toLowerCase().includes(normalized) ||
        data.uploader.toLowerCase().includes(normalized)
      );
    };
    this.loadStickers();
  }

  applyFilter(value: string): void {
    this.filterValue.set(value);
    this.dataSource.filter = value.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private loadStickers(): void {
    this.isLoading.set(true);
    this.selection.clear();
    this.stickerService.getAllStickers().subscribe({
      next: (raw: any[]) => {
        const currentUser = this.currentUser();
        const parsed: ParsedSticker[] = raw.map((s: any) => {
          const geom = JSON.parse(s[1]);
          const [lon, lat] = geom.coordinates;
          const uploadedBy: string = s[7];
          const isOwner = uploadedBy != null && uploadedBy === currentUser;
          return {
            id: s[0],
            lat,
            lon,
            poster: s[2],
            uploader: s[3],
            post_date: s[4],
            upload_date: s[5],
            image: s[6],
            uploaded_by: uploadedBy,
            imageUrl: `/uploads/${s[6]}`,
            canEdit: this.isEditor() || this.isAdmin() || (this.isUploader() && isOwner),
            canDelete: this.isAdmin(),
          };
        });
        this.dataSource.data = parsed;
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Stickers laden mislukt:', err);
        this.isLoading.set(false);
      },
    });
  }

  isAllSelected(): boolean {
    return (
      this.selection.selected.length === this.dataSource.data.length &&
      this.dataSource.data.length > 0
    );
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.data.forEach((row) => this.selection.select(row));
    }
  }

  openEdit(sticker: ParsedSticker): void {
    const ref = this.dialog.open(EditStickerDialogComponent, {
      width: '480px',
      data: { sticker, isAdmin: this.isAdmin() } satisfies EditDialogData,
    });
    ref.afterClosed().subscribe((result: EditDialogResult | undefined) => {
      if (result?.updated) {
        this.loadStickers();
        this.snackBar.open('Sticker succesvol bijgewerkt!', 'Sluiten', { duration: 3000 });
      }
    });
  }

  openDelete(sticker: ParsedSticker): void {
    const ref = this.dialog.open(DeleteStickerDialogComponent, {
      width: '400px',
      data: { stickerId: sticker.id, poster: sticker.poster } satisfies DeleteDialogData,
    });
    ref.afterClosed().subscribe((result: DeleteDialogResult | undefined) => {
      if (result?.deleted) {
        this.loadStickers();
        this.snackBar.open('Sticker verwijderd.', 'Sluiten', { duration: 3000 });
      }
    });
  }

  openBulkDelete(): void {
    const selected = this.selection.selected;
    if (!selected.length) return;

    const ref = this.dialog.open(BulkDeleteDialogComponent, {
      width: '400px',
      data: { count: selected.length } satisfies BulkDeleteDialogData,
    });
    ref.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (!confirmed) return;
      const ids = selected.map((s) => s.id);
      forkJoin(ids.map((id) => this.stickerService.deleteSticker(id))).subscribe({
        next: () => {
          this.loadStickers();
          this.snackBar.open(`${ids.length} sticker(s) verwijderd.`, 'Sluiten', { duration: 3000 });
        },
        error: () => {
          this.loadStickers();
          this.snackBar.open('Verwijderen deels mislukt.', 'Sluiten', { duration: 5000 });
        },
      });
    });
  }

  goToMap(sticker: ParsedSticker): void {
    this.router.navigate(['/map'], {
      queryParams: { lat: sticker.lat, lon: sticker.lon, id: sticker.id },
    });
  }

  openFullSize(imageUrl: string): void {
    this.fullSizeImageUrl.set(imageUrl);
  }

  closeFullSize(): void {
    this.fullSizeImageUrl.set(null);
  }
}
