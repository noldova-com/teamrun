/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { HeightLedger } from "../../../src/app/models/height-ledger";
import { VirtualListAnchor } from "../../../src/app/models/virtual-list-anchor";
import { VirtualRange } from "../../../src/app/models/virtual-range";

describe("HeightLedger", () => {
  it("starts every row at the estimate, adds up their offsets and finds the row under any position", () => {
    const ledger = new HeightLedger(4, 100);

    expect([ledger.count, ledger.total, ledger.offsetOf(2), ledger.heightOf(1)]).toEqual([4, 400, 200, 100]);
    expect([-5, 0, 99, 100, 250, 399, 400, 1000].map(t => ledger.indexAt(t))).toEqual([0, 0, 0, 1, 2, 3, 3, 3]);
  });

  it("measures rows, telling a real change from a repeated height, and adds up offsets again from the lowest change", () => {
    const ledger = new HeightLedger(4, 100);

    expect(ledger.measure(3, 10)).toBe(true);
    expect([ledger.offsetOf(3), ledger.total]).toEqual([300, 310]);
    expect(ledger.measure(1, 50)).toBe(true);
    expect(ledger.measure(1, 50)).toBe(false);
    expect([ledger.offsetOf(1), ledger.offsetOf(2), ledger.offsetOf(3), ledger.total]).toEqual([100, 150, 250, 260]);
    expect(ledger.measure(0, 20)).toBe(true);
    expect([ledger.offsetOf(2), ledger.total, ledger.heightOf(0), ledger.heightOf(2)]).toEqual([70, 180, 20, 100]);
    expect([69, 70, 169, 170].map(t => ledger.indexAt(t))).toEqual([1, 2, 2, 3]);
  });

  it("gives the rows within a margin around the view with the space above and below them, and nothing for an empty list", () => {
    const ledger = new HeightLedger(10, 100);

    expect(ledger.rangeFor(450, 200, 100)).toEqual(new VirtualRange(3, 8, 300, 200));
    expect(ledger.rangeFor(0, 250, 600)).toEqual(new VirtualRange(0, 9, 0, 100));
    expect(ledger.rangeFor(900, 100, 600)).toEqual(new VirtualRange(3, 10, 300, 0));
    expect(new HeightLedger(0, 100).rangeFor(0, 500, 600)).toBe(VirtualRange.empty);
  });

  it("anchors to the row under a position and finds that place again after rows above it change, are inserted or removed", () => {
    const ledger = new HeightLedger(10, 100);
    const anchor = ledger.anchorAt(250);

    expect(anchor).toEqual(new VirtualListAnchor(2, 50));
    ledger.measure(0, 300);
    expect(ledger.topOf(anchor)).toBe(450);
    ledger.insert(0, 2);
    expect(ledger.topOf(anchor.afterInsert(0, 2))).toBe(650);
    ledger.remove(0, 3);
    expect(ledger.topOf(anchor.afterInsert(0, 2).afterRemove(0, 3))).toBe(150);
    expect(ledger.topOf(new VirtualListAnchor(40, 10))).toBe(ledger.total + 10);
    expect(new HeightLedger(0, 100).anchorAt(80)).toEqual(new VirtualListAnchor(0, 0));
  });

  it("inserts rows at the estimate and removes rows, keeping the measured heights of the rest", () => {
    const ledger = new HeightLedger(3, 100);
    ledger.measure(0, 10);
    ledger.measure(2, 30);

    expect(ledger.total).toBe(140);
    ledger.insert(1, 2);
    expect([0, 1, 2, 3, 4].map(t => ledger.heightOf(t))).toEqual([10, 100, 100, 100, 30]);
    expect([ledger.count, ledger.total, ledger.offsetOf(4)]).toEqual([5, 340, 310]);
    ledger.remove(0, 2);
    expect([ledger.count, ledger.total, ledger.heightOf(2)]).toEqual([3, 230, 30]);
    ledger.insert(3, 1);
    expect([ledger.count, ledger.total, ledger.offsetOf(3)]).toEqual([4, 330, 230]);
    ledger.remove(3, 1);
    expect([ledger.count, ledger.total]).toEqual([3, 230]);
  });

  it("keeps a list of 100,000 rows and follows the height of its last row as it grows", () => {
    const ledger = new HeightLedger(100_000, 120);

    expect(ledger.total).toBe(12_000_000);
    for (let height = 121; height <= 130; height++)
      ledger.measure(99_999, height);
    expect([ledger.total, ledger.indexAt(11_999_999), ledger.indexAt(6_000_000)]).toEqual([12_000_010, 99_999, 50_000]);
  });
});
