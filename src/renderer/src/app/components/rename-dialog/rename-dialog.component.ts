/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type WritableSignal, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";

@Component({
  selector: "tr-rename-dialog",
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./rename-dialog.component.html"
})
export class RenameDialogComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly title: WritableSignal<string> = signal(inject<string>(MAT_DIALOG_DATA));
  private readonly dialog: MatDialogRef<RenameDialogComponent, string> = inject(MatDialogRef);

  protected canSave(): boolean {
    return !String.isNullOrWhitespace(this.title());
  }

  protected save(event: globalThis.Event): void {
    event.preventDefault();
    if (this.canSave())
      this.dialog.close(this.title().trim());
  }
}
