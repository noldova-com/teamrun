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
import NightlyFailure from "../../workflows/nightly-failure.ts";
import NightlyFinding from "../../workflows/nightly-finding.ts";
import NightlyIssueFiler from "../../workflows/nightly-issue-filer.ts";
import GitHubApiFixture from "../fixtures/github-api.fixture.ts";

class NightlyIssueFilerTests {
  private static readonly RUN: string = "https://github.com/noldova-com/teamrun/actions/runs/7";
  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";

  public static register(): void {
    test("a new failure opens a bug, and one with an open bug of the same title comments there instead", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, [
        { number: 40, title: "Nightly: quit.spec.ts › asks", pull_request: {} },
        { number: 41, title: "Nightly: quit.spec.ts › asks" },
        { number: 42, title: "Another bug" }
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
      fixture.answer(NightlyIssueFilerTests.OPEN_BUGS, [{ number: 41, title: "Nightly: npm test › Packages" }]);

      await NightlyIssueFilerTests.create(fixture).fileAsync([new NightlyFinding(new NightlyFailure("npm test › Packages", "It failed.", 1), ["Linux x64, tests"])]);

      assert.ok(fixture.bodies[0]?.startsWith(`It failed again in the nightly run ${NightlyIssueFilerTests.RUN}: 1 failure in Linux x64, tests.`));
    });

    test("more failures than it files one at a time share one bug for the run, without looking for open ones", async () => {
      const fixture = new GitHubApiFixture();
      fixture.answer("/issues", { number: 50 });
      const findings = Array.from({ length: NightlyIssueFiler.MAXIMUM_ISSUES + 1 }, (_, index) => new NightlyFinding(new NightlyFailure(`test ${index}`, "Error", 1), ["Linux x64, tests"]));

      const lines = await NightlyIssueFilerTests.create(fixture).fileAsync(findings);

      assert.deepEqual(lines, ["- 11 failures, too many for an issue each: opened #50"]);
      assert.deepEqual(fixture.requests, ["POST /issues"]);
      assert.equal(fixture.fields[0], "title=Nightly: 11 tests and workflows failed in one run");
      assert.equal(fixture.bodies[0], [
        `The nightly run ${NightlyIssueFilerTests.RUN} failed in 11 tests and workflows, more than the 10 it files one at a time, so they share this issue:`,
        "",
        ...findings.map((_, index) => `- test ${index} (Linux x64, tests)`)
      ].join("\n"));
    });

    test("a title longer than GitHub takes is cut to 256 characters with an ellipsis", () => {
      const fits = "a".repeat(256 - "Nightly: ".length);

      assert.equal(NightlyIssueFiler.titleOf(fits), `Nightly: ${fits}`);
      assert.equal(NightlyIssueFiler.titleOf(`${fits}b`), `Nightly: ${fits.slice(0, -1)}…`);
      assert.equal(NightlyIssueFiler.titleOf(`${fits}b`).length, 256);
    });
  }

  private static create(fixture: GitHubApiFixture): NightlyIssueFiler {
    return new NightlyIssueFiler(new GitHubApi(GitHubApiFixture.REPOSITORY, fixture, "work"), GitHubApiFixture.REPOSITORY, NightlyIssueFilerTests.RUN);
  }
}

NightlyIssueFilerTests.register();
