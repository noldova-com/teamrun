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

import FlakyRecord from "../checks/flaky-record.ts";
import FlakyTest from "../checks/flaky-test.ts";
import UiSummary from "../ui-summary.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class UiSummaryTests {
  private static readonly REPORT: string = JSON.stringify({ stats: { expected: 5, unexpected: 0, flaky: 0, skipped: 0, duration: 4000 }, suites: [] });

  public static register(): void {
    test("the report's summary goes to the step summary and the log, with the screenshot link", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "_build/ui/report.json": UiSummaryTests.REPORT });
      const summaryPath = path.join(repository.directory, "summary.md");
      const log = new TextOutputFixture();

      const exitCode = await new UiSummary(repository.directory, log).runAsync({ GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Windows x64", SCREENSHOT_URL: "https://example.com/a" });

      assert.equal(exitCode, 0);
      const summary = await readFile(summaryPath, "utf8");
      assert.ok(summary.startsWith("### UI workflows: Windows x64\n"));
      assert.ok(summary.endsWith("[Main window screenshot](https://example.com/a)\n"));
      assert.equal(log.text, summary);
    });

    test("the tests that passed only on retry go to the flaky test record, the log and the step summary", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const report = { stats: { expected: 1, unexpected: 0, flaky: 1, skipped: 0, duration: 4000 }, suites: [{ title: "a.spec.ts", specs: [{ title: "docks", file: "a.spec.ts", tests: [{ status: "flaky", results: [{ errors: [{ message: "Error: first" }] }] }] }] }] };
      await repository.writeAsync({ "_build/ui/report.json": JSON.stringify(report) });
      const summaryPath = path.join(repository.directory, "summary.md");
      const log = new TextOutputFixture();

      assert.equal(await new UiSummary(repository.directory, log).runAsync({ GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Linux x64" }), 0);

      assert.deepEqual(FlakyRecord.parse(await readFile(path.join(repository.directory, "_build", "flaky-tests.json"), "utf8")),
        [new FlakyTest("UI workflows", "src/shell/desktop/tests/e2e/a.spec.ts", "a.spec.ts › docks", "Error: first")]);
      assert.ok(log.text.endsWith("Flaky, passed when run again: a.spec.ts › docks (src/shell/desktop/tests/e2e/a.spec.ts)\n"));
      assert.ok((await readFile(summaryPath, "utf8")).includes("| UI workflows | a.spec.ts › docks | src/shell/desktop/tests/e2e/a.spec.ts | Error: first |\n"));
    });

    test("the summary says so when the screenshot link is missing because its upload failed", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "_build/ui/report.json": UiSummaryTests.REPORT });
      const summaryPath = path.join(repository.directory, "summary.md");

      const exitCode = await new UiSummary(repository.directory, new TextOutputFixture()).runAsync({
        GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "macOS x64", SCREENSHOT_URL: "", SCREENSHOT_UPLOAD_FAILED: "true"
      });

      assert.equal(exitCode, 0);
      assert.ok((await readFile(summaryPath, "utf8")).endsWith("\n\nNo main-window screenshot link: its upload failed.\n"));
    });

    test("a missing or malformed report is summarized as a failure", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const summaryPath = path.join(repository.directory, "summary.md");
      const environment = { GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Linux ARM64" };
      const log = new TextOutputFixture();

      assert.equal(await new UiSummary(repository.directory, log).runAsync(environment), 1);
      await repository.writeAsync({ "_build/ui/report.json": "{" });
      assert.equal(await new UiSummary(repository.directory, log).runAsync(environment), 1);

      assert.equal(await readFile(summaryPath, "utf8"),
        "### UI workflows: Linux ARM64\n\nThe UI workflows produced no report.\n### UI workflows: Linux ARM64\n\nThe UI workflow report is not a Playwright JSON report.\n");
      assert.equal(log.text, "The UI workflows produced no report.\nThe UI workflow report is not a Playwright JSON report.\n");
    });

    test("a missing summary file or target fails before reading the report", async () => {
      for (const environment of [{}, { GITHUB_STEP_SUMMARY: "", UI_TARGET: "Linux x64" }, { GITHUB_STEP_SUMMARY: "summary.md" }, { GITHUB_STEP_SUMMARY: "summary.md", UI_TARGET: "" }]) {
        const log = new TextOutputFixture();

        assert.equal(await new UiSummary("unused", log).runAsync(environment), 1);
        assert.equal(log.text, "GITHUB_STEP_SUMMARY and UI_TARGET must name the step summary file and the target.\n");
      }
    });

    test("an unwritable summary file is not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "_build/ui/report.json": UiSummaryTests.REPORT });

      await assert.rejects(new UiSummary(repository.directory, new TextOutputFixture()).runAsync({ GITHUB_STEP_SUMMARY: repository.directory, UI_TARGET: "Linux x64" }));
    });

    test("the command summarizes the working directory's report and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "_build/ui/report.json": UiSummaryTests.REPORT });
      const summaryPath = path.join(repository.directory, "summary.md");

      const result = spawnSync(process.execPath, [SourceTreeFixture.locateScript("ui-summary.ts")], {
        cwd: repository.directory,
        env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "macOS x64", SCREENSHOT_URL: "" },
        encoding: "utf8",
        timeout: 30_000
      });

      assert.equal(result.status, 0, result.stderr);
      assert.ok((await readFile(summaryPath, "utf8")).includes("| 5 | 0 | 0 | 0 | 4.0 s | 0 |"));
    });
  }
}

UiSummaryTests.register();
