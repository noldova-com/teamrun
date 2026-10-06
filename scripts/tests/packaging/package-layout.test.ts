/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import PackageLayout from "../../packaging/package-layout.ts";

class PackageLayoutTests {
  public static register(): void {
    test("packaging keeps its stage, caches, Electron copy, configuration, packages, smoke evidence and generated command under _build/package", () => {
      const root = path.join("fixture", "root");
      const folder = path.join(root, "_build", "package");
      const layout = new PackageLayout(root);

      assert.deepEqual([layout.stage, layout.npmCache, layout.electron, layout.toolCache, layout.output, layout.smoke, layout.command, layout.configuration], [
        path.join(folder, "app"),
        path.join(folder, "npm-cache"),
        path.join(folder, "electron"),
        path.join(folder, "tool-cache"),
        path.join(folder, "out"),
        path.join(folder, "smoke"),
        path.join(folder, "command"),
        path.join(folder, "electron-builder.json")
      ]);
    });
  }
}

PackageLayoutTests.register();
