import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { CHANGELOG_DATA, ChangelogRelease } from '../../../core/models/changelog.model';

@Component({
  selector: 'app-changelog-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatExpansionModule],
  templateUrl: './changelog-dialog.component.html',
  styleUrls: ['./changelog-dialog.component.scss'],
})
export class ChangelogDialogComponent {
  private dialogRef = inject(MatDialogRef<ChangelogDialogComponent>);

  readonly latestRelease: ChangelogRelease | undefined = CHANGELOG_DATA.find((r) => r.version !== 'Unreleased');
  readonly olderReleases: ChangelogRelease[] = CHANGELOG_DATA.filter(
    (r) => r.version !== 'Unreleased' && r !== this.latestRelease,
  );
  readonly unreleasedEntry: ChangelogRelease | undefined = CHANGELOG_DATA.find((r) => r.version === 'Unreleased');

  readonly sectionIconMap: Record<string, string> = {
    Added: 'add_circle',
    Changed: 'change_circle',
    Fixed: 'bug_report',
    Dependencies: 'package_2',
    Docs: 'description',
  };

  close(): void {
    this.dialogRef.close();
  }
}
