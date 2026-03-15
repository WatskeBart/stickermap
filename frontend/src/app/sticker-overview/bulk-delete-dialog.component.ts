import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface BulkDeleteDialogData {
  count: number;
}

@Component({
  selector: 'app-bulk-delete-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './bulk-delete-dialog.component.html',
})
export class BulkDeleteDialogComponent {
  data: BulkDeleteDialogData = inject(MAT_DIALOG_DATA);
  private dialogRef = inject(MatDialogRef<BulkDeleteDialogComponent>);

  confirm(): void {
    this.dialogRef.close(true);
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
