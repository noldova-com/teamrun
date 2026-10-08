/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import ListTargets from "../list-targets.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class ListTargetsTests {
  private static readonly USAGE: string = "Usage: node scripts/list-targets.ts\n";

  public static register(): void {
    test("every target is printed for the workflows with its runner, processor, platform and whether it is packaged each night, from the one target table", () => {
      const output = new TextOutputFixture();

      assert.equal(new ListTargets(output).run([]), 0);
      assert.equal(output.text, [
        "Linux x64|ubuntu-24.04|x64|linux|nightly",
        "Linux ARM64|ubuntu-24.04-arm|arm64|linux|manual",
        "Windows x64|windows-2025|x64|windows|nightly",
        "Windows ARM64|windows-11-arm|arm64|windows|manual",
        "macOS x64|macos-15-intel|x64|macos|manual",
        "macOS ARM64|macos-15|arm64|macos|manual",
        ""
      ].join("\n"));
    });

    test("any argument is refused with the usage, also from the command line", () => {
      const output = new TextOutputFixture();

      assert.equal(new ListTargets(output).run(["--nightly"]), 2);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("list-targets.ts"), "--help"], { encoding: "utf8", timeout: 10_000 });

      assert.equal(output.text, ListTargetsTests.USAGE);
      assert.deepEqual([command.status, command.stdout], [2, ListTargetsTests.USAGE]);
    });

    test("the command line prints the table", () => {
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("list-targets.ts")], { encoding: "utf8", timeout: 10_000 });

      assert.equal(command.status, 0);
      assert.equal(command.stdout.split("\n")[0], "Linux x64|ubuntu-24.04|x64|linux|nightly");
    });
  }
}

ListTargetsTests.register();
