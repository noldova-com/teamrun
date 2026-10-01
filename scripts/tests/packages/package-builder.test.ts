/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import BuildLayout from "../../packages/build-layout.ts";
import PackageBuilder from "../../packages/package-builder.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import PackageException from "../../packages/package.exception.ts";
import RootManifest from "../../packages/root-manifest.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import PackageTreeFixture from "../fixtures/package-tree.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageBuilderTests {
  private static readonly ALPHA: PackageManifest = new PackageManifest("src/foundation/alpha", "@noldova/teamrun-foundation-alpha", []);
  private static readonly ROOT: RootManifest = new RootManifest("0.0.7", 3);

  public static register(): void {
    test("a package is compiled, stamped, packed and installed, and its tests compile against the installed package", async t => {
      const layout = new BuildLayout((await PackageBuilderTests.createAsync(t, true)).directory);
      const archive = layout.locateArchive(PackageBuilderTests.ALPHA, "0.0.7");
      const builder = PackageBuilderTests.createBuilder(layout, new NpmCommand(new ProcessRunner(), process.env));

      await builder.buildSourceAsync(PackageBuilderTests.ALPHA, [archive, path.join(layout.archivesFolder, "not-built-yet.tgz")]);
      await builder.compileTestsAsync(PackageBuilderTests.ALPHA);

      const installed = layout.locateInstalled(PackageBuilderTests.ALPHA);
      const manifest: unknown = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8"));
      assert.ok(typeof manifest === "object" && manifest !== null && "version" in manifest);
      assert.equal(manifest.version, "0.0.7");
      assert.equal(await readFile(path.join(installed, "LICENSE"), "utf8"), "Fixture license\n");
      assert.match(await readFile(path.join(installed, "api", "index.d.ts"), "utf8"), /^export declare class Resources/);
      assert.match(await readFile(path.join(installed, "resources.js"), "utf8"), /version = "0\.0\.7";\s+static protocol = "3";/);
      assert.ok(existsSync(archive));
      assert.ok(existsSync(path.join(layout.locateTestOutput(PackageBuilderTests.ALPHA), "api", "index.test.js")));
    });

    test("the installed package's source maps resolve to the package's real source files", async t => {
      const layout = new BuildLayout((await PackageBuilderTests.createAsync(t, true)).directory);
      const builder = PackageBuilderTests.createBuilder(layout, new NpmCommand(new ProcessRunner(), process.env));

      await builder.buildSourceAsync(PackageBuilderTests.ALPHA, [layout.locateArchive(PackageBuilderTests.ALPHA, "0.0.7")]);
      await builder.compileTestsAsync(PackageBuilderTests.ALPHA);

      const installed = layout.locateInstalled(PackageBuilderTests.ALPHA);
      const maps: readonly (readonly [string, string])[] = [
        [path.join(installed, "api", "index.js.map"), layout.locateSource(PackageBuilderTests.ALPHA, "src", "api", "index.ts")],
        [path.join(installed, "resources.js.map"), layout.locateSource(PackageBuilderTests.ALPHA, "src", "resources.ts")],
        [path.join(layout.locateTestOutput(PackageBuilderTests.ALPHA), "api", "index.test.js.map"), layout.locateSource(PackageBuilderTests.ALPHA, "tests", "api", "index.test.ts")]
      ];
      for (const [map, source] of maps) {
        const content: unknown = JSON.parse(await readFile(map, "utf8"));
        assert.ok(typeof content === "object" && content !== null && "sources" in content && Array.isArray(content.sources), map);
        assert.deepEqual(content.sources.map(t => path.resolve(path.dirname(map), String(t))), [source]);
      }
    });

    test("types installed for the Angular project under src are never included in a package's compilation", async t => {
      const repository = await PackageBuilderTests.createAsync(t, true);
      await repository.writeAsync({ "src/node_modules/@types/leak/index.d.ts": "declare const leaked: MissingType;\n" });
      const layout = new BuildLayout(repository.directory);

      await PackageBuilderTests.createBuilder(layout, new NpmCommand(new ProcessRunner(), process.env))
        .buildSourceAsync(PackageBuilderTests.ALPHA, [layout.locateArchive(PackageBuilderTests.ALPHA, "0.0.7")]);

      assert.ok(existsSync(path.join(layout.locateInstalled(PackageBuilderTests.ALPHA), "api", "index.js")));
    });

    test("a package without resources is installed without stamping them", async t => {
      const layout = new BuildLayout((await PackageBuilderTests.createAsync(t, false)).directory);

      await PackageBuilderTests.createBuilder(layout, new NpmCommand(new ProcessRunner(), process.env))
        .buildSourceAsync(PackageBuilderTests.ALPHA, [layout.locateArchive(PackageBuilderTests.ALPHA, "0.0.7")]);

      assert.ok(existsSync(path.join(layout.locateInstalled(PackageBuilderTests.ALPHA), "api", "index.js")));
      assert.equal(existsSync(path.join(layout.locateOutput(PackageBuilderTests.ALPHA), "resources.js")), false);
    });

    test("a package without its API declarations is refused before compiling", async t => {
      const layout = new BuildLayout((await PackageBuilderTests.createAsync(t, true)).directory);
      await rm(layout.locateSource(PackageBuilderTests.ALPHA, "src", "api", "index.d.ts"));

      await assert.rejects(
        PackageBuilderTests.createBuilder(layout, new NpmCommand(new ProcessRunner(), process.env)).buildSourceAsync(PackageBuilderTests.ALPHA, []),
        new PackageException("src/foundation/alpha has no src/api/index.d.ts."));
      assert.equal(existsSync(layout.locateOutput(PackageBuilderTests.ALPHA)), false);
    });

    test("compiler errors in a package or its tests fail with the compiler's output", async t => {
      const repository = await PackageBuilderTests.createAsync(t, true);
      await repository.writeAsync({
        "src/foundation/alpha/src/broken.ts": "export const value: number = \"text\";\n",
        "src/foundation/alpha/tests/broken.test.ts": "export const value: string = 1;\n"
      });
      const builder = PackageBuilderTests.createBuilder(new BuildLayout(repository.directory), new NpmCommand(new ProcessRunner(), process.env));

      await assert.rejects(builder.buildSourceAsync(PackageBuilderTests.ALPHA, []),
        t => t instanceof PackageException && /^Compiling src\/foundation\/alpha\/src failed with exit code \d+:\n.*broken\.ts.*TS2322/s.test(t.message));
      await assert.rejects(builder.compileTestsAsync(PackageBuilderTests.ALPHA),
        t => t instanceof PackageException && /^Compiling src\/foundation\/alpha\/tests failed with exit code \d+:\n.*broken\.test\.ts.*TS2322/s.test(t.message));
    });

    test("failed packing or installing fails the build with npm's output", async t => {
      const layout = new BuildLayout((await PackageBuilderTests.createAsync(t, true)).directory);
      const failedPack = new NpmCommand(new ProcessRunnerFixture([], [new ProcessResult(1, "", "pack error\n")]), { npm_execpath: "npm-cli.js" });
      const failedInstall = new NpmCommand(new ProcessRunnerFixture([], [new ProcessResult(0, "", ""), new ProcessResult(7, "out\n", "install error\n")]), { npm_execpath: "npm-cli.js" });

      await assert.rejects(PackageBuilderTests.createBuilder(layout, failedPack).buildSourceAsync(PackageBuilderTests.ALPHA, []),
        new PackageException("Packing @noldova/teamrun-foundation-alpha failed with exit code 1:\npack error"));
      await assert.rejects(PackageBuilderTests.createBuilder(layout, failedInstall).buildSourceAsync(PackageBuilderTests.ALPHA, []),
        new PackageException("Installing @noldova/teamrun-foundation-alpha failed with exit code 7:\nout\ninstall error"));
    });
  }

  private static async createAsync(t: TestContext, withResources: boolean): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await PackageTreeFixture.writeRootAsync(repository);
    await PackageTreeFixture.writePackageAsync(repository, "foundation-alpha", [], true, withResources);
    return repository;
  }

  private static createBuilder(layout: BuildLayout, npm: NpmCommand): PackageBuilder {
    return new PackageBuilder(layout, PackageBuilderTests.ROOT, new ProcessRunner(), npm);
  }
}

PackageBuilderTests.register();
