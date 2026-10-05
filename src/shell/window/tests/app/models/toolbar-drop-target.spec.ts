/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolbarDropTarget } from "../../../src/app/models/toolbar-drop-target";

describe("ToolbarDropTarget", () => {
  it("holds a place in a row or a new row with where to draw it, and equals only a target of the same place and drawing", () => {
    const target = new ToolbarDropTarget(1, 2, false, 10, 20, 30);

    expect([target.row, target.index, target.isNewRow, target.x, target.y, target.rowWidth]).toEqual([1, 2, false, 10, 20, 30]);
    expect(target.equals(new ToolbarDropTarget(1, 2, false, 10, 20, 30))).toBe(true);
    expect(target.equals(null)).toBe(false);
    for (const other of [new ToolbarDropTarget(0, 2, false, 10, 20, 30), new ToolbarDropTarget(1, 3, false, 10, 20, 30), new ToolbarDropTarget(1, 2, true, 10, 20, 30),
      new ToolbarDropTarget(1, 2, false, 11, 20, 30), new ToolbarDropTarget(1, 2, false, 10, 21, 30), new ToolbarDropTarget(1, 2, false, 10, 20, 31)])
      expect(target.equals(other)).toBe(false);
  });
});
