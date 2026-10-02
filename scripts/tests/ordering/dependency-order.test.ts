/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import DependencyOrder from "../../ordering/dependency-order.ts";

class DependencyOrderTests {
  private static readonly ITEMS: ReadonlyMap<string, readonly string[]> = new Map([
    ["window", ["ui", "core"]],
    ["ui", ["core"]],
    ["json", ["core"]],
    ["core", []]
  ]);

  public static register(): void {
    test("items come after the items they depend on, otherwise in their given order", () => {
      const order = DependencyOrderTests.create([...DependencyOrderTests.ITEMS.keys()]);

      assert.deepEqual(order.sort(t => new Error(t.join(","))), ["core", "ui", "json", "window"]);
      assert.deepEqual(DependencyOrderTests.create([]).sort(t => new Error(t.join(","))), []);
    });

    test("a cycle throws the caller's error, naming every item that cannot be placed", () => {
      const cyclic = new Map([["core", []], ["ui", ["window", "core"]], ["window", ["ui"]], ["notes", ["window"]]]);
      const order = new DependencyOrder([...cyclic.keys()], t => t, t => cyclic.get(t) ?? []);

      assert.throws(() => order.sort(t => new RangeError(`cycle: ${t.join(", ")}`)), new RangeError("cycle: ui, window, notes"));
    });
  }

  private static create(names: readonly string[]): DependencyOrder<string> {
    return new DependencyOrder(names, t => t, t => DependencyOrderTests.ITEMS.get(t) ?? []);
  }
}

DependencyOrderTests.register();
