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

import NightlyReport from "../nightly-report.ts";
import NightlyFailure from "../workflows/nightly-failure.ts";
import NightlyLegResult from "../workflows/nightly-leg-result.ts";
import NightlyResultException from "../workflows/nightly-result.exception.ts";
import GitHubApiFixture from "./fixtures/github-api.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class NightlyReportTests {
  private static readonly RUN: string = "https://github.com/noldova-com/teamrun/actions/runs/7";
  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";
  private static readonly LEGS: readonly string[] = ["Linux x64, tests", "Linux x64, UI workflows", "Windows x64, UI workflows"];
  private static readonly REQUIRED: string = "GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY, NIGHTLY_RUN_URL, NIGHTLY_LEGS (a JSON list of the jobs' labels) and NIGHTLY_RESULTS must describe the run.\n";

  public static register(): void {
    test("a night where every job passed posts nothing and says so in the summary", async t => {
      const repository = await NightlyReportTests.prepareAsync(t, NightlyReportTests.LEGS.map(label => new NightlyLegResult(label, [])));
      const fixture = new GitHubApiFixture();
      const log = new TextOutputFixture();

      assert.equal(await new NightlyReport(fixture, log, repository.directory).runAsync(NightlyReportTests.environment(repository)), 0);

      assert.deepEqual(fixture.requests, []);
      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"), "Nightly repeats:\n\n- Every job passed.\n");
      assert.equal(log.text, "Nightly repeats:\n\n- Every job passed.\n");
    });

    test("a failure in several jobs is one bug that names them all, and a job without a result is a failure of its own", async t => {
      const repository = await NightlyReportTests.prepareAsync(t, [
        new NightlyLegResult("Linux x64, UI workflows", [new NightlyFailure("quit.spec.ts › asks", "Error: on Linux", 1)]),
        new NightlyLegResult("Windows x64, UI workflows", [new NightlyFailure("quit.spec.ts › asks", "Error: on Windows", 2), new NightlyFailure("docking.spec.ts › joins", "Error: dock", 1)])
      ]);
      await repository.writeAsync({ "_build/nightly/results/notes.txt": "not a result" });
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyReportTests.OPEN_BUGS, [{ number: 41, title: "Nightly: quit.spec.ts › asks", user: { login: "github-actions[bot]" } }]);
      fixture.answer("/issues", { number: 43 });

      assert.equal(await new NightlyReport(fixture, new TextOutputFixture(), repository.directory).runAsync(NightlyReportTests.environment(repository)), 0);

      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"), [
        "Nightly repeats:",
        "",
        "- docking.spec.ts › joins: opened #43",
        "- Linux x64, tests › the run itself: opened #43",
        "- quit.spec.ts › asks: commented on #41",
        ""
      ].join("\n"));
      assert.deepEqual(fixture.writes, ["POST /issues", "POST /issues", "POST /issues/41/comments"]);
      assert.ok(fixture.bodies[1]?.includes("    It left no result, so it didn't start or stopped before recording one."));
      assert.ok(fixture.bodies[2]?.startsWith(`It failed again in the nightly run ${NightlyReportTests.RUN}: 3 failures in Linux x64, UI workflows, Windows x64, UI workflows.\n\nFirst error:\n\n    Error: on Linux`));
    });

    test("a run that left no results at all reports every job", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyReportTests.OPEN_BUGS, []);
      fixture.answer("/issues", { number: 43 });

      assert.equal(await new NightlyReport(fixture, new TextOutputFixture(), repository.directory).runAsync(NightlyReportTests.environment(repository)), 0);

      assert.deepEqual(fixture.fields.filter(t => t.startsWith("title=")), NightlyReportTests.LEGS.map(label => `title=Nightly: ${label} › the run itself`));
    });

    test("a GitHub request that fails ends the report with exit code 1, after the summary names what it had filed and why it stopped", async t => {
      const repository = await NightlyReportTests.prepareAsync(t, NightlyReportTests.LEGS.map(label => new NightlyLegResult(label, [new NightlyFailure(`${label} › a test`, "Error", 1)])));
      const fixture = new GitHubApiFixture();
      fixture.answer(NightlyReportTests.OPEN_BUGS, [{ number: 41, title: "Nightly: Linux x64, UI workflows › a test", user: { login: "github-actions[bot]" } }]);
      fixture.answer("/issues", { number: 43 });
      fixture.fail("/issues/41/comments", "HTTP 502: Bad Gateway (HTTP 502)");
      const log = new TextOutputFixture();

      assert.equal(await new NightlyReport(fixture, log, repository.directory).runAsync(NightlyReportTests.environment(repository)), 1);

      const summary = await readFile(path.join(repository.directory, "summary.md"), "utf8");
      assert.equal(log.text, summary);
      assert.ok(summary.startsWith("Nightly repeats:\n\n- Linux x64, tests › a test: opened #43\n- Filing the nightly failures stopped: \"gh api --method POST repos/noldova-com/teamrun/issues/41/comments "));
      assert.ok(summary.endsWith("failed with exit code 1: HTTP 502: Bad Gateway (HTTP 502)\n"));
      assert.deepEqual(fixture.writes, ["POST /issues", "POST /issues/41/comments"]);
    });

    test("an error that isn't a failed GitHub request is not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      await assert.rejects(new NightlyReport(new GitHubApiFixture(), new TextOutputFixture(), repository.directory).runAsync(NightlyReportTests.environment(repository)), /No answer recorded/u);
    });

    test("a result that isn't a job's result is not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "_build/nightly/results/linux-x64-tests.json": "{" });

      await assert.rejects(new NightlyReport(new GitHubApiFixture(), new TextOutputFixture(), repository.directory).runAsync(NightlyReportTests.environment(repository)), NightlyResultException);
    });

    test("a missing setting, or jobs that aren't a list of labels, fails before reading anything", async () => {
      const complete: Readonly<Record<string, string>> = {
        GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY, GITHUB_STEP_SUMMARY: "summary.md", NIGHTLY_RUN_URL: NightlyReportTests.RUN, NIGHTLY_LEGS: "[\"Linux x64, tests\"]", NIGHTLY_RESULTS: "results"
      };
      const cases: readonly Readonly<Record<string, string>>[] = [
        {},
        ...Object.keys(complete).map(t => ({ ...complete, [t]: "" })),
        { ...complete, NIGHTLY_LEGS: "[" },
        { ...complete, NIGHTLY_LEGS: "[]" },
        { ...complete, NIGHTLY_LEGS: "{}" },
        { ...complete, NIGHTLY_LEGS: "[1]" },
        { ...complete, NIGHTLY_LEGS: "[\"\"]" }
      ];
      for (const environment of cases) {
        const fixture = new GitHubApiFixture();
        const log = new TextOutputFixture();

        assert.equal(await new NightlyReport(fixture, log, "unused").runAsync(environment), 1, JSON.stringify(environment));
        assert.equal(log.text, NightlyReportTests.REQUIRED);
        assert.deepEqual(fixture.requests, []);
      }
    });

    test("the command reports the results in the working directory and terminates", async t => {
      const repository = await NightlyReportTests.prepareAsync(t, NightlyReportTests.LEGS.map(label => new NightlyLegResult(label, [])));

      const passed = spawnSync(process.execPath, [SourceTreeFixture.locateScript("nightly-report.ts")], {
        cwd: repository.directory, env: { ...process.env, ...NightlyReportTests.environment(repository) }, encoding: "utf8", timeout: 30_000
      });
      const refused = spawnSync(process.execPath, [SourceTreeFixture.locateScript("nightly-report.ts")], {
        cwd: repository.directory, env: { ...process.env, ...NightlyReportTests.environment(repository), NIGHTLY_LEGS: "" }, encoding: "utf8", timeout: 30_000
      });

      assert.equal(passed.status, 0, passed.stderr);
      assert.equal(passed.stdout, "Nightly repeats:\n\n- Every job passed.\n");
      assert.equal(refused.status, 1, refused.stderr);
      assert.equal(refused.stdout, NightlyReportTests.REQUIRED);
    });
  }

  private static async prepareAsync(t: TestContext, results: readonly NightlyLegResult[]): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(Object.fromEntries(results.map((result, index) => [`_build/nightly/results/${index}.json`, result.toJson()])));
    return repository;
  }

  private static environment(repository: RepositoryFixture): Readonly<Record<string, string>> {
    return {
      GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY,
      GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"),
      NIGHTLY_RUN_URL: NightlyReportTests.RUN,
      NIGHTLY_LEGS: JSON.stringify(NightlyReportTests.LEGS),
      NIGHTLY_RESULTS: "_build/nightly/results"
    };
  }
}

NightlyReportTests.register();
