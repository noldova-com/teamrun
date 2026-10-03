/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OverlayAlignment } from "../../../src/app/enums/overlay-alignment";
import { OverlayAnchoring } from "../../../src/app/models/overlay-anchoring";
import { OverlaySide } from "../../../src/app/models/overlay-side";

describe("OverlayAnchoring", () => {
  it("keeps its side, alignment, gap and cross offset, with no cross offset by default", () => {
    const tooltip = new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Center, 8);
    const submenu = new OverlayAnchoring(OverlaySide.end, OverlayAlignment.Start, 0, -5);

    expect([tooltip.side, tooltip.alignment, tooltip.gap, tooltip.crossOffset]).toEqual([OverlaySide.below, OverlayAlignment.Center, 8, 0]);
    expect([submenu.side, submenu.alignment, submenu.gap, submenu.crossOffset]).toEqual([OverlaySide.end, OverlayAlignment.Start, 0, -5]);
  });
});
