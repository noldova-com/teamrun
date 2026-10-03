/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, inject } from "@angular/core";

import { OverlayBounds } from "../models/overlay-bounds";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class OverlayBoundsService {
  private readonly document: Document = inject(DOCUMENT);

  public get gap(): number {
    return this.measure(Resources.overlayGapLook);
  }

  public boundsFor(origin: Element): OverlayBounds {
    const gap = this.gap;
    const view = this.document.documentElement;
    const edge = origin.closest(Resources.chromeSelector)?.getAttribute(Resources.chromeAttribute);
    const top = edge === Resources.topChrome ? gap : this.measure(Resources.windowRowLook) + gap;
    const bottom = view.clientHeight - (edge === Resources.bottomChrome ? gap : this.measure(Resources.statusBarLook) + gap);
    return new OverlayBounds(top, view.clientWidth - gap, bottom, gap);
  }

  private measure(look: string): number {
    const probe = this.document.createElement("div");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.height = `var(${Resources.formatLookVariable(look)})`;
    this.document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  }
}
