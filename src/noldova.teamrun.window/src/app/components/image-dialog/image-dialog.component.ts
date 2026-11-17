/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type InputSignal, type OutputEmitterRef, inject, input, output } from "@angular/core";

import { type DialogService, DialogTokens } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import type { ImageViewerData } from "../../models/image-viewer-data";
import type { ImageViewerService } from "../../services/image-viewer.service";
import { ImageViewerComponent } from "../image-viewer/image-viewer.component";

@Component({
  selector: "nol-teamrun-image-dialog",
  imports: [ImageViewerComponent],
  templateUrl: "./image-dialog.component.html"
})
export class ImageDialogComponent {
  protected readonly titleId: string = inject(DialogTokens.titleId);

  public readonly data: InputSignal<ImageViewerData> = input.required<ImageViewerData>();
  public readonly viewer: InputSignal<ImageViewerService> = input.required<ImageViewerService>();
  public readonly closed: OutputEmitterRef<void> = output<void>();

  public static open(dialogs: DialogService, viewer: ImageViewerService, data: ImageViewerData, returnFocus: HTMLElement | null): void {
    const dialog = dialogs.open(ImageDialogComponent, Resources.imageCloseSelector);
    dialog.componentRef?.setInput("viewer", viewer);
    dialog.componentRef?.setInput("data", data);
    dialog.closed.subscribe(() => returnFocus?.focus());
    dialog.componentInstance?.closed.subscribe(() => dialog.close());
  }
}
