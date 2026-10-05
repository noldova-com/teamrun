/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { test, type TestContext } from "node:test";

import AngularProject from "../angular/angular-project.ts";
import GalleryFile from "../angular/gallery-file.ts";
import Package from "../package.ts";
import PackageStage from "../packaging/package-stage.ts";
import PackagingException from "../packaging/packaging.exception.ts";
import ProcessRunner from "../processes/process-runner.ts";
import NpmCommand from "../toolchain/npm-command.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class StageFixture extends PackageStage {
  private readonly failure: Error | null;

  public staged: number = 0;

  public constructor(root: string, failure: Error | null = null) {
    const runner = new ProcessRunner();
    const npm = new NpmCommand(runner, process.env);
    super(root, runner, npm, new GalleryFile(root), new AngularProject(root, runner, npm));

    this.failure = failure;
  }

  public override async stageAsync(output: Writable): Promise<void> {
    this.staged++;
    if (this.failure !== null)
      throw this.failure;
    output.write("Staged.\n");
  }
}

class BuilderFixture extends ProcessRunnerFixture {
  private readonly made: readonly string[];

  public constructor(made: readonly string[], exitCodes: readonly number[] = []) {
    super(exitCodes);

    this.made = made;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    const configuration = JSON.parse(await readFile(String(commandArguments.at(-1)), "utf8")) as { readonly directories: { readonly output: string } };
    await mkdir(configuration.directories.output, { recursive: true });
    for (const file of this.made)
      await writeFile(path.join(configuration.directories.output, file), "package\n");
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class PackageTests {
  private static readonly USAGE: string = "Usage: npm run package\n";
  private static readonly APP_IMAGE: string = "Fixture Studio-linux-x64.AppImage";

  public static register(): void {
    test("packaging stages the app, writes the configuration for the host and runs electron-builder with its own CommonJS tool cache and no signing identity", async t => {
      const repository = await PackageTests.createAsync(t);
      const stage = new StageFixture(repository.directory);
      const builder = new BuilderFixture([PackageTests.APP_IMAGE]);
      const output = new TextOutputFixture();
      const folder = path.join(repository.directory, "_build", "package", "out");
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, "TeamRun-linux-x64.AppImage"), "old\n");

      const exitCode = await new Package(repository.directory, "linux", "x64", stage, builder, { PATH: "fixture-path" }, output).runAsync([]);

      const file = path.join(repository.directory, "_build", "package", "electron-builder.json");
      assert.equal(exitCode, 0, output.text);
      assert.equal(stage.staged, 1);
      assert.deepEqual(builder.runs, [[process.execPath, repository.directory, path.join(repository.directory, "node_modules", "electron-builder", "cli.js"), "--publish", "never", "--config", file]]);
      assert.deepEqual(builder.environments, [{ PATH: "fixture-path", ELECTRON_BUILDER_CACHE: path.join(repository.directory, "_build", "package", "tool-cache"), CSC_IDENTITY_AUTO_DISCOVERY: "false" }]);
      const configuration = JSON.parse(await readFile(file, "utf8")) as Readonly<Record<string, unknown>>;
      assert.equal(configuration["appId"], "org.fixtureworks.studio");
      assert.equal(configuration["electronVersion"], "44.5.1");
      assert.equal(configuration["electronDist"], path.join(repository.directory, "_build", "package", "electron"));
      assert.equal(await readFile(path.join(repository.directory, "_build", "package", "electron", "electron"), "utf8"), "program\n");
      assert.deepEqual(configuration["directories"], { app: stage.folder, output: folder });
      assert.equal(await readFile(path.join(repository.directory, "_build", "package", "tool-cache", "package.json"), "utf8"), "{\"type\":\"commonjs\"}\n");
      assert.equal(existsSync(path.join(folder, "TeamRun-linux-x64.AppImage")), false);
      assert.equal(output.text, `Staged.\nPackages made:\n  ${path.join(folder, PackageTests.APP_IMAGE)}\n`);
    });

    test("a failed electron-builder run or one that leaves a package unmade fails packaging", async t => {
      const repository = await PackageTests.createAsync(t);
      const failed = new TextOutputFixture();
      const unmade = new TextOutputFixture();

      assert.equal(await new Package(repository.directory, "linux", "x64", new StageFixture(repository.directory), new BuilderFixture([], [3]), {}, failed).runAsync([]), 1);
      assert.equal(await new Package(repository.directory, "linux", "x64", new StageFixture(repository.directory), new BuilderFixture([]), {}, unmade).runAsync([]), 1);

      assert.equal(failed.text, "Staged.\nelectron-builder failed with exit code 3.\n");
      assert.equal(unmade.text, `Staged.\nelectron-builder finished without making ${path.join(repository.directory, "_build", "package", "out", PackageTests.APP_IMAGE)}.\n`);
    });

    test("a host without packages or a failed stage stops packaging before electron-builder runs", async t => {
      const repository = await PackageTests.createAsync(t);
      const builder = new BuilderFixture([PackageTests.APP_IMAGE]);
      const host = new TextOutputFixture();
      const staged = new TextOutputFixture();

      assert.equal(await new Package(repository.directory, "freebsd", "x64", new StageFixture(repository.directory), builder, {}, host).runAsync([]), 1);
      assert.equal(await new Package(repository.directory, "linux", "x64", new StageFixture(repository.directory, new PackagingException("The stage broke.")), builder, {}, staged).runAsync([]), 1);

      assert.equal(host.text, "Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64.\n");
      assert.equal(staged.text, "The stage broke.\n");
      assert.deepEqual(builder.runs, []);
    });

    test("an unexpected error reaches the caller", async t => {
      const repository = await PackageTests.createAsync(t);
      const stage = new StageFixture(repository.directory, new RangeError("The fixture broke."));

      await assert.rejects(() => new Package(repository.directory, "linux", "x64", stage, new BuilderFixture([]), {}, new TextOutputFixture()).runAsync([]), new RangeError("The fixture broke."));
    });

    test("any argument is refused with the usage, and the command exits with that result", async t => {
      const repository = await PackageTests.createAsync(t);
      const output = new TextOutputFixture();
      const stage = new StageFixture(repository.directory);

      const exitCode = await new Package(repository.directory, "linux", "x64", stage, new BuilderFixture([]), {}, output).runAsync(["--target", "linux"]);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("package.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(exitCode, 2);
      assert.equal(output.text, PackageTests.USAGE);
      assert.equal(stage.staged, 0);
      assert.equal(command.status, 2);
      assert.equal(command.stdout, PackageTests.USAGE);
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "package.json": JSON.stringify(ProductIdentityFixture.manifest()),
      "node_modules/electron/package.json": JSON.stringify({ name: "electron", version: "44.5.1" }),
      "node_modules/electron/dist/electron": "program\n"
    });
    return repository;
  }
}

PackageTests.register();
