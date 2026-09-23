/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";

import { ConfirmRequest } from "../../models/confirm-request";
import { Resources } from "../../resources";

@Component({
  selector: "tr-confirm-dialog",
  imports: [MatButtonModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./confirm-dialog.component.html"
})
export class ConfirmDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly request: ConfirmRequest = inject<ConfirmRequest>(MAT_DIALOG_DATA);
  private readonly dialog: MatDialogRef<ConfirmDialogComponent, boolean> = inject(MatDialogRef);

  protected confirm(): void {
    this.dialog.close(true);
  }
}
