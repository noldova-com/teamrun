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
    const anchor = new VirtualListAnchor(10, 25, "message 10");

    expect([anchor.index, anchor.distance, anchor.key, new VirtualListAnchor(0, 0).key]).toEqual([10, 25, "message 10", null]);
    expect(anchor.afterInsert(0, 5)).toEqual(new VirtualListAnchor(15, 25, "message 10"));
    expect(anchor.afterInsert(10, 2)).toEqual(new VirtualListAnchor(12, 25, "message 10"));
    expect(anchor.afterInsert(11, 2)).toBe(anchor);
  });

  it("moves earlier by the rows removed before its row, moves to the first removed place at no distance when its row goes, and stays for rows removed after it", () => {
    const anchor = new VirtualListAnchor(10, 25, "message 10");

    expect(anchor.afterRemove(0, 5)).toEqual(new VirtualListAnchor(5, 25, "message 10"));
    expect(anchor.afterRemove(5, 5)).toEqual(new VirtualListAnchor(5, 25, "message 10"));
    expect(anchor.afterRemove(8, 5)).toEqual(new VirtualListAnchor(8, 0));
    expect(anchor.afterRemove(10, 1)).toEqual(new VirtualListAnchor(10, 0));
    expect(anchor.afterRemove(11, 3)).toBe(anchor);
  });

  it("finds its row by its key before it falls back to its place, so a saved position survives rows added or removed before it", () => {
    const anchor = new VirtualListAnchor(10, 25, "message 10");
    const asked: string[] = [];
    const find = (key: string): number => {
      asked.push(key);
      return 14;
    };

    expect(anchor.resolve(find)).toEqual(new VirtualListAnchor(14, 25, "message 10"));
    expect(anchor.resolve(() => -1)).toBe(anchor);
    expect(new VirtualListAnchor(3, 0).resolve(() => 7)).toEqual(new VirtualListAnchor(3, 0));
    expect(asked).toEqual(["message 10"]);
  });
});
