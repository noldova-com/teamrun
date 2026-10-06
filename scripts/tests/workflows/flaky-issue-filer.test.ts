/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import FlakyTest from "../../checks/flaky-test.ts";
import GitHubApi from "../../repository/github-api.ts";
import GitHubException from "../../repository/github.exception.ts";
import FlakyFilingException from "../../workflows/flaky-filing.exception.ts";
import FlakyIssueFiler from "../../workflows/flaky-issue-filer.ts";
import FlakyOccurrence from "../../workflows/flaky-occurrence.ts";
import FlakyRedactor from "../../workflows/flaky-redactor.ts";
import GitHubApiFixture from "../fixtures/github-api.fixture.ts";

class FlakyIssueFilerTests {
  private static readonly RUN: string = "https://github.com/noldova-com/teamrun/actions/runs/7";
  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";
  private static readonly MILESTONES: string = "/milestones?state=open&per_page=100";
  private static readonly NOW: Date = new Date("2026-10-06T01:00:00.000Z");
  private static readonly ZERO_WIDTH_SPACE: string = String.fromCodePoint(0x200b);
  private static readonly MODIFIER_GRAVE: string = String.fromCodePoint(0x2cb);

  public static register(): void {
    test("a new flaky test opens a bug in the Shell milestone with its key, its fenced and redacted failure, its jobs and when its fix is due", async () => {
      const fixture = FlakyIssueFilerTests.createFixture([]);
      fixture.answer("/issues", { number: 43 });
      const flaky = new FlakyTest("Script tests", "scripts/tests/a.test.ts", "group > `fails` @once", "not ok 1 - fails\n  at /home/runner/work/a.ts:1\n  token " + "a1B2_c3D4-".repeat(4) + "\n  ```end @here");

      const lines = await FlakyIssueFilerTests.create(fixture).fileAsync([new FlakyOccurrence(flaky, ["ubuntu-24.04-x64", "windows-2025-x64"])]);

      const key = createHash("sha256").update(JSON.stringify(["Script tests", "scripts/tests/a.test.ts", "group > `fails` @once"])).digest("hex");
      const name = `group > ${FlakyIssueFilerTests.MODIFIER_GRAVE}fails${FlakyIssueFilerTests.MODIFIER_GRAVE} @${FlakyIssueFilerTests.ZERO_WIDTH_SPACE}once`;
      const grave = FlakyIssueFilerTests.MODIFIER_GRAVE.repeat(3);
      assert.deepEqual(lines, ["- group > `fails` @once: opened #43"]);
      assert.deepEqual(fixture.writes, ["POST /issues"]);
      assert.deepEqual(fixture.fields.filter(t => !t.startsWith("body=")), ["title=Flaky: group > `fails` @once", "labels[]=bug", "milestone=4"]);
      assert.equal(fixture.bodies[0], [
        `<!-- flaky-test: ${key} -->`,
        "This test failed and then passed when it ran again in the same job, so it is flaky. A flaky test is a bug: see [Flakiness and races](https://github.com/noldova-com/teamrun/blob/main/docs/TESTING.md#flakiness-and-races). " +
          "Its fix is due within 24 hours, by 2026-10-07T01:00:00.000Z.",
        "",
        "- **Runner:** Script tests",
        "- **File:** scripts/tests/a.test.ts",
        "- **Jobs:** ubuntu-24.04-x64, windows-2025-x64",
        `- **Run:** ${FlakyIssueFilerTests.RUN}`,
        "",
        "Test:",
        "",
        "```text",
        name,
        "```",
        "",
        "First failure:",
        "",
        "```text",
        `not ok 1 - fails\n  at ~/work/a.ts:1\n  token [redacted]\n  ${grave}end @${FlakyIssueFilerTests.ZERO_WIDTH_SPACE}here`,
        "```",
        "",
        "Later runs where it is flaky again comment on this issue.",
        "<!-- flaky-occurrence: {\"name\":\"group \\u003e `fails` \\u0040once\",\"jobs\":[\"ubuntu-24.04-x64\",\"windows-2025-x64\"]} -->"
      ].join("\n"));
    });

    test("a flaky test comments on the open bug whose body holds its key, or else on one whose title names it exactly, and never on a partial match", async () => {
      const keyed = new FlakyTest("Package tests", "@noldova/a/a.test.js", "ATests.fails", "first");
      const named = new FlakyTest("Angular tests", "shell/b.spec.ts", "B shows", "second");
      const partial = new FlakyTest("UI workflows", "src/shell/desktop/tests/e2e/c.spec.ts", "c.spec.ts › docks", "third");
      const fixture = FlakyIssueFilerTests.createFixture([
        { number: 40, title: "Flaky: B shows", body: "", pull_request: {} },
        { number: 41, title: "Something else", body: `Older text\n<!-- flaky-test: ${FlakyIssueFiler.keyOf(keyed)} -->` },
        { number: 42, title: "B shows sometimes fails", body: null },
        { number: 44, title: "Flaky: c.spec.ts › docks_twice", body: "c.spec.ts › docksAgain and xc.spec.ts › docks" }
      ]);
      fixture.answer("/issues", { number: 45 });

      const lines = await FlakyIssueFilerTests.create(fixture).fileAsync([["ubuntu-24.04-x64"], ["macos-15-arm64"], ["windows-2025-x64"]].map((jobs, index) => new FlakyOccurrence([keyed, named, partial][index] ?? keyed, jobs)));

      assert.deepEqual(lines, ["- ATests.fails: commented on #41", "- B shows: commented on #42", "- c.spec.ts › docks: opened #45"]);
      assert.deepEqual(fixture.writes, ["POST /issues/41/comments", "POST /issues/42/comments", "POST /issues"]);
      assert.equal(fixture.bodies[0], [
        `It was flaky again in ${FlakyIssueFilerTests.RUN}, in ubuntu-24.04-x64.`,
        "",
        "First failure:",
        "",
        "```text",
        "first",
        "```",
        "<!-- flaky-occurrence: {\"name\":\"ATests.fails\",\"jobs\":[\"ubuntu-24.04-x64\"]} -->"
      ].join("\n"));
    });

    test("a short name in an unrelated bug's body finds nothing, and the key wins over a title that names the test", async () => {
      const short = new FlakyTest("Script tests", "scripts/tests/a.test.ts", "opens", "first");
      const keyed = new FlakyTest("Script tests", "scripts/tests/b.test.ts", "closes", "second");
      const fixture = FlakyIssueFilerTests.createFixture([
        { number: 50, title: "Settings is slow", body: "The tab opens slowly." },
        { number: 51, title: "Flaky: closes", body: "" },
        { number: 52, title: "Something else", body: `<!-- flaky-test: ${FlakyIssueFiler.keyOf(keyed)} -->` }
      ]);
      fixture.answer("/issues", { number: 53 });

      const lines = await FlakyIssueFilerTests.create(fixture).fileAsync([new FlakyOccurrence(short, ["job"]), new FlakyOccurrence(keyed, ["job"])]);

      assert.deepEqual(lines, ["- opens: opened #53", "- closes: commented on #52"]);
      assert.deepEqual(fixture.writes, ["POST /issues", "POST /issues/52/comments"]);
    });

    test("a name is found only where it stands on its own, at either end of the text or between other characters", () => {
      assert.deepEqual(
        ["a > b", "x a > b.", "(a > b)", "a > bc", "za > b", "a > b_", "a > ba > b"].map(t => FlakyIssueFiler.names(t, "a > b")),
        [true, true, true, false, false, false, false]);
      assert.equal(FlakyIssueFiler.names("é a > b ü", "a > b"), true);
      assert.equal(FlakyIssueFiler.names("éa > b", "a > b"), false);
    });

    test("a title longer than GitHub allows is cut with an ellipsis, and the key in the body still finds its bug", () => {
      const name = "n".repeat(300);

      assert.equal(FlakyIssueFiler.titleOf(name), `Flaky: ${"n".repeat(248)}…`);
      assert.equal(FlakyIssueFiler.titleOf(name).length, 256);
      assert.equal(FlakyIssueFiler.titleOf("short"), "Flaky: short");
      assert.equal(FlakyIssueFiler.titleOf("n".repeat(249)).length, 256);
    });

    test("without an open Shell milestone the bug is opened without a milestone", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(FlakyIssueFilerTests.OPEN_BUGS, []);
      fixture.answer(FlakyIssueFilerTests.MILESTONES, [{ number: 2, title: "Modules" }]);
      fixture.answer("/issues", { number: 46 });

      await FlakyIssueFilerTests.create(fixture).fileAsync([new FlakyOccurrence(new FlakyTest("Script tests", "a", "b", "c"), ["job"])]);

      assert.deepEqual(fixture.fields.filter(t => !t.startsWith("body=")), ["title=Flaky: b", "labels[]=bug"]);
    });

    test("more than ten flaky tests in one run share one issue, opened once and commented on later", async () => {
      const occurrences = Array.from({ length: 11 }, (_, index) => new FlakyOccurrence(new FlakyTest("Script tests", "a", `test ${index}`, "failed"), ["job"]));
      const opening = FlakyIssueFilerTests.createFixture([]);
      opening.answer("/issues", { number: 47 });
      const commenting = FlakyIssueFilerTests.createFixture([{ number: 47, title: FlakyIssueFiler.MANY_TESTS_TITLE, body: "" }]);

      const opened = await FlakyIssueFilerTests.create(opening).fileAsync(occurrences);
      const commented = await FlakyIssueFilerTests.create(commenting).fileAsync(occurrences);

      assert.deepEqual([opened, commented], [["- 11 flaky tests, too many for an issue each: opened #47"], ["- 11 flaky tests, too many for an issue each: commented on #47"]]);
      assert.ok(opening.bodies[0]?.startsWith(`The run ${FlakyIssueFilerTests.RUN} had 11 flaky tests, more than the 10 it files one at a time, so they share this issue:\n\n- test 0 (job)\n`));
      assert.ok(opening.bodies[0]?.endsWith("<!-- flaky-occurrence: {\"name\":\"test 10\",\"jobs\":[\"job\"]} -->\n\nLater runs with that many flaky tests comment on this issue."));
      assert.ok(commenting.bodies[0]?.startsWith(`The run ${FlakyIssueFilerTests.RUN} had 11 flaky tests again:\n\n- test 0 (job)\n`));
      assert.deepEqual(opening.fields.filter(t => t.startsWith("title=")), [`title=${FlakyIssueFiler.MANY_TESTS_TITLE}`]);
    });

    test("a failed GitHub request stops the filing, naming what it had filed, and any other error is not hidden", async () => {
      const failing = FlakyIssueFilerTests.createFixture([{ number: 49, title: "Flaky: second", body: "" }]);
      failing.answer("/issues", { number: 50 });
      failing.fail("/issues/49/comments", "gh: Server Error (HTTP 502)");
      const occurrences = ["first", "second"].map(t => new FlakyOccurrence(new FlakyTest("Script tests", "a", t, "failed"), ["job"]));

      await assert.rejects(FlakyIssueFilerTests.create(failing).fileAsync(occurrences),
        (error: unknown) => error instanceof FlakyFilingException && error.cause instanceof GitHubException && error.message.startsWith("Filing the flaky tests stopped: ") && error.filed.length === 1);
      await assert.rejects(FlakyIssueFilerTests.create(new GitHubApiFixture()).fileAsync(occurrences), /No answer recorded/u);
    });
  }

  private static createFixture(issues: readonly object[]): GitHubApiFixture {
    const fixture = new GitHubApiFixture();
    fixture.answer(FlakyIssueFilerTests.OPEN_BUGS, issues);
    fixture.answer(FlakyIssueFilerTests.MILESTONES, [{ number: 3, title: "Modules" }, { number: 4, title: "Shell" }]);
    return fixture;
  }

  private static create(fixture: GitHubApiFixture): FlakyIssueFiler {
    return new FlakyIssueFiler(new GitHubApi(GitHubApiFixture.REPOSITORY, fixture, "work"), GitHubApiFixture.REPOSITORY, FlakyIssueFilerTests.RUN, new FlakyRedactor(FlakyRedactor.RUNNER_HOMES), FlakyIssueFilerTests.NOW);
  }
}

FlakyIssueFilerTests.register();
