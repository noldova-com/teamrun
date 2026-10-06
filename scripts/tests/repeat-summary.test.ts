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

import RepeatSummary from "../repeat-summary.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class RepeatSummaryTests {
  private static readonly REPORT: string = "_build/ui/report.json";
  private static readonly LEG: string = "macOS ARM64, 5 passes, shard 2 of 2";
  private static readonly OUT_OF_TIME: string = JSON.stringify({
    suites: [{ title: "quit.spec.ts", specs: [{ title: "quits", tests: [{ status: "expected", results: [{ status: "passed" }] }, { status: "skipped", results: [] }] }] }],
    errors: [{ message: "Timed out waiting 2520s for the test suite to run" }]
  });

  public static register(): void {
    test("a run out of time is summarized and annotated as such", async t => {
      const folder = await RepeatSummaryTests.createAsync(t, { [RepeatSummaryTests.REPORT]: RepeatSummaryTests.OUT_OF_TIME });
      const log = new TextOutputFixture();

      assert.equal(await new RepeatSummary(folder.directory, log).runAsync(RepeatSummaryTests.environment(folder)), 0);

      const summary = `### Repeat (${RepeatSummaryTests.LEG})\n\n1 UI tests passed, 0 failed, 0 were skipped and 1 did not finish.\n\n` +
        "The repeat ran out of time: Playwright stopped it at its global timeout, before the job's time limit, so the tests that did not finish are not failures.\n";
      assert.equal(await readFile(path.join(folder.directory, "summary.md"), "utf8"), summary);
      assert.equal(log.text, `${summary}::error title=The repeat ran out of time::${RepeatSummaryTests.LEG} ran out of time after 1 passing and 0 failing UI tests; 1 did not finish.\n`);
    });

    test("no report says the UI workflows stopped before Playwright ran them, and missing settings fail with the reason", async t => {
      const folder = await RepeatSummaryTests.createAsync(t, {});
      const log = new TextOutputFixture();
      const refused = new TextOutputFixture();

      assert.equal(await new RepeatSummary(folder.directory, log).runAsync(RepeatSummaryTests.environment(folder)), 0);
      assert.equal(await new RepeatSummary(folder.directory, refused).runAsync({ GITHUB_STEP_SUMMARY: "", REPEAT_LEG: RepeatSummaryTests.LEG }), 1);
      assert.equal(await new RepeatSummary(folder.directory, refused).runAsync({ GITHUB_STEP_SUMMARY: path.join(folder.directory, "summary.md") }), 1);

      const summary = `### Repeat (${RepeatSummaryTests.LEG})\n\nThe UI workflows left no report, so they stopped before Playwright ran them; the job's log has the details.\n`;
      assert.equal(log.text, summary);
      assert.equal(await readFile(path.join(folder.directory, "summary.md"), "utf8"), summary);
      assert.equal(refused.text, "GITHUB_STEP_SUMMARY and REPEAT_LEG must name the step summary file and the repeat job.\n".repeat(2));
    });

    test("the command summarizes the working directory's report from its environment and terminates", async t => {
      const folder = await RepeatSummaryTests.createAsync(t, { [RepeatSummaryTests.REPORT]: RepeatSummaryTests.OUT_OF_TIME });

      const summarized = spawnSync(process.execPath, [SourceTreeFixture.locateScript("repeat-summary.ts")],
        { cwd: folder.directory, env: { ...process.env, ...RepeatSummaryTests.environment(folder) }, encoding: "utf8", timeout: 10_000 });

      assert.equal(summarized.status, 0, summarized.stderr);
      assert.ok(summarized.stdout.endsWith("1 did not finish.\n"));
    });
  }

  private static environment(folder: RepositoryFixture): Record<string, string> {
    return { GITHUB_STEP_SUMMARY: path.join(folder.directory, "summary.md"), REPEAT_LEG: RepeatSummaryTests.LEG };
  }

  private static async createAsync(t: TestContext, files: Readonly<Record<string, string>>): Promise<RepositoryFixture> {
    const folder = await RepositoryFixture.createAsync();
    t.after(() => folder.disposeAsync());
    await folder.writeAsync(files);
    return folder;
  }
}

RepeatSummaryTests.register();
