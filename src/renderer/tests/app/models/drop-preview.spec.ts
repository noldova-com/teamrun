/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../src/app/enums/dock-side";
import { DropPreview } from "../../../src/app/models/drop-preview";

describe("DropPreview", () => {
  it("lays a side dock along its edge at full height and the bottom dock between the side tracks", () => {
    const left = new DropPreview(DockSide.Left, "416px", "40px", "0");
    expect([left.left, left.right, left.top, left.width, left.height]).toEqual(["0", null, "0", "416px", null]);

    const right = new DropPreview(DockSide.Right, "400px", "40px", "0");
    expect([right.left, right.right, right.top, right.width, right.height]).toEqual([null, "0", "0", "400px", null]);

    expect([left.centerX, left.centerY]).toEqual(["calc(416px / 2)", "50%"]);
    expect([right.centerX, right.centerY]).toEqual(["calc(100% - 400px / 2)", "50%"]);

    const bottom = new DropPreview(DockSide.Bottom, "260px", "40px", "0");
    expect([bottom.centerX, bottom.centerY]).toEqual(["calc(40px + (100% - 40px - 0) / 2)", "calc(100% - 260px / 2)"]);
    expect([bottom.left, bottom.right, bottom.top, bottom.width, bottom.height]).toEqual(["40px", "0", null, null, "260px"]);
  });
});
