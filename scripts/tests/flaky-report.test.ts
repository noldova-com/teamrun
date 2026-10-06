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

import FlakyTest from "../checks/flaky-test.ts";
import FlakyReport from "../flaky-report.ts";
import GitHubApiFixture from "./fixtures/github-api.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class FlakyReportTests {
  private static readonly RUN: string = "https://github.com/noldova-com/teamrun/actions/runs/7";
  private static readonly OPEN_BUGS: string = "/issues?state=open&labels=bug&per_page=100";
  private static readonly MILESTONES: string = "/milestones?state=open&per_page=100";
  private static readonly NOW: Date = new Date("2026-10-06T01:00:00.000Z");
  private static readonly REQUIRED: string = "GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY, FLAKY_RUN_URL and FLAKY_RECORDS must describe the run.\n";

  public static register(): void {
    test("a test flaky in several jobs is one bug that names every job, and the summary lists what was filed", async t => {
      const shared = new FlakyTest("Script tests", "scripts/tests/a.test.ts", "b > shared", "failed once");
      const repository = await FlakyReportTests.prepareAsync(t, {
        "flaky-tests-windows-2025-x64-1": [shared],
        "flaky-tests-ubuntu-24.04-x64-2": [new FlakyTest("Angular tests", "shell/a.spec.ts", "A shows", "Error: first"), shared],
        "flaky-tests-ui-macos-15-arm64-3-1": [new FlakyTest("UI workflows", "src/shell/desktop/tests/e2e/c.spec.ts", "c.spec.ts › docks", "Error: c")]
      });
      await repository.writeAsync({ "_build/flaky/not-a-record/flaky-tests.json": "[]", "_build/flaky/flaky-tests-ubuntu-24.04-arm64-1/other.json": "[]" });
      const fixture = FlakyReportTests.createFixture();
      fixture.answerInTurn("/issues", [{ number: 51 }, { number: 52 }, { number: 53 }]);
      const log = new TextOutputFixture();

      const exitCode = await new FlakyReport(fixture, log, repository.directory, FlakyReportTests.NOW).runAsync(FlakyReportTests.environment(repository));

      const summary = "Flaky tests:\n\n- A shows: opened #51\n- b > shared: opened #52\n- c.spec.ts › docks: opened #53\n";
      assert.equal(exitCode, 0);
      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"), summary);
      assert.equal(log.text, summary);
      assert.ok(fixture.bodies[1]?.includes("\n- **Jobs:** ubuntu-24.04-x64, windows-2025-x64\n"));
      assert.ok(fixture.bodies[2]?.includes("\n- **Jobs:** macos-15-arm64, UI shard 3\n"));
    });

    test("a run without flaky records posts nothing and says so", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const fixture = new GitHubApiFixture();

      assert.equal(await new FlakyReport(fixture, new TextOutputFixture(), repository.directory, FlakyReportTests.NOW).runAsync(FlakyReportTests.environment(repository)), 0);

      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"), "Flaky tests:\n\n- No job recorded a flaky test.\n");
      assert.deepEqual(fixture.requests, []);
    });

    test("a record that is not a list of flaky tests fails the report before filing anything", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "_build/flaky/flaky-tests-ubuntu-24.04-x64-1/flaky-tests.json": "{}" });
      const fixture = new GitHubApiFixture();

      assert.equal(await new FlakyReport(fixture, new TextOutputFixture(), repository.directory, FlakyReportTests.NOW).runAsync(FlakyReportTests.environment(repository)), 1);

      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"),
        "Flaky tests:\n\n- The flaky test record is not a list of tests with a runner, a file, a name and a failure.\n");
      assert.deepEqual(fixture.requests, []);
    });

    test("a GitHub request that fails ends the report with exit code 1, after the summary names what it had filed and why it stopped", async t => {
      const repository = await FlakyReportTests.prepareAsync(t, { "flaky-tests-ubuntu-24.04-x64-1": [new FlakyTest("Script tests", "a", "first", "x"), new FlakyTest("Script tests", "a", "second", "y")] });
      const failing = new GitHubApiFixture();
      failing.answer(FlakyReportTests.OPEN_BUGS, [{ number: 49, title: "Flaky: second", body: "" }]);
      failing.answer(FlakyReportTests.MILESTONES, []);
      failing.answer("/issues", { number: 54 });
      failing.fail("/issues/49/comments", "gh: Server Error (HTTP 502)");

      assert.equal(await new FlakyReport(failing, new TextOutputFixture(), repository.directory, FlakyReportTests.NOW).runAsync(FlakyReportTests.environment(repository)), 1);

      assert.match(await readFile(path.join(repository.directory, "summary.md"), "utf8"), /^Flaky tests:\n\n- first: opened #54\n- Filing the flaky tests stopped: "gh api .+" failed with exit code 1: gh: Server Error \(HTTP 502\)\n$/su);
    });

    test("an error that isn't a failed GitHub request or a malformed record is not hidden", async t => {
      const repository = await FlakyReportTests.prepareAsync(t, { "flaky-tests-ubuntu-24.04-x64-1": [new FlakyTest("Script tests", "a", "first", "x")] });

      const unreadable = await RepositoryFixture.createAsync();
      t.after(() => unreadable.disposeAsync());
      await unreadable.writeAsync({ "_build/flaky/flaky-tests-ubuntu-24.04-x64-1/flaky-tests.json/inner": "" });

      await assert.rejects(new FlakyReport(new GitHubApiFixture(), new TextOutputFixture(), repository.directory, FlakyReportTests.NOW).runAsync(FlakyReportTests.environment(repository)), /No answer recorded/u);
      await assert.rejects(new FlakyReport(new GitHubApiFixture(), new TextOutputFixture(), unreadable.directory, FlakyReportTests.NOW).runAsync(FlakyReportTests.environment(unreadable)), { code: "EISDIR" });
    });

    test("a job's label comes from its artifact's name without the attempt, naming the UI shard", () => {
      assert.deepEqual(
        ["flaky-tests-ubuntu-24.04-x64-1", "flaky-tests-ui-windows-2025-x64-2-3", "flaky-tests-x64", "other-1"].map(t => FlakyReport.labelOf(t)),
        ["ubuntu-24.04-x64", "windows-2025-x64, UI shard 2", null, null]);
    });

    test("a missing setting fails before reading anything", async () => {
      const complete = { GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY, GITHUB_STEP_SUMMARY: "summary.md", FLAKY_RUN_URL: FlakyReportTests.RUN, FLAKY_RECORDS: "records" };

      for (const environment of [{}, ...Object.keys(complete).map(t => ({ ...complete, [t]: "" }))]) {
        const fixture = new GitHubApiFixture();
        const log = new TextOutputFixture();

        assert.equal(await new FlakyReport(fixture, log, "unused", FlakyReportTests.NOW).runAsync(environment), 1);
        assert.equal(log.text, FlakyReportTests.REQUIRED);
        assert.deepEqual(fixture.requests, []);
      }
    });

    test("the command reports the records in the working directory and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      const passed = spawnSync(process.execPath, [SourceTreeFixture.locateScript("flaky-report.ts")], {
        cwd: repository.directory, env: { ...process.env, ...FlakyReportTests.environment(repository) }, encoding: "utf8", timeout: 30_000
      });
      const refused = spawnSync(process.execPath, [SourceTreeFixture.locateScript("flaky-report.ts")], {
        cwd: repository.directory, env: { ...process.env, ...FlakyReportTests.environment(repository), FLAKY_RECORDS: "" }, encoding: "utf8", timeout: 30_000
      });

      assert.equal(passed.status, 0, passed.stderr);
      assert.equal(passed.stdout, "Flaky tests:\n\n- No job recorded a flaky test.\n");
      assert.equal(refused.status, 1, refused.stderr);
      assert.equal(refused.stdout, FlakyReportTests.REQUIRED);
    });
  }

  private static async prepareAsync(t: TestContext, records: Readonly<Record<string, readonly FlakyTest[]>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(Object.fromEntries(Object.entries(records).map(([artifact, tests]) => [`_build/flaky/${artifact}/flaky-tests.json`, JSON.stringify(tests)])));
    return repository;
  }

  private static createFixture(): GitHubApiFixture {
    const fixture = new GitHubApiFixture();
    fixture.answer(FlakyReportTests.OPEN_BUGS, []);
    fixture.answer(FlakyReportTests.MILESTONES, []);
    return fixture;
  }

  private static environment(repository: RepositoryFixture): Readonly<Record<string, string>> {
    return {
      GITHUB_REPOSITORY: GitHubApiFixture.REPOSITORY,
      GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"),
      FLAKY_RUN_URL: FlakyReportTests.RUN,
      FLAKY_RECORDS: "_build/flaky"
    };
  }
}

FlakyReportTests.register();
