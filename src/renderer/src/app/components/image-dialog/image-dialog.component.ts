/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

import type { ImageViewerData } from "../../models/image-viewer-data";
import { ImageViewerComponent } from "../image-viewer/image-viewer.component";

@Component({
  selector: "tr-image-dialog",
  imports: [ImageViewerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block h-full" },
  templateUrl: "./image-dialog.component.html"
})
export class ImageDialogComponent {
  protected readonly data: ImageViewerData = inject(MAT_DIALOG_DATA);
  protected readonly dialog: MatDialogRef<ImageDialogComponent> = inject(MatDialogRef);
}
