/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DependencySchedule } from "../dependency-schedule.ts";

interface IItem {
  readonly name: string;
  readonly dependencies: readonly string[];
}

class Gate {
  public readonly promise: Promise<void>;
  private settle: (error: Error | null) => void = () => undefined;

  public constructor() {
    this.promise = new Promise<void>((resolve, reject) => {
      this.settle = error => error === null ? resolve() : reject(error);
    });
  }

  public open(): void {
    this.settle(null);
  }

  public fail(error: Error): void {
    this.settle(error);
  }
}

class Tasks {
  public readonly started: string[] = [];
  public readonly finished: string[] = [];
  private readonly gates: Map<string, Gate> = new Map();
  private readonly starts: Map<string, Gate> = new Map();

  public constructor(names: readonly string[]) {
    for (const name of names) {
      this.gates.set(name, new Gate());
      this.starts.set(name, new Gate());
    }
  }

  public async runAsync(item: IItem): Promise<void> {
    this.started.push(item.name);
    this.gateOf(this.starts, item.name).open();
    await this.gateOf(this.gates, item.name).promise;
    this.finished.push(item.name);
  }

  public async startOfAsync(name: string): Promise<void> {
    await this.gateOf(this.starts, name).promise;
  }

  public finish(name: string): void {
    this.gateOf(this.gates, name).open();
  }

  public fail(name: string, error: Error): void {
    this.gateOf(this.gates, name).fail(error);
  }

  private gateOf(gates: ReadonlyMap<string, Gate>, name: string): Gate {
    const gate = gates.get(name);
    if (gate === undefined)
      throw new Error(`No gate for ${name}.`);
    return gate;
  }
}

const item = (name: string, ...dependencies: string[]): IItem => ({ name, dependencies });
const cycle = (names: readonly string[]): Error => new Error(`cycle: ${names.join(", ")}`);
const scheduleOf = (items: readonly IItem[], limit: number): DependencySchedule<IItem> => new DependencySchedule(items, t => t.name, t => t.dependencies, limit);

describe("DependencySchedule", () => {
  it("runs independent items at the same time and an item only after its dependencies finish", async () => {
    const tasks = new Tasks(["a", "b", "c", "d"]);
    const run = scheduleOf([item("a"), item("b"), item("c", "a"), item("d", "a", "b")], 4).runAsync(async t => await tasks.runAsync(t), cycle);

    await tasks.startOfAsync("a");
    await tasks.startOfAsync("b");
    assert.deepEqual(tasks.started, ["a", "b"]);

    tasks.finish("a");
    await tasks.startOfAsync("c");
    assert.deepEqual(tasks.started, ["a", "b", "c"]);

    tasks.finish("b");
    await tasks.startOfAsync("d");
    tasks.finish("c");
    tasks.finish("d");
    await run;
    assert.deepEqual(tasks.started, ["a", "b", "c", "d"]);
    assert.deepEqual(tasks.finished, ["a", "b", "c", "d"]);
  });

  it("runs no more items at once than its limit, starting the next in the given order", async () => {
    const tasks = new Tasks(["a", "b", "c"]);
    const run = scheduleOf([item("a"), item("b"), item("c")], 2).runAsync(async t => await tasks.runAsync(t), cycle);

    await tasks.startOfAsync("a");
    await tasks.startOfAsync("b");
    assert.deepEqual(tasks.started, ["a", "b"]);

    tasks.finish("b");
    await tasks.startOfAsync("c");
    tasks.finish("a");
    tasks.finish("c");
    await run;
    assert.deepEqual(tasks.started, ["a", "b", "c"]);
  });

  it("runs one item at a time with a limit below one", async () => {
    const tasks = new Tasks(["a", "b"]);
    const run = scheduleOf([item("a"), item("b")], 0).runAsync(async t => await tasks.runAsync(t), cycle);

    await tasks.startOfAsync("a");
    assert.deepEqual(tasks.started, ["a"]);
    tasks.finish("a");
    await tasks.startOfAsync("b");
    tasks.finish("b");
    await run;
  });

  it("starts nothing after a failure, lets the running items finish, then throws the first failure", async () => {
    const failure = new Error("a failed");
    const tasks = new Tasks(["a", "b", "c", "d"]);
    const events: string[] = [];
    const run = scheduleOf([item("a"), item("b"), item("c"), item("d", "a")], 2).runAsync(async t => await tasks.runAsync(t), cycle)
      .catch((error: unknown) => {
        events.push("rejected");
        throw error;
      });

    await tasks.startOfAsync("a");
    await tasks.startOfAsync("b");
    tasks.fail("a", failure);
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(events, []);

    tasks.finish("b");
    await assert.rejects(run, failure);
    assert.deepEqual(tasks.started, ["a", "b"]);
    assert.deepEqual(tasks.finished, ["b"]);
    assert.deepEqual(events, ["rejected"]);
  });

  it("throws the cycle's error, naming the items left, when no item can start", async () => {
    const tasks = new Tasks(["a", "b", "c"]);
    const run = scheduleOf([item("a"), item("b", "c"), item("c", "b")], 2).runAsync(async t => await tasks.runAsync(t), cycle);

    await tasks.startOfAsync("a");
    tasks.finish("a");
    await assert.rejects(run, { message: "cycle: b, c" });
    assert.deepEqual(tasks.started, ["a"]);
  });

  it("finishes at once with no items", async () => {
    const tasks = new Tasks([]);
    await scheduleOf([], 2).runAsync(async t => await tasks.runAsync(t), cycle);
    assert.deepEqual(tasks.started, []);
  });
});
