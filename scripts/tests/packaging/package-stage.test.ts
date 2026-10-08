/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import GalleryFile from "../../angular/gallery-file.ts";
import PackageStage from "../../packaging/package-stage.ts";
import PackageTarget from "../../packaging/package-target.ts";
import PackagedBuild from "../../packaging/packaged-build.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import PackageArchivesFixture from "../fixtures/package-archives.fixture.ts";
import PackagedBuildFixture from "../fixtures/packaged-build.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TarballServerFixture from "../fixtures/tarball-server.fixture.ts";
import TarballFixture from "../fixtures/tarball.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class PackageStageTests {
  private static readonly TIMEOUT: number = 120_000;
  private static readonly TARGET: PackageTarget = PackageTarget.fromProcess(process.platform, process.arch);

  private static archives: Promise<PackageArchivesFixture> | null = null;

  public static register(): void {
    before(() => PackageStageTests.archives = PackageArchivesFixture.createAsync());
    after(() => PackageStageTests.archives?.then(t => t.disposeAsync()));

    test("the stage is built with --packaged, holds the shipped packages, the modules' runtime and CLI parts among them, from the build's archives without the Electron the desktop runs in, and the identity's files, and leaves the Gallery file as development had it", { timeout: PackageStageTests.TIMEOUT }, async t => {
      const repository = await PackageStageTests.createAsync(t, ["tasks", "notes"]);
      await repository.writeAsync({
        "src/modules/notes/module.json": JSON.stringify({ id: "notes", version: "0.2.0", displayName: "Notes", description: "Used by the tests.", parts: [], dependencies: [], contributes: {} })
      });
      const gallery = new GalleryFile(repository.directory);
      const build = new PackagedBuildFixture(gallery);
      const stage = PackageStageTests.createStage(repository, build, gallery);
      const output = new TextOutputFixture();

      await stage.stageAsync(PackageStageTests.TARGET, output, "http://127.0.0.1:8080/");

      const folder = path.join(repository.directory, "_build", "package", "app");
      assert.equal(stage.folder, folder);
      assert.deepEqual(build.runs, [[process.execPath, repository.directory, path.join(repository.directory, "scripts", "build.ts"), "--packaged", "--output", path.join(folder, "_build"), "--update-feed", "http://127.0.0.1:8080/"]]);
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
          "@noldova/teamrun-modules-tasks-cli": "0.3.0",
          "@noldova/teamrun-modules-tasks-runtime": "0.3.0",
          "@noldova/teamrun-shell-cli": "0.0.7",
          "@noldova/teamrun-shell-desktop": "0.0.7"
        }
      });
      assert.deepEqual((await readdir(path.join(folder, "node_modules", "@noldova"))).sort(), [
        "teamrun-foundation-alpha", "teamrun-foundation-beta", "teamrun-modules-tasks-cli", "teamrun-modules-tasks-runtime", "teamrun-shell-cli", "teamrun-shell-desktop"
      ].sort());
      assert.equal(JSON.parse(await readFile(path.join(folder, "node_modules", "@noldova", "teamrun-modules-tasks-runtime", "package.json"), "utf8")).version, "0.3.0");
      assert.equal(existsSync(path.join(folder, "node_modules", "electron")), false);
      assert.equal(await readFile(path.join(folder, "_build", "window", "browser", "index.html"), "utf8"), PackagedBuildFixture.WINDOW);
      assert.equal(await readFile(path.join(folder, "assets", "fixture-icons", "icon-dark.ico"), "utf8"), "ico\n");
      assert.equal(await readFile(path.join(folder, "assets", "dictionaries", "dictionaries.json"), "utf8"), "{\"dictionaries\":[]}\n");
      assert.equal(await readFile(path.join(folder, "LICENSE"), "utf8"), "Fixture license\n");
      assert.equal(output.text, "The packaged window holds no Gallery.\nPackages in the stage: @noldova/teamrun-foundation-beta, @noldova/teamrun-foundation-alpha, "
        + "@noldova/teamrun-modules-tasks-runtime, @noldova/teamrun-modules-tasks-cli, @noldova/teamrun-shell-cli, @noldova/teamrun-shell-desktop.\n"
        + "Third-party packages in the stage: none.\n");
      assert.equal(await readFile(path.join(repository.directory, "_build", "package", "runtime-third-party.txt"), "utf8"), "");
    });

    test("staging again starts from an empty stage, and a module the build does not list is not shipped", { timeout: PackageStageTests.TIMEOUT }, async t => {
      const repository = await PackageStageTests.createAsync(t, []);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery), gallery);
      await mkdir(path.join(stage.folder, "left-over"), { recursive: true });

      await stage.stageAsync(PackageStageTests.TARGET, new TextOutputFixture(), null);

      assert.equal(existsSync(path.join(stage.folder, "left-over")), false);
      assert.equal(existsSync(path.join(stage.folder, "node_modules", "@noldova", "teamrun-modules-tasks-runtime")), false);
      assert.equal(existsSync(path.join(stage.folder, "node_modules", "@noldova", "teamrun-modules-tasks-cli")), false);
    });

    test("a packaged window that still holds the Gallery stops the stage before anything is installed", async t => {
      const repository = await PackageStageTests.createAsync(t, []);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery, [], `<p>${GalleryFile.MARKERS[2]}</p>\n`), gallery);

      await assert.rejects(() => stage.stageAsync(PackageStageTests.TARGET, new TextOutputFixture(), null),
        new ProcessException(`The window built in _build/package/app/_build/window contains ${JSON.stringify(GalleryFile.MARKERS[2])} in ${path.join("browser", "index.html")}.`));
      assert.equal(existsSync(path.join(stage.folder, "node_modules")), false);
      assert.equal(await gallery.isPackagedAsync(), false);
    });

    test("a failed packaged build stops the stage and still leaves the Gallery file as development had it", async t => {
      const repository = await PackageStageTests.createAsync(t, []);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery, [2]), gallery);

      await assert.rejects(() => stage.stageAsync(PackageStageTests.TARGET, new TextOutputFixture(), null), new PackagingException("The packaged build failed with exit code 2."));
      assert.equal(await gallery.isPackagedAsync(), false);
    });

    test("a module whose runtime package is not under src/ is refused", async t => {
      const repository = await PackageStageTests.createAsync(t, ["tasks", "gone"]);
      await repository.writeAsync({
        "src/modules/gone/module.json": JSON.stringify({ id: "gone", version: "0.1.0", displayName: "Gone", description: "Used by the tests.", parts: ["runtime"], dependencies: [], contributes: {} }),
        "src/modules/gone/runtime/README.md": "No package.\n"
      });
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery), gallery);

      await assert.rejects(() => stage.stageAsync(PackageStageTests.TARGET, new TextOutputFixture(), null),
        new PackagingException("The stage needs @noldova/teamrun-modules-gone-runtime, which is not a package under src/."));
    });

    test("third-party packages are installed offline from their locked, verified tarballs, nested copies among them, and their licenses are written for the package", { timeout: PackageStageTests.TIMEOUT }, async t => {
      const repository = await PackageStageTests.createAsync(t, [], PackageArchivesFixture.THIRD_PARTY);
      const server = await TarballServerFixture.startAsync();
      t.after(() => server.disposeAsync());
      const left = TarballFixture.packFiles({
        "package.json": JSON.stringify({ name: "fixture-left", version: "1.0.0", license: "MIT", main: "index.js", dependencies: { "fixture-right": "2.0.0" } }),
        "index.js": "module.exports = 'left';\n",
        "LICENSE": "Left license\n"
      });
      const right = TarballFixture.packFiles({
        "package.json": JSON.stringify({ name: "fixture-right", version: "2.0.0", license: "ISC OR GPL-2.0-only", main: "index.js" }),
        "index.js": "module.exports = 'right';\n",
        "LICENCE.md": "Right licence\n"
      });
      await repository.writeAsync({
        "package-lock.json": JSON.stringify({
          name: "fixture", lockfileVersion: 3, requires: true, packages: {
            "": { name: "fixture", dependencies: PackageArchivesFixture.THIRD_PARTY_DEPENDENCIES },
            "node_modules/fixture-left": server.lock("left.tgz", left, { version: "1.0.0", license: "MIT", dependencies: { "fixture-right": "2.0.0" } }),
            "node_modules/fixture-left/node_modules/fixture-right": server.lock("right.tgz", right, { version: "2.0.0", license: "ISC OR GPL-2.0-only" }),
            "node_modules/fixture-right": server.lock("old-right.tgz", Buffer.from("never shipped"), { version: "1.0.0", dev: true })
          }
        })
      });
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery), gallery);
      const output = new TextOutputFixture();

      await stage.stageAsync(PackageStageTests.TARGET, output, null);

      const modules = path.join(stage.folder, "node_modules");
      assert.equal(await readFile(path.join(modules, "fixture-left", "index.js"), "utf8"), "module.exports = 'left';\n");
      assert.equal(await readFile(path.join(modules, "fixture-right", "index.js"), "utf8"), "module.exports = 'right';\n");
      assert.equal(JSON.parse(await readFile(path.join(modules, "@noldova", "teamrun-shell-desktop", "package.json"), "utf8")).dependencies["fixture-left"], "1.0.0");
      assert.deepEqual(server.requests.sort(), ["/left.tgz", "/right.tgz"]);
      assert.deepEqual((await readdir(path.join(repository.directory, "_build", "package", "third-party"))).sort(), ["fixture-left-1.0.0.tgz", "fixture-right-2.0.0.tgz"]);
      assert.equal(await readFile(path.join(repository.directory, "_build", "package", "runtime-third-party.txt"), "utf8"),
        `fixture-left@1.0.0\nLicense: MIT\n\nLeft license\n\n${"-".repeat(80)}\n\nfixture-right@2.0.0\nLicense: ISC, chosen from "ISC OR GPL-2.0-only"\n\nRight licence\n`);
      assert.match(output.text, /\nThird-party packages in the stage: fixture-left@1\.0\.0 \(MIT\), fixture-right@2\.0\.0 \(ISC\)\.\n$/);
    });

    test("installing never reaches the registry: a dependency missing from the build's archives fails the stage", { timeout: PackageStageTests.TIMEOUT }, async t => {
      const repository = await PackageStageTests.createAsync(t, [], PackageArchivesFixture.OUTSIDE);
      const gallery = new GalleryFile(repository.directory);
      const stage = PackageStageTests.createStage(repository, new PackagedBuildFixture(gallery), gallery);

      const error = await stage.stageAsync(PackageStageTests.TARGET, new TextOutputFixture(), null).then(() => null, (failure: unknown) => failure);

      assert.ok(error instanceof PackagingException, String(error));
      assert.match(error.message, /^Installing the packages into the stage failed with exit code \d+; it uses only the build's archives and never the registry:\n/);
      assert.match(error.message, /left-pad/);
      assert.match(error.message, /ENOTCACHED|cache mode is 'only-if-cached'/);
    });
  }

  private static createStage(repository: RepositoryFixture, build: PackagedBuildFixture, gallery: GalleryFile): PackageStage {
    const npm = new NpmCommand(new ProcessRunner(), process.env);
    return new PackageStage(repository.directory, npm, new PackagedBuild(repository.directory, build, gallery, new AngularProject(repository.directory, new ProcessRunner(), npm)));
  }

  private static async createAsync(t: TestContext, modules: readonly string[], variant: string = PackageArchivesFixture.SHIPPED): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    assert.ok(PackageStageTests.archives !== null);
    await (await PackageStageTests.archives).writeSourcesAsync(repository, modules, variant);
    return repository;
  }
}

PackageStageTests.register();
