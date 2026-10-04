/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import WatchPullRequests from "../watch-pull-requests.ts";
import GitHubApiFixture from "./fixtures/github-api.fixture.ts";
import PullRequestScenarioFixture from "./fixtures/pull-request-scenario.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class WatchPullRequestsTests {
  public static register(): void {
    test("the findings go to the step summary and the log under a heading", async t => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, isDraft: true });
      scenario.add({ number: 4, buildRuns: 0, commitMinutesAgo: 30 });
      const summaryPath = path.join(await WatchPullRequestsTests.createFolderAsync(t), "summary.md");
      const log = new TextOutputFixture();
      const command = new WatchPullRequests(scenario.api, log, "work", () => PullRequestScenarioFixture.NOW.getTime(), WatchPullRequestsTests.waitAsync);

      const status = await command.runAsync({ GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY, GITHUB_STEP_SUMMARY: summaryPath });

      const expected = "Open pull requests:\n\n- #3: skipped, a draft\n- #4: no-build (commented)\n";
      assert.equal(status, 0);
      assert.equal(await readFile(summaryPath, "utf8"), expected);
      assert.equal(log.text, expected);
      assert.deepEqual(scenario.api.writes, ["POST /issues/4/comments"]);
    });

    test("a run adds to the step summary instead of replacing it", async t => {
      const scenario = new PullRequestScenarioFixture();
      const summaryPath = path.join(await WatchPullRequestsTests.createFolderAsync(t), "summary.md");
      const command = new WatchPullRequests(scenario.api, new TextOutputFixture(), "work", () => PullRequestScenarioFixture.NOW.getTime(), WatchPullRequestsTests.waitAsync);
      const environment = { GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY, GITHUB_STEP_SUMMARY: summaryPath };

      await command.runAsync(environment);
      await command.runAsync(environment);

      assert.equal(await readFile(summaryPath, "utf8"), "Open pull requests:\n\n- No open pull requests.\nOpen pull requests:\n\n- No open pull requests.\n");
    });

    test("a missing or empty repository or summary file fails before reading anything", async () => {
      const scenario = new PullRequestScenarioFixture();
      for (const environment of [{}, { GITHUB_REPOSITORY: "", GITHUB_STEP_SUMMARY: "summary.md" }, { GITHUB_REPOSITORY: "a/b" }, { GITHUB_REPOSITORY: "a/b", GITHUB_STEP_SUMMARY: "" }]) {
        const log = new TextOutputFixture();

        assert.equal(await new WatchPullRequests(scenario.api, log, "work", () => PullRequestScenarioFixture.NOW.getTime(), WatchPullRequestsTests.waitAsync).runAsync(environment), 1);
        assert.equal(log.text, "GITHUB_REPOSITORY and GITHUB_STEP_SUMMARY must name the repository and the step's summary file.\n");
      }
      assert.deepEqual(scenario.api.requests, []);
    });

    test("the command refuses to run without its variables and terminates", () => {
      const command = SourceTreeFixture.locateScript("watch-pull-requests.ts");
      const environment = { ...process.env, GITHUB_REPOSITORY: "", GITHUB_STEP_SUMMARY: "" };

      const refused = spawnSync(process.execPath, [command], { env: environment, encoding: "utf8", timeout: 10_000 });

      assert.equal(refused.status, 1, refused.stderr);
      assert.equal(refused.stdout, "GITHUB_REPOSITORY and GITHUB_STEP_SUMMARY must name the repository and the step's summary file.\n");
    });
  }

  private static async waitAsync(): Promise<void> {
    await Promise.resolve();
  }

  private static async createFolderAsync(t: TestContext): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), "watch-pull-requests-"));
    t.after(() => rm(folder, { recursive: true, force: true }));
    return folder;
  }
}

WatchPullRequestsTests.register();
