/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, linkedSignal, output, signal, viewChild } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatMenuModule } from "@angular/material/menu";

import "@noldova/teamrun-foundation-core";

import type { ImageSource } from "../../models/image-source";
import type { ImageViewerData } from "../../models/image-viewer-data";
import { Resources } from "../../resources";
import { BridgeService } from "../../services/bridge.service";
import { ImageActionsComponent } from "../image-actions/image-actions.component";

@Component({
  selector: "tr-image-viewer",
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, MatMenuModule, ImageActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block h-full min-h-0", "(keydown)": "keyDown($event)" },
  templateUrl: "./image-viewer.component.html"
})
export class ImageViewerComponent {
  public readonly data = input.required<ImageViewerData>();
  public readonly embedded = input(false);
  public readonly closed = output<void>();
  private readonly bridge: BridgeService = inject(BridgeService);
  private readonly viewport = viewChild<ElementRef<HTMLElement>>("viewport");
  private readonly closeButton = viewChild<unknown, ElementRef<HTMLButtonElement>>("closeButton", { read: ElementRef });

  protected readonly resources: typeof Resources = Resources;
  protected readonly index = linkedSignal(() => this.data().index);
  protected readonly current = computed(() => this.data().images[this.index()] ?? this.data().image);
  protected readonly loaded = signal<HTMLImageElement | null>(null);
  protected readonly failed = signal(false);
  protected readonly zoom = signal(1);
  protected readonly percent = computed(() => Math.round(this.zoom() * Resources.percentScale));

  public constructor() {
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      const viewport = this.viewport()?.nativeElement;
      if (!Object.isUndefined(viewport) && !Object.isUndefined(globalThis.ResizeObserver)) {
        const observer = new ResizeObserver(() => this.fit());
        observer.observe(viewport, { box: "border-box" });
        destroy.onDestroy(() => observer.disconnect());
      }
      if (this.embedded())
        this.closeButton()?.nativeElement.focus();
      this.fit();
    });
    effect(onCleanup => {
      const source = this.current();
      let cancelled = false;
      onCleanup(() => cancelled = true);
      this.loaded.set(null);
      this.failed.set(false);
      void this.load(source).then(image => {
        if (cancelled)
          return;
        this.loaded.set(image);
        this.failed.set(Object.isNull(image));
        this.fit();
      });
    });
  }

  protected fit(): void {
    const viewport = this.viewport()?.nativeElement;
    const image = this.loaded();
    if (Object.isUndefined(viewport) || Object.isNull(image) || viewport.clientWidth === 0 || viewport.clientHeight === 0)
      return;
    this.zoom.set(Math.min(1, viewport.clientWidth / image.naturalWidth, viewport.clientHeight / image.naturalHeight));
    viewport.scrollTo(0, 0);
  }

  protected changeZoom(increase: boolean): void {
    this.zoom.update(t => Math.max(Resources.imageMinimumZoom, Math.min(Resources.imageMaximumZoom,
      increase ? t * Resources.imageZoomStep : t / Resources.imageZoomStep)));
    const viewport = this.viewport()?.nativeElement;
    requestAnimationFrame(() => {
      if (viewport?.isConnected)
        viewport.scrollTo((viewport.scrollWidth - viewport.clientWidth) / 2, (viewport.scrollHeight - viewport.clientHeight) / 2);
    });
  }

  protected move(delta: number): void {
    const index = this.index() + delta;
    if (index >= 0 && index < this.data().images.length)
      this.index.set(index);
  }

  protected keyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented)
      return;
    if (event.key === Resources.imageCloseKey || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === Resources.imageCloseTabKey)) {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    if (event.key === Resources.imagePreviousKey || event.key === Resources.imageNextKey) {
      event.preventDefault();
      event.stopPropagation();
      this.move(event.key === Resources.imagePreviousKey ? -1 : 1);
    }
  }

  protected closeBackdrop(event: MouseEvent): void {
    if (!this.embedded() && event.target === event.currentTarget)
      this.closed.emit();
  }

  private async load(source: ImageSource): Promise<HTMLImageElement | null> {
    try {
      const url = source.data ?? (Object.isNull(source.path) ? null : await this.bridge.readImage(source.path));
      if (Object.isNull(url))
        return null;
      const image = new Image();
      image.src = url;
      await image.decode();
      return image;
    }
    catch {
      return null;
    }
  }
}
