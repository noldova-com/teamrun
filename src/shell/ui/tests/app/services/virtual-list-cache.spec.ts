/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListException } from "../../../src/app/exceptions/virtual-list.exception";
import { VirtualListCache } from "../../../src/app/services/virtual-list-cache";
import { VirtualListSourceFixture } from "../../fixtures/virtual-list-source.fixture";

describe("VirtualListCache", () => {
  let errors: unknown[];

  beforeEach(() => {
    errors = [];
  });

  function createCache(source: VirtualListSourceFixture, pageSize?: number, capacity?: number): VirtualListCache<string> {
    return new VirtualListCache(source, t => errors.push(t), pageSize, capacity);
  }

  it("reads the pages of 50 that cover a request once each, the last one only up to the length, and gives their items", async () => {
    const source = new VirtualListSourceFixture(220);
    const cache = createCache(source);

    cache.request(60, 120);
    cache.request(60, 120);
    expect(source.describeReads()).toEqual(["50-100", "100-150"]);
    const revision = cache.revision();
    await source.readAt(0).answerAsync();
    await source.readAt(1).answerAsync();
    expect([cache.itemAt(50), cache.itemAt(149), cache.itemAt(150), cache.size, cache.revision()]).toEqual(["item 50", "item 149", undefined, 100, revision + 2]);
    cache.request(50, 150);
    cache.request(190, 400);
    expect(source.describeReads()).toEqual(["50-100", "100-150", "150-200", "200-220"]);
    expect(errors).toEqual([]);
  });

  it("aborts the pages no longer requested, before or after the request, and ignores what they answer later", async () => {
    const source = new VirtualListSourceFixture(300);
    const cache = createCache(source);

    cache.request(0, 50);
    cache.request(200, 250);
    cache.request(0, 50);
    expect(source.describeReads()).toEqual(["0-50 aborted", "200-250 aborted", "0-50"]);
    const revision = cache.revision();
    await source.readAt(0).answerAsync();
    await source.readAt(1).refuseAsync(new Error("The store went away."));
    expect([cache.itemAt(0), cache.revision(), cache.hasFailed, errors]).toEqual([undefined, revision, false, []]);
    await source.readAt(2).answerAsync();
    expect(cache.itemAt(0)).toBe("item 0");
  });

  it("keeps no more items than it holds, dropping those farthest from the request first and never a requested one", async () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source, 10, 20);

    for (const start of [0, 10, 20]) {
      cache.request(start, start + 10);
      await source.readAt(source.reads.length - 1).answerAsync();
    }
    expect([cache.size, cache.itemAt(9), cache.itemAt(10), cache.itemAt(29)]).toEqual([20, undefined, "item 10", "item 29"]);
    cache.request(0, 10);
    await source.readAt(source.reads.length - 1).answerAsync();
    expect([cache.size, cache.itemAt(0), cache.itemAt(19), cache.itemAt(20)]).toEqual([20, "item 0", "item 19", undefined]);
    cache.request(0, 30);
    await source.readAt(source.reads.length - 1).answerAsync();
    expect([cache.size, cache.itemAt(0), cache.itemAt(29)]).toEqual([30, "item 0", "item 29"]);
  });

  it("marks a page failed when the source refuses it or answers another number of items, reports why, and reads it again only on a retry", async () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source);
    const refusal = new Error("The store went away.");

    cache.request(0, 100);
    const revision = cache.revision();
    await source.readAt(0).refuseAsync(refusal);
    await source.readAt(1).answerAsync(["item 50"]);
    expect(errors).toEqual([refusal, new VirtualListException("A read of the 50 items from 50 to 99 answered 1.")]);
    expect([cache.hasFailed, cache.itemAt(0), cache.itemAt(50), cache.revision()]).toEqual([true, undefined, undefined, revision + 2]);
    cache.request(0, 100);
    expect(source.reads.length).toBe(2);
    cache.retry();
    await source.readAt(2).answerAsync();
    await source.readAt(3).answerAsync();
    expect(source.describeReads()).toEqual(["0-50", "50-100", "0-50", "50-100"]);
    expect([cache.hasFailed, cache.itemAt(99)]).toEqual([false, "item 99"]);
  });

  it("tells whether an item's page failed, and finds the place of the first loaded item that passes a test", async () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source);

    cache.request(0, 100);
    await source.readAt(0).answerAsync();
    await source.readAt(1).refuseAsync(new Error("The store went away."));

    expect([cache.isFailed(49), cache.isFailed(50), cache.isFailed(99)]).toEqual([false, true, true]);
    expect([cache.findIndex(t => t === "item 7"), cache.findIndex(t => t === "item 70")]).toEqual([7, -1]);
  });

  it("moves its items with the items inserted or removed before them, drops changed ones, and stops every read and failure in flight", async () => {
    const source = new VirtualListSourceFixture(200);
    const cache = createCache(source);
    cache.request(0, 50);
    await source.readAt(0).answerAsync();
    cache.request(0, 150);
    await source.readAt(2).refuseAsync(new Error("The store went away."));
    const revision = cache.revision();

    source.reportInserted(0, 5);
    expect([cache.itemAt(4), cache.itemAt(5), cache.itemAt(54), cache.itemAt(55)]).toEqual([undefined, "item 0", "item 49", undefined]);
    expect([source.readAt(1).abort.aborted, cache.hasFailed, cache.revision()]).toEqual([true, false, revision + 1]);
    source.reportRemoved(0, 5);
    expect([cache.itemAt(0), cache.itemAt(49)]).toEqual(["item 0", "item 49"]);
    source.reportRemoved(10, 5);
    expect([cache.itemAt(9), cache.itemAt(10), cache.itemAt(44), cache.itemAt(45)]).toEqual(["item 9", "item 15", "item 49", undefined]);
    source.reportUpdated(1, 2);
    expect([cache.itemAt(0), cache.itemAt(1), cache.itemAt(2), cache.itemAt(3), cache.size]).toEqual(["item 0", undefined, undefined, "item 3", 43]);
    source.reportInserted(40, 1);
    expect([cache.itemAt(39), cache.itemAt(40), cache.itemAt(41)]).toEqual(["item 44", undefined, "item 45"]);
  });

  it("stops its reads and no longer follows its source once disposed", () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source);
    cache.request(0, 50);
    const revision = cache.revision();

    cache.dispose();
    source.reportInserted(0, 1);

    expect([source.readAt(0).abort.aborted, cache.revision()]).toEqual([true, revision]);
  });
});
