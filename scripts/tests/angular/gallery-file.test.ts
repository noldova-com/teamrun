/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import GalleryFile from "../../angular/gallery-file.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

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
    test("a development build's gallery file brings the kit's Gallery into the window through its development entry", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const file = new GalleryFile(repository.directory);

      await file.writeAsync(false);

      assert.equal(file.file, path.join(repository.directory, "src", "generated", "gallery.ts"));
      assert.equal(await readFile(file.file, "utf8"), [
        GalleryFileTests.LICENSE,
        "import { GalleryComponent } from \"@noldova/teamrun-shell-ui/gallery\";",
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
      assert.deepEqual(GalleryFile.MARKERS, ["tr-gallery-scope-frame", "tr-gallery-forms", "Plate, center chosen", "\"data-tr-state\""]);
    });

    test("every marker the packaged check looks for occurs in the Gallery's own source, so renaming it cannot make the check pass on nothing", async () => {
      const folder = path.join(SourceTreeFixture.root, "src", "shell", "ui", "src", "app", "components", "gallery");
      const source = (await Promise.all((await readdir(folder)).map(t => readFile(path.join(folder, t), "utf8")))).join("\n");

      assert.deepEqual(GalleryFile.MARKERS.filter(t => !source.includes(t)), []);
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
