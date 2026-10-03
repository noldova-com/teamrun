/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolbarFit } from "../../../src/app/models/toolbar-fit";

describe("ToolbarFit", () => {
  const edges = [40, 100, 150];

  it("keeps every group when they all fit, even to within half a pixel", () => {
    expect(ToolbarFit.count(edges, 30, 150)).toBe(3);
    expect(ToolbarFit.count(edges, 30, 149.6)).toBe(3);
    expect(ToolbarFit.count([], 30, 0)).toBe(0);
  });

  it("keeps the leading groups that leave room for the overflow button", () => {
    expect(ToolbarFit.count(edges, 30, 149)).toBe(2);
    expect(ToolbarFit.count(edges, 30, 130)).toBe(2);
    expect(ToolbarFit.count(edges, 30, 129)).toBe(1);
    expect(ToolbarFit.count(edges, 30, 69)).toBe(0);
    expect(ToolbarFit.count(edges, 30, 70)).toBe(1);
  });
});
