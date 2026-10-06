/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import BuildLayout from "../../packages/build-layout.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import PackageException from "../../packages/package.exception.ts";
import WindowsAddonBuilder from "../../packages/windows-addon-builder.ts";
import ProcessResult from "../../processes/process-result.ts";
import NodeGypFixture from "../fixtures/node-gyp.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class WindowsAddonBuilderTests {
  private static readonly RUNTIME: PackageManifest = new PackageManifest("src/shell/runtime", "@noldova/teamrun-shell-runtime", [], "[]", ["windows-process", "job"]);

  public static register(): void {
    test("on Windows each listed addon is built by node-gyp in its own folder and lands in the package's native folder", async t => {
      const layout = await WindowsAddonBuilderTests.createLayoutAsync(t);
      const output = path.join(layout.root, "_build", "packages", "shell-runtime");
      const stale = path.join(layout.locateAddonWork(WindowsAddonBuilderTests.RUNTIME, "job"), "stale.txt");
      await mkdir(path.dirname(stale), { recursive: true });
      await writeFile(stale, "stale\n");
      const nodeGyp = new NodeGypFixture();

      await new WindowsAddonBuilder(layout, nodeGyp, "win32", "x64").buildAsync(WindowsAddonBuilderTests.RUNTIME, output);

      assert.equal(await readFile(path.join(output, "native", "windows-process.node"), "utf8"), "built windows-process source\n");
      assert.equal(await readFile(path.join(output, "native", "job.node"), "utf8"), "built job source\n");
      assert.equal(existsSync(stale), false);
      assert.deepEqual(nodeGyp.runs, ["windows-process", "job"].map(t => [layout.locateAddonWork(WindowsAddonBuilderTests.RUNTIME, t), "rebuild", "--loglevel=error", "--enable-lto=false", "--enable-thin-lto=false", "--devdir", layout.nodeGypFolder]));
      assert.deepEqual(nodeGyp.projects, [
        JSON.stringify({ targets: [{ target_name: "windows_process", sources: ["windows-process.c"], defines: ["NAPI_VERSION=8"] }] }),
        JSON.stringify({ targets: [{ target_name: "job", sources: ["job.c"], defines: ["NAPI_VERSION=8"] }] })
      ]);
    });

    test("elsewhere no addon is built", async t => {
      const layout = await WindowsAddonBuilderTests.createLayoutAsync(t);
      const output = path.join(layout.root, "_build", "packages", "shell-runtime");
      const nodeGyp = new NodeGypFixture();

      for (const platform of ["linux", "darwin"])
        await new WindowsAddonBuilder(layout, nodeGyp, platform, "x64").buildAsync(WindowsAddonBuilderTests.RUNTIME, output);

      assert.deepEqual(nodeGyp.runs, []);
      assert.equal(existsSync(path.join(output, "native")), false);
    });

    test("without Visual Studio's C++ workload the build names what to install for its processor, and any other failure gives node-gyp's output", async t => {
      const layout = await WindowsAddonBuilderTests.createLayoutAsync(t);
      const output = path.join(layout.root, "_build", "packages", "shell-runtime");
      const missing = new ProcessResult(1, "", "gyp ERR! stack Error: Could not find any Visual Studio installation to use\n");
      const failed = new ProcessResult(1, "", "windows-process.c(12): error C2065\n");

      await assert.rejects(
        new WindowsAddonBuilder(layout, new NodeGypFixture(missing), "win32", "x64").buildAsync(WindowsAddonBuilderTests.RUNTIME, output),
        new PackageException("Building @noldova/teamrun-shell-runtime's Windows addon windows-process needs the \"Desktop development with C++\" workload of Visual Studio or the Visual Studio Build Tools, 2022 or later, and node-gyp found no Visual Studio with it. Install it and run npm run build again."));
      await assert.rejects(
        new WindowsAddonBuilder(layout, new NodeGypFixture(missing), "win32", "arm64").buildAsync(WindowsAddonBuilderTests.RUNTIME, output),
        new PackageException("Building @noldova/teamrun-shell-runtime's Windows addon windows-process needs the \"Desktop development with C++\" workload of Visual Studio or the Visual Studio Build Tools, 2022 or later, with its C++ ARM64 build tools component, and node-gyp found no Visual Studio with it. Install it and run npm run build again."));
      await assert.rejects(
        new WindowsAddonBuilder(layout, new NodeGypFixture(failed), "win32", "x64").buildAsync(WindowsAddonBuilderTests.RUNTIME, output),
        new PackageException("Building @noldova/teamrun-shell-runtime's Windows addon windows-process failed with exit code 1:\nwindows-process.c(12): error C2065"));
      assert.equal(existsSync(path.join(output, "native")), false);
    });
  }

  private static async createLayoutAsync(t: TestContext): Promise<BuildLayout> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "src/shell/runtime/src/native/windows-process.c": "windows-process source\n",
      "src/shell/runtime/src/native/job.c": "job source\n"
    });
    return new BuildLayout(repository.directory);
  }
}

WindowsAddonBuilderTests.register();
