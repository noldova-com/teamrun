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

import BuildLayout from "../../packages/build-layout.ts";
import PackageManifest from "../../packages/package-manifest.ts";

class BuildLayoutTests {
  public static register(): void {
    test("build outputs live under _build by package id, and installed packages under node_modules by name", () => {
      const root = path.join("work", "teamrun");
      const layout = new BuildLayout(root);
      const manifest = new PackageManifest("src/modules/terminal/window", "@noldova/teamrun-modules-terminal-window", []);

      assert.equal(layout.root, root);
      assert.equal(layout.archivesFolder, path.join(root, "_build", "archives"));
      assert.equal(layout.locateSource(manifest), path.join(root, "src", "modules", "terminal", "window"));
      assert.equal(layout.locateSource(manifest, "src", "api", "index.d.ts"), path.join(root, "src", "modules", "terminal", "window", "src", "api", "index.d.ts"));
      assert.equal(layout.locateOutput(manifest), path.join(root, "_build", "packages", "modules-terminal-window"));
      assert.equal(layout.locateTestOutput(manifest), path.join(root, "_build", "tests", "modules-terminal-window"));
      assert.equal(layout.locateArchive(manifest, "0.0.2"), path.join(root, "_build", "archives", "noldova-teamrun-modules-terminal-window-0.0.2.tgz"));
      assert.equal(layout.locateRecord(manifest), path.join(root, "_build", "records", "modules-terminal-window.txt"));
      assert.equal(layout.locateInstalled(manifest), path.join(root, "node_modules", "@noldova", "teamrun-modules-terminal-window"));
    });
  }
}

BuildLayoutTests.register();
