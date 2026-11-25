/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync } from "node:fs";
import { glob, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { ProcessRunner } from "../processes/process-runner.ts";
import { ProcessException } from "../processes/process.exception.ts";
import { RetriedDownload } from "../processes/retried-download.ts";
import type { ICoverageCount } from "../totals/interfaces/i-coverage-count.ts";
import { JsonFields } from "../totals/json-fields.ts";
import { AngularTestReport } from "./angular-test-report.ts";
import { AngularTestRun } from "./angular-test-run.ts";
import { PreBundleRun } from "./pre-bundle-run.ts";
import { RetriedTest } from "./retried-test.ts";

export class AngularProject {
  public static readonly LOG_FILE: string = "_build/angular-tests.log";
  public static readonly RETRY_VARIABLE: string = "NOLDOVA_TEST_RETRY";

  private static readonly FOLDER: string = "src";
  private static readonly WORKSPACE_FILE: string = "angular.json";
  private static readonly LOCKFILE: string = "package-lock.json";
  private static readonly INSTALLED_LOCKFILE: string = "node_modules/.package-lock.json";
  private static readonly RECORD_ENCODING: BufferEncoding = "utf8";
  private static readonly CLI: string = "node_modules/@angular/cli/bin/ng.js";
  private static readonly PLAYWRIGHT_CLI: string = "node_modules/playwright/cli.js";
  private static readonly INSTALL_COMMAND: string = "npm ci --no-audit --no-fund";
  private static readonly BROWSER_ARGUMENTS: readonly string[] = ["install", "--only-shell", "chromium"];
  private static readonly TEST_ARGUMENTS: readonly string[] = ["test", "--reporters=default", "--reporters=json"];
  private static readonly OUTPUT_FILE_OPTION: string = "--output-file";
  private static readonly INCLUDE_OPTION: string = "--include";
  private static readonly NO_COVERAGE_OPTION: string = "--no-coverage";
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "angular-tests.json"];
  private static readonly COVERAGE_SEGMENTS: readonly string[] = ["_build", "angular-coverage"];
  private static readonly COVERAGE_SUMMARY: string = "coverage-summary.json";
  private static readonly COVERAGE_UNIT: string = "statements";
  private static readonly TEST_TARGET: string = "test";
  private static readonly PASSED_STATUS: string = "passed";
  private static readonly RETRY_ON: string = "1";
  private static readonly OPTIONS_PATH: readonly string[] = ["architect", AngularProject.TEST_TARGET, "options"];
  private static readonly NO_PROJECT: string = "No Angular project under src/; there is nothing to prepare.\n";
  private static readonly INSTALLING_BROWSER: string = "Installing the browser for the Angular tests...\n";
  private static readonly BROWSER_SUBJECT: string = "The browser for the Angular tests";

  private readonly directory: string;
  private readonly runner: ProcessRunner;

  public readonly root: string;

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.directory = path.join(root, AngularProject.FOLDER);
    this.runner = runner;
  }

  public requireInstalled(): void {
    if (!existsSync(path.join(this.root, AngularProject.INSTALLED_LOCKFILE)) || !existsSync(path.join(this.root, AngularProject.CLI)))
      throw new ProcessException(`The Angular project in ${AngularProject.FOLDER}/ isn't installed; ${AngularProject.INSTALL_COMMAND} in the root installs it.`);
    if (statSync(path.join(this.root, AngularProject.LOCKFILE)).mtimeMs > statSync(path.join(this.root, AngularProject.INSTALLED_LOCKFILE)).mtimeMs)
      throw new ProcessException(`The Angular project in ${AngularProject.FOLDER}/ was installed before the root's ${AngularProject.LOCKFILE} changed; ${AngularProject.INSTALL_COMMAND} in the root installs it again.`);
  }

  public async prepareAsync(output: Writable): Promise<void> {
    if (!this.hasProject()) {
      output.write(AngularProject.NO_PROJECT);
      return;
    }

    this.requireInstalled();
    output.write(AngularProject.INSTALLING_BROWSER);
    await RetriedDownload.runAsync(AngularProject.BROWSER_SUBJECT, output, async () => {
      const result = await this.runner.captureAsync(process.execPath, [path.join(this.root, AngularProject.PLAYWRIGHT_CLI), ...AngularProject.BROWSER_ARGUMENTS], this.directory, RetriedDownload.ATTEMPT_TIMEOUT);
      return result.isSuccessful ? null : `exit code ${result.exitCode}: ${result.errorOutput.trim()}`;
    });
  }

  public async testAsync(include: readonly string[], isRetrying: boolean): Promise<AngularTestRun> {
    const report = path.join(this.root, ...AngularProject.REPORT_SEGMENTS);
    const coverage = path.join(this.root, ...AngularProject.COVERAGE_SEGMENTS, AngularProject.COVERAGE_SUMMARY);
    await rm(report, { force: true });
    await rm(path.dirname(coverage), { recursive: true, force: true });
    await rm(path.join(this.root, PreBundleRun.FOLDER), { recursive: true, force: true });
    await mkdir(path.dirname(report), { recursive: true });
    const exitCode = await this.runner.runLoggedAsync(
      process.execPath,
      [path.join(this.root, AngularProject.CLI), ...AngularProject.TEST_ARGUMENTS, AngularProject.OUTPUT_FILE_OPTION, report, ...AngularProject.selectionArguments(include)],
      this.directory,
      path.join(this.root, AngularProject.LOG_FILE),
      process.stdout,
      process.stderr,
      PreBundleRun.environment(isRetrying ? { ...process.env, [AngularProject.RETRY_VARIABLE]: AngularProject.RETRY_ON } : process.env));
    const results = existsSync(report) ? await this.readResultsAsync(report) : null;
    return new AngularTestRun(
      exitCode,
      Object.isNull(results) ? null : new AngularTestReport(this.describe(report), t => this.specName(path.resolve(t))).read(results),
      existsSync(coverage) ? await this.readCoverageAsync(coverage) : null,
      Object.isNull(results) ? [] : results.flatMap((t, i) => this.readRetried(new JsonFields(t, this.describe(report), [`test file ${i + 1}`]))));
  }

  public async specFilesAsync(): Promise<readonly string[]> {
    const workspace = await this.readJsonAsync(path.join(this.directory, AngularProject.WORKSPACE_FILE));
    const projects = AngularProject.field(workspace, "projects");
    const options = (Object.isObject(projects) ? Object.values(projects) : [])
      .map(t => AngularProject.OPTIONS_PATH.reduce<unknown>((value, name) => AngularProject.field(value, name), t))
      .find(t => !Object.isUndefined(t));
    if (!Object.isUndefined(AngularProject.field(options, "exclude")))
      throw new ProcessException(`src/${AngularProject.WORKSPACE_FILE} excludes files from its ${AngularProject.TEST_TARGET} target, and the check of the spec files run does not apply exclusions.`);
    const include = AngularProject.field(options, "include");
    if (!Array.isArray(include) || include.length === 0 || include.some(t => !Object.isString(t)))
      throw new ProcessException(`src/${AngularProject.WORKSPACE_FILE} names no spec files for its ${AngularProject.TEST_TARGET} target.`);
    const files: string[] = [];
    for await (const file of glob(include as string[], { cwd: this.directory }))
      files.push(this.specName(path.resolve(this.directory, file)));
    return files.sort();
  }

  private async readResultsAsync(report: string): Promise<readonly unknown[]> {
    const results = AngularProject.field(await this.readJsonAsync(report), "testResults");
    if (!Array.isArray(results) || results.some(t => !Object.isString(AngularProject.field(t, "name"))))
      throw new ProcessException(`The Angular test report ${this.describe(report)} lists no test files.`);
    return results;
  }

  private async readCoverageAsync(summary: string): Promise<ICoverageCount> {
    const statements = new JsonFields(await this.readJsonAsync(summary), this.describe(summary)).object("total").object(AngularProject.COVERAGE_UNIT);
    return { unit: AngularProject.COVERAGE_UNIT, covered: statements.count("covered"), total: statements.count("total") };
  }

  private readRetried(result: JsonFields): readonly RetriedTest[] {
    const file = this.specName(path.resolve(result.text("name")));
    return result.objects("assertionResults")
      .filter(t => t.text("status") === AngularProject.PASSED_STATUS && t.has("failureMessages") && t.list("failureMessages").length > 0)
      .map(t => new RetriedTest(file, t.text("fullName"), String(t.list("failureMessages")[0])));
  }

  private async readJsonAsync(file: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(file, AngularProject.RECORD_ENCODING));
    }
    catch (error) {
      throw new ProcessException(`${this.describe(file)} could not be read as JSON: ${String(error)}.`, { cause: error });
    }
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }

  private specName(file: string): string {
    return path.relative(this.directory, file).split(path.sep).join(path.posix.sep);
  }

  private static selectionArguments(include: readonly string[]): readonly string[] {
    return include.length === 0 ? [] : [AngularProject.NO_COVERAGE_OPTION, ...include.flatMap(t => [AngularProject.INCLUDE_OPTION, t])];
  }

  private static field(value: unknown, name: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
  }

  public hasProject(): boolean {
    return existsSync(path.join(this.directory, AngularProject.WORKSPACE_FILE));
  }
}
