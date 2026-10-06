/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test, type TestContext } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import GalleryFile from "../../angular/gallery-file.ts";
import PackagedBuildCheck from "../../checks/packaged-build-check.ts";
import PackagedBuild from "../../packaging/packaged-build.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import PackagedBuildFixture from "../fixtures/packaged-build.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class BrokenBuildFixture extends PackagedBuild {
  public override async buildAsync(): Promise<void> {
    throw new Error("broken");
  }
}

class PackagedBuildCheckTests {
  public static register(): void {
    test("the check makes the packaged build in its variant folder and passes when the build leaves out the Gallery", async t => {
      const repository = await PackagedBuildCheckTests.createAsync(t, true);
      const gallery = new GalleryFile(repository.directory);
      const runner = new PackagedBuildFixture(gallery);
      const angular = PackagedBuildCheckTests.createAngular(repository);
      const output = new TextOutputFixture();
      const check = new PackagedBuildCheck(repository.directory, new PackagedBuild(repository.directory, runner, gallery, angular), angular);

      assert.equal(check.title, "Packaged build leaves out the Gallery");
      assert.equal(await check.runAsync(output), true);

      const folder = path.join(repository.directory, "_build", "variants", "packaged");
      assert.deepEqual(runner.runs, [[process.execPath, repository.directory, path.join(repository.directory, "scripts", "build.ts"), "--packaged", "--output", folder]]);
      assert.equal(output.text, "");
    });

    test("the check fails with the packaged build's reason, and lets an unexpected failure through", async t => {
      const repository = await PackagedBuildCheckTests.createAsync(t, true);
      const gallery = new GalleryFile(repository.directory);
      const angular = PackagedBuildCheckTests.createAngular(repository);
      const output = new TextOutputFixture();
      const broken = new BrokenBuildFixture(repository.directory, new PackagedBuildFixture(gallery), gallery, angular);

      assert.equal(await new PackagedBuildCheck(repository.directory, new PackagedBuild(repository.directory, new PackagedBuildFixture(gallery, [1]), gallery, angular), angular).runAsync(output), false);
      await assert.rejects(new PackagedBuildCheck(repository.directory, broken, angular).runAsync(new TextOutputFixture()), new Error("broken"));

      assert.equal(output.text, "The packaged build failed with exit code 1.\n");
    });

    test("the check fails and names the file when the built window still holds the Gallery", async t => {
      const repository = await PackagedBuildCheckTests.createAsync(t, true);
      const gallery = new GalleryFile(repository.directory);
      const angular = PackagedBuildCheckTests.createAngular(repository);
      const output = new TextOutputFixture();
      const runner = new PackagedBuildFixture(gallery, [], `<p>${GalleryFile.MARKERS[0]}</p>\n`);

      assert.equal(await new PackagedBuildCheck(repository.directory, new PackagedBuild(repository.directory, runner, gallery, angular), angular).runAsync(output), false);

      assert.equal(output.text, `The window built in _build/variants/packaged/window contains ${JSON.stringify(GalleryFile.MARKERS[0])} in ${path.join("browser", "index.html")}.\n`);
    });

    test("a tree without the Angular project has no window to check", async t => {
      const repository = await PackagedBuildCheckTests.createAsync(t, false);
      const gallery = new GalleryFile(repository.directory);
      const runner = new PackagedBuildFixture(gallery);
      const angular = PackagedBuildCheckTests.createAngular(repository);
      const output = new TextOutputFixture();

      const isPassing = await new PackagedBuildCheck(repository.directory, new PackagedBuild(repository.directory, runner, gallery, angular), angular).runAsync(output);

      assert.deepEqual([isPassing, runner.runs, output.text], [true, [], ""]);
    });
  }

  private static createAngular(repository: RepositoryFixture): AngularProject {
    return new AngularProject(repository.directory, new ProcessRunner(), new NpmCommand(new ProcessRunner(), process.env));
  }

  private static async createAsync(t: TestContext, hasProject: boolean): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    if (hasProject)
      await repository.writeAsync({ "src/angular.json": "{}\n" });
    return repository;
  }
}

PackagedBuildCheckTests.register();
