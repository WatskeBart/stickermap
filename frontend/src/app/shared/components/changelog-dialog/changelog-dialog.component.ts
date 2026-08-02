import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslatePipe } from '@ngx-translate/core';
import { CHANGELOG_DATA, ChangelogRelease } from '../../../core/models/changelog.model';

@Component({
  selector: 'app-changelog-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatExpansionModule, TranslatePipe],
  templateUrl: './changelog-dialog.component.html',
  styleUrl: './changelog-dialog.component.scss',
})
export class ChangelogDialogComponent {
  private dialogRef = inject(MatDialogRef<ChangelogDialogComponent>);

  readonly latestRelease: ChangelogRelease | undefined = CHANGELOG_DATA.find((r) => r.version !== 'Unreleased');
  readonly olderReleases: ChangelogRelease[] = CHANGELOG_DATA.filter(
    (r) => r.version !== 'Unreleased' && r !== this.latestRelease,
  );
  readonly unreleasedEntry: ChangelogRelease | undefined = CHANGELOG_DATA.find((r) => r.version === 'Unreleased');

  close(): void {
    this.dialogRef.close();
  }
}
