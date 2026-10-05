/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DockSide } from "../../../../src/app/enums/dock-side";
import { DockYield } from "../../../../src/app/models/layout/dock-yield";

describe("DockYield", () => {
  it("holds the middle width wanted, the docks closed for it and the dock kept, and yields nothing by default", () => {
    const closed = new Set([DockSide.Left]);
    const yielded = new DockYield(40, closed, DockSide.Right);

    expect([yielded.preferredMiddle, yielded.closed, yielded.kept]).toEqual([40, closed, DockSide.Right]);
    expect([DockYield.none.preferredMiddle, [...DockYield.none.closed], DockYield.none.kept]).toEqual([0, [], null]);
  });
});
