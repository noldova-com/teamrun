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
import BuildLayout from "../../packages/build-layout.ts";
import PackageManifest from "../../packages/package-manifest.ts";

class ApiPackageTests {
  public static register(): void {
    test("a package's API is its directory, id, source project, API source and installed declarations", () => {
      const root = path.resolve("repository");
      const found = new ApiPackage(new BuildLayout(root), new PackageManifest("src/foundation/json", "@noldova/teamrun-foundation-json", []));

      assert.deepEqual([found.directory, found.id], ["src/foundation/json", "foundation-json"]);
      assert.equal(found.project, path.join(root, "src/foundation/json/src/tsconfig.json"));
      assert.equal(found.implementation, path.join(root, "src/foundation/json/src/api/index.ts"));
      assert.equal(found.declarations, path.join(root, "node_modules/@noldova/teamrun-foundation-json/api/index.d.ts"));
    });
  }
}

ApiPackageTests.register();
