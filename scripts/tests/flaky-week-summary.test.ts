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
import { test } from "node:test";

import FlakyWeekSummary from "../flaky-week-summary.ts";
import GitHubApiFixture from "./fixtures/github-api.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class FlakyWeekSummaryTests {
  private static readonly NOW: Date = new Date("2026-10-06T01:00:00.000Z");
  private static readonly ISSUES: string = "/issues?labels=bug&state=all&since=2026-09-29T01:00:00.000Z&per_page=100";
  private static readonly NONE: string = "### Flaky tests in the last seven days\n\nNo test was flaky in the last seven days.\n";
  private static readonly REQUIRED: string = "GITHUB_REPOSITORY and GITHUB_STEP_SUMMARY must name the repository and the step summary file.\n";

  public static register(): void {
    test("the week's count goes to the step summary and the log", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const fixture = new GitHubApiFixture();
      fixture.answer(FlakyWeekSummaryTests.ISSUES, []);
      const log = new TextOutputFixture();

      assert.equal(await new FlakyWeekSummary(fixture, log, repository.directory, FlakyWeekSummaryTests.NOW).runAsync(FlakyWeekSummaryTests.environment(repository)), 0);

      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"), FlakyWeekSummaryTests.NONE);
      assert.equal(log.text, FlakyWeekSummaryTests.NONE);
    });

    test("a GitHub request that fails ends the count with exit code 1 and its message, and any other error is not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const fixture = new GitHubApiFixture();
      fixture.fail(FlakyWeekSummaryTests.ISSUES, "gh: Server Error (HTTP 502)");
      const log = new TextOutputFixture();

      assert.equal(await new FlakyWeekSummary(fixture, log, repository.directory, FlakyWeekSummaryTests.NOW).runAsync(FlakyWeekSummaryTests.environment(repository)), 1);

      assert.match(log.text, /^"gh api .+" failed with exit code 1: gh: Server Error \(HTTP 502\)\n$/u);
      await assert.rejects(new FlakyWeekSummary(new GitHubApiFixture(), new TextOutputFixture(), repository.directory, FlakyWeekSummaryTests.NOW).runAsync(FlakyWeekSummaryTests.environment(repository)), /No answer recorded/u);
    });

    test("a missing setting fails before reading anything", async () => {
      for (const environment of [{}, { GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY }, { GITHUB_STEP_SUMMARY: "summary.md" }]) {
        const fixture = new GitHubApiFixture();
        const log = new TextOutputFixture();

        assert.equal(await new FlakyWeekSummary(fixture, log, "unused", FlakyWeekSummaryTests.NOW).runAsync(environment), 1);
        assert.equal(log.text, FlakyWeekSummaryTests.REQUIRED);
        assert.deepEqual(fixture.requests, []);
      }
    });

    test("the command refuses to start without its settings and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      const refused = spawnSync(process.execPath, [SourceTreeFixture.locateScript("flaky-week-summary.ts")], {
        cwd: repository.directory, env: { ...process.env, GITHUB_REPOSITORY: "", GITHUB_STEP_SUMMARY: "" }, encoding: "utf8", timeout: 30_000
      });

      assert.equal(refused.status, 1, refused.stderr);
      assert.equal(refused.stdout, FlakyWeekSummaryTests.REQUIRED);
    });
  }

  private static environment(repository: RepositoryFixture): Readonly<Record<string, string>> {
    return { GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY, GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md") };
  }
}

FlakyWeekSummaryTests.register();
