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

  function createCache(source: VirtualListSourceFixture): VirtualListCache<string> {
    return new VirtualListCache(source, t => errors.push(t));
  }

  async function answerAllAsync(source: VirtualListSourceFixture): Promise<void> {
    for (const read of source.reads.filter(t => !t.abort.aborted && !t.isSettled))
      await read.answerAsync();
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

  it("keeps a request inside the list, so it never reads before the first item", () => {
    const source = new VirtualListSourceFixture(30);
    const cache = createCache(source);

    cache.request(-10, 40);
    cache.request(-100, 10);

    expect(source.describeReads()).toEqual(["0-30"]);
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
    expect([cache.itemAt(0), cache.revision(), cache.isFailed(200), errors]).toEqual([undefined, revision, false, []]);
    await source.readAt(2).answerAsync();
    expect(cache.itemAt(0)).toBe("item 0");
  });

  it("keeps no more than 150 items, dropping those farthest from the request first and never a requested one", async () => {
    const source = new VirtualListSourceFixture(300);
    const cache = createCache(source);

    for (const start of [0, 50, 100, 150]) {
      cache.request(start, start + 50);
      await answerAllAsync(source);
    }
    expect([cache.size, cache.itemAt(49), cache.itemAt(50), cache.itemAt(199)]).toEqual([150, undefined, "item 50", "item 199"]);
    cache.request(0, 50);
    await answerAllAsync(source);
    expect([cache.size, cache.itemAt(0), cache.itemAt(149), cache.itemAt(150)]).toEqual([150, "item 0", "item 149", undefined]);
  });

  it("narrows a request of more than 150 items to the 150 around its middle", async () => {
    const source = new VirtualListSourceFixture(500);
    const cache = createCache(source);

    cache.request(0, 400);
    await answerAllAsync(source);

    expect(source.describeReads()).toEqual(["100-150", "150-200", "200-250", "250-300"]);
    expect([cache.size, cache.itemAt(124), cache.itemAt(125), cache.itemAt(274), cache.itemAt(275)]).toEqual([150, undefined, "item 125", "item 274", undefined]);
    expect(source.reads.length).toBe(4);
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
    expect([cache.isFailed(0), cache.isFailed(99), cache.itemAt(0), cache.itemAt(50), cache.revision()]).toEqual([true, true, undefined, undefined, revision + 2]);
    cache.request(0, 100);
    expect(source.reads.length).toBe(2);
    cache.retry();
    await source.readAt(2).answerAsync();
    await source.readAt(3).answerAsync();
    expect(source.describeReads()).toEqual(["0-50", "50-100", "0-50", "50-100"]);
    expect([cache.isFailed(0), cache.itemAt(99)]).toEqual([false, "item 99"]);
  });

  it("reads only the failed pages again on a retry, leaving a page still loading to finish", async () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source);
    cache.request(0, 100);
    await source.readAt(0).refuseAsync(new Error("The store went away."));

    cache.retry();
    await answerAllAsync(source);

    expect([source.describeReads(), cache.itemAt(0), cache.itemAt(99)]).toEqual([["0-50", "50-100", "0-50"], "item 0", "item 99"]);
  });

  it("finds the place of the first loaded item that passes a test", async () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source);

    cache.request(0, 50);
    await source.readAt(0).answerAsync();

    expect([cache.findIndex(t => t === "item 7"), cache.findIndex(t => t === "item 70")]).toEqual([7, -1]);
  });

  it("takes a read that throws instead of answering as a failed read", async () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source);
    const thrown = new Error("The store is closed.");
    source.readError = thrown;

    expect(() => cache.request(0, 50)).not.toThrow();
    source.readError = null;
    const failed = [cache.isFailed(0), errors];
    cache.retry();
    await answerAllAsync(source);

    expect([failed, cache.itemAt(0)]).toEqual([[true, [thrown]], "item 0"]);
  });

  it("keeps an updated item until its new one arrives, and reads its page again without stopping the other reads", async () => {
    const source = new VirtualListSourceFixture(200);
    const cache = createCache(source);
    cache.request(0, 100);
    await source.readAt(0).answerAsync();

    source.reportUpdated(3, 1);
    const kept = cache.itemAt(3);
    source.reportUpdated(3, 1);
    await source.readAt(2).answerAsync(Array.from({ length: 50 }, (_, t) => t === 3 ? "older 3" : `item ${t}`));
    const between = cache.itemAt(3);
    await source.readAt(3).answerAsync(Array.from({ length: 50 }, (_, t) => t === 3 ? "newest 3" : `item ${t}`));
    await source.readAt(1).answerAsync();

    expect([kept, between, cache.itemAt(3), cache.itemAt(99)]).toEqual(["item 3", "older 3", "newest 3", "item 99"]);
    expect(source.describeReads()).toEqual(["0-50", "50-100", "0-50", "0-50"]);
  });

  it("reads a page again once it finishes when an item in it changed while it loaded, and ignores changes to items it neither holds nor reads", async () => {
    const source = new VirtualListSourceFixture(200);
    const cache = createCache(source);
    cache.request(0, 50);

    source.reportUpdated(10, 1);
    source.reportUpdated(150, 50);
    await source.readAt(0).answerAsync();
    await answerAllAsync(source);

    expect(source.describeReads()).toEqual(["0-50", "0-50"]);
  });

  it("goes on reading an earlier page while one item streams updates", async () => {
    const source = new VirtualListSourceFixture(100);
    const cache = createCache(source);
    cache.request(0, 100);
    await source.readAt(1).answerAsync();

    for (let update = 0; update < 5; update++)
      source.reportUpdated(99, 1);
    await source.readAt(0).answerAsync();

    expect([source.readAt(0).abort.aborted, cache.itemAt(0)]).toEqual([false, "item 0"]);
  });

  it("moves its items with the items inserted or removed before them, and stops only the reads and failures that reach the change", async () => {
    const source = new VirtualListSourceFixture(200);
    const cache = createCache(source);
    cache.request(0, 150);
    await source.readAt(0).answerAsync();
    await source.readAt(1).refuseAsync(new Error("The store went away."));
    const revision = cache.revision();

    source.reportInserted(120, 5);
    const later = [source.readAt(2).abort.aborted, cache.isFailed(50), cache.revision()];
    source.reportInserted(0, 5);
    const earlier = [cache.isFailed(50), cache.itemAt(4), cache.itemAt(5), cache.itemAt(54), cache.itemAt(55)];
    source.reportRemoved(0, 5);
    source.reportRemoved(10, 5);
    cache.request(0, 45);

    expect([later, earlier]).toEqual([[true, true, revision + 1], [false, undefined, "item 0", "item 49", undefined]]);
    expect([cache.itemAt(9), cache.itemAt(10), cache.itemAt(44), cache.itemAt(45)]).toEqual(["item 9", "item 15", "item 49", undefined]);
    expect(source.describeReads()).toEqual(["0-50", "50-100", "100-150 aborted"]);
  });

  it("goes on reading a page that ends before an insert or a remove", async () => {
    const source = new VirtualListSourceFixture(200);
    const cache = createCache(source);
    cache.request(0, 100);

    source.reportInserted(60, 1);
    source.reportRemoved(150, 1);
    await source.readAt(0).answerAsync();

    expect([source.describeReads(), cache.itemAt(49)]).toEqual([["0-50", "50-100 aborted"], "item 49"]);
  });

  it("moves a changed item it holds outside the request with the items inserted before it, and forgets it once it is removed", async () => {
    const source = new VirtualListSourceFixture(200);
    const cache = createCache(source);
    cache.request(0, 50);
    await source.readAt(0).answerAsync();
    cache.request(100, 150);

    source.reportUpdated(10, 1);
    source.reportInserted(0, 1);
    const moved = cache.itemAt(11);
    source.reportRemoved(11, 1);

    expect([moved, cache.itemAt(10), cache.itemAt(11), source.reads.length]).toEqual(["item 10", "item 9", "item 11", 2]);
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
