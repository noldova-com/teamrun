/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListAnchor } from "../../../src/app/models/virtual-list-anchor";

describe("VirtualListAnchor", () => {
  it("moves later by the rows inserted at or before its row, and stays for rows inserted after it", () => {
    const anchor = new VirtualListAnchor(10, 25);

    expect([anchor.index, anchor.distance]).toEqual([10, 25]);
    expect(anchor.afterInsert(0, 5)).toEqual(new VirtualListAnchor(15, 25));
    expect(anchor.afterInsert(10, 2)).toEqual(new VirtualListAnchor(12, 25));
    expect(anchor.afterInsert(11, 2)).toBe(anchor);
  });

  it("moves earlier by the rows removed before its row, moves to the first removed place at no distance when its row goes, and stays for rows removed after it", () => {
    const anchor = new VirtualListAnchor(10, 25);

    expect(anchor.afterRemove(0, 5)).toEqual(new VirtualListAnchor(5, 25));
    expect(anchor.afterRemove(5, 5)).toEqual(new VirtualListAnchor(5, 25));
    expect(anchor.afterRemove(8, 5)).toEqual(new VirtualListAnchor(8, 0));
    expect(anchor.afterRemove(10, 1)).toEqual(new VirtualListAnchor(10, 0));
    expect(anchor.afterRemove(11, 3)).toBe(anchor);
  });
});
