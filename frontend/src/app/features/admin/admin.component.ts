import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, switchMap, takeWhile } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { StickerService } from '../../core/services/sticker.service';
import type { AdminStats, AdminAuditItem, AdminJob, MaintenanceJobType } from '../../core/models/sticker.model';

interface JobState {
  id: string;
  info: AdminJob;
}

interface ActionDef {
  type: MaintenanceJobType;
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatExpansionModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private readonly stickerService = inject(StickerService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly stats = signal<AdminStats | null>(null);
  readonly statsLoading = signal(false);
  readonly auditItems = signal<AdminAuditItem[]>([]);
  readonly auditLoading = signal(false);
  readonly auditColumns = ['id', 'image', 'thumbnail', 'issues'];

  readonly jobs = signal<Partial<Record<MaintenanceJobType, JobState>>>({});

  readonly actions: ActionDef[] = [
    {
      type: 'generate-thumbnails',
      icon: 'image_search',
      title: 'Ontbrekende thumbnails genereren',
      description: 'Genereert thumbnail-bestanden voor stickers waarbij de thumbnail ontbreekt in de database of op schijf.',
    },
    {
      type: 'compress-images',
      icon: 'compress',
      title: 'Afbeeldingen comprimeren',
      description: `Comprimeert afbeeldingen waarvan de langste zijde groter is dan ${1920}px naar het standaard formaat.`,
    },
    {
      type: 'strip-exif',
      icon: 'no_photography',
      title: 'EXIF-data verwijderen',
      description: 'Verwijdert alle EXIF-metadata (locatie, apparaatinfo) uit bestaande afbeeldingen voor meer privacy.',
    },
    {
      type: 'cleanup-orphans',
      icon: 'delete_sweep',
      title: 'Ontbrekende bestanden opruimen',
      description: 'Verwijdert bestanden in de upload-map die niet meer gekoppeld zijn aan een sticker of rapport.',
    },
  ];

  isRunning = computed(() => {
    const j = this.jobs();
    return (type: MaintenanceJobType) => j[type]?.info.status === 'running';
  });

  ngOnInit(): void {
    this.loadStats();
    this.loadAudit();
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.stickerService.getAdminStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => { this.stats.set(s); this.statsLoading.set(false); },
        error: () => this.statsLoading.set(false),
      });
  }

  loadAudit(): void {
    this.auditLoading.set(true);
    this.stickerService.getAdminAudit()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => { this.auditItems.set(items); this.auditLoading.set(false); },
        error: () => this.auditLoading.set(false),
      });
  }

  startJob(type: MaintenanceJobType): void {
    this.stickerService.startMaintenanceJob(type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ job_id }) => this.pollJob(type, job_id),
        error: () => this.snackBar.open('Kon taak niet starten.', 'Sluiten', { duration: 4000 }),
      });
  }

  private pollJob(type: MaintenanceJobType, jobId: string): void {
    interval(3000).pipe(
      switchMap(() => this.stickerService.getAdminJobStatus(jobId)),
      takeWhile((s) => s.status === 'running', true),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (info) => {
        this.jobs.update((j) => ({ ...j, [type]: { id: jobId, info } }));
        if (info.status !== 'running') {
          this.onJobFinished(type, info);
        }
      },
      error: () => this.snackBar.open('Fout bij ophalen taakstatus.', 'Sluiten', { duration: 4000 }),
    });
  }

  private onJobFinished(type: MaintenanceJobType, job: AdminJob): void {
    const action = this.actions.find((a) => a.type === type);
    const label = action?.title ?? type;
    if (job.status === 'done') {
      this.snackBar.open(`✓ ${label}: ${job.processed} verwerkt.`, 'Sluiten', { duration: 6000 });
      this.loadStats();
      this.loadAudit();
    } else {
      this.snackBar.open(`✗ ${label}: fout opgetreden (${job.errors.length} fout(en)).`, 'Sluiten', { duration: 8000 });
    }
  }

  jobFor(type: MaintenanceJobType): JobState | undefined {
    return this.jobs()[type];
  }
}
