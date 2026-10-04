/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TemplatePortal } from "@angular/cdk/portal";
import {
  DestroyRef, Directive, ElementRef, Injector, type Signal, type TemplateRef, ViewContainerRef, type WritableSignal, afterNextRender, inject, input, output, signal
} from "@angular/core";

import "@noldova/teamrun-foundation-core";

import { OverlayAlignment } from "../../enums/overlay-alignment";
import { OverlayAnchoring } from "../../models/overlay-anchoring";
import { OverlaySide } from "../../models/overlay-side";
import { AnchoredOverlay } from "../../services/anchored-overlay";
import { OverlayBoundsService } from "../../services/overlay-bounds.service";
import { Resources } from "../../../resources";

@Directive({
  selector: "[trPopoverTrigger]",
  exportAs: "trPopoverTrigger",
  host: {
    "aria-haspopup": "dialog",
    "[attr.aria-expanded]": "isOpen()",
    "(click)": "toggle()"
  }
})
export class PopoverTriggerDirective {
  private readonly injector: Injector = inject(Injector);
  private readonly viewContainer: ViewContainerRef = inject(ViewContainerRef);
  private readonly bounds: OverlayBoundsService = inject(OverlayBoundsService);
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly open: WritableSignal<boolean> = signal(false);
  private overlay: AnchoredOverlay | null = null;

  public readonly template = input.required<TemplateRef<unknown>>({ alias: "trPopoverTrigger" });
  public readonly side = input<OverlaySide>(OverlaySide.above, { alias: "trPopoverSide" });
  public readonly alignment = input<OverlayAlignment>(OverlayAlignment.End, { alias: "trPopoverAlignment" });
  public readonly opened = output<void>();
  public readonly isOpen: Signal<boolean> = this.open.asReadonly();

  public constructor() {
    inject(DestroyRef).onDestroy(() => this.close());
  }

  public toggle(): void {
    if (this.open())
      this.close();
    else
      this.show();
  }

  public close(): void {
    const hadFocus = this.overlay?.element.contains(document.activeElement) ?? false;
    this.open.set(false);
    this.overlay?.dispose();
    this.overlay = null;
    if (hadFocus)
      this.host.focus();
  }

  private show(): void {
    const overlay = new AnchoredOverlay(this.injector, Resources.popoverPaneClass);
    overlay.outsidePointerEvents.subscribe(event => {
      if (!(event.target instanceof Node && this.host.contains(event.target)))
        this.close();
    });
    overlay.keydownEvents.subscribe(event => this.closeFromKeyboard(event));
    overlay.originScrolls.subscribe(() => this.close());
    this.overlay = overlay;
    this.open.set(true);
    overlay.openTemplate(new TemplatePortal(this.template(), this.viewContainer), this.host, new OverlayAnchoring(this.side(), this.alignment(), this.bounds.gap));
    afterNextRender(() => overlay.element.querySelector<HTMLElement>(`.${Resources.popoverClass}`)?.focus(), { injector: this.injector });
    this.opened.emit();
  }

  private closeFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== Resources.escapeKey || event.defaultPrevented)
      return;
    event.preventDefault();
    this.close();
    this.host.focus();
  }
}
