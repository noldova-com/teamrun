/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { mkdtempSync, readdirSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { TestingException } from "../../exceptions/testing.exception.js";
import { TestProject } from "../../models/discovery/test-project.js";
import { Resources } from "../../resources.js";
import { TestDiscovery } from "../discovery/test-discovery.js";
import { GitHubSummaryWriter } from "../reporting/git-hub-summary-writer.js";
import { TestReportWriter } from "../reporting/test-report-writer.js";
import { TestExecutor } from "./test-executor.js";
import { TestRunner } from "./test-runner.js";

export class TestRunEntry {
  public async runAsync(): Promise<void> {
    const testProjectArguments = process.argv.slice(2);
    const summary = new GitHubSummaryWriter(process.env[Resources.gitHubSummaryVariable]);
    this.keepCoverageFromChildren();
    const temporaryDirectory = this.isolateTemporaryFiles();
    let interrupted = false;

    try {
      const filters = this.parseFilters(process.env[Resources.filtersVariable]);
      const timeoutMilliseconds = this.parseTimeout(process.env[Resources.timeoutVariable]);

      const testProjects: TestProject[] = [];
      for (let index = 0; index < testProjectArguments.length; index += 2) {
        const packageName = testProjectArguments[index];
        const rootDirectory = testProjectArguments[index + 1];
        if (Object.isUndefined(packageName) || Object.isUndefined(rootDirectory))
          throw new TestingException(Resources.testProjectPairRequired);

        testProjects.push(new TestProject(packageName, rootDirectory));
      }

      const runner = new TestRunner(new TestDiscovery(), new TestExecutor(timeoutMilliseconds));
      const reporter = new TestReportWriter(!Object.isUndefined(process.env[Resources.skipTestDetailsVariable]));
      const result = await runner.runAsync(testProjects, filters, reporter);

      reporter.writeSummary(result);
      summary.writeTests(result);
      if (result.selection.isFiltered && result.selection.selected === 0) {
        console.error(Resources.noTestMatchedFilters.trimEnd());
        summary.writeFailure(Resources.noTestMatchedFilters);
      }
      const selectionFile = process.env[Resources.selectionFileVariable];
      if (!Object.isUndefined(selectionFile))
        writeFileSync(selectionFile, JSON.stringify({ discovered: result.selection.discovered, selected: result.selection.selected }));
      interrupted = result.isInterrupted;
      process.exitCode = Math.min(result.failed + result.unreached + Number(result.total === 0), 1);
    }
    catch (error) {
      console.error(String(error));
      summary.writeFailure(String(error));
      process.exitCode = 1;
    }

    const leftovers = this.removeTemporaryFiles(temporaryDirectory);
    if (interrupted) {
      writeSync(Resources.standardErrorDescriptor, Resources.runInterrupted);
      summary.writeFailure(Resources.runInterrupted);
      process.exit(Resources.failedExitCode);
    }

    if (leftovers.length > 0) {
      const failure = Resources.formatTemporaryLeftovers(leftovers);
      writeSync(Resources.standardErrorDescriptor, failure);
      summary.writeFailure(failure);
      process.exitCode = Resources.failedExitCode;
    }

    setTimeout(() => {
      const failure = Resources.formatUnclosedTestResources(process.getActiveResourcesInfo());
      writeSync(Resources.standardErrorDescriptor, failure);
      summary.writeFailure(failure);
      process.exit(Resources.failedExitCode);
    }, Resources.testShutdownGraceMilliseconds).unref();
  }

  private keepCoverageFromChildren(): void {
    const directory = process.env[Resources.coverageVariable];
    if (!Object.isUndefined(directory)) {
      process.env[Resources.coverageDirectoryVariable] = directory;
      delete process.env[Resources.coverageVariable];
    }
  }

  private isolateTemporaryFiles(): string {
    const root = process.env[Resources.temporaryRootVariable] ?? tmpdir();
    const directory = mkdtempSync(join(root, Resources.temporaryDirectoryPrefix));
    for (const variable of Resources.temporaryDirectoryVariables)
      process.env[variable] = directory;

    return directory;
  }

  private removeTemporaryFiles(directory: string): string[] {
    const leftovers = readdirSync(directory).sort();
    rmSync(directory, { recursive: true, force: true, maxRetries: Resources.temporaryRemovalRetries });
    return leftovers;
  }

  private parseFilters(text: string | undefined): string[] {
    if (Object.isUndefined(text))
      throw new TestingException(Resources.testFiltersInvalid);

    let value: unknown;
    try {
      value = JSON.parse(text);
    }
    catch (error) {
      throw new TestingException(Resources.testFiltersInvalid, new ExceptionOptions(error));
    }

    if (!Array.isArray(value))
      throw new TestingException(Resources.testFiltersInvalid);

    const filters: string[] = [];
    for (const filter of value) {
      if (!Object.isString(filter))
        throw new TestingException(Resources.testFiltersInvalid);

      filters.push(filter);
    }

    return filters;
  }

  private parseTimeout(text: string | undefined): number {
    if (Object.isUndefined(text))
      return Resources.defaultTimeoutMilliseconds;

    const value = Number(text);
    if (!Number.isInteger(value) || value <= 0 || String(value) !== text)
      throw new TestingException(Resources.timeoutInvalid);

    return value;
  }
}

await new TestRunEntry().runAsync();
