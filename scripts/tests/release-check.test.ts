/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ReleaseCheck from "../release-check.ts";
import GitHubApiFixture from "./fixtures/github-api.fixture.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class ReleaseCheckTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly COMPARE: string = `/compare/${ReleaseCheckTests.REVISION}...main`;
  private static readonly TAG: string = "/git/matching-refs/tags/v0.0.7";
  private static readonly RELEASES: string = "/releases";
  private static readonly RUNS: string = `/actions/workflows/build-and-test.yml/runs?event=push&branch=main&per_page=1&head_sha=${ReleaseCheckTests.REVISION}`;
  private static readonly PASSED: Readonly<Record<string, unknown>> = { workflow_runs: [{ status: "completed", conclusion: "success" }] };
  private static readonly NOT_FOUND: string = "gh: Not Found (HTTP 404)";
  private static readonly USAGE: string = "Usage: RELEASE_REPOSITORY=<owner/name> RELEASE_VERSION=<N.N.N> RELEASE_REVISION=<commit> npm run release:check\n";

  public static register(): void {
    test("a version that matches the manifest and is newer than every published release, whatever order they were made in, on a revision main contains, passes, "
      + "also with no release or only drafts", async t => {
      const repository = await ReleaseCheckTests.createAsync(t);
      const github = new GitHubApiFixture();
      const first = new GitHubApiFixture();
      const drafted = new GitHubApiFixture();
      const output = new TextOutputFixture();
      github.answer(ReleaseCheckTests.RELEASES, [ReleaseCheckTests.release(4, "v0.0.5"), ReleaseCheckTests.release(3, "v0.0.9", true), ReleaseCheckTests.release(2, "v0.0.6"),
        ReleaseCheckTests.release(1, "v0.0.4")]);
      github.answer(ReleaseCheckTests.TAG, [{ ref: "refs/tags/v0.0.70", object: { sha: ReleaseCheckTests.REVISION, type: "commit" } }]);
      first.answer(ReleaseCheckTests.RELEASES, []);
      drafted.answer(ReleaseCheckTests.RELEASES, [ReleaseCheckTests.release(1, "v0.0.7", true)]);
      for (const fixture of [github, first, drafted]) {
        fixture.answer(ReleaseCheckTests.COMPARE, { status: fixture === github ? "ahead" : "identical" });
        fixture.answer(ReleaseCheckTests.RUNS, ReleaseCheckTests.PASSED);
      }
      first.answer(ReleaseCheckTests.TAG, []);
      drafted.answer(ReleaseCheckTests.TAG, []);

      const outputs = path.join(repository.directory, "outputs");

      const exitCodes = [await ReleaseCheckTests.checkAsync(repository, github, output, "0.0.7", { GITHUB_OUTPUT: outputs }),
        await ReleaseCheckTests.checkAsync(repository, first, new TextOutputFixture()), await ReleaseCheckTests.checkAsync(repository, drafted, new TextOutputFixture())];

      assert.deepEqual(exitCodes, [0, 0, 0]);
      assert.equal(output.text, `v0.0.7 of noldova-com/teamrun from ${ReleaseCheckTests.REVISION}: the version is new, the revision is on main and its Build and test run there passed. `
        + "Signed platforms: none.\n");
      assert.equal(await readFile(outputs, "utf8"), "signed=\n");
      assert.deepEqual(github.requests, [`GET ${ReleaseCheckTests.RELEASES}`, `GET ${ReleaseCheckTests.TAG}`, `GET ${ReleaseCheckTests.COMPARE}`, `GET ${ReleaseCheckTests.RUNS}`]);
    });

    test("another version than the manifest's, one that is not newer or already tagged, a revision off main or unknown, or a malformed request fails with the reason", async t => {
      const repository = await ReleaseCheckTests.createAsync(t);
      const tag = [{ ref: "refs/tags/v0.0.7", object: { sha: ReleaseCheckTests.REVISION, type: "commit" } }];
      const older = [ReleaseCheckTests.release(2, "v0.0.6")];
      const cases: readonly (readonly [string, readonly unknown[], unknown, unknown, string])[] = [
        ["0.0.8", [], [], null, "The root manifest's version is 0.0.7, not 0.0.8; raise it on main first.\n"],
        ["0.0.7", [ReleaseCheckTests.release(2, "v0.0.7")], [], null, "0.0.7 is not newer than the highest release, 0.0.7.\n"],
        ["0.0.7", [ReleaseCheckTests.release(2, "v0.0.6"), ReleaseCheckTests.release(1, "v0.0.8")], [], null, "0.0.7 is not newer than the highest release, 0.0.8.\n"],
        ["0.0.7", [ReleaseCheckTests.release(2, "release-7")], [], null, "The tag of release 2 must be a tag such as v0.0.2, not \"release-7\".\n"],
        ["0.0.7", older, tag, null, "The tag v0.0.7 already exists; a published tag is never moved.\n"],
        ["0.0.7", older, [], { status: "diverged" }, `${ReleaseCheckTests.REVISION} is not on main; main is diverged compared with it.\n`],
        ["0.0.7", older, [], { status: "behind" }, `${ReleaseCheckTests.REVISION} is not on main; main is behind compared with it.\n`],
        ["0.0.7", older, [], null, `${ReleaseCheckTests.REVISION} is not a commit of noldova-com/teamrun.\n`],
        ["0.0.7-rc", [], [], null, "RELEASE_VERSION must be a plain version such as 0.0.2, not \"0.0.7-rc\".\n"]
      ];

      for (const [version, releases, reference, comparison, reason] of cases) {
        const github = new GitHubApiFixture();
        const output = new TextOutputFixture();
        github.answer(ReleaseCheckTests.RELEASES, releases);
        github.answer(ReleaseCheckTests.TAG, reference);
        if (comparison === null)
          github.fail(ReleaseCheckTests.COMPARE, ReleaseCheckTests.NOT_FOUND);
        else
          github.answer(ReleaseCheckTests.COMPARE, comparison);

        assert.equal(await ReleaseCheckTests.checkAsync(repository, github, output, version), 1, reason);
        assert.equal(output.text, reason);
      }
    });

    test("a revision whose latest Build and test run on main did not pass, or that no run on main checked, fails with the run's state", async t => {
      const repository = await ReleaseCheckTests.createAsync(t);
      const passed = "release a revision whose run on main passed.\n";
      const cases: readonly (readonly [readonly unknown[], string])[] = [
        [[], `No Build and test run on main has checked ${ReleaseCheckTests.REVISION}; ${passed}`],
        [[{ status: "in_progress", conclusion: null }], `The Build and test run on main for ${ReleaseCheckTests.REVISION} is in_progress, not success; ${passed}`],
        [[{ status: "completed", conclusion: "failure" }], `The Build and test run on main for ${ReleaseCheckTests.REVISION} is failure, not success; ${passed}`],
        [[{ status: "completed", conclusion: "cancelled" }, { status: "completed", conclusion: "success" }],
          `The Build and test run on main for ${ReleaseCheckTests.REVISION} is cancelled, not success; ${passed}`]
      ];

      for (const [runs, reason] of cases) {
        const github = new GitHubApiFixture();
        const output = new TextOutputFixture();
        github.answer(ReleaseCheckTests.RELEASES, []);
        github.answer(ReleaseCheckTests.TAG, []);
        github.answer(ReleaseCheckTests.COMPARE, { status: "ahead" });
        github.answer(ReleaseCheckTests.RUNS, { workflow_runs: runs });

        assert.equal(await ReleaseCheckTests.checkAsync(repository, github, output), 1, reason);
        assert.equal(output.text, reason);
      }
    });

    test("a release to the product's own repository, its update feed, signs the declared Windows and macOS packages and tells the workflow so", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest({ releaseRepository: GitHubApiFixture.REPOSITORY }, [],
        { signedPlatforms: ["macos", "windows"] })) });
      const github = new GitHubApiFixture();
      const output = new TextOutputFixture();
      const outputs = path.join(repository.directory, "outputs");
      github.answer(ReleaseCheckTests.RELEASES, []);
      github.answer(ReleaseCheckTests.TAG, []);
      github.answer(ReleaseCheckTests.COMPARE, { status: "identical" });
      github.answer(ReleaseCheckTests.RUNS, ReleaseCheckTests.PASSED);

      assert.equal(await ReleaseCheckTests.checkAsync(repository, github, output, "0.0.7", { GITHUB_OUTPUT: outputs }), 0, output.text);

      assert.ok(output.text.endsWith("passed. Signed platforms: windows, macos.\n"), output.text);
      assert.equal(await readFile(outputs, "utf8"), "signed=windows macos\n");
    });

    test("a release to the update feed whose declaration leaves Windows or macOS unsigned is refused before GitHub is asked anything, whatever the case it is written in", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const cases: readonly (readonly [Readonly<Record<string, unknown>>, string, string])[] = [
        [{}, GitHubApiFixture.REPOSITORY, "windows and macos"],
        [{ signedPlatforms: ["windows"] }, "NOLDOVA-COM/teamrun", "macos"]
      ];

      for (const [settings, requested, unsigned] of cases) {
        await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest({ releaseRepository: GitHubApiFixture.REPOSITORY }, [], settings)) });
        const github = new GitHubApiFixture();
        const output = new TextOutputFixture();
        const environment = { RELEASE_REPOSITORY: requested, RELEASE_VERSION: "0.0.7", RELEASE_REVISION: ReleaseCheckTests.REVISION };

        assert.equal(await new ReleaseCheck(repository.directory, github, environment, output).runAsync([]), 1, requested);
        assert.equal(output.text, `${requested} is Fixture Studio's update feed, which gets only signed windows and macos packages, `
          + `but teamrun.signedPlatforms leaves out ${unsigned}.\n`, requested);
        assert.deepEqual(github.requests, [], requested);
      }
    });

    test("a GitHub failure other than a missing resource is reported, and an unexpected error reaches the caller", async t => {
      const repository = await ReleaseCheckTests.createAsync(t);
      const failing = new GitHubApiFixture();
      const output = new TextOutputFixture();
      failing.fail(ReleaseCheckTests.RELEASES, "gh: Server Error (HTTP 500)");

      assert.equal(await ReleaseCheckTests.checkAsync(repository, failing, output), 1);
      assert.equal(output.text, "\"gh api --paginate --slurp repos/noldova-com/teamrun/releases\" failed with exit code 1: gh: Server Error (HTTP 500)\n");
      await assert.rejects(ReleaseCheckTests.checkAsync(repository, new GitHubApiFixture(), new TextOutputFixture()), new Error("No answer recorded for /releases."));
    });

    test("any argument is refused with the usage, also from the command line", async t => {
      const repository = await ReleaseCheckTests.createAsync(t);
      const output = new TextOutputFixture();

      assert.equal(await new ReleaseCheck(repository.directory, new GitHubApiFixture(), {}, output).runAsync(["--version", "0.0.7"]), 2);
      const command = spawnSync(process.execPath, [SourceTreeFixture.locateScript("release-check.ts"), "--help"], { cwd: repository.directory, encoding: "utf8", timeout: 10_000 });

      assert.equal(output.text, ReleaseCheckTests.USAGE);
      assert.deepEqual([command.status, command.stdout], [2, ReleaseCheckTests.USAGE]);
    });
  }

  private static release(id: number, tag: string, isDraft: boolean = false): Readonly<Record<string, unknown>> {
    return { id, tag_name: tag, target_commitish: "main", draft: isDraft, assets: [] };
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ "package.json": JSON.stringify(ProductIdentityFixture.manifest()) });
    return repository;
  }

  private static checkAsync(repository: RepositoryFixture, github: GitHubApiFixture, output: TextOutputFixture, version: string = "0.0.7",
    outputs: NodeJS.ProcessEnv = {}): Promise<number> {
    const environment = { RELEASE_REPOSITORY: GitHubApiFixture.REPOSITORY, RELEASE_VERSION: version, RELEASE_REVISION: ReleaseCheckTests.REVISION, ...outputs };
    return new ReleaseCheck(repository.directory, github, environment, output).runAsync([]);
  }
}

ReleaseCheckTests.register();
