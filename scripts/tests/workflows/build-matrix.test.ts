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
    test("manual runs build every target, pushes every target but macOS x64, and pull requests defer the slowest and scarcest", () => {
      const full = new BuildMatrix("workflow_dispatch");
      const pullRequest = new BuildMatrix("pull_request");

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
      assert.deepEqual([new BuildMatrix("push").targets.map(t => t.name), new BuildMatrix("push").deferred.map(t => t.name)],
        [["Linux x64", "Linux ARM64", "Windows x64", "Windows ARM64", "macOS ARM64"], ["macOS x64"]]);
    });

    test("a merge group runs what a pull request runs", () => {
      const describe = (matrix: BuildMatrix): string[] => [...matrix.targets, ...matrix.deferred].map(t =>
        `${t.name}: ${matrix.uiShards(t).map(s => `${s.index}/${s.count} ${s.grep} ${s.isPrebuilt}`).join(", ")}`);

      assert.deepEqual(describe(new BuildMatrix("merge_group")), describe(new BuildMatrix("pull_request")));
      assert.deepEqual(new BuildMatrix("merge_group").targets.map(t => t.name), ["Linux x64", "Linux ARM64", "Windows x64", "macOS ARM64"]);
    });

    test("only a target that runs its tests in one job and only the smoke set folds its UI workflows into that job", () => {
      const folded = (matrix: BuildMatrix): string[] => matrix.targets.filter(t => matrix.foldsUi(t)).map(t => t.name);

      assert.deepEqual(folded(new BuildMatrix("pull_request")), ["macOS ARM64"]);
      assert.deepEqual(folded(new BuildMatrix("merge_group")), ["macOS ARM64"]);
      assert.deepEqual(folded(new BuildMatrix("push")), []);
      assert.deepEqual(folded(new BuildMatrix("workflow_dispatch")), []);
    });

    test("Windows and macOS x64 run their UI workflows in three shards, macOS ARM64 in two, Linux in five", () => {
      const targets = new BuildMatrix("workflow_dispatch").targets;

      assert.ok(targets.every(t => t.uiShards.every(s => s.target === t)));
      assert.deepEqual(targets.map(t => `${t.name}: ${t.uiShards.map(s => `${s.index}/${s.count}`).join(" ")}`), [
        "Linux x64: 1/5 2/5 3/5 4/5 5/5",
        "Linux ARM64: 1/5 2/5 3/5 4/5 5/5",
        "Windows x64: 1/3 2/3 3/3",
        "Windows ARM64: 1/3 2/3 3/3",
        "macOS x64: 1/3 2/3 3/3",
        "macOS ARM64: 1/2 2/2"
      ]);
    });

    test("pull requests run every UI workflow in shards on Linux and only the smoke set in one self-built job on Windows and macOS, and other runs shard every target", () => {
      const describe = (matrix: BuildMatrix): string[] => matrix.targets.map(t =>
        `${t.name}: ${matrix.uiShards(t).map(s => `${s.index}/${s.count}${s.grep === "" ? "" : ` ${s.grep}`}${s.isPrebuilt ? " prebuilt" : ""}`).join(" ")}`);

      assert.deepEqual(describe(new BuildMatrix("pull_request")), [
        "Linux x64: 1/5 prebuilt 2/5 prebuilt 3/5 prebuilt 4/5 prebuilt 5/5 prebuilt",
        "Linux ARM64: 1/5 prebuilt 2/5 prebuilt 3/5 prebuilt 4/5 prebuilt 5/5 prebuilt",
        "Windows x64: 1/1 @smoke",
        "macOS ARM64: 1/1 @smoke"
      ]);
      assert.deepEqual(describe(new BuildMatrix("workflow_dispatch")), [
        "Linux x64: 1/5 prebuilt 2/5 prebuilt 3/5 prebuilt 4/5 prebuilt 5/5 prebuilt",
        "Linux ARM64: 1/5 prebuilt 2/5 prebuilt 3/5 prebuilt 4/5 prebuilt 5/5 prebuilt",
        "Windows x64: 1/3 prebuilt 2/3 prebuilt 3/3 prebuilt",
        "Windows ARM64: 1/3 prebuilt 2/3 prebuilt 3/3 prebuilt",
        "macOS x64: 1/3 prebuilt 2/3 prebuilt 3/3 prebuilt",
        "macOS ARM64: 1/2 prebuilt 2/2 prebuilt"
      ]);
      assert.ok(new BuildMatrix("pull_request").targets.every(t => new BuildMatrix("pull_request").uiShards(t).every(s => s.target === t)));
    });

    test("a target's key and operating system come from its name", () => {
      assert.deepEqual(new BuildMatrix("workflow_dispatch").targets.map(t => `${t.key} ${t.operatingSystem}`), [
        "linux-x64 Linux", "linux-arm64 Linux", "windows-x64 Windows", "windows-arm64 Windows", "macos-x64 macOS", "macos-arm64 macOS"
      ]);
    });
  }
}

BuildMatrixTests.register();
