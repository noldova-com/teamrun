/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type WritableSignal, inject, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";

import { Resources } from "../../resources";

@Component({
  selector: "tr-rewind-dialog",
  imports: [MatButtonModule, MatCheckboxModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./rewind-dialog.component.html"
})
export class RewindDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly restoreFiles: WritableSignal<boolean> = signal(true);
  private readonly dialog: MatDialogRef<RewindDialogComponent, boolean> = inject(MatDialogRef);

  protected confirm(): void {
    this.dialog.close(this.restoreFiles());
  }
}
