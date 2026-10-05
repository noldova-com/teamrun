/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DragGesture } from "../../../src/app/models/drag-gesture";

describe("DragGesture", () => {
  it("starts once the pointer is the threshold away from where it went down, in any direction, and not before", () => {
    const { threshold } = DragGesture;

    expect([DragGesture.hasStarted(10, 10, 10 + threshold - 1, 10), DragGesture.hasStarted(10, 10, 10, 10 - threshold), DragGesture.hasStarted(10, 10, 10 - threshold, 10)])
      .toEqual([false, true, true]);
    expect([DragGesture.hasStarted(0, 0, 2, 2), DragGesture.hasStarted(0, 0, 0, 0)]).toEqual([false, false]);
    expect(threshold).toBe(4);
  });
});
