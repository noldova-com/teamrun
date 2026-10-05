/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { ComponentPortal } from "@angular/cdk/portal";
import { Injectable, Injector, inject } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import { AnchoredOverlay, OverlayAlignment, OverlayAnchoring, OverlaySide } from "@noldova/teamrun-shell-ui";

import { CommandSearchComponent } from "../components/command-search/command-search.component";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class CommandSearchService {
  private readonly injector: Injector = inject(Injector);
  private readonly document: Document = inject(DOCUMENT);
  private overlay: AnchoredOverlay | null = null;
  private returnFocus: HTMLElement | null = null;

  public get isOpen(): boolean {
    return this.overlay?.isOpen ?? false;
  }

  public open(): void {
    const row = this.document.querySelector(Resources.windowRowSelector);
    if (this.isOpen || Object.isNull(row))
      return;
    const focused = this.document.activeElement;
    this.returnFocus = focused instanceof HTMLElement ? focused : null;
    const overlay = new AnchoredOverlay(this.injector, Resources.commandSearchPaneClass);
    overlay.outsidePointerEvents.subscribe(() => this.close());
    overlay.originLost.subscribe(() => this.close());
    this.overlay = overlay;
    overlay.openComponent(new ComponentPortal(CommandSearchComponent), row, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Center, 0), () => {
      const edges = row.getBoundingClientRect();
      return new DOMRect(0, edges.top, this.document.documentElement.clientWidth, edges.height);
    });
  }

  public close(): void {
    this.overlay?.dispose();
    this.overlay = null;
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected)
      target.focus();
  }
}
