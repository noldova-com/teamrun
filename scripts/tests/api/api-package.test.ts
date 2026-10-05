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

import ApiPackage from "../../api/api-package.ts";
import ApiVisibility from "../../api/api-visibility.ts";
import BuildLayout from "../../packages/build-layout.ts";
import PackageManifest from "../../packages/package-manifest.ts";

class ApiPackageTests {
  public static register(): void {
    test("a package's API is its directory, id, source project, API source, installed declarations read from the build, source declarations to report, and the repository root for its examples", () => {
      const root = path.resolve("repository");
      const found = ApiPackage.forPackage(new BuildLayout(root), new PackageManifest("src/foundation/json", "@noldova/teamrun-foundation-json", []));

      assert.deepEqual([found.directory, found.id], ["src/foundation/json", "foundation-json"]);
      assert.equal(found.project, path.join(root, "src/foundation/json/src/tsconfig.json"));
      assert.equal(found.implementation, path.join(root, "src/foundation/json/src/api/index.ts"));
      assert.equal(found.declarations, path.join(root, "node_modules/@noldova/teamrun-foundation-json/api/index.d.ts"));
      assert.equal(found.source, path.join(root, "src/foundation/json/src/api/index.d.ts"));
      assert.equal(found.missingDeclarationsMessage, `no installed declarations at ${found.declarations}; build the packages first`);
      assert.equal(found.visibility, ApiVisibility.PUBLIC_AND_PROTECTED);
      assert.equal(found.exampleRoot, root);
      assert.equal(found.paths, undefined);
    });

    test("an Angular part's API is its directory, an id from its path, the shared project, its API source and declarations in source, read and reported in place, and a root for its examples beside the project's dependencies", () => {
      const root = path.resolve("repository");
      const paths = { "@noldova/teamrun-shell-window": [path.join(root, "src/shell/window/src/api/index.d.ts")] };
      const found = ApiPackage.forPart(root, "src/shell/window", path.join(root, "src/tsconfig.json"), paths);

      assert.deepEqual([found.directory, found.id], ["src/shell/window", "shell-window"]);
      assert.equal(found.project, path.join(root, "src/tsconfig.json"));
      assert.equal(found.implementation, path.join(root, "src/shell/window/src/api/index.ts"));
      assert.equal(found.implementation, ApiPackage.locatePartImplementation(root, "src/shell/window"));
      assert.equal(found.declarations, path.join(root, "src/shell/window/src/api/index.d.ts"));
      assert.equal(found.declarations, ApiPackage.locatePartDeclarations(root, "src/shell/window"));
      assert.equal(found.source, found.declarations);
      assert.equal(found.missingDeclarationsMessage, `no declarations at ${found.declarations}`);
      assert.equal(found.visibility, ApiVisibility.PUBLIC);
      assert.equal(found.exampleRoot, path.join(root, "src/node_modules/.cache/teamrun"));
      assert.deepEqual(found.paths, paths);
    });

    test("an Angular part's examples compile beside the dependencies of the project it is given, wherever that project is", () => {
      const root = path.resolve("repository");
      const found = ApiPackage.forPart(root, "src/shell/window", path.join(root, "apps/web/tsconfig.json"), {});

      assert.equal(found.exampleRoot, path.join(root, "apps/web/node_modules/.cache/teamrun"));
    });
  }
}

ApiPackageTests.register();
