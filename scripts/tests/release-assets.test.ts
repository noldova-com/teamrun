/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ReleaseAssets from "../release-assets.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class ReleaseAssetsTests {
  private static readonly USAGE: string = "Usage: npm run release:assets\n";
  private static readonly OUT: string = "_build/package/out";

  public static register(): void {
    test("the host's packages get their checksums and update metadata, dated now and versioned from the manifest", async t => {
      const repository = await ReleaseAssetsTests.createAsync(t);
      await repository.writeAsync({ [`${ReleaseAssetsTests.OUT}/Fixture Studio-linux-arm64.AppImage`]: "package\n" });
      const output = new TextOutputFixture();
      t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-06T01:02:03.000Z") });

      const exitCode = await new ReleaseAssets(repository.directory, "linux", "arm64", output).runAsync([]);

      t.mock.timers.reset();
      const metadata = await readFile(path.join(repository.directory, ReleaseAssetsTests.OUT, "latest-linux-arm64.yml"), "utf8");
      assert.equal(exitCode, 0, output.text);
      assert.equal(output.text, "The release files of linux arm64 for 0.0.7:\nFixture Studio-linux-arm64.AppImage\nFixture Studio-linux-arm64.AppImage.sha256\nlatest-linux-arm64.yml\n");
      assert.ok(metadata.startsWith("version: 0.0.7\n") && metadata.endsWith("releaseDate: '2026-10-06T01:02:03.000Z'\n"), metadata);
    });

    test("a missing package, a host without packages or an unreadable manifest fails with the reason, and an unexpected error reaches the caller", async t => {
      const repository = await ReleaseAssetsTests.createAsync(t);
      const outputs = [new TextOutputFixture(), new TextOutputFixture(), new TextOutputFixture()] as const;
      const empty = await RepositoryFixture.createAsync();
      t.after(() => empty.disposeAsync());

      const exitCodes = [
        await new ReleaseAssets(repository.directory, "win32", "x64", outputs[0]).runAsync([]),
        await new ReleaseAssets(repository.directory, "freebsd", "x64", outputs[1]).runAsync([]),
        await new ReleaseAssets(empty.directory, "linux", "x64", outputs[2]).runAsync([])
      ];
      await mkdir(path.join(repository.directory, ReleaseAssetsTests.OUT, "Fixture Studio-linux-x64.AppImage"), { recursive: true });

      assert.deepEqual(exitCodes, [1, 1, 1]);
      assert.equal(outputs[0].text, `${path.join(repository.directory, ReleaseAssetsTests.OUT, "Fixture Studio-windows-x64.exe")} is missing; npm run package makes it.\n`);
      assert.equal(outputs[1].text, "Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64.\n");
      assert.match(outputs[2].text, /package\.json/u);
      await assert.rejects(new ReleaseAssets(repository.directory, "linux", "x64", new TextOutputFixture()).runAsync([]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EISDIR");
    });

    test("any argument is refused with the usage, also from the command line", async t => {
      const repository = await ReleaseAssetsTests.createAsync(t);
      const output = new TextOutputFixture();

      assert.equal(await new ReleaseAssets(repository.directory, "linux", "x64", output).runAsync(["--target", "linux"]), 2);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("release-assets.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(output.text, ReleaseAssetsTests.USAGE);
      assert.deepEqual([command.status, command.stdout], [2, ReleaseAssetsTests.USAGE]);
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest()) });
    return repository;
  }
}

ReleaseAssetsTests.register();
