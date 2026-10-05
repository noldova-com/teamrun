/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageDigest from "../../release/package-digest.ts";
import ReleaseFile from "../../release/release-file.ts";

class ReleaseFileTests {
  public static register(): void {
    test("a release file keeps its name and digest", () => {
      const digest = new PackageDigest("ab", "cd", 3);
      const file = new ReleaseFile("TeamRun-windows-x64.exe", digest);

      assert.deepEqual([file.name, file.digest], ["TeamRun-windows-x64.exe", digest]);
    });
  }
}

ReleaseFileTests.register();
