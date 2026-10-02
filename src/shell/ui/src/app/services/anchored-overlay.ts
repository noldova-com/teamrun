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
import type { Observable } from "rxjs";

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
  private origin: Element | null = null;
  private point: DOMRect | null = null;
  private anchoring: OverlayAnchoring | null = null;
  private placementValue: OverlayPlacement | null = null;

  public constructor(injector: Injector, panelClass: string) {
    this.bounds = injector.get(OverlayBoundsService);
    this.strategy = createGlobalPositionStrategy(injector);
    this.overlay = createOverlayRef(injector, { positionStrategy: this.strategy, panelClass });
    this.overlay.detachments().subscribe(() => this.release());
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

  public openComponent<T>(portal: ComponentPortal<T>, origin: Element, anchoring: OverlayAnchoring, point: DOMRect | null = null): ComponentRef<T> {
    const attached = this.overlay.attach(portal);
    this.follow(origin, anchoring, point);
    return attached;
  }

  public openTemplate<T>(portal: TemplatePortal<T>, origin: Element, anchoring: OverlayAnchoring, point: DOMRect | null = null): EmbeddedViewRef<T> {
    const attached = this.overlay.attach(portal);
    this.follow(origin, anchoring, point);
    return attached;
  }

  public reposition(): void {
    if (Object.isNull(this.origin) || Object.isNull(this.anchoring))
      return;
    const element = this.element;
    element.style.maxHeight = String.empty;
    const size = element.getBoundingClientRect();
    const anchor = this.point ?? this.origin.getBoundingClientRect();
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

  private follow(origin: Element, anchoring: OverlayAnchoring, point: DOMRect | null): void {
    this.origin = origin;
    this.anchoring = anchoring;
    this.point = point;
    const reposition = (): void => this.reposition();
    const scrolled = (event: Event): void => {
      if (event.target instanceof Node && !this.element.contains(event.target) && event.target.contains(origin))
        this.close();
    };
    const resize = new ResizeObserver(reposition);
    resize.observe(this.element);
    window.addEventListener(Resources.resizeEvent, reposition);
    document.addEventListener(Resources.scrollEvent, scrolled, { capture: true, passive: true });
    this.cleanups.push(
      () => resize.disconnect(),
      () => window.removeEventListener(Resources.resizeEvent, reposition),
      () => document.removeEventListener(Resources.scrollEvent, scrolled, { capture: true }));
    this.reposition();
  }

  private release(): void {
    this.cleanups.splice(0).forEach(t => t());
    this.origin = null;
    this.point = null;
    this.anchoring = null;
    this.placementValue = null;
  }
}
