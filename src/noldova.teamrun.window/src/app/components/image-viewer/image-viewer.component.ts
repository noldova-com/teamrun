/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, ElementRef, Injector, type InputSignal, type OutputEmitterRef, PendingTasks, type Signal, type WritableSignal,
  afterNextRender, computed, effect, inject, input, linkedSignal, output, signal, untracked, viewChild } from "@angular/core";

import "@noldova/context.core";
import { AnnouncementPoliteness, Announcer, ButtonComponent, ButtonVariant, ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent,
  TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources";
import { CopiedMoment } from "../../models/copied-moment";
import type { ImageDimensions } from "../../models/image-dimensions";
import type { ImageViewerData } from "../../models/image-viewer-data";
import type { ViewedImage } from "../../models/viewed-image";
import { ClockService } from "../../services/clock.service";
import { ImageViewerService } from "../../services/image-viewer.service";

@Component({
  selector: "nol-teamrun-image-viewer",
  imports: [ButtonComponent, ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent, TooltipDirective],
  templateUrl: "./image-viewer.component.html",
  styleUrl: "./image-viewer.component.css",
  host: {
    "[class.nol-teamrun-image-viewer-tab]": "embedded()",
    "tabindex": "-1",
    "(keydown)": "keyDown($event)"
  }
})
export class ImageViewerComponent {
  private readonly viewport: Signal<ElementRef<HTMLElement>> = viewChild.required<ElementRef<HTMLElement>>("viewport");
  private readonly previousButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("previous", { read: ElementRef });
  private readonly nextButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("next", { read: ElementRef });
  private readonly zoomOutButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("zoomOut", { read: ElementRef });
  private readonly zoomInButton: Signal<ElementRef<HTMLButtonElement>> = viewChild.required("zoomIn", { read: ElementRef });
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly announcer: Announcer = inject(Announcer);
  private readonly tasks: PendingTasks = inject(PendingTasks);
  private fitted: boolean = true;

  public readonly data: InputSignal<ImageViewerData> = input.required<ImageViewerData>();
  public readonly viewer: InputSignal<ImageViewerService> = input.required<ImageViewerService>();
  public readonly embedded: InputSignal<boolean> = input<boolean>(false);
  public readonly titleId: InputSignal<string | null> = input<string | null>(null);
  public readonly closed: OutputEmitterRef<void> = output<void>();

  protected readonly resources: typeof Resources = Resources;
  protected readonly text: ButtonVariant = ButtonVariant.Text;
  protected readonly index: WritableSignal<number> = linkedSignal(() => this.data().index);
  protected readonly current: Signal<ViewedImage> = computed(() => this.data().images[this.index()]!);
  protected readonly loaded: WritableSignal<HTMLImageElement | null> = signal(null);
  protected readonly loadedSize: Signal<ImageDimensions | null> = computed(() => {
    const image = this.loaded();
    return Object.isNull(image) ? null : ImageViewerService.naturalSizeOf(image);
  });
  protected readonly failed: WritableSignal<boolean> = signal(false);
  protected readonly error: WritableSignal<string | null> = signal(null);
  protected readonly copied: CopiedMoment<ViewedImage> = new CopiedMoment<ViewedImage>(inject(ClockService));
  protected readonly zoom: WritableSignal<number> = signal(1);
  protected readonly percent: Signal<number> = computed(() => Math.round(this.zoom() * Resources.percentScale));

  public constructor() {
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => this.copied.dispose());
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.refit());
      observer.observe(this.viewport().nativeElement);
      destroy.onDestroy(() => observer.disconnect());
      if (this.embedded())
        this.host.focus();
    });
    effect(onCleanup => {
      const image = this.current();
      let cancelled = false;
      const done = this.tasks.add();
      onCleanup(() => {
        cancelled = true;
        done();
      });
      untracked(() => {
        this.loaded.set(null);
        this.failed.set(false);
        this.error.set(null);
        this.copied.clear();
      });
      void this.load(image, () => cancelled).finally(done);
    });
  }

  protected fit(): void {
    this.fitted = true;
    const viewport = this.viewport().nativeElement;
    const size = this.loadedSize();
    if (Object.isNull(size) || viewport.clientWidth === 0 || viewport.clientHeight === 0)
      return;
    this.zoom.set(Math.min(1, viewport.clientWidth / size.width, viewport.clientHeight / size.height));
    viewport.scrollTo(0, 0);
  }

  protected changeZoom(increase: boolean): void {
    this.keepFocus(increase ? this.zoomOutButton() : this.zoomInButton());
    this.fitted = false;
    this.zoom.update(t => Math.max(Resources.imageMinimumZoom, Math.min(Resources.imageMaximumZoom,
      increase ? t * Resources.imageZoomStep : t / Resources.imageZoomStep)));
    const viewport = this.viewport().nativeElement;
    requestAnimationFrame(() => viewport.scrollTo((viewport.scrollWidth - viewport.clientWidth) / 2, (viewport.scrollHeight - viewport.clientHeight) / 2));
  }

  protected move(delta: number): void {
    const index = this.index() + delta;
    if (index >= 0 && index < this.data().images.length) {
      this.keepFocus(delta < 0 ? this.nextButton() : this.previousButton());
      this.index.set(index);
    }
  }

  protected async copy(): Promise<void> {
    if (this.viewer().copying())
      return;
    const image = this.current();
    const copied = await this.viewer().copyAsync(image);
    this.report(copied, Resources.imageCopyFailed);
    if (!copied || this.current() !== image)
      return;
    this.copied.show(image);
    this.announcer.announce(Resources.copiedImageLabel, AnnouncementPoliteness.Polite);
  }

  protected async save(): Promise<void> {
    this.report(await this.viewer().saveAsync(this.current()), Resources.imageSaveFailed);
  }

  protected keyDown(event: KeyboardEvent): void {
    if (event.defaultPrevented)
      return;
    if (!this.embedded() && (event.key === Resources.imageCloseKey
      || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === Resources.imageCloseTabKey))) {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }
    const pan = Resources.imagePanKeys[event.key];
    const isPlain = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (isPlain && !Object.isUndefined(pan) && this.isZoomed()) {
      event.preventDefault();
      event.stopPropagation();
      const viewport = this.viewport().nativeElement;
      viewport.scrollBy(pan[0] * viewport.clientWidth * Resources.imagePanFraction, pan[1] * viewport.clientHeight * Resources.imagePanFraction);
      return;
    }
    if (event.key === Resources.imagePreviousKey || event.key === Resources.imageNextKey) {
      event.preventDefault();
      event.stopPropagation();
      this.move(event.key === Resources.imagePreviousKey ? -1 : 1);
      return;
    }
    const isZoomIn = Resources.imageZoomInKeys.includes(event.key);
    if (!isPlain || Object.isNull(this.loaded()) || (!isZoomIn && event.key !== Resources.imageZoomOutKey && event.key !== Resources.imageFitKey))
      return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === Resources.imageFitKey)
      this.fit();
    else if (isZoomIn ? this.zoom() < Resources.imageMaximumZoom : this.zoom() > Resources.imageMinimumZoom)
      this.changeZoom(isZoomIn);
  }

  protected closeBackdrop(event: MouseEvent): void {
    if (!this.embedded() && event.target === event.currentTarget)
      this.closed.emit();
  }

  private refit(): void {
    if (this.fitted)
      this.fit();
  }

  private isZoomed(): boolean {
    const viewport = this.viewport().nativeElement;
    return viewport.scrollWidth > viewport.clientWidth || viewport.scrollHeight > viewport.clientHeight;
  }

  private keepFocus(fallback: ElementRef<HTMLButtonElement>): void {
    const focused = this.host.ownerDocument.activeElement;
    afterNextRender(() => {
      if (focused instanceof HTMLButtonElement && focused.disabled)
        fallback.nativeElement.focus();
    }, { injector: this.injector });
  }

  private async load(image: ViewedImage, isCancelled: () => boolean): Promise<void> {
    const decoded = await this.viewer().loadAsync(image);
    if (isCancelled())
      return;
    this.loaded.set(decoded);
    this.failed.set(Object.isNull(decoded));
    this.fit();
  }

  private report(succeeded: boolean, failure: string): void {
    if (!succeeded)
      this.error.set(failure);
    else if (this.error() === failure)
      this.error.set(null);
  }
}
