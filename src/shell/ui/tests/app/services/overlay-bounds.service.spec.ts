/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { OverlayBoundsService } from "../../../src/app/services/overlay-bounds.service";
import { AppearanceFixture } from "../../fixtures/appearance.fixture";

describe("OverlayBoundsService", () => {
  const anchors: HTMLElement[] = [];

  beforeEach(() => {
    AppearanceFixture.apply();
  });

  afterEach(() => {
    anchors.splice(0).forEach(t => t.remove());
    document.documentElement.style.fontSize = "";
    AppearanceFixture.reset();
  });

  function anchorIn(edge: string | null): HTMLElement {
    const band = document.createElement("div");
    if (edge !== null)
      band.setAttribute("data-tr-chrome", edge);
    const anchor = document.createElement("button");
    band.append(anchor);
    document.body.append(band);
    anchors.push(band);
    return anchor;
  }

  function rem(look: string): number {
    const root = getComputedStyle(document.documentElement);
    return parseFloat(root.getPropertyValue(`--tr-${look}`)) * parseFloat(root.fontSize);
  }

  it("keeps overlays a gap inside the viewport, below the window row and above the status bar", () => {
    const service = TestBed.inject(OverlayBoundsService);
    const view = document.documentElement;
    const bounds = service.boundsFor(anchorIn(null));

    expect(service.gap).toBe(rem("space-2"));
    expect([bounds.top, bounds.right, bounds.bottom, bounds.left])
      .toEqual([rem("window-row-height") + service.gap, view.clientWidth - service.gap, view.clientHeight - rem("status-bar-height") - service.gap, service.gap]);
  });

  it("lets an overlay anchored in a chrome band come within a gap of that band's edge only", () => {
    const service = TestBed.inject(OverlayBoundsService);
    const view = document.documentElement;
    const fromRow = service.boundsFor(anchorIn("top"));
    const fromStatus = service.boundsFor(anchorIn("bottom"));

    expect([fromRow.top, fromRow.bottom]).toEqual([service.gap, view.clientHeight - rem("status-bar-height") - service.gap]);
    expect([fromStatus.top, fromStatus.bottom]).toEqual([rem("window-row-height") + service.gap, view.clientHeight - service.gap]);
  });

  it("reads its rem-based bounds again after the text size changes", () => {
    const service = TestBed.inject(OverlayBoundsService);
    const before = service.boundsFor(anchorIn(null));

    document.documentElement.style.fontSize = "20px";
    const after = service.boundsFor(anchorIn(null));

    expect(after.top).toBeCloseTo(before.top * 20 / 16, 3);
    expect(service.gap).toBe(10);
  });
});
