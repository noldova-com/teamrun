/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import InstalledPackage from "../../packaging/installed-package.ts";

class InstalledPackageTests {
  public static register(): void {
    test("an installed package keeps the program that starts the desktop, the program that runs the command line, its resources and the command it puts on the PATH", () => {
      const installed = new InstalledPackage("desktop", "program", "resources", "command");

      assert.deepEqual([installed.desktop, installed.program, installed.resources, installed.command], ["desktop", "program", "resources", "command"]);
    });
  }
}

InstalledPackageTests.register();
