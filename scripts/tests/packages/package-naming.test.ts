/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageNaming from "../../packages/package-naming.ts";
import PackageException from "../../packages/package.exception.ts";

class PackageNamingTests {
  public static register(): void {
    test("a package below src/ is named by its group's prefix and the rest of its path joined with hyphens", () => {
      assert.deepEqual(["src/foundation/core", "src/shell/desktop", "src/modules/notes/runtime", "src/foundation/a/b"].map(t => PackageNaming.nameSourcePackage(t)),
        ["@noldova/teamrun-foundation-core", "@noldova/teamrun-shell-desktop", "@noldova/teamrun-modules-notes-runtime", "@noldova/teamrun-foundation-a-b"]);
    });

    test("a package outside the groups' folders has no name", () => {
      assert.throws(() => PackageNaming.nameSourcePackage("src/shell-ui"),
        new PackageException("src/shell-ui is not inside src/foundation, src/shell, src/modules, the folders that hold packages."));
    });

    test("fixture packages and module packages are named from the same table", () => {
      assert.equal(PackageNaming.nameFixturePackage("clock/runtime"), "@noldova/teamrun-fixture-clock-runtime");
      assert.equal(PackageNaming.nameModulePackage("notes", "window", false), "@noldova/teamrun-modules-notes-window");
      assert.equal(PackageNaming.nameModulePackage("clock", "cli", true), "@noldova/teamrun-fixture-clock-cli");
      assert.equal(PackageNaming.locateModulePrefix("notes", false), "@noldova/teamrun-modules-notes-");
    });

    test("the repository's own packages are those of the table", () => {
      const names = ["@noldova/teamrun-foundation-core", "@noldova/teamrun-shell-cli", "@noldova/teamrun-modules-notes-cli", "@noldova/teamrun-fixture-clock-cli", "@noldova/scripts", "@angular/core"];

      assert.deepEqual(names.map(t => PackageNaming.isOwn(t)), [true, true, true, true, false, false]);
      assert.equal(PackageNaming.SCOPE, "@noldova/");
    });

    test("a file in a folder of foundation or the shell belongs to that folder's published package, and other files to none", () => {
      const files = ["src/foundation/core/src/index.ts", "src/shell/window/src/app/app.ts", "src/shell/desktop/tests/e2e/fixtures/modules/clock/runtime/package.json", "src/shell/README.md", "src/modules/notes/runtime/src/index.ts", "scripts/test.ts"];

      assert.deepEqual(files.map(t => PackageNaming.locatePublishedPackage(t)),
        [PackageNaming.nameSourcePackage("src/foundation/core"), PackageNaming.nameSourcePackage("src/shell/window"), PackageNaming.nameSourcePackage("src/shell/desktop"), null, null, null]);
    });
  }
}

PackageNamingTests.register();
