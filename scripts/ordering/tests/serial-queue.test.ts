/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SerialQueue } from "../serial-queue.ts";

class Gate {
  public readonly promise: Promise<void>;
  private release: () => void = () => undefined;

  public constructor() {
    this.promise = new Promise<void>(resolve => {
      this.release = resolve;
    });
  }

  public open(): void {
    this.release();
  }
}

describe("SerialQueue", () => {
  it("starts each piece of work only after the one before it settles, and returns its result", async () => {
    const queue = new SerialQueue();
    const events: string[] = [];
    const first = new Gate();
    const firstStarted = new Gate();
    const one = queue.runAsync(async () => {
      events.push("one started");
      firstStarted.open();
      await first.promise;
      events.push("one finished");
      return 1;
    });
    const two = queue.runAsync(async () => {
      events.push("two started");
      return 2;
    });

    await firstStarted.promise;
    assert.deepEqual(events, ["one started"]);
    first.open();
    assert.equal(await one, 1);
    assert.equal(await two, 2);
    assert.deepEqual(events, ["one started", "one finished", "two started"]);
  });

  it("gives a failure only to its own caller and runs the next piece of work", async () => {
    const queue = new SerialQueue();
    const failure = new Error("one failed");
    const one = queue.runAsync(async () => {
      throw failure;
    });
    const two = queue.runAsync(async () => "two");

    await assert.rejects(one, failure);
    assert.equal(await two, "two");
  });
});
