/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test, type TestContext } from "node:test";

import type ProcessResult from "../processes/process-result.ts";
import ReleasePublish from "../release-publish.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import ReleaseFolderFixture from "./fixtures/release-folder.fixture.ts";
import ReleaseGitHubFixture from "./fixtures/release-github.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BrokenGitHubFixture extends ReleaseGitHubFixture {
  public override async captureAsync(): Promise<ProcessResult> {
    throw new RangeError("The fixture broke.");
  }
}

class ReleasePublishTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly USAGE: string = "Usage: RELEASE_REPOSITORY=<owner/name> RELEASE_VERSION=<N.N.N> RELEASE_REVISION=<commit> RELEASE_FOLDER=<folder> "
    + "RELEASE_RUN_URL=<url> npm run release:publish\n";

  public static register(): void {
    test("the release's files are checked and published to the requested repository with the notes", async t => {
      const [repository, release] = await ReleasePublishTests.createAsync(t);
      const github = new ReleaseGitHubFixture();
      const output = new TextOutputFixture();

      const exitCode = await new ReleasePublish(repository.directory, github, ReleasePublishTests.describe(release), output).runAsync([]);

      assert.equal(exitCode, 0, output.text);
      assert.ok(output.text.endsWith(`Published v0.0.7 from ${ReleasePublishTests.REVISION} with 22 files.\n`), output.text);
      assert.ok(github.fields.includes("body=Unsigned test release of Fixture Studio, published in noldova-com/teamrun; an installed Fixture Studio never updates from it.\n\n"
        + "Fixture Studio 0.0.7 for Windows, Linux and macOS, each on x64 and ARM64. Its packages are unsigned.\n\n"
        + "No target has passed its native acceptance yet, so every target was accepted by a CI run only.\n\n"
        + "Each target's package passed its install check on that target's own runner in the run that built it: https://github.com/noldova-com/teamrun/actions/runs/7"), github.fields.join("\n"));
      assert.deepEqual(github.releases.map(t => [t.tag, t.isDraft, t.assets.length]), [["v0.0.7", false, 22]]);
    });

    test("a relative, missing or #-marked folder, a run address that is missing or not https, files that differ from the release or a GitHub failure fails with the reason, and an unexpected error reaches the caller", async t => {
      const [repository, release] = await ReleasePublishTests.createAsync(t);
      const refusing = new ReleaseGitHubFixture();
      refusing.upload("Fixture Studio-windows-x64.exe", ["is refused"]);
      const cases = [
        [{ RELEASE_FOLDER: "out" }, new ReleaseGitHubFixture(), "RELEASE_FOLDER must be the absolute path of the folder that holds the release's files, not \"out\".\n"],
        [{ RELEASE_FOLDER: undefined }, new ReleaseGitHubFixture(), "RELEASE_FOLDER must be the absolute path of the folder that holds the release's files, not \"\".\n"],
        [{ RELEASE_FOLDER: release.locate("out#1") }, new ReleaseGitHubFixture(),
          `RELEASE_FOLDER must not contain #, which gh release upload reads as the start of a file's label: "${release.locate("out#1")}".\n`],
        [{ RELEASE_FOLDER: release.locate("missing") }, new ReleaseGitHubFixture(), `The release's folder ${release.locate("missing")} does not exist.\n`],
        [{ RELEASE_RUN_URL: undefined }, new ReleaseGitHubFixture(), "RELEASE_RUN_URL must be the https address of the run that built the release, not \"\".\n"],
        [{ RELEASE_RUN_URL: "http://github.com/runs/7" }, new ReleaseGitHubFixture(),
          "RELEASE_RUN_URL must be the https address of the run that built the release, not \"http://github.com/runs/7\".\n"],
        [{ RELEASE_VERSION: "0.0.8" }, new ReleaseGitHubFixture(), "latest-windows-x64.yml does not describe version 0.0.8 with Fixture Studio-windows-x64.exe as they are.\n"],
        [{}, refusing, `Creating the draft release v0.0.7 for ${ReleasePublishTests.REVISION}.\n"gh release upload v0.0.7 ${release.locate("Fixture Studio-windows-x64.exe")} `
          + `--repo ${ReleaseGitHubFixture.REPOSITORY}" failed with exit code 1: HTTP 422: Validation Failed (https://uploads.github.com/)\n`]
      ] as const;

      for (const [variables, github, reason] of cases) {
        const output = new TextOutputFixture();
        assert.equal(await new ReleasePublish(repository.directory, github, { ...ReleasePublishTests.describe(release), ...variables }, output).runAsync([]), 1, reason);
        assert.equal(output.text, reason);
      }
      await assert.rejects(new ReleasePublish(repository.directory, new BrokenGitHubFixture(), ReleasePublishTests.describe(release), new TextOutputFixture()).runAsync([]),
        new RangeError("The fixture broke."));
    });

    test("any argument is refused with the usage, also from the command line", async t => {
      const [repository] = await ReleasePublishTests.createAsync(t);
      const output = new TextOutputFixture();

      assert.equal(await new ReleasePublish(repository.directory, new ReleaseGitHubFixture(), {}, output).runAsync(["--dry-run"]), 2);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("release-publish.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(output.text, ReleasePublishTests.USAGE);
      assert.deepEqual([command.status, command.stdout], [2, ReleasePublishTests.USAGE]);
    });
  }

  private static describe(release: ReleaseFolderFixture): NodeJS.ProcessEnv {
    return {
      RELEASE_REPOSITORY: ReleaseGitHubFixture.REPOSITORY, RELEASE_VERSION: "0.0.7", RELEASE_REVISION: ReleasePublishTests.REVISION, RELEASE_FOLDER: release.folder,
      RELEASE_RUN_URL: "https://github.com/noldova-com/teamrun/actions/runs/7"
    };
  }

  private static async createAsync(t: TestContext): Promise<readonly [RepositoryFixture, ReleaseFolderFixture]> {
    const repository = await RepositoryFixture.createAsync();
    const release = await ReleaseFolderFixture.createAsync(String(ProductIdentityFixture.json["name"]), "0.0.7");
    t.after(() => Promise.all([repository.disposeAsync(), release.disposeAsync()]));
    await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest()) });
    return [repository, release];
  }
}

ReleasePublishTests.register();
