/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import GalleryFile from "../../angular/gallery-file.ts";
import PackageStage from "../../packaging/package-stage.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

interface IFixturePackage {
  readonly directory: string;
  readonly name: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  readonly peers: Readonly<Record<string, string>>;
}

class PackagedBuildFixture extends ProcessRunnerFixture {
  private readonly gallery: GalleryFile;
  private readonly window: string;
  private readonly runtimePackages: readonly (string | null)[];

  public constructor(gallery: GalleryFile, window: string, runtimePackages: readonly (string | null)[], exitCodes: readonly number[] = []) {
    super(exitCodes);

    this.gallery = gallery;
    this.window = window;
    this.runtimePackages = runtimePackages;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string): Promise<number | null> {
    const output = String(commandArguments.at(-1));
    await this.gallery.writeAsync(true);
    await mkdir(path.join(output, "window", "browser"), { recursive: true });
    await writeFile(path.join(output, "window", "browser", "index.html"), this.window);
    await writeFile(path.join(output, "window", "3rdpartylicenses.txt"), "Third-party licenses\n");
    await mkdir(path.join(output, "modules"), { recursive: true });
    const modules = this.runtimePackages.map((t, index) => ({ id: `module${index}`, runtimePackage: t }));
    await writeFile(path.join(output, "modules", "declarations.json"), JSON.stringify({ formatVersion: 1, modules }));
    await writeFile(path.join(output, "product.json"), "{}\n");
    return super.runAsync(command, commandArguments, directory);
  }
}

class PackageStageTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly WINDOW: string = "<!doctype html><title>Fixture Studio</title>\n";
  private static readonly TASKS_RUNTIME: string = "@noldova/teamrun-modules-tasks-runtime";
  private static readonly BETA: IFixturePackage = { directory: "src/foundation/beta", name: "@noldova/teamrun-foundation-beta", version: "0.0.7", dependencies: [], peers: {} };
  private static readonly PACKAGES: readonly IFixturePackage[] = [
    PackageStageTests.BETA,
    { directory: "src/foundation/alpha", name: "@noldova/teamrun-foundation-alpha", version: "0.0.7", dependencies: ["@noldova/teamrun-foundation-beta"], peers: {} },
    { directory: "src/foundation/testing", name: "@noldova/teamrun-foundation-testing", version: "0.0.7", dependencies: [], peers: {} },
    { directory: "src/shell/cli", name: "@noldova/teamrun-shell-cli", version: "0.0.7", dependencies: ["@noldova/teamrun-foundation-alpha"], peers: {} },
    { directory: "src/shell/desktop", name: "@noldova/teamrun-shell-desktop", version: "0.0.7", dependencies: ["@noldova/teamrun-foundation-alpha"], peers: { electron: "44.5.1" } },
    { directory: "src/modules/tasks/runtime", name: PackageStageTests.TASKS_RUNTIME, version: "0.3.0", dependencies: ["@noldova/teamrun-foundation-beta"], peers: {} }
  ];
  private static readonly SHIPPED: string = "shipped";
  private static readonly OUTSIDE: string = "outside";

  private static archives: string = "";

  public static register(): void {
    before(async () => {
      PackageStageTests.archives = await mkdtemp(path.join(tmpdir(), "teamrun-package-stage-"));
      await Promise.all([
        ...PackageStageTests.PACKAGES.map(t => PackageStageTests.packAsync(t, PackageStageTests.SHIPPED, {})),
        PackageStageTests.packAsync(PackageStageTests.BETA, PackageStageTests.OUTSIDE, { "left-pad": "1.3.0" })
      ]);
    });
    after(() => rm(PackageStageTests.archives, { recursive: true, force: true }));

    test("the stage is built with --packaged, holds the shipped packages from the build's archives without the Electron the desktop runs in, and the identity's files, and leaves the Gallery file as development had it", { timeout: PackageStageTests.TIMEOUT }, async t => {
      const repository = await PackageStageTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const build = new PackagedBuildFixture(gallery, PackageStageTests.WINDOW, [PackageStageTests.TASKS_RUNTIME, null]);
      const stage = PackageStageTests.createStage(repository, build, gallery);
      const output = new TextOutputFixture();

      await stage.stageAsync(output);

      const folder = path.join(repository.directory, "_build", "package", "app");
      assert.equal(stage.folder, folder);
      assert.deepEqual(build.runs, [[process.execPath, repository.directory, path.join(repository.directory, "scripts", "build.ts"), "--packaged", "--output", path.join(folder, "_build")]]);
      assert.equal(await gallery.isPackagedAsync(), false);
      assert.deepEqual(JSON.parse(await readFile(path.join(folder, "package.json"), "utf8")), {
        name: "fixture-studio",
        productName: "Fixture Studio",
        version: "0.0.7",
        author: "Fixture Works",
        desktopName: "org.fixtureworks.studio.desktop",
        private: true,
        main: "node_modules/@noldova/teamrun-shell-desktop/main.js",
        dependencies: {
          "@noldova/teamrun-foundation-alpha": "0.0.7",
          "@noldova/teamrun-foundation-beta": "0.0.7",
          "@noldova/teamrun-modules-tasks-runtime": "0.3.0",
          "@noldova/teamrun-shell-cli": "0.0.7",
          "@noldova/teamrun-shell-desktop": "0.0.7"
        }
      });
      assert.deepEqual((await readdir(path.join(folder, "node_modules", "@noldova"))).sort(), [
        "teamrun-foundation-alpha", "teamrun-foundation-beta", "teamrun-modules-tasks-runtime", "teamrun-shell-cli", "teamrun-shell-desktop"
      ]);
      assert.equal(JSON.parse(await readFile(path.join(folder, "node_modules", "@noldova", "teamrun-modules-tasks-runtime", "package.json"), "utf8")).version, "0.3.0");
      assert.equal(existsSync(path.join(folder, "node_modules", "electron")), false);
      assert.equal(await readFile(path.join(folder, "_build", "window", "browser", "index.html"), "utf8"), PackageStageTests.WINDOW);
      assert.equal(await readFile(path.join(folder, "assets", "fixture-icons", "icon-dark.ico"), "utf8"), "ico\n");
      assert.equal(await readFile(path.join(folder, "LICENSE"), "utf8"), "Fixture license\n");
      assert.equal(output.text, "The packaged window holds no Gallery.\nPackages in the stage: @noldova/teamrun-foundation-beta, @noldova/teamrun-foundation-alpha, "
        + "@noldova/teamrun-modules-tasks-runtime, @noldova/teamrun-shell-cli, @noldova/teamrun-shell-desktop.\n");
    });

    test("staging again starts from an empty stage", { timeout: PackageStageTests.TIMEOUT }, async t => {
      const repository = await PackageStageTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery, PackageStageTests.WINDOW, []), gallery);
      await mkdir(path.join(stage.folder, "left-over"), { recursive: true });

      await stage.stageAsync(new TextOutputFixture());

      assert.equal(existsSync(path.join(stage.folder, "left-over")), false);
      assert.equal(existsSync(path.join(stage.folder, "node_modules", "@noldova", "teamrun-modules-tasks-runtime")), false);
    });

    test("a packaged window that still holds the Gallery stops the stage before anything is installed", async t => {
      const repository = await PackageStageTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery, `<p>${GalleryFile.MARKERS[2]}</p>\n`, []), gallery);

      await assert.rejects(() => stage.stageAsync(new TextOutputFixture()),
        new ProcessException(`The window built in _build/package/app/_build/window contains ${JSON.stringify(GalleryFile.MARKERS[2])} in ${path.join("browser", "index.html")}.`));
      assert.equal(existsSync(path.join(stage.folder, "node_modules")), false);
      assert.equal(await gallery.isPackagedAsync(), false);
    });

    test("a failed packaged build stops the stage and still leaves the Gallery file as development had it", async t => {
      const repository = await PackageStageTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery, PackageStageTests.WINDOW, [], [2]), gallery);

      await assert.rejects(() => stage.stageAsync(new TextOutputFixture()), new PackagingException("The packaged build failed with exit code 2."));
      assert.equal(await gallery.isPackagedAsync(), false);
    });

    test("a module whose runtime package is not under src/ is refused", async t => {
      const repository = await PackageStageTests.createAsync(t);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery, PackageStageTests.WINDOW, ["@noldova/teamrun-modules-gone-runtime"]), gallery);

      await assert.rejects(() => stage.stageAsync(new TextOutputFixture()),
        new PackagingException("The stage needs @noldova/teamrun-modules-gone-runtime, which is not a package under src/."));
    });

    test("installing never reaches the registry: a dependency missing from the build's archives fails the stage", { timeout: PackageStageTests.TIMEOUT }, async t => {
      const repository = await PackageStageTests.createAsync(t, true);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery, PackageStageTests.WINDOW, []), gallery);

      const error = await stage.stageAsync(new TextOutputFixture()).then(() => null, (failure: unknown) => failure);

      assert.ok(error instanceof PackagingException, String(error));
      assert.match(error.message, /^Installing the packages into the stage failed with exit code \d+; it uses only the build's archives and never the registry:\n/);
      assert.match(error.message, /left-pad/);
      assert.match(error.message, /ENOTCACHED|cache mode is 'only-if-cached'/);
    });
  }

  private static createStage(repository: RepositoryFixture, build: ProcessRunnerFixture, gallery: GalleryFile): PackageStage {
    const npm = new NpmCommand(new ProcessRunner(), process.env);
    return new PackageStage(repository.directory, build, npm, gallery, new AngularProject(repository.directory, new ProcessRunner(), npm));
  }

  private static async createAsync(t: TestContext, hasOutsideDependency: boolean = false): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "package.json": JSON.stringify(ProductIdentityFixture.manifest()),
      "LICENSE": "Fixture license\n",
      "assets/fixture-icons/icon-dark.ico": "ico\n",
      "src/angular.json": "{}\n",
      "src/modules/tasks/module.json": JSON.stringify({ id: "tasks", version: "0.3.0", displayName: "Tasks", description: "Used by the tests.", parts: ["runtime"], dependencies: [], contributes: {} }),
      ...Object.fromEntries(PackageStageTests.PACKAGES.map(t => [`${t.directory}/package.json`, JSON.stringify({
        name: t.name,
        version: "__VERSION__",
        dependencies: Object.fromEntries(t.dependencies.map(u => [u, "__VERSION__"]))
      })]))
    });
    const target = path.join(repository.directory, "_build", "archives");
    await cp(path.join(PackageStageTests.archives, PackageStageTests.SHIPPED), target, { recursive: true });
    if (hasOutsideDependency)
      await cp(path.join(PackageStageTests.archives, PackageStageTests.OUTSIDE), target, { recursive: true });
    return repository;
  }

  private static async packAsync(fixture: IFixturePackage, variant: string, outside: Readonly<Record<string, string>>): Promise<void> {
    const archives = path.join(PackageStageTests.archives, variant);
    const packed = path.join(PackageStageTests.archives, "packed", variant, fixture.name.split("/").join("-"));
    await mkdir(packed, { recursive: true });
    await mkdir(archives, { recursive: true });
    const dependencies = { ...Object.fromEntries(fixture.dependencies.map(t => [t, PackageStageTests.versionOf(t)])), ...outside };
    await writeFile(path.join(packed, "package.json"), JSON.stringify({ name: fixture.name, version: fixture.version, main: "index.js", dependencies, peerDependencies: fixture.peers }));
    await writeFile(path.join(packed, "index.js"), "export {};\n");
    const result = await new NpmCommand(new ProcessRunner(), process.env).runAsync(["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", archives], packed);
    assert.ok(result.isSuccessful, result.errorOutput);
  }

  private static versionOf(name: string): string {
    return String(new Map(PackageStageTests.PACKAGES.map(t => [t.name, t.version])).get(name));
  }
}

PackageStageTests.register();
