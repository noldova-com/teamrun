/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { glob, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import { AngularTestReport } from "../../../scripts/angular/angular-test-report.ts";
import { ProcessRunner } from "../../../scripts/processes/process-runner.ts";
import { RetriedDownload } from "../../../scripts/processes/retried-download.ts";
import { JsonFields } from "../../../scripts/totals/json-fields.ts";
import { TotalsException } from "../../../scripts/totals/totals.exception.ts";
import { BuildDocs } from "./build-docs.ts";
import { DocsSiteCheck } from "./docs-site-check.ts";

export class TestDocs {
  private static readonly ANGULAR_CLI: string = "node_modules/@angular/cli/bin/ng.js";
  private static readonly PLAYWRIGHT_CLI: string = "node_modules/playwright/cli.js";
  private static readonly BROWSER_ARGUMENTS: readonly string[] = ["install", "--only-shell", "chromium"];
  private static readonly INSTALLING_BROWSER: string = "Installing the browser for the docs site's tests...\n";
  private static readonly BROWSER_SUBJECT: string = "The browser for the docs site's tests";
  private static readonly TEST_ARGUMENTS: readonly string[] = ["test", "docs", "--reporters=default", "--reporters=json", "--output-file"];
  private static readonly REPORT_FILE: string = "_build/docs-tests.json";
  private static readonly SPEC_FILES: string = "tests/**/*.spec.ts";
  private static readonly RUNNER: string = "docs";
  private static readonly TITLE: string = "The docs site's tests";
  private static readonly COVERAGE_FOLDER: string = "_build/docs-coverage";
  private static readonly DEPENDENCY_CACHE: string = "node_modules/.vite";
  private static readonly SITE_FOLDER: string = "src/noldova.teamrun.docs";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;

  public constructor(root: string, runner: ProcessRunner, output: Writable) {
    this.root = root;
    this.runner = runner;
    this.output = output;
  }

  public async runAsync(): Promise<number> {
    if (await new BuildDocs(this.root, this.runner, this.output).runAsync() !== 0)
      return 1;
    this.output.write(TestDocs.INSTALLING_BROWSER);
    await RetriedDownload.runAsync(TestDocs.BROWSER_SUBJECT, this.output, async () => {
      const result = await this.runner.captureAsync(process.execPath, [path.join(this.root, TestDocs.PLAYWRIGHT_CLI), ...TestDocs.BROWSER_ARGUMENTS], this.root, RetriedDownload.ATTEMPT_TIMEOUT);
      return result.isSuccessful ? null : `exit code ${result.exitCode}: ${result.errorOutput.trim()}`;
    });
    await rm(path.join(this.root, TestDocs.COVERAGE_FOLDER), { recursive: true, force: true });
    await rm(path.join(this.root, TestDocs.DEPENDENCY_CACHE), { recursive: true, force: true });
    const report = path.join(this.root, TestDocs.REPORT_FILE);
    await rm(report, { force: true });
    const site = path.join(this.root, TestDocs.SITE_FOLDER);
    const tested = await this.runner.runAsync(process.execPath, [path.join(this.root, TestDocs.ANGULAR_CLI), ...TestDocs.TEST_ARGUMENTS, report], site);
    const isReportSound = await this.checkReportAsync(report, site);
    const check = new DocsSiteCheck(this.root);
    this.output.write(`\n${check.title}\n`);
    const isSiteSound = await check.runAsync(this.output);
    return tested === 0 && isReportSound && isSiteSound ? 0 : 1;
  }

  private async checkReportAsync(report: string, site: string): Promise<boolean> {
    if (!existsSync(report)) {
      this.output.write(`${TestDocs.TITLE} wrote no report to ${TestDocs.REPORT_FILE}.\n`);
      return false;
    }
    try {
      const name = (file: string): string => path.relative(site, path.resolve(site, file)).split(path.sep).join(path.posix.sep);
      const results = JsonFields.parse(await readFile(report, "utf8"), TestDocs.REPORT_FILE).list("testResults");
      const expected: string[] = [];
      for await (const file of glob(TestDocs.SPEC_FILES, { cwd: site }))
        expected.push(name(file));
      return new AngularTestReport(TestDocs.REPORT_FILE, name).read(results).toTotals(TestDocs.RUNNER, TestDocs.TITLE, null, expected.sort(), null).report(this.output);
    }
    catch (error) {
      if (!(error instanceof TotalsException))
        throw error;
      this.output.write(`${error.message}\n`);
      return false;
    }
  }
}

if (import.meta.main)
  process.exitCode = await new TestDocs(path.resolve(import.meta.dirname, "../../.."), new ProcessRunner(), process.stdout).runAsync();
