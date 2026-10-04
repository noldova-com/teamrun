/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import BuildMatrix from "../../workflows/build-matrix.ts";

class BuildMatrixTests {
  public static register(): void {
    test("pushes and manual runs build every target, and pull requests defer the slowest and scarcest", () => {
      const full = new BuildMatrix(false);
      const pullRequest = new BuildMatrix(true);

      assert.deepEqual(full.targets.map(t => `${t.name}|${t.runner}|${t.architecture}`), [
        "Linux x64|ubuntu-24.04|x64",
        "Linux ARM64|ubuntu-24.04-arm|arm64",
        "Windows x64|windows-2025|x64",
        "Windows ARM64|windows-11-arm|arm64",
        "macOS x64|macos-15-intel|x64",
        "macOS ARM64|macos-15|arm64"
      ]);
      assert.deepEqual(full.deferred, []);
      assert.deepEqual(pullRequest.targets.map(t => t.name), ["Linux x64", "Linux ARM64", "Windows x64", "macOS ARM64"]);
      assert.deepEqual(pullRequest.deferred.map(t => t.name), ["Windows ARM64", "macOS x64"]);
    });

    test("each target's UI workflows run in three shards", () => {
      const shards = new BuildMatrix(true).uiShards;

      assert.deepEqual(shards.map(t => `${t.target.name} ${t.index}/${t.count}`), [
        "Linux x64 1/3", "Linux x64 2/3", "Linux x64 3/3",
        "Linux ARM64 1/3", "Linux ARM64 2/3", "Linux ARM64 3/3",
        "Windows x64 1/3", "Windows x64 2/3", "Windows x64 3/3",
        "macOS ARM64 1/3", "macOS ARM64 2/3", "macOS ARM64 3/3"
      ]);
    });
  }
}

BuildMatrixTests.register();
