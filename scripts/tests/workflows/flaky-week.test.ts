/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitHubApi from "../../repository/github-api.ts";
import FlakyIssueFiler from "../../workflows/flaky-issue-filer.ts";
import FlakyWeek from "../../workflows/flaky-week.ts";
import GitHubApiFixture from "../fixtures/github-api.fixture.ts";

class FlakyWeekTests {
  private static readonly NOW: Date = new Date("2026-10-06T01:00:00.000Z");
  private static readonly SINCE: string = "2026-09-29T01:00:00.000Z";
  private static readonly ISSUES: string = `/issues?labels=bug&state=all&since=${FlakyWeekTests.SINCE}&per_page=100`;
  private static readonly RECENT: string = "2026-10-01T00:00:00Z";
  private static readonly OLD: string = "2026-09-20T00:00:00Z";

  public static register(): void {
    test("the week's summary counts each occurrence in issues opened and comments written in the last seven days, per test and per target", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(FlakyWeekTests.ISSUES, [
        { number: 1, created_at: FlakyWeekTests.RECENT, body: `Opened.\n${FlakyIssueFiler.formatOccurrence("a > b", ["ubuntu-24.04-x64", "windows-2025-x64, UI shard 2"])}` },
        { number: 2, created_at: FlakyWeekTests.OLD, body: FlakyIssueFiler.formatOccurrence("old > test", ["ubuntu-24.04-x64"]) },
        { number: 3, created_at: FlakyWeekTests.RECENT, body: null },
        { number: 4, created_at: FlakyWeekTests.RECENT, body: "", pull_request: {} }
      ]);
      fixture.answer(FlakyWeekTests.comments(1), [
        { created_at: FlakyWeekTests.RECENT, body: `Again.\n${FlakyIssueFiler.formatOccurrence("a > b", ["windows-2025-x64"])}` },
        { created_at: FlakyWeekTests.OLD, body: FlakyIssueFiler.formatOccurrence("a > b", ["macos-15-arm64"]) }
      ]);
      fixture.answer(FlakyWeekTests.comments(2), [{ created_at: FlakyWeekTests.RECENT, body: FlakyIssueFiler.formatOccurrence("old > test", ["windows-2025-x64"]) }]);
      fixture.answer(FlakyWeekTests.comments(3), [{
        created_at: FlakyWeekTests.RECENT,
        body: [
          FlakyIssueFiler.formatOccurrence("x | <y> `z` @w", ["macos-15-arm64"]),
          "<!-- flaky-occurrence: { -->",
          "<!-- flaky-occurrence: null -->",
          "<!-- flaky-occurrence: {\"name\":1,\"jobs\":[]} -->",
          "<!-- flaky-occurrence: {\"name\":\"n\",\"jobs\":\"j\"} -->",
          "<!-- flaky-occurrence: {\"name\":\"n\",\"jobs\":[1]} -->"
        ].join("\n")
      }]);

      const summary = await new FlakyWeek(new GitHubApi(GitHubApiFixture.REPOSITORY, fixture, "work"), FlakyWeekTests.NOW).summarizeAsync();

      assert.equal(summary, [
        "### Flaky tests in the last seven days",
        "",
        "| Test | Times flaky |",
        "|---|---|",
        "| a &gt; b | 2 |",
        "| old &gt; test | 1 |",
        "| x &#124; &lt;y&gt; &#96;z&#96; &#64;w | 1 |",
        "",
        "| Target | Times flaky |",
        "|---|---|",
        "| windows-2025-x64 | 3 |",
        "| macos-15-arm64 | 1 |",
        "| ubuntu-24.04-x64 | 1 |",
        ""
      ].join("\n"));
      assert.ok(!fixture.requests.includes(`GET ${FlakyWeekTests.comments(4)}`));
    });

    test("a week without flaky tests says so", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(FlakyWeekTests.ISSUES, []);

      assert.equal(await new FlakyWeek(new GitHubApi(GitHubApiFixture.REPOSITORY, fixture, "work"), FlakyWeekTests.NOW).summarizeAsync(),
        "### Flaky tests in the last seven days\n\nNo test was flaky in the last seven days.\n");
    });
  }

  private static comments(issue: number): string {
    return `/issues/${issue}/comments?since=${FlakyWeekTests.SINCE}&per_page=100`;
  }
}

FlakyWeekTests.register();
