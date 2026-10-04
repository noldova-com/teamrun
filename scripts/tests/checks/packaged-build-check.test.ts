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
import PackagedBuildCheck from "../../checks/packaged-build-check.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class BuildRunnerFixture extends ProcessRunnerFixture {
  private readonly gallery: GalleryFile;
  private readonly isPackaged: boolean;

  public constructor(gallery: GalleryFile, exitCodes: readonly number[], isPackaged: boolean) {
    super(exitCodes);

    this.gallery = gallery;
    this.isPackaged = isPackaged;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string): Promise<number | null> {
    await this.gallery.writeAsync(this.isPackaged);
    return super.runAsync(command, commandArguments, directory);
  }
}

class AngularProjectFixture extends AngularProject {
  private readonly isPresent: boolean;
  private readonly failure: Error | null;

  public readonly verified: (string | readonly string[] | null)[][] = [];

  public constructor(isPresent: boolean, failure: Error | null = null) {
    const runner = new ProcessRunnerFixture();
    super("root", runner, new NpmCommand(runner, {}));

    this.isPresent = isPresent;
    this.failure = failure;
  }

  public override hasProject(): boolean {
    return this.isPresent;
  }

  public override async verifyWithoutAsync(outputPath: string | null, texts: readonly string[]): Promise<void> {
    this.verified.push([outputPath, texts]);
    if (this.failure !== null)
      throw this.failure;
  }
}

class PackagedBuildCheckTests {
  public static register(): void {
    test("the check builds the packaged window and passes when its Gallery file is the empty stub and the bundle holds no Gallery", async t => {
      const repository = await PackagedBuildCheckTests.createRepositoryAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const runner = new BuildRunnerFixture(gallery, [], true);
      const angular = new AngularProjectFixture(true);
      const output = new TextOutputFixture();
      const check = new PackagedBuildCheck(repository.directory, runner, gallery, angular);

      assert.equal(check.title, "Packaged build leaves out the Gallery");
      assert.equal(await check.runAsync(output), true);

      const folder = path.join(repository.directory, "_build", "variants", "packaged");
      assert.deepEqual(runner.runs, [[process.execPath, repository.directory, path.join(repository.directory, "scripts", "build.ts"), "--packaged", "--output", folder]]);
      assert.deepEqual(angular.verified, [[path.join(folder, "window"), GalleryFile.MARKERS]]);
      assert.equal(output.text, "");
      assert.match(await readFile(gallery.file, "utf8"), /GalleryComponent;\n$/);
    });

    test("the check fails when the packaged build fails, and leaves the development Gallery file in place", async t => {
      const repository = await PackagedBuildCheckTests.createRepositoryAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const angular = new AngularProjectFixture(true);
      const output = new TextOutputFixture();

      assert.equal(await new PackagedBuildCheck(repository.directory, new BuildRunnerFixture(gallery, [1], true), gallery, angular).runAsync(output), false);

      assert.equal(output.text, "The packaged build failed.\n");
      assert.deepEqual(angular.verified, []);
      assert.match(await readFile(gallery.file, "utf8"), /GalleryComponent;\n$/);
    });

    test("the check fails when the packaged build's Gallery file still brings in the Gallery", async t => {
      const repository = await PackagedBuildCheckTests.createRepositoryAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const angular = new AngularProjectFixture(true);
      const output = new TextOutputFixture();

      assert.equal(await new PackagedBuildCheck(repository.directory, new BuildRunnerFixture(gallery, [], false), gallery, angular).runAsync(output), false);

      assert.equal(output.text, "The packaged build's Gallery file still brings in the Gallery.\n");
      assert.deepEqual(angular.verified, []);
    });

    test("the check fails and names the file when the built window holds the Gallery, and lets an unexpected failure through", async t => {
      const repository = await PackagedBuildCheckTests.createRepositoryAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const output = new TextOutputFixture();
      const found = new AngularProjectFixture(true, new ProcessException("The window built in _build/variants/packaged/window contains \"tr-gallery-forms\" in main.js."));

      assert.equal(await new PackagedBuildCheck(repository.directory, new BuildRunnerFixture(gallery, [], true), gallery, found).runAsync(output), false);
      await assert.rejects(
        new PackagedBuildCheck(repository.directory, new BuildRunnerFixture(gallery, [], true), gallery, new AngularProjectFixture(true, new Error("broken"))).runAsync(new TextOutputFixture()),
        new Error("broken"));

      assert.equal(output.text, "The window built in _build/variants/packaged/window contains \"tr-gallery-forms\" in main.js.\n");
    });

    test("a tree without the Angular project has no window to check", async t => {
      const repository = await PackagedBuildCheckTests.createRepositoryAsync(t);
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      const isPassing = await new PackagedBuildCheck(repository.directory, runner, new GalleryFile(repository.directory), new AngularProjectFixture(false)).runAsync(output);

      assert.deepEqual([isPassing, runner.runs, output.text], [true, [], ""]);
    });
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository;
  }
}

PackagedBuildCheckTests.register();
