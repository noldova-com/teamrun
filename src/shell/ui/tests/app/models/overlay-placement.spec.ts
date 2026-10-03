/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OverlayPlacement } from "../../../src/app/models/overlay-placement";
import { OverlaySide } from "../../../src/app/models/overlay-side";

describe("OverlayPlacement", () => {
  it("keeps its position, side and height limit", () => {
    const limited = new OverlayPlacement(12, 40, OverlaySide.below, 300);
    const free = new OverlayPlacement(0, 0, OverlaySide.above, null);

    expect([limited.left, limited.top, limited.side, limited.maxHeight]).toEqual([12, 40, OverlaySide.below, 300]);
    expect(free.maxHeight).toBeNull();
  });
});
