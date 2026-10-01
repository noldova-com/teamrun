/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ApiProject from "../../api/api-project.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";

class ApiProjectTests {
  public static register(): void {
    test("a project lives in _build by purpose and package, and lists only the given files", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const project = new ApiProject(fixture.directory, "api-examples", "json");
      await project.writeAsync("base.json", fixture.directory, ["a.ts", "b.ts"]);

      assert.equal(project.folder, path.join(fixture.directory, "_build", "api-examples", "json"));
      assert.equal(project.file, path.join(project.folder, "tsconfig.json"));
      assert.deepEqual(JSON.parse(await readFile(project.file, "utf8")), {
        extends: "base.json",
        compilerOptions: { noEmit: true, rootDir: fixture.directory },
        files: ["a.ts", "b.ts"]
      });
    });
  }
}

ApiProjectTests.register();
