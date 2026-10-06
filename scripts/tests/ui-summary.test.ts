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

import FlakyRecord from "../checks/flaky-record.ts";
import FlakyTest from "../checks/flaky-test.ts";
import ProcessResult from "../processes/process-result.ts";
import UiSummary from "../ui-summary.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class UiSummaryTests {
  private static readonly WORKFLOWS: string = "src/shell/desktop/tests/e2e";
  private static readonly PASSED: object = { expectedStatus: "passed", status: "expected", results: [{ status: "passed" }] };
  private static readonly LISTED: object = { expectedStatus: "passed", results: [] };
  private static readonly LIST_ARGUMENTS: readonly string[] = ["test", "--config", "src/shell/desktop/tests/e2e/playwright.config.ts", "--list", "--reporter=json"];
  private static readonly SPEC_FILES: Readonly<Record<string, string>> = { "src/shell/desktop/tests/e2e/a.spec.ts": "", "src/shell/desktop/tests/e2e/b.spec.ts": "" };

  public static register(): void {
    test("the summary lists the workflows, records the shard's totals and goes to the step summary and the log, with the screenshot link", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);
      const summaryPath = path.join(repository.directory, "summary.md");
      const log = new TextOutputFixture();
      const runner = UiSummaryTests.listing(repository);

      const exitCode = await new UiSummary(repository.directory, log, runner).runAsync({ GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Windows x64", UI_SHARD: "1/2", SCREENSHOT_URL: "https://example.com/a" });

      assert.equal(exitCode, 0);
      const summary = await readFile(summaryPath, "utf8");
      assert.ok(summary.startsWith("### UI workflows: Windows x64\n"));
      assert.ok(summary.includes("| UI workflows | 2 | 1 | 1 | 0 | 0 | 1 | 0 | Not measured |\n\nDuration 4.0 s, 0 platform log lines.\n"));
      assert.ok(summary.endsWith("[Main window screenshot](https://example.com/a)\n"));
      assert.equal(log.text, summary);
      assert.deepEqual(runner.captured, [[process.execPath, repository.directory, path.join(repository.directory, "node_modules", "playwright", "cli.js"), "test", "--config", `${UiSummaryTests.WORKFLOWS}/playwright.config.ts`, "--list", "--reporter=json"]]);
      const record = JSON.parse(await readFile(path.join(repository.directory, "_build", "totals", "ui.json"), "utf8"));
      assert.deepEqual([record.runner, record.title, record.discovered, record.executed, record.unselected, record.files], ["ui", "UI workflows", 2, 1, 1, [`${UiSummaryTests.WORKFLOWS}/a.spec.ts`]]);
      assert.deepEqual([record.shard, record.expected, record.rerunPassed], ["1/2", [`${UiSummaryTests.WORKFLOWS}/a.spec.ts`, `${UiSummaryTests.WORKFLOWS}/b.spec.ts`], 0]);
    });

    test("a shard of a grep run lists the workflows again with the grep, so the totals expect only the files it selects", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);
      const selected = UiSummaryTests.report(repository, [{ title: "a.spec.ts", specs: [UiSummaryTests.spec("a.spec.ts", "docks", UiSummaryTests.LISTED)] }]);
      const runner = new ProcessRunnerFixture([], [new ProcessResult(0, UiSummaryTests.list(repository), ""), new ProcessResult(0, selected, "")]);

      const exitCode = await new UiSummary(repository.directory, new TextOutputFixture(), runner).runAsync({ GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), UI_TARGET: "Windows x64", UI_SHARD: "1/1", GREP: "@smoke" });

      assert.equal(exitCode, 0);
      assert.deepEqual(runner.captured.map(t => t.slice(3)), [UiSummaryTests.LIST_ARGUMENTS, [...UiSummaryTests.LIST_ARGUMENTS, "--grep", "@smoke"]]);
      const record = JSON.parse(await readFile(path.join(repository.directory, "_build", "totals", "ui.json"), "utf8"));
      assert.deepEqual([record.shard, record.discovered, record.expected], ["1/1", 2, [`${UiSummaryTests.WORKFLOWS}/a.spec.ts`]]);
    });

    test("a run of every workflow without shards fails for each listed file it has no result for", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);
      const log = new TextOutputFixture();

      const exitCode = await new UiSummary(repository.directory, log, UiSummaryTests.listing(repository)).runAsync({ GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), UI_TARGET: "Linux x64" });

      assert.equal(exitCode, 1);
      assert.ok(log.text.endsWith(`\nUI workflows have no result for these files:\n  ${UiSummaryTests.WORKFLOWS}/b.spec.ts\n`), log.text);
      assert.equal(JSON.parse(await readFile(path.join(repository.directory, "_build", "totals", "ui.json"), "utf8")).shard, null);
    });

    test("the tests that passed only on retry count as failed, with a note, and go to the flaky test record, the log and the step summary", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);
      const flaky = { expectedStatus: "passed", status: "flaky", results: [{ status: "failed", errors: [{ message: "Error: first" }] }, { status: "passed" }] };
      await repository.writeAsync({ "_build/ui/report.json": UiSummaryTests.report(repository, [{ title: "a.spec.ts", specs: [UiSummaryTests.spec("a.spec.ts", "docks", flaky)] }]) });
      const summaryPath = path.join(repository.directory, "summary.md");
      const log = new TextOutputFixture();

      assert.equal(await new UiSummary(repository.directory, log, UiSummaryTests.listing(repository)).runAsync({ GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Linux x64", UI_SHARD: "2/2" }), 0);

      assert.equal(JSON.parse(await readFile(path.join(repository.directory, "_build", "totals", "ui.json"), "utf8")).rerunPassed, 1);
      assert.deepEqual(FlakyRecord.parse(await readFile(path.join(repository.directory, "_build", "flaky-tests.json"), "utf8")),
        [new FlakyTest("UI workflows", `${UiSummaryTests.WORKFLOWS}/a.spec.ts`, "a.spec.ts › docks", "Error: first")]);
      assert.ok(log.text.endsWith(`Flaky, passed when run again: a.spec.ts › docks (${UiSummaryTests.WORKFLOWS}/a.spec.ts)\n`));
      const summary = await readFile(summaryPath, "utf8");
      assert.ok(summary.includes("| UI workflows | 2 | 1 | 0 | 1 (1 passed when run again; see the flaky record) | 0 | 1 | 0 | Not measured |\n"));
      assert.ok(summary.includes(`| UI workflows | a.spec.ts › docks | ${UiSummaryTests.WORKFLOWS}/a.spec.ts | Error: first |\n`));
    });

    test("the summary lists the shard's screenshot checkpoints after the totals", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);
      const record = { name: "docked", settings: null, settingsProblem: "shell.settings failed: closed.", colorScheme: "light", zoom: 1, viewport: { width: 1920, height: 1080 }, pixelRatio: 1 };
      const checkpointed = { ...UiSummaryTests.PASSED, results: [{ status: "passed", retry: 0, annotations: [{ type: "checkpoint", description: JSON.stringify(record) }] }] };
      await repository.writeAsync({ "_build/ui/report.json": UiSummaryTests.report(repository, [{ title: "a.spec.ts", specs: [UiSummaryTests.spec("a.spec.ts", "docks", checkpointed)] }]) });
      const summaryPath = path.join(repository.directory, "summary.md");

      assert.equal(await new UiSummary(repository.directory, new TextOutputFixture(), UiSummaryTests.listing(repository)).runAsync({ GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Linux x64" }), 0);

      assert.ok((await readFile(summaryPath, "utf8")).endsWith("<details><summary>Screenshot checkpoints (1)</summary>\n\n" +
        "| Workflow | Checkpoint | Theme | Mode | Fonts (interface / code) | Sizes (panel / message / code) | Zoom | Viewport | Pixel ratio |\n|---|---|---|---|---|---|---|---|---|\n" +
        "| a.spec.ts › docks | docked | Not read: shell.settings failed: closed. | light | Not read | Not read | 1 | 1920 × 1080 | 1 |\n\n</details>\n"));
    });

    test("the summary says so when the screenshot link is missing because its upload failed", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);
      const summaryPath = path.join(repository.directory, "summary.md");

      const exitCode = await new UiSummary(repository.directory, new TextOutputFixture(), UiSummaryTests.listing(repository)).runAsync({
        GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "macOS x64", UI_SHARD: "1/3", SCREENSHOT_URL: "", SCREENSHOT_UPLOAD_FAILED: "true"
      });

      assert.equal(exitCode, 0);
      assert.ok((await readFile(summaryPath, "utf8")).endsWith("\n\nNo main-window screenshot link: its upload failed.\n"));
    });

    test("a spec file Playwright lists no test for fails the summary after it is written, and the totals are still recorded", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, { ...UiSummaryTests.SPEC_FILES, "src/shell/desktop/tests/e2e/empty.spec.ts": "" });
      const summaryPath = path.join(repository.directory, "summary.md");
      const log = new TextOutputFixture();

      assert.equal(await new UiSummary(repository.directory, log, UiSummaryTests.listing(repository)).runAsync({ GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Linux x64", UI_SHARD: "1/5" }), 1);

      assert.ok(log.text.endsWith(`\nUI workflows found no tests in these files:\n  ${UiSummaryTests.WORKFLOWS}/empty.spec.ts\n`));
      assert.ok((await readFile(summaryPath, "utf8")).startsWith("### UI workflows: Linux x64\n\n| Tests |"));
      assert.deepEqual(JSON.parse(await readFile(path.join(repository.directory, "_build", "totals", "ui.json"), "utf8")).empty, [`${UiSummaryTests.WORKFLOWS}/empty.spec.ts`]);
    });

    test("a missing or malformed report, a list Playwright cannot make, or a report without the fields the totals read is summarized as a failure", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const summaryPath = path.join(repository.directory, "summary.md");
      const environment = { GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "Linux ARM64" };
      const log = new TextOutputFixture();

      assert.equal(await new UiSummary(repository.directory, log, new ProcessRunnerFixture()).runAsync(environment), 1);
      await repository.writeAsync({ "_build/ui/report.json": "{" });
      assert.equal(await new UiSummary(repository.directory, log, new ProcessRunnerFixture()).runAsync(environment), 1);
      await repository.writeAsync({ "_build/ui/report.json": JSON.stringify({ stats: { duration: 1 }, suites: [] }) });
      assert.equal(await new UiSummary(repository.directory, log, new ProcessRunnerFixture([], [new ProcessResult(1, "", "Error: broken config")])).runAsync(environment), 1);
      assert.equal(await new UiSummary(repository.directory, log, new ProcessRunnerFixture([], [new ProcessResult(0, "{}", "")])).runAsync(environment), 1);

      const messages = [
        "The UI workflows produced no report.",
        "The UI workflow report is not a Playwright JSON report.",
        "Playwright could not list the UI workflows:\nError: broken config",
        "_build/ui/report.json, config, is not a JSON object."
      ];
      assert.equal(await readFile(summaryPath, "utf8"), messages.map(t => `### UI workflows: Linux ARM64\n\n${t}\n`).join(""));
      assert.equal(log.text, messages.map(t => `${t}\n`).join(""));
    });

    test("a missing summary file or target fails before reading the report", async () => {
      for (const environment of [{}, { GITHUB_STEP_SUMMARY: "", UI_TARGET: "Linux x64" }, { GITHUB_STEP_SUMMARY: "summary.md" }, { GITHUB_STEP_SUMMARY: "summary.md", UI_TARGET: "" }]) {
        const log = new TextOutputFixture();

        assert.equal(await new UiSummary("unused", log, new ProcessRunnerFixture()).runAsync(environment), 1);
        assert.equal(log.text, "GITHUB_STEP_SUMMARY and UI_TARGET must name the step summary file and the target.\n");
      }
    });

    test("an unwritable summary file is not hidden", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);

      await assert.rejects(new UiSummary(repository.directory, new TextOutputFixture(), UiSummaryTests.listing(repository)).runAsync({ GITHUB_STEP_SUMMARY: repository.directory, UI_TARGET: "Linux x64" }));
    });

    test("the command lists the workflows with the repository's Playwright, summarizes the working directory's report and terminates", async t => {
      const repository = await UiSummaryTests.createRepositoryAsync(t, UiSummaryTests.SPEC_FILES);
      await repository.writeAsync({ "node_modules/playwright/cli.js": `process.stdout.write(${JSON.stringify(UiSummaryTests.list(repository))});\n` });
      const summaryPath = path.join(repository.directory, "summary.md");

      const result = spawnSync(process.execPath, [SourceTreeFixture.locateScript("ui-summary.ts")], {
        cwd: repository.directory,
        env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath, UI_TARGET: "macOS x64", UI_SHARD: "1/3", GREP: "", SCREENSHOT_URL: "" },
        encoding: "utf8",
        timeout: 30_000
      });

      assert.equal(result.status, 0, result.stderr);
      assert.ok((await readFile(summaryPath, "utf8")).includes("| UI workflows | 2 | 1 | 1 | 0 | 0 | 1 | 0 | Not measured |"));
    });
  }

  private static listing(repository: RepositoryFixture): ProcessRunnerFixture {
    return new ProcessRunnerFixture([], [new ProcessResult(0, UiSummaryTests.list(repository), "")]);
  }

  private static list(repository: RepositoryFixture): string {
    return UiSummaryTests.report(repository, [
      { title: "a.spec.ts", specs: [UiSummaryTests.spec("a.spec.ts", "docks", UiSummaryTests.LISTED)] },
      { title: "b.spec.ts", specs: [UiSummaryTests.spec("b.spec.ts", "undocks", UiSummaryTests.LISTED)] }
    ]);
  }

  private static report(repository: RepositoryFixture, suites: readonly object[]): string {
    const testDir = path.join(repository.directory, ...UiSummaryTests.WORKFLOWS.split("/"));
    return JSON.stringify({ config: { rootDir: testDir, projects: [{ testDir, testMatch: ["**/*.spec.ts"], testIgnore: [] }] }, stats: { duration: 4000 }, suites });
  }

  private static spec(file: string, title: string, test: object): object {
    return { title, file, tests: [test] };
  }

  private static async createRepositoryAsync(t: TestContext, files: Readonly<Record<string, string>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ ...files, "_build/ui/report.json": UiSummaryTests.report(repository, [{ title: "a.spec.ts", specs: [UiSummaryTests.spec("a.spec.ts", "docks", UiSummaryTests.PASSED)] }]) });
    return repository;
  }
}

UiSummaryTests.register();
