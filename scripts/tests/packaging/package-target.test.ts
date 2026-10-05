/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageTarget from "../../packaging/package-target.ts";
import PackagingException from "../../packaging/packaging.exception.ts";

class PackageTargetTests {
  public static register(): void {
    test("each platform and processor names its packages without a version", () => {
      const names = [["win32", "x64"], ["win32", "arm64"], ["darwin", "x64"], ["darwin", "arm64"], ["linux", "x64"], ["linux", "arm64"]]
        .map(([platform, architecture]) => PackageTarget.fromProcess(String(platform), String(architecture)))
        .map(t => t.extensions.map(extension => t.formatFileName("TeamRun", extension)));

      assert.deepEqual(names, [
        ["TeamRun-windows-x64.exe"],
        ["TeamRun-windows-arm64.exe"],
        ["TeamRun-macos-x64.dmg", "TeamRun-macos-x64.zip"],
        ["TeamRun-macos-arm64.dmg", "TeamRun-macos-arm64.zip"],
        ["TeamRun-linux-x64.AppImage"],
        ["TeamRun-linux-arm64.AppImage"]
      ]);
    });

    test("each platform names the formats it is packaged in", () => {
      assert.deepEqual(
        ["windows", "macos", "linux"].map(t => new PackageTarget(t, "x64").formats),
        [["nsis"], ["dmg", "zip"], ["AppImage"]]);
    });

    test("a platform or processor without packages is refused, naming it", () => {
      assert.throws(() => PackageTarget.fromProcess("freebsd", "x64"), new PackagingException("Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64."));
      assert.throws(() => PackageTarget.fromProcess("win32", "ia32"), new PackagingException("Packages are made for windows, macos and linux on x64 and arm64, not for windows on ia32."));
    });
  }
}

PackageTargetTests.register();
