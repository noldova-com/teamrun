/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { OverlaySide } from "../../../src/app/models/overlay-side";

describe("OverlaySide", () => {
  it("knows its axis, its direction and its opposite", () => {
    const sides = [OverlaySide.above, OverlaySide.below, OverlaySide.start, OverlaySide.end];

    expect(sides.map(t => [t.isVertical, t.isForward])).toEqual([[true, false], [true, true], [false, false], [false, true]]);
    expect(sides.map(t => t.opposite)).toEqual([OverlaySide.below, OverlaySide.above, OverlaySide.end, OverlaySide.start]);
  });
});
