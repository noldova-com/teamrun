/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HeightLedger } from "../../../src/app/models/height-ledger";
import { VirtualRange } from "../../../src/app/models/virtual-range";

describe("HeightLedger", () => {
  it("keeps measured and estimated heights with their offsets and finds the items under a viewport", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const ledger = new HeightLedger(ids, new Map([["b", 50], ["d", 200]]), 100);

    expect(ledger.count).toBe(5);
    expect(ledger.total).toBe(550);
    expect(ledger.offsetOf("a")).toBe(0);
    expect(ledger.offsetOf("c")).toBe(150);
    expect(ledger.offsetOf("e")).toBe(450);
    expect(ledger.offsetOf("zz")).toBeNull();
    expect(ledger.heightOf("b")).toBe(50);
    expect(ledger.heightOf("c")).toBe(100);
    expect(ledger.heightOf("zz")).toBeNull();
    expect(ledger.indexAt(0)).toBe(0);
    expect(ledger.indexAt(149)).toBe(1);
    expect(ledger.indexAt(150)).toBe(2);
    expect(ledger.indexAt(9999)).toBe(4);

    const middle = ledger.rangeFor(160, 100, 0);
    expect(middle.start).toBe(2);
    expect(middle.end).toBe(4);
    expect(middle.top).toBe(150);
    expect(middle.bottom).toBe(100);
    const wide = ledger.rangeFor(160, 100, 100);
    expect(wide.start).toBe(0);
    expect(wide.end).toBe(4);
    expect(wide.top).toBe(0);
    expect(wide.bottom).toBe(100);
    expect(ledger.rangeFor(0, 1000, 1000).end).toBe(5);
    const end = ledger.rangeFor(500, 100, 0);
    expect(end.start).toBe(4);
    expect(end.end).toBe(5);
    expect(end.top).toBe(450);
    expect(end.equals(new VirtualRange(4, 5, 450, 0))).toBe(true);
    expect(end.equals(middle)).toBe(false);
  });

  it("is empty without items", () => {
    const ledger = new HeightLedger([], new Map(), 100);

    expect(ledger.total).toBe(0);
    expect(ledger.indexAt(10)).toBe(0);
    expect(ledger.rangeFor(0, 100, 50)).toBe(VirtualRange.empty);
    expect(VirtualRange.empty.equals(new VirtualRange(0, 0, 0, 0))).toBe(true);
  });
});
