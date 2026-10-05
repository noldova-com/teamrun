/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PullRequestPool from "../../workflows/pull-request-pool.ts";

class PullRequestPoolTests {
  public static register(): void {
    test("no items give no results", async () => {
      assert.deepEqual(await new PullRequestPool(4).mapAsync([], async () => 1), []);
    });

    test("at most its limit of items run at once, and the next starts when one ends", async () => {
      const work = PullRequestPoolTests.defer(6);
      const started: number[] = [];
      const mapping = new PullRequestPool(4).mapAsync(work, t => {
        started.push(work.indexOf(t));
        return t.promise;
      });

      await PullRequestPoolTests.settleAsync();
      const first = [...started];
      work[2]?.resolve("two");
      await PullRequestPoolTests.settleAsync();
      const second = [...started];
      for (const item of work)
        item.resolve("done");

      assert.deepEqual(first, [0, 1, 2, 3]);
      assert.deepEqual(second, [0, 1, 2, 3, 4]);
      assert.deepEqual(await mapping, ["done", "done", "two", "done", "done", "done"]);
    });

    test("results keep the items' order, whichever ends first", async () => {
      const work = PullRequestPoolTests.defer(3);
      const mapping = new PullRequestPool(4).mapAsync(work, t => t.promise);

      for (const [index, item] of [...work.entries()].reverse())
        item.resolve(`item ${index}`);

      assert.deepEqual(await mapping, ["item 0", "item 1", "item 2"]);
    });

    test("a failure does not stop the other items, and is thrown once they have all ended", async () => {
      const work = PullRequestPoolTests.defer(4);
      const failure = new Error("Item 0 failed.");
      const started: number[] = [];
      const mapping = new PullRequestPool(2).mapAsync(work, t => {
        started.push(work.indexOf(t));
        return t.promise;
      });
      let isSettled = false;
      const settling = mapping.finally(() => {
        isSettled = true;
      });

      work[0]?.reject(failure);
      await PullRequestPoolTests.settleAsync();
      const wasSettled = isSettled;
      const afterFailure = [...started];
      for (const item of work.slice(1))
        item.resolve("done");

      assert.equal(wasSettled, false);
      assert.deepEqual(afterFailure, [0, 1, 2]);
      await assert.rejects(settling, failure);
      assert.deepEqual(started, [0, 1, 2, 3]);
    });

    test("every failure is reported, in the items' order rather than the order they failed in", async () => {
      const work = PullRequestPoolTests.defer(4);
      const failures = [new Error("Item 1 failed."), new Error("Item 3 failed.")];
      const mapping = new PullRequestPool(4).mapAsync(work, t => t.promise);

      work[3]?.reject(failures[1]);
      await PullRequestPoolTests.settleAsync();
      work[1]?.reject(failures[0]);
      work[0]?.resolve("done");
      work[2]?.resolve("done");
      const failure = await mapping.then(() => null, (error: unknown) => error);

      assert.ok(failure instanceof AggregateError);
      assert.equal(failure.message, "2 pull requests failed.");
      assert.deepEqual(failure.errors, failures);
    });
  }

  private static defer(count: number): PromiseWithResolvers<string>[] {
    return Array.from({ length: count }, () => Promise.withResolvers<string>());
  }

  private static async settleAsync(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }
}

PullRequestPoolTests.register();
