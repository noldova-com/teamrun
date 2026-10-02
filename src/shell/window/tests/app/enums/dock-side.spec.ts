/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../src/app/enums/dock-side";

describe("DockSide", () => {
  it("names the three docks with matching string values", () => {
    expect(Object.entries(DockSide)).toEqual([["Left", "Left"], ["Right", "Right"], ["Bottom", "Bottom"]]);
  });
});
