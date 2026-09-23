/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, type ElementRef, type WritableSignal, computed, effect, inject, input, output, signal, viewChild } from "@angular/core";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatMenuModule } from "@angular/material/menu";

import "@noldova/teamrun-foundation-core";

import type { ImageSource } from "../../models/image-source";
import { ImageDimensions } from "../../models/image-dimensions";
import { ImageViewerData } from "../../models/image-viewer-data";
import { ImageDialogComponent } from "../image-dialog/image-dialog.component";
import { ImageOpenMode } from "../../enums/image-open-mode";
import { ImageActionsComponent } from "../image-actions/image-actions.component";
import { Resources } from "../../resources";
import { BridgeService } from "../../services/bridge.service";
import { NavigationService } from "../../services/navigation.service";
import { PreferencesService } from "../../services/preferences.service";

@Component({
  selector: "tr-image-preview",
  imports: [MatDialogModule, MatTooltipModule, MatMenuModule, ImageActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./image-preview.component.html"
})
export class ImagePreviewComponent {
  private static readonly sizes: Map<string, ImageDimensions> = new Map();
  public readonly image = input.required<ImageSource>();
  public readonly images = input<readonly ImageSource[]>([]);
  public readonly compact = input(false);
  public readonly showCaption = input(true);
  public readonly settled = output<void>();

  protected readonly source: WritableSignal<string | null> = signal(null);
  protected readonly dimensions: WritableSignal<ImageDimensions | null> = signal(null);
  private readonly bridge: BridgeService = inject(BridgeService);
  private readonly dialog: MatDialog = inject(MatDialog);
  private readonly navigation: NavigationService = inject(NavigationService);
  private readonly preferences: PreferencesService = inject(PreferencesService);
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>("trigger");
  protected readonly alternativeOpenMode = computed(() =>
    this.preferences.imageOpenMode() === ImageOpenMode.Popup ? ImageOpenMode.Tab : ImageOpenMode.Popup);
  private readonly path = computed(() => this.image().path);
  private readonly data = computed(() => this.image().data);

  public constructor() {
    effect(onCleanup => {
      const path = this.path();
      const data = this.data();
      let cancelled = false;
      onCleanup(() => cancelled = true);
      this.source.set(null);
      this.dimensions.set(Object.isNull(path) ? null : ImagePreviewComponent.sizes.get(path) ?? null);
      void this.decode(path, data).then(image => {
        if (cancelled)
          return;
        const size = Object.isNull(image) ? null : new ImageDimensions(image.naturalWidth, image.naturalHeight);
        this.dimensions.set(size);
        this.source.set(image?.src ?? null);
        if (!Object.isNull(path))
          ImagePreviewComponent.remember(path, size);
        this.settled.emit();
      });
    });
  }

  protected open(mode: ImageOpenMode = this.preferences.imageOpenMode()): void {
    if (mode === ImageOpenMode.Tab) {
      this.navigation.openImage(this.image());
      return;
    }
    const opened = this.dialog.open(ImageDialogComponent, {
      data: new ImageViewerData(this.image(), this.images()),
      panelClass: Resources.imageViewerPanelClass,
      backdropClass: Resources.imageViewerBackdropClass,
      width: Resources.imageViewerWidth,
      height: Resources.imageViewerHeight,
      maxWidth: Resources.imageViewerWidth,
      ariaLabel: this.image().label,
      autoFocus: Resources.imageViewerInitialFocus,
      restoreFocus: false
    });
    opened.afterClosed().subscribe(() => this.trigger()?.nativeElement.focus());
  }

  private async decode(path: string | null, data: string | null): Promise<HTMLImageElement | null> {
    try {
      const source = data ?? (Object.isNull(path) ? null : await this.bridge.readImage(path));
      if (Object.isNull(source))
        return null;
      const image = new Image();
      image.src = source;
      await image.decode();
      return image;
    }
    catch {
      return null;
    }
  }

  private static remember(path: string, size: ImageDimensions | null): void {
    this.sizes.delete(path);
    if (!Object.isNull(size))
      this.sizes.set(path, size);
    if (this.sizes.size > Resources.imageDimensionCacheLimit) {
      const oldest = this.sizes.keys().next().value;
      if (!Object.isUndefined(oldest))
        this.sizes.delete(oldest);
    }
  }
}
