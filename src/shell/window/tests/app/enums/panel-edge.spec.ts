/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PanelEdge } from "../../../src/app/enums/panel-edge";

describe("PanelEdge", () => {
  it("names the four edges with matching string values", () => {
    expect(Object.entries(PanelEdge)).toEqual([["Left", "Left"], ["Right", "Right"], ["Top", "Top"], ["Bottom", "Bottom"]]);
  });
});
