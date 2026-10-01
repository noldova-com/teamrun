/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ApiPackage from "../../api/api-package.ts";
import ApiException from "../../api/api.exception.ts";
import ApiPackageFixture from "../fixtures/api-package.fixture.ts";

class ApiPackageTests {
  public static register(): void {
    test("a manifest names the package, its id, its project, its API source and its installed declarations", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      const manifest = await fixture.writePackageAsync("json", {}, null);
      const found = await ApiPackage.readAsync(fixture.directory, manifest);

      assert.deepEqual([found.name, found.id], ["@noldova/teamrun-foundation-json", "teamrun-foundation-json"]);
      assert.equal(found.project, path.join(fixture.directory, "src/foundation/json/src/tsconfig.json"));
      assert.equal(found.implementation, path.join(fixture.directory, "src/foundation/json/src/api/index.ts"));
      assert.equal(found.declarations, path.join(fixture.directory, "node_modules/@noldova/teamrun-foundation-json/api/index.d.ts"));
    });

    test("a manifest without a scoped name and a types entry is refused", async t => {
      const fixture = await ApiPackageFixture.createAsync();
      t.after(() => fixture.disposeAsync());
      await mkdir(path.join(fixture.directory, "src"), { recursive: true });
      const manifests = ["null", "[]", "{ \"name\": \"json\", \"types\": \"api/index.d.ts\" }", "{ \"name\": \"@noldova/teamrun-json\" }", "{ \"name\": 3, \"types\": 3 }"];
      for (const [index, text] of manifests.entries()) {
        await writeFile(path.join(fixture.directory, "src", `${index}.json`), text);

        await assert.rejects(ApiPackage.readAsync(fixture.directory, `src/${index}.json`),
          new ApiException(`src/${index}.json needs a scoped "name" and a "types" entry.`));
      }
    });
  }
}

ApiPackageTests.register();
