/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type IRepeatLeg from "../../workflows/interfaces/i-repeat-leg.ts";
import RepeatMatrix from "../../workflows/repeat-matrix.ts";

class RepeatMatrixTests {
  public static register(): void {
    test("Linux x64 and Windows x64 run five passes as parallel jobs, and macOS ARM64 runs all five in one job", () => {
      const pass = (target: string, key: string, runner: string, architecture: string, index: number): IRepeatLeg =>
        ({ name: `${target}, pass ${index} of 5`, key: `${key}-${index}`, runner, architecture, repeats: 1, shard: "", hasTests: true });
      const passes = [1, 2, 3, 4, 5];

      assert.deepEqual(RepeatMatrix.plan(0), [
        ...passes.map(t => pass("Linux x64", "linux-x64", "ubuntu-24.04", "x64", t)),
        ...passes.map(t => pass("Windows x64", "windows-x64", "windows-2025", "x64", t)),
        { name: "macOS ARM64, 5 passes", key: "macos-arm64", runner: "macos-15", architecture: "arm64", repeats: 5, shard: "", hasTests: true }
      ]);
    });

    test("macOS ARM64 keeps one job while five passes of the UI tests fit in 40 minutes at 3.6 s a test, and splits them into two shards past it, never more", () => {
      const serial = (count: number): readonly IRepeatLeg[] => RepeatMatrix.plan(count).filter(t => t.runner === "macos-15");
      const sharded = (index: number): IRepeatLeg =>
        ({ name: `macOS ARM64, 5 passes, shard ${index} of 2`, key: `macos-arm64-${index}`, runner: "macos-15", architecture: "arm64", repeats: 5, shard: `${index}/2`, hasTests: index === 1 });

      assert.deepEqual([serial(1).length, serial(133).length], [1, 1]);
      assert.deepEqual(serial(134), [sharded(1), sharded(2)]);
      assert.deepEqual(serial(1_000), [sharded(1), sharded(2)]);
      assert.equal(RepeatMatrix.plan(1_000).filter(t => t.runner !== "macos-15").length, 10);
    });
  }
}

RepeatMatrixTests.register();
