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
import { after, before, test, type TestContext } from "node:test";

import AngularProject from "../angular/angular-project.ts";
import GalleryFile from "../angular/gallery-file.ts";
import Package from "../package.ts";
import PackageStage from "../packaging/package-stage.ts";
import PackagedBuild from "../packaging/packaged-build.ts";
import ProcessRunner from "../processes/process-runner.ts";
import NpmCommand from "../toolchain/npm-command.ts";
import PackageArchivesFixture from "./fixtures/package-archives.fixture.ts";
import PackagedBuildFixture from "./fixtures/packaged-build.fixture.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BuilderFixture extends ProcessRunnerFixture {
  private readonly made: readonly string[];
  private readonly failure: Error | null;

  public constructor(made: readonly string[], exitCodes: readonly number[] = [], failure: Error | null = null) {
    super(exitCodes);

    this.made = made;
    this.failure = failure;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    if (this.failure !== null)
      throw this.failure;
    const configuration = JSON.parse(await readFile(String(commandArguments.at(-1)), "utf8")) as { readonly directories: { readonly output: string } };
    await mkdir(configuration.directories.output, { recursive: true });
    for (const file of this.made)
      await writeFile(path.join(configuration.directories.output, file), "package\n");
    return super.runAsync(command, commandArguments, directory, environment);
  }
}

class PackageTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly USAGE: string = "Usage: npm run package\n";
  private static readonly APP_IMAGE: string = "Fixture Studio-linux-x64.AppImage";
  private static readonly STAGED: string = "The packaged window holds no Gallery.\nPackages in the stage: @noldova/teamrun-foundation-beta, "
    + "@noldova/teamrun-foundation-alpha, @noldova/teamrun-shell-cli, @noldova/teamrun-shell-desktop.\n";

  private static archives: PackageArchivesFixture | null = null;

  public static register(): void {
    before(async () => {
      PackageTests.archives = await PackageArchivesFixture.createAsync();
    });
    after(() => PackageTests.archives?.disposeAsync());

    test("packaging stages the app, writes the configuration for the host and runs electron-builder with its own CommonJS tool cache, no signing identity and only the variables it needs",
      { timeout: PackageTests.TIMEOUT }, async t => {
        const repository = await PackageTests.createAsync(t);
        const builder = new BuilderFixture([PackageTests.APP_IMAGE]);
        const output = new TextOutputFixture();
        const folder = path.join(repository.directory, "_build", "package", "out");
        await mkdir(folder, { recursive: true });
        await writeFile(path.join(folder, "TeamRun-linux-x64.AppImage"), "old\n");
        const environment = {
          Path: "fixture-path",
          HOME: "fixture-home",
          GH_TOKEN: "fixture-token",
          CSC_LINK: "fixture-certificate",
          WIN_CSC_LINK: "fixture-certificate",
          CSC_NAME: "Fixture Identity",
          APPIMAGE_TOOLS_PATH: "fixture-tools",
          ELECTRON_BUILDER_NSIS_DIR: "fixture-tools",
          ELECTRON_BUILDER_RCEDIT_PATH: "fixture-tools",
          ELECTRON_BUILDER_ICONS_TOOLSET_DIR: "fixture-tools",
          ELECTRON_BUILDER_CACHE: "fixture-cache",
          CSC_IDENTITY_AUTO_DISCOVERY: "true"
        };

        const exitCode = await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, environment, output).runAsync([]);

        const file = path.join(repository.directory, "_build", "package", "electron-builder.json");
        assert.equal(exitCode, 0, output.text);
        assert.deepEqual(builder.runs, [[process.execPath, repository.directory, path.join(repository.directory, "node_modules", "electron-builder", "cli.js"), "--publish", "never", "--config", file]]);
        assert.deepEqual(builder.environments, [{
          Path: "fixture-path",
          HOME: "fixture-home",
          ELECTRON_BUILDER_CACHE: path.join(repository.directory, "_build", "package", "tool-cache"),
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
        }]);
        const configuration = JSON.parse(await readFile(file, "utf8")) as Readonly<Record<string, unknown>>;
        assert.equal(configuration["appId"], "org.fixtureworks.studio");
        assert.equal(configuration["electronVersion"], "44.5.1");
        assert.equal(configuration["electronDist"], path.join(repository.directory, "_build", "package", "electron"));
        assert.equal(await readFile(path.join(repository.directory, "_build", "package", "electron", "electron"), "utf8"), "program\n");
        assert.deepEqual(configuration["directories"], { app: path.join(repository.directory, "_build", "package", "app"), output: folder });
        assert.equal(existsSync(path.join(repository.directory, "_build", "package", "app", "node_modules", "@noldova", "teamrun-shell-desktop", "package.json")), true);
        assert.equal(await readFile(path.join(repository.directory, "_build", "package", "tool-cache", "package.json"), "utf8"), "{\"type\":\"commonjs\"}\n");
        assert.equal(existsSync(path.join(folder, "TeamRun-linux-x64.AppImage")), false);
        assert.equal(output.text, `${PackageTests.STAGED}Packages made:\n  ${path.join(folder, PackageTests.APP_IMAGE)}\n`);
      });

    test("a failed electron-builder run or one that leaves a package unmade fails packaging", { timeout: PackageTests.TIMEOUT }, async t => {
      const repository = await PackageTests.createAsync(t);
      const failed = new TextOutputFixture();
      const unmade = new TextOutputFixture();

      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), new BuilderFixture([], [3]), {}, failed).runAsync([]), 1);
      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), new BuilderFixture([]), {}, unmade).runAsync([]), 1);

      assert.equal(failed.text, `${PackageTests.STAGED}electron-builder failed with exit code 3.\n`);
      assert.equal(unmade.text, `${PackageTests.STAGED}electron-builder finished without making ${path.join(repository.directory, "_build", "package", "out", PackageTests.APP_IMAGE)}.\n`);
    });

    test("a host without packages or a failed packaged build stops packaging before electron-builder runs", async t => {
      const repository = await PackageTests.createAsync(t);
      const builder = new BuilderFixture([PackageTests.APP_IMAGE]);
      const host = new TextOutputFixture();
      const staged = new TextOutputFixture();

      assert.equal(await new Package(repository.directory, "freebsd", "x64", PackageTests.createStage(repository), builder, {}, host).runAsync([]), 1);
      assert.equal(await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository, [2]), builder, {}, staged).runAsync([]), 1);

      assert.equal(host.text, "Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64.\n");
      assert.equal(staged.text, "The packaged build failed with exit code 2.\n");
      assert.deepEqual(builder.runs, []);
    });

    test("an unexpected error reaches the caller", { timeout: PackageTests.TIMEOUT }, async t => {
      const repository = await PackageTests.createAsync(t);
      const builder = new BuilderFixture([], [], new RangeError("The fixture broke."));

      await assert.rejects(() => new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, {}, new TextOutputFixture()).runAsync([]),
        new RangeError("The fixture broke."));
    });

    test("any argument is refused with the usage, and the command exits with that result", async t => {
      const repository = await PackageTests.createAsync(t);
      const output = new TextOutputFixture();
      const builder = new BuilderFixture([]);

      const exitCode = await new Package(repository.directory, "linux", "x64", PackageTests.createStage(repository), builder, {}, output).runAsync(["--target", "linux"]);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("package.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(exitCode, 2);
      assert.equal(output.text, PackageTests.USAGE);
      assert.equal(existsSync(path.join(repository.directory, "_build", "package")), false);
      assert.deepEqual(builder.runs, []);
      assert.equal(command.status, 2);
      assert.equal(command.stdout, PackageTests.USAGE);
    });
  }

  private static createStage(repository: RepositoryFixture, exitCodes: readonly number[] = []): PackageStage {
    const gallery = new GalleryFile(repository.directory);
    const npm = new NpmCommand(new ProcessRunner(), process.env);
    const angular = new AngularProject(repository.directory, new ProcessRunner(), npm);
    return new PackageStage(repository.directory, npm, new PackagedBuild(repository.directory, new PackagedBuildFixture(gallery, exitCodes), gallery, angular));
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    assert.ok(PackageTests.archives !== null);
    await PackageTests.archives.writeSourcesAsync(repository, []);
    await repository.writeAsync({
      "node_modules/electron/package.json": JSON.stringify({ name: "electron", version: "44.5.1" }),
      "node_modules/electron/dist/electron": "program\n"
    });
    return repository;
  }
}

PackageTests.register();
