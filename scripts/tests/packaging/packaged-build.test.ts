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
import { test, type TestContext } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import GalleryFile from "../../angular/gallery-file.ts";
import PackagedBuild from "../../packaging/packaged-build.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import PackagedBuildFixture from "../fixtures/packaged-build.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackagedBuildTests {
  public static register(): void {
    test("the packaged build runs the build with --packaged into the folder, and with the local update feed it is given, checks its window for the Gallery and leaves the Gallery file as development had it", async t => {
      const repository = await PackagedBuildTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const runner = new PackagedBuildFixture(gallery);
      const folder = path.join(repository.directory, "out");

      await PackagedBuildTests.create(repository, runner, gallery).buildAsync(folder, null);
      await PackagedBuildTests.create(repository, runner, gallery).buildAsync(folder, "http://127.0.0.1:8080/");

      const script = path.join(repository.directory, "scripts", "build.ts");
      assert.deepEqual(runner.runs, [
        [process.execPath, repository.directory, script, "--packaged", "--output", folder],
        [process.execPath, repository.directory, script, "--packaged", "--output", folder, "--update-feed", "http://127.0.0.1:8080/"]
      ]);
      assert.match(await readFile(gallery.file, "utf8"), /GalleryComponent;\n$/);
    });

    test("a failed build or one whose Gallery file still brings in the Gallery is refused, and the Gallery file is restored", async t => {
      const repository = await PackagedBuildTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const folder = path.join(repository.directory, "out");

      await assert.rejects(PackagedBuildTests.create(repository, new PackagedBuildFixture(gallery, [1]), gallery).buildAsync(folder, null),
        new PackagingException("The packaged build failed with exit code 1."));
      assert.equal(await gallery.isPackagedAsync(), false);
      await assert.rejects(PackagedBuildTests.create(repository, new PackagedBuildFixture(gallery, [], PackagedBuildFixture.WINDOW, false), gallery).buildAsync(folder, null),
        new PackagingException("The packaged build's Gallery file still brings in the Gallery."));
      assert.equal(await gallery.isPackagedAsync(), false);
    });

    test("a window that holds the Gallery is refused with the file that holds it", async t => {
      const repository = await PackagedBuildTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const runner = new PackagedBuildFixture(gallery, [], `<p>${GalleryFile.MARKERS[1]}</p>\n`);

      await assert.rejects(PackagedBuildTests.create(repository, runner, gallery).buildAsync(path.join(repository.directory, "out"), null),
        new ProcessException(`The window built in out/window contains ${JSON.stringify(GalleryFile.MARKERS[1])} in ${path.join("browser", "index.html")}.`));
      assert.equal(await gallery.isPackagedAsync(), false);
    });
  }

  private static create(repository: RepositoryFixture, runner: PackagedBuildFixture, gallery: GalleryFile): PackagedBuild {
    return new PackagedBuild(repository.directory, runner, gallery, new AngularProject(repository.directory, new ProcessRunner(), new NpmCommand(new ProcessRunner(), process.env)));
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "src/angular.json": "{}\n" });
    return repository;
  }
}

PackagedBuildTests.register();
