/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListException } from "../../../src/app/exceptions/virtual-list.exception";
import { ArrayVirtualListSource } from "../../../src/app/models/array-virtual-list-source";

describe("ArrayVirtualListSource", () => {
  async function readAllAsync(source: ArrayVirtualListSource<string>): Promise<readonly string[]> {
    return await source.readAsync(0, source.length());
  }

  it("reads a copy of its items by position and gives their keys through its function", async () => {
    const items = ["a", "b", "c"];
    const source = new ArrayVirtualListSource(items, t => `key ${t}`, 26);
    items.push("d");

    expect([source.length(), source.estimate, source.keyOf("b")]).toEqual([3, 26, "key b"]);
    expect(await source.readAsync(1, 3)).toEqual(["b", "c"]);
    expect(new ArrayVirtualListSource([], t => t).estimate).toBe(120);
  });

  it("inserts, removes and replaces items and reports each change after making it", async () => {
    const source = new ArrayVirtualListSource(["a", "b", "c"], t => t);
    const seen: string[] = [];
    source.observe({
      onInserted: () => void source.readAsync(0, source.length()).then(t => seen.push(t.join(""))),
      onRemoved: () => void source.readAsync(0, source.length()).then(t => seen.push(t.join(""))),
      onUpdated: () => void source.readAsync(0, source.length()).then(t => seen.push(t.join("")))
    });

    source.insert(0, ["x", "y"]);
    source.insert(5, ["z"]);
    source.remove(1, 2);
    source.replace(2, ["C", "Z"]);
    await readAllAsync(source);

    expect(seen).toEqual(["xyabc", "xyabcz", "xbcz", "xbCZ"]);
    expect(await readAllAsync(source)).toEqual(["x", "b", "C", "Z"]);
  });

  it("refuses a change outside the list or of no items, and keeps its items and length", async () => {
    const source = new ArrayVirtualListSource(["a", "b", "c"], t => t);

    expect(() => source.insert(4, ["x"])).toThrow(VirtualListException);
    expect(() => source.insert(0, [])).toThrow(VirtualListException);
    expect(() => source.remove(2, 2)).toThrow(VirtualListException);
    expect(() => source.replace(2, ["x", "y"])).toThrow(VirtualListException);
    expect([source.length(), await readAllAsync(source)]).toEqual([3, ["a", "b", "c"]]);
  });
});
