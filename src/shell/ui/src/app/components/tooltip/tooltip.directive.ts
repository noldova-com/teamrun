/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AriaDescriber, FocusMonitor } from "@angular/cdk/a11y";
import { DOCUMENT } from "@angular/common";
import { ComponentPortal } from "@angular/cdk/portal";
import { type ComponentRef, DestroyRef, Directive, ElementRef, Injector, effect, inject, input } from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { OverlayAlignment } from "../../enums/overlay-alignment";
import { OverlayAnchoring } from "../../models/overlay-anchoring";
import { OverlaySide } from "../../models/overlay-side";
import { AnchoredOverlay } from "../../services/anchored-overlay";
import { OverlayBoundsService } from "../../services/overlay-bounds.service";
import { Resources } from "../../../resources";
import { TooltipComponent } from "./tooltip.component";

@Directive({
  selector: "[trTooltip]",
  host: {
    "(pointerenter)": "scheduleShow()",
    "(pointerleave)": "leaveAnchor($event)",
    "(pointerdown)": "hide()",
    "(keydown.escape)": "dismiss($event)"
  }
})
export class TooltipDirective {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector: Injector = inject(Injector);
  private readonly bounds: OverlayBoundsService = inject(OverlayBoundsService);
  private overlay: AnchoredOverlay | null = null;
  private tooltip: ComponentRef<TooltipComponent> | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  public readonly text = input.required<string>({ alias: "trTooltip" });
  public readonly side = input<OverlaySide>(OverlaySide.above, { alias: "trTooltipSide" });
  public readonly isDisabled = input<boolean>(false, { alias: "trTooltipDisabled" });
  public readonly isTruncatedOnly = input<boolean>(false, { alias: "trTooltipTruncated" });
  public readonly besideSelector = input<string | null>(null, { alias: "trTooltipBeside" });

  public constructor() {
    const describer = inject(AriaDescriber);
    const focus = inject(FocusMonitor);
    const document = inject(DOCUMENT);
    const dismissOnEscape = (event: KeyboardEvent): void => {
      if (event.key === Resources.escapeKey)
        this.hide();
    };
    document.addEventListener(Resources.keydownEvent, dismissOnEscape);
    const subscription = focus.monitor(this.host).subscribe(origin => {
      if (origin === Resources.keyboardFocusOrigin)
        this.show();
      else if (Object.isNull(origin))
        this.hide();
    });
    effect(onCleanup => {
      const message = this.text();
      this.tooltip?.setInput(Resources.tooltipTextInput, message);
      if (this.isTruncatedOnly())
        return;
      describer.describe(this.host, message);
      onCleanup(() => describer.removeDescription(this.host, message));
    });
    effect(() => {
      if (this.isDisabled())
        this.hide();
    });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener(Resources.keydownEvent, dismissOnEscape);
      subscription.unsubscribe();
      focus.stopMonitoring(this.host);
      this.clearTimers();
      this.overlay?.dispose();
    });
  }

  public get isShown(): boolean {
    return this.overlay?.isOpen ?? false;
  }

  public show(): void {
    this.clearTimers();
    if (this.isShown || this.isDisabled() || (this.isTruncatedOnly() && !this.isTruncated()))
      return;
    const overlay = this.overlay ?? this.createOverlay();
    const side = this.side();
    const anchoring = new OverlayAnchoring(side, OverlayAlignment.Center, this.bounds.gap);
    this.tooltip = overlay.openComponent(new ComponentPortal(TooltipComponent), this.host, anchoring, this.areaBeside(side));
    this.tooltip.setInput(Resources.tooltipTextInput, this.text());
    this.tooltip.changeDetectorRef.detectChanges();
    overlay.reposition();
  }

  public hide(): void {
    this.clearTimers();
    this.overlay?.close();
  }

  protected scheduleShow(): void {
    this.clearTimers();
    this.showTimer = setTimeout(() => this.show(), Resources.tooltipShowDelay);
  }

  protected leaveAnchor(event: PointerEvent): void {
    if (this.isWithinTooltip(event.relatedTarget))
      return;
    this.scheduleHide();
  }

  protected dismiss(event: Event): void {
    if (!this.isShown)
      return;
    event.stopPropagation();
    this.hide();
  }

  private scheduleHide(): void {
    this.clearTimers();
    this.hideTimer = setTimeout(() => this.hide(), Resources.tooltipHideDelay);
  }

  private createOverlay(): AnchoredOverlay {
    const overlay = new AnchoredOverlay(this.injector, Resources.tooltipPaneClass);
    overlay.element.addEventListener(Resources.pointerLeaveEvent, event => {
      if (!(event.relatedTarget instanceof Node && this.host.contains(event.relatedTarget)))
        this.scheduleHide();
    });
    overlay.detachments.subscribe(() => this.tooltip = null);
    overlay.originLost.subscribe(() => this.hide());
    this.overlay = overlay;
    return overlay;
  }

  private areaBeside(side: OverlaySide): (() => DOMRect) | null {
    const selector = this.besideSelector();
    if (Object.isNull(selector))
      return null;
    const around = this.host.closest(selector) ?? this.host;
    return () => {
      const anchor = this.host.getBoundingClientRect();
      const edges = around.getBoundingClientRect();
      return side.isVertical ? new DOMRect(anchor.left, edges.top, anchor.width, edges.height) : new DOMRect(edges.left, anchor.top, edges.width, anchor.height);
    };
  }

  private isTruncated(): boolean {
    const marked = [...this.host.querySelectorAll<HTMLElement>(Resources.truncationSelector)];
    return (marked.length > 0 ? marked : [this.host]).some(t => t.scrollWidth > t.clientWidth);
  }

  private isWithinTooltip(target: EventTarget | null): boolean {
    return target instanceof Node && (this.overlay?.element.contains(target) ?? false);
  }

  private clearTimers(): void {
    if (!Object.isNull(this.showTimer))
      clearTimeout(this.showTimer);
    if (!Object.isNull(this.hideTimer))
      clearTimeout(this.hideTimer);
    this.showTimer = null;
    this.hideTimer = null;
  }
}
