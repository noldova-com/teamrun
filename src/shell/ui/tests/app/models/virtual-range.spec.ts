/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualRange } from "../../../src/app/models/virtual-range";

describe("VirtualRange", () => {
  it("equals a range with the same rows and spaces, and no range that differs in any of them", () => {
    const range = new VirtualRange(3, 8, 300, 200);

    expect([range.start, range.end, range.top, range.bottom]).toEqual([3, 8, 300, 200]);
    expect(range.equals(new VirtualRange(3, 8, 300, 200))).toBe(true);
    expect([
      range.equals(new VirtualRange(4, 8, 300, 200)),
      range.equals(new VirtualRange(3, 9, 300, 200)),
      range.equals(new VirtualRange(3, 8, 301, 200)),
      range.equals(new VirtualRange(3, 8, 300, 199))
    ]).toEqual([false, false, false, false]);
    expect(VirtualRange.empty.equals(new VirtualRange(0, 0, 0, 0))).toBe(true);
  });
});
