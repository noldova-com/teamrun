/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListException } from "../../../src/app/exceptions/virtual-list.exception";
import type { IVirtualListObserver } from "../../../src/app/interfaces/i-virtual-list-observer";
import { VirtualListSourceFixture } from "../../fixtures/virtual-list-source.fixture";

describe("VirtualListSource", () => {
  function observe(source: VirtualListSourceFixture, name: string, log: string[]): IVirtualListObserver {
    const observer: IVirtualListObserver = {
      onInserted: (at, count) => log.push(`${name} inserted ${count} at ${at}, length ${source.length()}`),
      onRemoved: (at, count) => log.push(`${name} removed ${count} at ${at}, length ${source.length()}`),
      onUpdated: (at, count) => log.push(`${name} updated ${count} at ${at}, length ${source.length()}`)
    };
    source.observe(observer);
    return observer;
  }

  it("starts with its length and estimate, 120 pixels unless given, and refuses a length or estimate that can't be", () => {
    expect([new VirtualListSourceFixture(10).length(), new VirtualListSourceFixture(10).estimate, new VirtualListSourceFixture(0, 26).estimate]).toEqual([10, 120, 26]);
    for (const length of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => new VirtualListSourceFixture(length)).toThrow(new VirtualListException(`A list's length must be a whole number of 0 or more, not ${length}.`));
    for (const estimate of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(() => new VirtualListSourceFixture(1, estimate)).toThrow(new VirtualListException(`A row's estimated height must be a number of pixels above 0, not ${estimate}.`));
  });

  it("changes its length before telling each observer, in the order they started, once each, and stops telling one that stopped", () => {
    const source = new VirtualListSourceFixture(10);
    const log: string[] = [];
    const first = observe(source, "first", log);
    observe(source, "second", log);
    source.observe(first);

    source.reportInserted(0, 5);
    source.reportInserted(15, 1);
    source.reportRemoved(3, 2);
    source.reportUpdated(13, 1);
    source.unobserve(first);
    source.reportUpdated(0, 14);

    expect(log).toEqual([
      "first inserted 5 at 0, length 15",
      "second inserted 5 at 0, length 15",
      "first inserted 1 at 15, length 16",
      "second inserted 1 at 15, length 16",
      "first removed 2 at 3, length 14",
      "second removed 2 at 3, length 14",
      "first updated 1 at 13, length 14",
      "second updated 1 at 13, length 14",
      "second updated 14 at 0, length 14"
    ]);
  });

  it("refuses an insert outside the list or of no whole number of items, and changes nothing", () => {
    const source = new VirtualListSourceFixture(10);
    const log: string[] = [];
    observe(source, "observer", log);

    for (const [at, count] of [[-1, 1], [11, 1], [0, 0], [1.5, 1], [0, 1.5]] as const)
      expect(() => source.reportInserted(at, count)).toThrow(new VirtualListException(
        `${count} items can't be inserted at ${at} in a list of 10; the count must be a whole number of 1 or more and the place from 0 to the length.`));
    expect([source.length(), log]).toEqual([10, []]);
  });

  it("refuses a removal or an update of items not all inside the list, or of no whole number of items, and changes nothing", () => {
    const source = new VirtualListSourceFixture(10);
    const log: string[] = [];
    observe(source, "observer", log);

    for (const [at, count] of [[-1, 1], [0, 0], [9, 2], [1.5, 1], [0, 1.5]] as const) {
      const message = `${count} items from ${at} are not in a list of 10; the count must be a whole number of 1 or more and every item inside the list.`;
      expect(() => source.reportRemoved(at, count)).toThrow(new VirtualListException(message));
      expect(() => source.reportUpdated(at, count)).toThrow(new VirtualListException(message));
    }
    expect([source.length(), log]).toEqual([10, []]);
  });

  it("tells every observer even when one throws, keeps the change, and then throws what the first one threw", () => {
    const source = new VirtualListSourceFixture(10);
    const log: string[] = [];
    const first = new Error("The first observer broke.");
    const breaking = (error: Error): IVirtualListObserver => ({
      onInserted: () => {
        throw error;
      },
      onRemoved: () => undefined,
      onUpdated: () => undefined
    });
    source.observe(breaking(first));
    observe(source, "kept", log);
    source.observe(breaking(new Error("The second observer broke.")));

    expect(() => source.reportInserted(0, 1)).toThrow(first);
    expect([source.length(), log]).toEqual([11, ["kept inserted 1 at 0, length 11"]]);
  });
});
