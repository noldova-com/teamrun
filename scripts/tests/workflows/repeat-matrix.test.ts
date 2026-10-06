/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import RepeatMatrix from "../../workflows/repeat-matrix.ts";

class RepeatMatrixTests {
  public static register(): void {
    test("Linux x64 and Windows x64 run five passes as parallel jobs, and macOS ARM64 runs all five in one job", () => {
      const pass = (target: string, key: string, runner: string, architecture: string, index: number): object =>
        ({ name: `${target}, pass ${index} of 5`, key: `${key}-${index}`, runner, architecture, repeats: 1 });
      const passes = [1, 2, 3, 4, 5];

      assert.deepEqual(RepeatMatrix.plan(), [
        ...passes.map(t => pass("Linux x64", "linux-x64", "ubuntu-24.04", "x64", t)),
        ...passes.map(t => pass("Windows x64", "windows-x64", "windows-2025", "x64", t)),
        { name: "macOS ARM64, 5 passes", key: "macos-arm64", runner: "macos-15", architecture: "arm64", repeats: 5 }
      ]);
    });
  }
}

RepeatMatrixTests.register();
