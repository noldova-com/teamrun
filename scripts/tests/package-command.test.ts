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

class PackageCommandTests {
  public static register(): void {
    test("packaging help exits successfully without starting a build", () => {
      const result = spawnSync(process.execPath, ["scripts/package.ts", "--help"], { encoding: "utf8", timeout: 10_000 });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /--platform windows\|linux\|mac/);
      assert.match(result.stdout, /never published/);
      assert.doesNotMatch(result.stdout, /Staging the application/);
    });
    
    test("packaging rejects publication arguments before staging", () => {
      const result = spawnSync(process.execPath, ["scripts/package.ts", "--publish", "always"], { encoding: "utf8", timeout: 10_000 });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Unknown option/);
      assert.doesNotMatch(result.stdout, /Staging the application/);
    });
  }
}

PackageCommandTests.register();
