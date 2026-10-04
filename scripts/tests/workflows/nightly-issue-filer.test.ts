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
import GitHubException from "../../repository/github.exception.ts";
import NightlyFailure from "../../workflows/nightly-failure.ts";
import NightlyFilingException from "../../workflows/nightly-filing.exception.ts";
import NightlyFinding from "../../workflows/nightly-finding.ts";
import NightlyIssueFiler from "../../workflows/nightly-issue-filer.ts";
import GitHubApiFixture from "../fixtures/github-api.fixture.ts";

class NightlyIssueFilerTests {
  private static readonly RUN: string = "https://github.com/noldova-com/teamrun/actions/runs/7";
  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";
  private static readonly BOT: object = { login: "github-actions[bot]" };

  public static register(): void {
    test("a new failure opens a bug, and one with an open bug of the same title that the nightly run opened comments there instead", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, [
        { number: 39, title: "Nightly: quit.spec.ts › asks", user: { login: "someone" } },
        { number: 40, title: "Nightly: quit.spec.ts › asks", user: NightlyIssueFilerTests.BOT, pull_request: {} },
        { number: 41, title: "Nightly: quit.spec.ts › asks", user: NightlyIssueFilerTests.BOT },
        { number: 42, title: "Another bug", user: NightlyIssueFilerTests.BOT }
      ]);
      fixture.answer("/issues", { number: 43 });
      const findings = [
        new NightlyFinding(new NightlyFailure("docking.spec.ts › joins", "Error: first", 1), ["Linux x64, UI workflows"]),
        new NightlyFinding(new NightlyFailure("quit.spec.ts › asks", "Error: quit", 3), ["macOS x64, UI workflows", "Windows x64, UI workflows"]),
        new NightlyFinding(new NightlyFailure("npm test › Packages", "It failed.", 1), ["Linux ARM64, tests"])
      ];

      const lines = await NightlyIssueFilerTests.create(fixture).fileAsync(findings);

      assert.deepEqual(lines, ["- docking.spec.ts › joins: opened #43", "- quit.spec.ts › asks: commented on #41", "- npm test › Packages: opened #43"]);
      assert.deepEqual(fixture.writes, ["POST /issues", "POST /issues/41/comments", "POST /issues"]);
      assert.deepEqual(fixture.fields.filter(t => !t.startsWith("body=")), ["title=Nightly: docking.spec.ts › joins", "labels[]=bug", "title=Nightly: npm test › Packages", "labels[]=bug"]);
      assert.equal(fixture.bodies[0], [
        "The nightly run, which repeats every test and UI workflow five times on every target, failed here.",
        "",
        "- **Failing:** docking.spec.ts › joins",
        "- **Jobs:** Linux x64, UI workflows",
        "- **Failures:** 1",
        `- **Run:** ${NightlyIssueFilerTests.RUN}`,
        "",
        "First error:",
        "",
        "    Error: first",
        "",
        "A flaky failure is a bug: see [Flakiness and races](https://github.com/noldova-com/teamrun/blob/main/docs/TESTING.md#flakiness-and-races). Later nights that fail here comment on this issue."
      ].join("\n"));
      assert.equal(fixture.bodies[1], `It failed again in the nightly run ${NightlyIssueFilerTests.RUN}: 3 failures in macOS x64, UI workflows, Windows x64, UI workflows.\n\nFirst error:\n\n    Error: quit`);
    });

    test("a comment says failure for a single one", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, [{ number: 41, title: "Nightly: npm test › Packages", user: NightlyIssueFilerTests.BOT }]);

      await NightlyIssueFilerTests.create(fixture).fileAsync([new NightlyFinding(new NightlyFailure("npm test › Packages", "It failed.", 1), ["Linux x64, tests"])]);

      assert.ok(fixture.bodies[0]?.startsWith(`It failed again in the nightly run ${NightlyIssueFilerTests.RUN}: 1 failure in Linux x64, tests.`));
    });

    test("more failures than it files one at a time open one bug with a title that stays the same from night to night", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, [{ number: 41, title: "Nightly: test 0", user: NightlyIssueFilerTests.BOT }]);
      fixture.answer("/issues", { number: 50 });
      const findings = NightlyIssueFilerTests.many();

      const lines = await NightlyIssueFilerTests.create(fixture).fileAsync(findings);

      assert.deepEqual(lines, ["- 11 failures, too many for an issue each: opened #50"]);
      assert.deepEqual(fixture.writes, ["POST /issues"]);
      assert.deepEqual(fixture.fields.filter(t => !t.startsWith("body=")), ["title=Nightly: more than ten failures", "labels[]=bug"]);
      assert.equal(fixture.bodies[0], [
        `The nightly run ${NightlyIssueFilerTests.RUN} failed in 11 tests and workflows, more than the 10 it files one at a time, so they share this issue:`,
        "",
        ...findings.map((_, index) => `- test ${index} (Linux x64, tests)`),
        "",
        "Later nights with that many failures comment on this issue."
      ].join("\n"));
    });

    test("more failures than it files one at a time comment on the open bug for that many failures", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, [{ number: 44, title: NightlyIssueFiler.MANY_FAILURES_TITLE, user: NightlyIssueFilerTests.BOT }]);
      const findings = NightlyIssueFilerTests.many();

      const lines = await NightlyIssueFilerTests.create(fixture).fileAsync(findings);

      assert.deepEqual(lines, ["- 11 failures, too many for an issue each: commented on #44"]);
      assert.deepEqual(fixture.writes, ["POST /issues/44/comments"]);
      assert.equal(fixture.bodies[0], [
        `It failed again in the nightly run ${NightlyIssueFilerTests.RUN}, in 11 tests and workflows:`,
        "",
        ...findings.map((_, index) => `- test ${index} (Linux x64, tests)`)
      ].join("\n"));
    });

    test("an error of several lines keeps each line indented as code", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, []);
      fixture.answer("/issues", { number: 43 });

      await NightlyIssueFilerTests.create(fixture).fileAsync([new NightlyFinding(new NightlyFailure("npm test › Packages", "The check's failing tests:\n✘ writesALine", 1), ["Linux x64, tests"])]);

      assert.ok(fixture.bodies[0]?.includes("First error:\n\n    The check's failing tests:\n    ✘ writesALine\n"));
    });

    test("a GitHub request that fails stops the filing with an error that names what it had filed", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, [{ number: 41, title: "Nightly: quit.spec.ts › asks", user: NightlyIssueFilerTests.BOT }]);
      fixture.answer("/issues", { number: 43 });
      fixture.fail("/issues/41/comments", "HTTP 403: rate limited (HTTP 403)");
      const findings = [
        new NightlyFinding(new NightlyFailure("docking.spec.ts › joins", "Error: dock", 1), ["Linux x64, UI workflows"]),
        new NightlyFinding(new NightlyFailure("quit.spec.ts › asks", "Error: quit", 1), ["Linux x64, UI workflows"]),
        new NightlyFinding(new NightlyFailure("restart.spec.ts › restores", "Error: restart", 1), ["Linux x64, UI workflows"])
      ];

      const error = await NightlyIssueFilerTests.create(fixture).fileAsync(findings).then(() => null, (t: unknown) => t);

      assert.ok(error instanceof NightlyFilingException);
      assert.deepEqual(error.filed, ["- docking.spec.ts › joins: opened #43"]);
      assert.match(error.message, /^Filing the nightly failures stopped: "gh api --method POST repos\/noldova-com\/teamrun\/issues\/41\/comments .*rate limited/su);
      assert.ok(error.cause instanceof GitHubException);
      assert.deepEqual(fixture.writes, ["POST /issues", "POST /issues/41/comments"]);
    });

    test("an error that isn't GitHub's passes through unchanged", async () => {
      const fixture = new GitHubApiFixture();

      await assert.rejects(NightlyIssueFilerTests.create(fixture).fileAsync([new NightlyFinding(new NightlyFailure("a", "b", 1), ["Linux x64, tests"])]), /No answer recorded/u);
    });

    test("a title longer than GitHub takes is cut to 256 characters with an ellipsis", () => {
      const fits = "a".repeat(256 - "Nightly: ".length);

      assert.equal(NightlyIssueFiler.titleOf(fits), `Nightly: ${fits}`);
      assert.equal(NightlyIssueFiler.titleOf(`${fits}b`), `Nightly: ${fits.slice(0, -1)}…`);
      assert.equal(NightlyIssueFiler.titleOf(`${fits}b`).length, 256);
    });
  }

  private static many(): readonly NightlyFinding[] {
    return Array.from({ length: NightlyIssueFiler.MAXIMUM_ISSUES + 1 }, (_, index) => new NightlyFinding(new NightlyFailure(`test ${index}`, "Error", 1), ["Linux x64, tests"]));
  }

  private static create(fixture: GitHubApiFixture): NightlyIssueFiler {
    return new NightlyIssueFiler(new GitHubApi(GitHubApiFixture.REPOSITORY, fixture, "work"), GitHubApiFixture.REPOSITORY, NightlyIssueFilerTests.RUN);
  }
}

NightlyIssueFilerTests.register();
