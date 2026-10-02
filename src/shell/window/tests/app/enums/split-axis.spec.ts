/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SplitAxis } from "../../../src/app/enums/split-axis";

describe("SplitAxis", () => {
  it("names the two axes with matching string values", () => {
    expect(Object.entries(SplitAxis)).toEqual([["Horizontal", "Horizontal"], ["Vertical", "Vertical"]]);
  });
});
