/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type GlobalPositionStrategy, type OverlayRef, createGlobalPositionStrategy, createOverlayRef } from "@angular/cdk/overlay";
import type { ComponentPortal, TemplatePortal } from "@angular/cdk/portal";
import type { ComponentRef, EmbeddedViewRef, Injector } from "@angular/core";
import { type Observable, Subject } from "rxjs";

import "@noldova/teamrun-foundation-core";

import type { OverlayAnchoring } from "../models/overlay-anchoring";
import type { OverlayPlacement } from "../models/overlay-placement";
import { Resources } from "../../resources";
import { OverlayBoundsService } from "./overlay-bounds.service";

export class AnchoredOverlay {
  private readonly overlay: OverlayRef;
  private readonly strategy: GlobalPositionStrategy;
  private readonly bounds: OverlayBoundsService;
  private readonly cleanups: (() => void)[] = [];
  private readonly originScrollsValue: Subject<void> = new Subject<void>();
  private origin: Element | null = null;
  private originAt: DOMRect | null = null;
  private area: (() => DOMRect) | null = null;
  private anchoring: OverlayAnchoring | null = null;
  private placementValue: OverlayPlacement | null = null;

  public constructor(injector: Injector, panelClass: string) {
    this.bounds = injector.get(OverlayBoundsService);
    this.strategy = createGlobalPositionStrategy(injector);
    this.overlay = createOverlayRef(injector, { positionStrategy: this.strategy, panelClass });
    this.overlay.detachments().subscribe(() => this.release());
  }

  public get overlayRef(): OverlayRef {
    return this.overlay;
  }

  public get element(): HTMLElement {
    return this.overlay.overlayElement;
  }

  public get isOpen(): boolean {
    return this.overlay.hasAttached();
  }

  public get placement(): OverlayPlacement | null {
    return this.placementValue;
  }

  public get detachments(): Observable<void> {
    return this.overlay.detachments();
  }

  public get outsidePointerEvents(): Observable<MouseEvent> {
    return this.overlay.outsidePointerEvents();
  }

  public get keydownEvents(): Observable<KeyboardEvent> {
    return this.overlay.keydownEvents();
  }

  public get originScrolls(): Observable<void> {
    return this.originScrollsValue;
  }

  public openComponent<T>(portal: ComponentPortal<T>, origin: Element, anchoring: OverlayAnchoring, area: (() => DOMRect) | null = null): ComponentRef<T> {
    const attached = this.overlay.attach(portal);
    this.follow(origin, anchoring, area);
    return attached;
  }

  public openTemplate<T>(portal: TemplatePortal<T>, origin: Element, anchoring: OverlayAnchoring): EmbeddedViewRef<T> {
    const attached = this.overlay.attach(portal);
    this.follow(origin, anchoring);
    return attached;
  }

  public follow(origin: Element, anchoring: OverlayAnchoring, area: (() => DOMRect) | null = null): void {
    this.release();
    this.origin = origin;
    this.anchoring = anchoring;
    this.area = area;
    const reposition = (): void => this.reposition();
    const scrolled = (event: Event): void => {
      if (event.target instanceof Node && !this.element.contains(event.target) && event.target.contains(origin) && this.hasOriginMoved(origin))
        this.originScrollsValue.next();
    };
    let frame: number | null = null;
    const resize = new ResizeObserver(() => frame ??= requestAnimationFrame(() => {
      frame = null;
      this.reposition();
    }));
    resize.observe(this.element);
    window.addEventListener(Resources.resizeEvent, reposition);
    document.addEventListener(Resources.scrollEvent, scrolled, { capture: true, passive: true });
    this.cleanups.push(
      () => resize.disconnect(),
      () => {
        if (!Object.isNull(frame))
          cancelAnimationFrame(frame);
      },
      () => window.removeEventListener(Resources.resizeEvent, reposition),
      () => document.removeEventListener(Resources.scrollEvent, scrolled, { capture: true }));
    this.reposition();
  }

  public reposition(): void {
    if (Object.isNull(this.origin) || Object.isNull(this.anchoring))
      return;
    const element = this.element;
    element.style.maxHeight = String.empty;
    this.strategy.left(Resources.zeroPixels).top(Resources.zeroPixels);
    this.overlay.updatePosition();
    const size = element.getBoundingClientRect();
    this.originAt = this.origin.getBoundingClientRect();
    const anchor = Object.isNull(this.area) ? this.originAt : this.area();
    const placement = this.bounds.boundsFor(this.origin).place(anchor, size.width, size.height, this.anchoring);
    element.style.maxHeight = Object.isNull(placement.maxHeight) ? String.empty : `${placement.maxHeight}px`;
    this.strategy.left(`${placement.left}px`).top(`${placement.top}px`);
    this.overlay.updatePosition();
    this.placementValue = placement;
  }

  public close(): void {
    this.overlay.detach();
  }

  public dispose(): void {
    this.overlay.dispose();
  }

  private release(): void {
    this.cleanups.splice(0).forEach(t => t());
    this.origin = null;
    this.originAt = null;
    this.area = null;
    this.anchoring = null;
    this.placementValue = null;
  }

  private hasOriginMoved(origin: Element): boolean {
    const now = origin.getBoundingClientRect();
    return now.left !== this.originAt?.left || now.top !== this.originAt.top;
  }
}
