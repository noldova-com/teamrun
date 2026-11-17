/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { AngularProject } from "./angular/angular-project.ts";
import { AngularTestCheck } from "./checks/angular-test-check.ts";
import { ArchiveReuseCheck } from "./checks/archive-reuse-check.ts";
import { CdkCopyRules } from "./checks/cdk-copy-rules.ts";
import { ChildStage } from "./checks/child-stage.ts";
import { CommentCheck } from "./checks/comment-check.ts";
import { CopyListCheck } from "./checks/copy-list-check.ts";
import { DependencyPinCheck } from "./checks/dependency-pin-check.ts";
import { DocumentCheck } from "./checks/document-check.ts";
import { FieldOrderCheck } from "./checks/field-order-check.ts";
import { FlakyRecord } from "./checks/flaky-record.ts";
import type { FlakyTest } from "./checks/flaky-test.ts";
import { GitHubConfigurationCheck } from "./checks/github-configuration-check.ts";
import { GlobalMockCheck } from "./checks/global-mock-check.ts";
import { LicenseHeaderCheck } from "./checks/license-header-check.ts";
import type { ICheck } from "./checks/interfaces/i-check.ts";
import type { ISelectableCheck } from "./checks/interfaces/i-selectable-check.ts";
import { OnPushCheck } from "./checks/on-push-check.ts";
import { PackageCheck } from "./checks/package-check.ts";
import { PackageTestCheck } from "./checks/package-test-check.ts";
import { ReadingChecks } from "./checks/reading-checks.ts";
import { ReadingFilterCheck } from "./checks/reading-filter-check.ts";
import { ScriptTestCheck } from "./checks/script-test-check.ts";
import { TestWaitCheck } from "./checks/test-wait-check.ts";
import { TypeCheck } from "./checks/type-check.ts";
import { VersionFileCheck } from "./checks/version-file-check.ts";
import { PackageBuild } from "./packages/package-build.ts";
import { ProcessRunner } from "./processes/process-runner.ts";
import { Git } from "./repository/git.ts";
import { RepositoryFiles } from "./repository/repository-files.ts";
import { TestOptions } from "./test-options.ts";
import { TestOptionsException } from "./test-options.exception.ts";
import { NpmCommand } from "./toolchain/npm-command.ts";
import { RunnerTotals } from "./totals/runner-totals.ts";

export class Test {
  private static readonly USAGE: string = "Usage: npm test [-- documents | angular | [--filter <text>]... [--repeat <count>] [--rerun-failed] [--skip-test-details] [--skip-coverage-details]]\n";
  private static readonly SEPARATE_VARIABLE: string = "NOLDOVA_SEPARATE_TEST";
  private static readonly ANGULAR: string = "angular";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly SUMMARY_HEADER: string = "| Check | Result |\n|---|---|\n";
  private static readonly FILTERED_SUMMARY_HEADER: string = "| Check | Result | Unit | Discovered | Selected | Unselected |\n|---|---|---|---|---|---|\n";
  private static readonly DOCUMENTS_NOTICE: string = "Filtered run: documents. A filtered run is not the complete gate.\n";
  private static readonly NO_MATCH: string = "No test matched the filters.\n";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly READING_STAGE: string = "scripts/reading-stage.ts";
  private static readonly READING_RESULTS: string = "_build/reading-checks.json";
  private static readonly READING_LOG: string = "_build/reading-checks.log";
  private static readonly READING_LIMIT_MILLISECONDS: number = 300_000;
  private static readonly RUNNERS: readonly string[] = [PackageTestCheck.RUNNER, AngularTestCheck.RUNNER];

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, output: Writable, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.runner = runner;
    this.output = output;
    this.environment = environment;
  }

  public async runAsync(selection: readonly string[]): Promise<number> {
    let options: TestOptions;
    try {
      options = TestOptions.parse(selection);
    }
    catch (error) {
      if (!(error instanceof TestOptionsException))
        throw error;
      this.output.write(`${error.message}\n${Test.USAGE}`);
      return Test.USAGE_EXIT_CODE;
    }
    const separate = this.environment[Test.SEPARATE_VARIABLE] ?? "";
    if (separate !== "" && separate !== Test.ANGULAR) {
      this.output.write(`${Test.SEPARATE_VARIABLE} names the tests that run in a job of their own, which npm test leaves out; it takes only ${Test.ANGULAR}, not ${JSON.stringify(separate)}.\n${Test.USAGE}`);
      return Test.USAGE_EXIT_CODE;
    }
    if (options.isDocuments)
      return await this.runChecksAsync([this.createDocumentChecks()], Test.DOCUMENTS_NOTICE, null, null);
    if (options.isAngular)
      return await this.runChecksAsync([[new AngularTestCheck(new AngularProject(this.root, this.runner), null)]], null, null, null);

    const flaky = options.isRerunningFailed ? new FlakyRecord(this.root, this.environment) : null;
    await flaky?.clearAsync();

    for (let run = 1; run <= options.repeat; run++) {
      if (options.repeat > 1)
        this.output.write(`\nRun ${run} of ${options.repeat}\n`);
      const exitCode = options.filters.length === 0
        ? await this.runChecksAsync(await this.createChecksAsync(flaky, options), null, flaky, this.createReadingStage())
        : await this.runFilteredAsync(options, flaky);
      if (exitCode !== 0) {
        if (options.repeat > 1)
          this.output.write(`\nRun ${run} of ${options.repeat} failed; the repeats stop there.\n`);
        return exitCode;
      }
    }
    if (options.repeat > 1)
      this.output.write(`\nAll ${options.repeat} runs passed.\n`);
    return 0;
  }

  public async runReadingStageAsync(results: string): Promise<number> {
    const [reading] = await this.createChecksAsync(null, TestOptions.parse([]));
    await writeFile(results, JSON.stringify(await Test.runStageAsync(reading ?? [], this.output)));
    return 0;
  }

  private static async runStageAsync(stage: readonly ICheck[], output: Writable): Promise<readonly boolean[]> {
    const results: boolean[] = [];
    for (const check of stage) {
      output.write(`\n${check.title}\n`);
      const passed = await check.runAsync(output);
      output.write(`${check.title}: ${passed ? "passed" : "failed"}\n`);
      results.push(passed);
    }
    return results;
  }

  private createReadingStage(): ChildStage {
    return new ChildStage(this.root, this.runner, path.join(this.root, Test.READING_STAGE), path.join(this.root, Test.READING_RESULTS), path.join(this.root, Test.READING_LOG),
      Test.READING_LIMIT_MILLISECONDS);
  }

  private async runChecksAsync(stages: readonly (readonly ICheck[])[], notice: string | null, flaky: FlakyRecord | null, reading: ChildStage | null): Promise<number> {
    if (notice !== null)
      this.output.write(notice);
    const earlier = (await flaky?.readAsync())?.length ?? 0;

    await RunnerTotals.clearAsync(this.root);
    const checks = stages.flat();
    let summary = Test.SUMMARY_HEADER;
    let failures = 0;
    let ran = 0;
    for (const [index, stage] of stages.entries()) {
      if (failures > 0)
        break;
      const titles = stage.map(t => t.title);
      const results = index === 0 && reading !== null ? await reading.runAsync(titles, this.output) : await Test.runStageAsync(stage, this.output);
      for (const [position, title] of titles.entries()) {
        const passed = results[position] === true;
        summary += `| ${title} | ${passed ? "Passed" : "Failed"} |\n`;
        ran++;
        if (!passed)
          failures++;
      }
    }
    const stopped = checks.slice(ran);
    if (stopped.length > 0) {
      this.output.write(`\nStopped before the ${stopped.length} checks that build, compile or run tests, because a check above failed: ${stopped.map(t => t.title).join(", ")}.\n`);
      summary += stopped.map(t => `| ${t.title} | Not run |\n`).join("");
    }

    const rerunPassed = Test.countByRunner((await flaky?.readAsync() ?? []).slice(earlier));
    const totals = (await RunnerTotals.readAllAsync(this.root, Test.RUNNERS)).map(t => t.withRerunPassed(rerunPassed.get(t.title) ?? 0));
    if (totals.length > 0) {
      for (const runner of totals)
        await runner.writeAsync(this.root);
      this.output.write(`\nTest totals\n${totals.map(t => t.formatLine()).join("")}`);
      summary += `\n${RunnerTotals.formatTable(totals)}`;
    }
    this.output.write(`\n${ran - failures} of ${checks.length} checks passed.\n`);
    await this.writeSummaryAsync(summary);
    return failures === 0 ? 0 : 1;
  }

  private async writeSummaryAsync(summary: string): Promise<void> {
    const summaryPath = this.environment[Test.SUMMARY_VARIABLE];
    if (summaryPath !== undefined)
      await appendFile(summaryPath, summary);
  }

  private async runFilteredAsync(options: TestOptions, flaky: FlakyRecord | null): Promise<number> {
    const filters = options.filters;
    this.output.write(`Filtered run: ${filters.map(t => JSON.stringify(t)).join(", ")}. A filtered run is not the complete gate.\n`);
    const checks = await this.createSelectableChecksAsync(flaky, options);

    let summary = `Filters: ${filters.map(t => Test.formatSummaryFilter(t)).join(" ")}\n\n${Test.FILTERED_SUMMARY_HEADER}`;
    let failures = 0;
    let selected = 0;
    for (const check of checks) {
      this.output.write(`\n${check.title}\n`);
      const selection = await check.runSelectedAsync(filters, this.output);
      const result = !selection.isPassing ? "Failed" : selection.selected === 0 ? "None selected" : "Passed";
      this.output.write(`${check.title}: ${result.toLowerCase()}; ${selection.selected} of ${selection.discovered} ${selection.unit} selected, ${selection.unselected} not selected.\n`);
      summary += `| ${check.title} | ${result} | ${selection.unit} | ${selection.discovered} | ${selection.selected} | ${selection.unselected} |\n`;
      selected += selection.selected;
      if (!selection.isPassing)
        failures++;
    }
    if (failures === 0 && selected === 0) {
      this.output.write(Test.NO_MATCH);
      summary += `\n${Test.NO_MATCH}`;
      failures++;
    }

    this.output.write(`\n${checks.length - failures} of ${checks.length} checks passed.\n`);
    await this.writeSummaryAsync(summary);
    return failures === 0 ? 0 : 1;
  }

  private static formatSummaryFilter(filter: string): string {
    return `<code>${filter.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;")}</code>`;
  }

  private static countByRunner(tests: readonly FlakyTest[]): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    for (const test of tests)
      counts.set(test.runner, (counts.get(test.runner) ?? 0) + 1);
    return counts;
  }

  private createDocumentChecks(): readonly ICheck[] {
    return [new DocumentCheck(this.root, new RepositoryFiles(this.root, new Git(this.root, this.runner)))];
  }

  private async createChecksAsync(flaky: FlakyRecord | null, options: TestOptions): Promise<readonly (readonly ICheck[])[]> {
    const reading = await this.createReadingChecksAsync(new RepositoryFiles(this.root, new Git(this.root, this.runner)));
    const build = new PackageBuild(this.root, this.runner, this.environment);
    const building: readonly ICheck[] = [
      new CdkCopyRules(this.runner, this.environment),
      new PackageCheck(build),
      new ArchiveReuseCheck(async () => await build.hashArchivesAsync(), async (names, output) => await build.rebuildAsync(names, output)),
      new CopyListCheck(this.root, async () => await new NpmCommand(this.runner, this.environment).runAsync(CopyListCheck.LIST_ARGUMENTS, this.root),
        async () => await build.readArchivesAsync()),
      new PackageTestCheck(this.root, build, this.runner, this.environment, flaky, options),
      ...this.environment[Test.SEPARATE_VARIABLE] === Test.ANGULAR ? [] : [new AngularTestCheck(new AngularProject(this.root, this.runner), flaky)],
      new TypeCheck(this.root, this.runner),
      new ScriptTestCheck(this.root, this.runner)
    ];
    return [reading, building];
  }

  private async createSelectableChecksAsync(flaky: FlakyRecord | null, options: TestOptions): Promise<readonly ISelectableCheck[]> {
    return [
      new ReadingChecks(await this.createReadingChecksAsync(new RepositoryFiles(this.root, new Git(this.root, this.runner)))),
      new PackageTestCheck(this.root, new PackageBuild(this.root, this.runner, this.environment), this.runner, this.environment, flaky, options),
      new AngularTestCheck(new AngularProject(this.root, this.runner), flaky)
    ];
  }

  private async createReadingChecksAsync(files: RepositoryFiles): Promise<readonly ICheck[]> {
    const { BucketNameCheck } = await import("./checks/bucket-name-check.ts");
    const { ConceptFileCheck } = await import("./checks/concept-file-check.ts");
    const { ConceptFolderCheck } = await import("./checks/concept-folder-check.ts");
    const { EnumValueCheck } = await import("./checks/enum-value-check.ts");
    const { InterfaceNameCheck } = await import("./checks/interface-name-check.ts");
    const { PagesBoundaryCheck } = await import("./checks/pages-boundary-check.ts");
    const { SyntaxTreeReader } = await import("./structure/syntax-tree.reader.ts");
    const syntax = new SyntaxTreeReader(this.root);
    return [
      new DocumentCheck(this.root, files),
      new LicenseHeaderCheck(this.root, files),
      new CommentCheck(this.root, files),
      new TestWaitCheck(this.root, files),
      new GlobalMockCheck(this.root, files),
      new FieldOrderCheck(this.root, files),
      new ReadingFilterCheck(async () => await this.createChecksAsync(null, TestOptions.parse([])), async () => await this.createSelectableChecksAsync(null, TestOptions.parse([]))),
      new BucketNameCheck(files, syntax),
      new InterfaceNameCheck(files, syntax),
      new EnumValueCheck(files, syntax),
      new ConceptFileCheck(this.root, files, syntax),
      new ConceptFolderCheck(files, syntax),
      new PagesBoundaryCheck(async () => await files.listAsync(), syntax),
      new GitHubConfigurationCheck(this.root, files),
      new DependencyPinCheck(this.root, files),
      new OnPushCheck(this.root, async () => await files.listAsync()),
      new VersionFileCheck(this.root)
    ];
  }
}

if (import.meta.main)
  process.exitCode = await new Test(process.cwd(), new ProcessRunner(), process.stdout, process.env).runAsync(process.argv.slice(2));
