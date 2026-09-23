/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, viewChild } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenu, MatMenuModule } from "@angular/material/menu";
import { MatDividerModule } from "@angular/material/divider";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources";
import type { ImageOpenMode } from "../../enums/image-open-mode";

@Component({
  selector: "tr-image-actions",
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, MatDividerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "contents" },
  templateUrl: "./image-actions.component.html"
})
export class ImageActionsComponent {
  public readonly source = input<string | null>(null);
  public readonly name = input.required<string>();
  public readonly toolbar = input(false);
  public readonly alternativeOpenMode = input<ImageOpenMode | null>(null);
  public readonly openRequested = output<ImageOpenMode>();
  public readonly menu = viewChild(MatMenu);
  protected readonly resources: typeof Resources = Resources;
  protected readonly copying = signal(false);
  protected readonly copied = signal(false);
  private readonly notifications: MatSnackBar = inject(MatSnackBar);
  private readonly destroy: DestroyRef = inject(DestroyRef);
  private timer: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    effect(() => {
      this.source();
      this.copied.set(false);
    });
    this.destroy.onDestroy(() => {
      if (!Object.isNull(this.timer))
        clearTimeout(this.timer);
    });
  }

  protected async copy(): Promise<void> {
    const source = this.source();
    if (Object.isNull(source) || this.copying())
      return;
    this.copying.set(true);
    try {
      await navigator.clipboard.write([new ClipboardItem({ [Resources.clipboardImageMediaType]: this.png(source) })]);
      if (this.destroy.destroyed || source !== this.source())
        return;
      this.copied.set(true);
      if (!Object.isNull(this.timer))
        clearTimeout(this.timer);
      this.timer = setTimeout(() => this.copied.set(false), Resources.copiedDuration);
    }
    catch {
      if (!this.destroy.destroyed)
        this.notifications.open(Resources.imageCopyFailed, Resources.closeLabel);
    }
    finally {
      this.copying.set(false);
    }
  }

  private async png(source: string): Promise<Blob> {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement(Resources.canvasElement);
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext(Resources.canvasContext);
    if (Object.isNull(context))
      throw new Error(Resources.imageCopyFailed);
    context.drawImage(image, 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (Object.isNull(blob))
        reject(new Error(Resources.imageCopyFailed));
      else
        resolve(blob);
    }, Resources.clipboardImageMediaType));
  }
}
