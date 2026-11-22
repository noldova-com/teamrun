/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, openSync, writeSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { DiscoveredTestClass, DiscoveredTestMethod, TestClassResult, TestConsoleReporter, TestRunResult } from "@noldova/context.testing";

import { PackageTestProject } from "./package-test-project.ts";
import type { PackageTestProgress } from "./package-test-progress.ts";

export class PackageTestEntry {
  public static readonly FILTERS_VARIABLE: string = "NOLDOVA_TEST_FILTERS";
  public static readonly RESULT_VARIABLE: string = "NOLDOVA_TEST_RESULT_FILE";
  public static readonly RESULTS_VARIABLE: string = "NOLDOVA_TEST_RESULTS_FILE";
  public static readonly PROGRESS_VARIABLE: string = "NOLDOVA_TEST_PROGRESS_FILE";
  public static readonly CLAIMS_VARIABLE: string = "NOLDOVA_TEST_CLAIMS";
  public static readonly ISOLATED_VARIABLE: string = "NOLDOVA_TEST_ISOLATED";
  public static readonly ALONE_VARIABLE: string = "NOLDOVA_TEST_ALONE";
  public static readonly COVERAGE_VARIABLE: string = "NODE_V8_COVERAGE";
  public static readonly BUDGET_VARIABLE: string = "NOLDOVA_TEST_BUDGET";
  public static readonly SKIP_DETAILS_VARIABLE: string = "NOLDOVA_TEST_SKIP_DETAILS";
  public static readonly PROCESS_LISTING_CATEGORY: string = "ProcessListing";
  public static readonly PROCESS_LISTING_TIMEOUT_MILLISECONDS: number = 75_000;

  private static readonly TIMEOUT_MILLISECONDS: number = 30_000;
  private static readonly FILTERS_INVALID: string = `${PackageTestEntry.FILTERS_VARIABLE} must hold a JSON list of filter texts.`;
  private static readonly ISOLATED_INVALID: string = `${PackageTestEntry.ISOLATED_VARIABLE} must hold a JSON list of test files.`;
  private static readonly PAIRS_INVALID: string = "The package test entry takes pairs of a package name and its compiled tests' folder.";
  private static readonly FAILURE_SEPARATOR: string = "\n";
  private static readonly SHUTDOWN_GRACE_MILLISECONDS: number = 1000;
  private static readonly STANDARD_ERROR: number = 2;
  private static readonly FAILED_EXIT_CODE: number = 1;
  private static readonly CLAIM_FLAGS: string = "wx";
  private static readonly CLAIMED_CODE: string = "EEXIST";

  private readonly commandArguments: readonly string[];
  private readonly environment: NodeJS.ProcessEnv;
  private isStopped: boolean = false;

  public constructor(commandArguments: readonly string[], environment: NodeJS.ProcessEnv) {
    this.commandArguments = commandArguments;
    this.environment = environment;
  }

  public static formatStopped(unreached: number): string {
    return `A test exceeded its time limit, so the run stopped after it; ${unreached} ${unreached === 1 ? "test" : "tests"} not yet started count as unreached.\n`;
  }

  public static formatUnclosed(resources: readonly string[]): string {
    return resources.length === 0
      ? `The tests finished, but the process didn't exit within ${PackageTestEntry.SHUTDOWN_GRACE_MILLISECONDS} ms and Node names no open resource; a worker thread or a native handle keeps it alive.\n`
      : `The tests finished, but resources remain open: ${resources.join(", ")}.\n`;
  }

  private static countMethods(testClasses: readonly DiscoveredTestClass[]): number {
    return testClasses.reduce((total, t) => total + t.methods.length, 0);
  }

  private static exitFlushed(exitCode: number): void {
    process.stdout.write("", () => process.exit(exitCode));
  }

  private static fileOf(testClass: DiscoveredTestClass): string {
    return `${testClass.packageName}/${testClass.filePath}`;
  }

  private static groupByFile(testClasses: readonly DiscoveredTestClass[]): DiscoveredTestClass[][] {
    const groups = new Map<string, DiscoveredTestClass[]>();
    for (const testClass of testClasses) {
      const file = PackageTestEntry.fileOf(testClass);
      groups.set(file, [...groups.get(file) ?? [], testClass]);
    }
    return [...groups].sort(([t, u], [v, w]) => PackageTestEntry.countMethods(w) - PackageTestEntry.countMethods(u) || t.localeCompare(v)).map(([, t]) => t);
  }

  private static timeoutOf(method: DiscoveredTestMethod): number {
    return method.categories.includes(PackageTestEntry.PROCESS_LISTING_CATEGORY) ? PackageTestEntry.PROCESS_LISTING_TIMEOUT_MILLISECONDS
      : PackageTestEntry.TIMEOUT_MILLISECONDS;
  }

  private static async executeAsync(testing: typeof import("@noldova/context.testing"), testClasses: readonly DiscoveredTestClass[],
    progress: PackageTestProgress): Promise<TestClassResult[]> {
    const results: TestClassResult[] = [];
    for (const testClass of testClasses)
      for (const timeout of new Set(testClass.methods.map(t => PackageTestEntry.timeoutOf(t)))) {
        const methods = testClass.methods.filter(t => PackageTestEntry.timeoutOf(t) === timeout);
        const part = methods.length === testClass.methods.length ? testClass : new testing.DiscoveredTestClass(testClass.packageName, testClass.className,
          testClass.filePath, testClass.testClassConstructor, testClass.skipReason, methods, testClass.categories);
        process.env[PackageTestEntry.BUDGET_VARIABLE] = String(timeout);
        results.push(...await new testing.TestExecutor(timeout).executeAsync([part], progress, new Set(), () => progress.isStopping));
      }
    return results;
  }

  private static claim(folder: string, index: number): boolean {
    try {
      closeSync(openSync(path.join(folder, String(index)), PackageTestEntry.CLAIM_FLAGS));
      return true;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === PackageTestEntry.CLAIMED_CODE)
        return false;
      throw error;
    }
  }

  public createReporter(testing: typeof import("@noldova/context.testing"), write: (text: string) => void, isInteractive: boolean): TestConsoleReporter {
    return new testing.TestConsoleReporter(write, isInteractive, this.environment[PackageTestEntry.SKIP_DETAILS_VARIABLE] === String(true));
  }

  public async runAsync(): Promise<number> {
    const testing = await import("@noldova/context.testing");
    const { PackageTestProgress } = await import("./package-test-progress.ts");
    const reporter = this.createReporter(testing, t => process.stdout.write(t), process.stdout.isTTY === true);
    const progress = new PackageTestProgress(reporter, this.environment[PackageTestEntry.PROGRESS_VARIABLE] ?? null);
    const claims = this.environment[PackageTestEntry.CLAIMS_VARIABLE];
    let result: TestRunResult;
    let wanted: number;
    try {
      const filters = this.readList(PackageTestEntry.FILTERS_VARIABLE, PackageTestEntry.FILTERS_INVALID);
      const projects = this.readProjects().map(t => new testing.TestProject(t.name, t.folder));
      const discovered = await new testing.TestDiscovery().discoverAsync(projects);
      const selected = new testing.TestRunner(new testing.TestDiscovery(), new testing.TestExecutor(PackageTestEntry.TIMEOUT_MILLISECONDS)).select(discovered, filters);
      wanted = PackageTestEntry.countMethods(selected);
      reporter.start();
      let ran: readonly DiscoveredTestClass[] = selected;
      let classResults: TestClassResult[];
      const alone = this.environment[PackageTestEntry.ALONE_VARIABLE];
      if (alone !== undefined) {
        ran = selected.filter(t => PackageTestEntry.fileOf(t) === alone);
        classResults = await PackageTestEntry.executeAsync(testing, ran, progress);
      }
      else if (claims === undefined)
        classResults = await PackageTestEntry.executeAsync(testing, selected, progress);
      else {
        const isolated = new Set(this.readList(PackageTestEntry.ISOLATED_VARIABLE, PackageTestEntry.ISOLATED_INVALID));
        const claimed: DiscoveredTestClass[] = [];
        classResults = [];
        for (const [index, group] of PackageTestEntry.groupByFile(selected).entries()) {
          if (progress.isStopping)
            break;
          if (group.some(t => isolated.has(PackageTestEntry.fileOf(t))) || !PackageTestEntry.claim(claims, index))
            continue;
          claimed.push(...group);
          classResults.push(...await PackageTestEntry.executeAsync(testing, group, progress));
        }
        ran = claimed;
      }
      result = new testing.TestRunResult(progress.complete(classResults),
        new testing.TestSelection(filters, PackageTestEntry.countMethods(discovered), PackageTestEntry.countMethods(ran)));
    }
    catch (error) {
      reporter.stop();
      process.stderr.write(`${String(error)}\n`);
      return PackageTestEntry.FAILED_EXIT_CODE;
    }
    this.isStopped = progress.isStopping;
    const unreached = result.selection.selected - result.total;
    reporter.writeSummary(result, result.selection);
    if (this.isStopped)
      writeSync(PackageTestEntry.STANDARD_ERROR, PackageTestEntry.formatStopped(unreached));

    const methods = result.classResults.flatMap(t => t.methodResults.map(u => ({ file: `${t.packageName}/${t.filePath}`, method: u })));
    const writer = new testing.TestReportWriter();
    const failed = methods.filter(t => t.method.outcome === testing.TestOutcome.Failed)
      .map(t => ({ identity: t.method.displayName, file: t.file, failure: writer.formatMethodLines(t.method, false).slice(1).map(u => u.trim()).join(PackageTestEntry.FAILURE_SEPARATOR) }));
    const skips = methods.filter(t => t.method.outcome === testing.TestOutcome.Skipped)
      .map(t => ({ file: t.file, names: [t.method.displayName], reason: String(t.method.skipReason) }));
    const resultFile = this.environment[PackageTestEntry.RESULT_VARIABLE];
    if (resultFile !== undefined)
      await writeFile(resultFile, JSON.stringify({
        discovered: result.selection.discovered,
        selected: result.selection.selected,
        wanted,
        passed: result.passed,
        failed: result.failed,
        skipped: result.skipped,
        unreached,
        skips,
        files: [...new Set(methods.map(t => t.file))]
      }));
    const resultsFile = this.environment[PackageTestEntry.RESULTS_VARIABLE];
    if (resultsFile !== undefined)
      await writeFile(resultsFile, JSON.stringify({ isComplete: !this.isStopped && unreached === 0, failed }));
    return result.failed + unreached === 0 ? 0 : PackageTestEntry.FAILED_EXIT_CODE;
  }

  public end(exitCode: number): void {
    process.exitCode = exitCode;
    if (this.isStopped) {
      PackageTestEntry.exitFlushed(exitCode);
      return;
    }
    setTimeout(() => {
      writeSync(PackageTestEntry.STANDARD_ERROR, PackageTestEntry.formatUnclosed(process.getActiveResourcesInfo()));
      PackageTestEntry.exitFlushed(PackageTestEntry.FAILED_EXIT_CODE);
    }, PackageTestEntry.SHUTDOWN_GRACE_MILLISECONDS).unref();
  }

  private readList(variable: string, invalid: string): readonly string[] {
    let list: unknown;
    try {
      list = JSON.parse(this.environment[variable] ?? "[]");
    }
    catch (error) {
      throw new TypeError(invalid, { cause: error });
    }
    if (!Array.isArray(list) || list.some(t => typeof t !== "string"))
      throw new TypeError(invalid);
    return list.map(String);
  }

  private readProjects(): readonly PackageTestProject[] {
    if (this.commandArguments.length === 0 || this.commandArguments.length % 2 !== 0)
      throw new TypeError(PackageTestEntry.PAIRS_INVALID);
    const projects: PackageTestProject[] = [];
    for (let index = 0; index < this.commandArguments.length; index += 2)
      projects.push(new PackageTestProject(String(this.commandArguments[index]), String(this.commandArguments[index + 1])));
    return projects;
  }
}

if (import.meta.main) {
  delete process.env[PackageTestEntry.COVERAGE_VARIABLE];
  const entry = new PackageTestEntry(process.argv.slice(2), process.env);
  entry.end(await entry.runAsync());
}
