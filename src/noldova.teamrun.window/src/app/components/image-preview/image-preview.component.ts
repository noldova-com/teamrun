/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type ElementRef, type InputSignal, type OutputEmitterRef, type Signal, type WritableSignal, computed, effect, inject, input, output, signal,
  untracked, viewChild } from "@angular/core";

import "@noldova/context.core";
import { ContextMenuTriggerDirective, DialogService, MenuComponent, MenuItemComponent, MenuSeparatorComponent, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { ChatAction } from "../../enums/chat-action";
import { ImageOpenMode } from "../../enums/image-open-mode";
import type { ImageDimensions } from "../../models/image-dimensions";
import { ImageViewerData } from "../../models/image-viewer-data";
import type { ViewedImage } from "../../models/viewed-image";
import { ChatStoreService } from "../../services/chat-store.service";
import { ImageViewerService } from "../../services/image-viewer.service";
import { ImageDialogComponent } from "../image-dialog/image-dialog.component";

@Component({
  selector: "nol-teamrun-image-preview",
  imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent, MenuSeparatorComponent, TooltipDirective],
  providers: [ChatStoreService.provider, ImageViewerService.provider],
  templateUrl: "./image-preview.component.html",
  styleUrl: "./image-preview.component.css"
})
export class ImagePreviewComponent {
  private readonly viewer: ImageViewerService = inject(ImageViewerService);
  private readonly store: ChatStoreService = inject(ChatStoreService);
  private readonly dialogs: DialogService = inject(DialogService);
  private readonly frame: Signal<ElementRef<HTMLButtonElement> | undefined> = viewChild<ElementRef<HTMLButtonElement>>("frame");
  private readonly tooltip: Signal<TooltipDirective | undefined> = viewChild("frame", { read: TooltipDirective });
  private readonly key: Signal<string> = computed(() => this.image().key);

  public readonly image: InputSignal<ViewedImage> = input.required<ViewedImage>();
  public readonly images: InputSignal<readonly ViewedImage[]> = input<readonly ViewedImage[]>([]);
  public readonly showCaption: InputSignal<boolean> = input<boolean>(true);
  public readonly fallback: InputSignal<string | null> = input<string | null>(null);
  public readonly settled: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly source: WritableSignal<string | null> = signal(null);
  protected readonly size: WritableSignal<ImageDimensions | null> = signal(null);
  protected readonly failed: WritableSignal<boolean> = signal(false);
  protected readonly canCopy: boolean = this.viewer.canCopy;
  protected readonly copying: Signal<boolean> = this.viewer.copying;
  protected readonly alternative: Signal<ImageOpenMode> =
    computed(() => this.viewer.openMode() === ImageOpenMode.Popup ? ImageOpenMode.Tab : ImageOpenMode.Popup);

  public constructor() {
    effect(onCleanup => {
      this.key();
      const image = untracked(() => this.image());
      let cancelled = false;
      onCleanup(() => cancelled = true);
      untracked(() => {
        this.source.set(null);
        this.failed.set(false);
        this.size.set(this.viewer.sizeOf(image.key));
      });
      void this.load(image, () => cancelled);
    });
  }

  protected open(mode: ImageOpenMode = this.viewer.openMode()): void {
    this.tooltip()!.hide();
    if (mode === ImageOpenMode.Tab) {
      this.viewer.openTab(this.image());
      return;
    }
    ImageDialogComponent.open(this.dialogs, this.viewer, new ImageViewerData(this.image(), this.images()), this.frame()!.nativeElement);
  }

  protected async copy(): Promise<void> {
    if (!await this.viewer.copyAsync(this.image()))
      this.store.reportFailure(ChatAction.CopyImage, this.image().key, Resources.imageCopyFailed, this.image().conversationId);
  }

  protected async save(): Promise<void> {
    if (!await this.viewer.saveAsync(this.image()))
      this.store.reportFailure(ChatAction.SaveImage, this.image().key, Resources.imageSaveFailed, this.image().conversationId);
  }

  private async load(image: ViewedImage, isCancelled: () => boolean): Promise<void> {
    const decoded = await this.viewer.loadAsync(image);
    if (isCancelled())
      return;
    if (Object.isNull(decoded)) {
      this.size.set(null);
      this.failed.set(true);
    }
    else {
      this.size.set(this.viewer.rememberSize(image, decoded));
      this.source.set(decoded.src);
    }
    this.settled.emit();
  }
}
