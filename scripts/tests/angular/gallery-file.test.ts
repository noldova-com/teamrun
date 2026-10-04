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

import GalleryFile from "../../angular/gallery-file.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class GalleryFileTests {
  private static readonly LICENSE: string = [
    "/**",
    " * @license",
    " * Copyright (c) Noldova.",
    " *",
    " * This source code is licensed under the license found in the",
    " * LICENSE file in the root directory of this source tree.",
    " */",
    ""
  ].join("\n");

  public static register(): void {
    test("a development build's gallery file brings the kit's Gallery into the window", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const file = new GalleryFile(repository.directory);

      await file.writeAsync(false);

      assert.equal(file.file, path.join(repository.directory, "src", "generated", "gallery.ts"));
      assert.equal(await readFile(file.file, "utf8"), [
        GalleryFileTests.LICENSE,
        "import { GalleryComponent } from \"@noldova/teamrun-shell-ui\";",
        "import type { Type } from \"@angular/core\";",
        "",
        "export const gallery: Type<unknown> | null = GalleryComponent;",
        ""
      ].join("\n"));
    });

    test("the gallery file tells whether it is the packaged build's, and the markers name what the bundle must not hold", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const file = new GalleryFile(repository.directory);

      await file.writeAsync(true);
      const packaged = await file.isPackagedAsync();
      await file.writeAsync(false);

      assert.deepEqual([packaged, await file.isPackagedAsync()], [true, false]);
      assert.deepEqual(GalleryFile.MARKERS, ["tr-gallery-scope-frame", "tr-gallery-forms", "Show the keyboard focus on the first control"]);
    });

    test("a packaged build's gallery file names no Gallery, and a later development build brings it back", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const file = new GalleryFile(repository.directory);

      await file.writeAsync(true);
      const packaged = await readFile(file.file, "utf8");
      await file.writeAsync(false);

      assert.equal(packaged, [
        GalleryFileTests.LICENSE,
        "import type { Type } from \"@angular/core\";",
        "",
        "export const gallery: Type<unknown> | null = null;",
        ""
      ].join("\n"));
      assert.match(await readFile(file.file, "utf8"), /GalleryComponent;\n$/);
    });
  }
}

GalleryFileTests.register();
