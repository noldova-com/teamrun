/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { TestOutcome } from "../../enums/test-outcome.js";
import { AssertFailedException } from "../../exceptions/assert-failed.exception.js";
import type { ITestProgressListener } from "../../interfaces/i-test-progress-listener.js";
import { TerminalColor } from "../../models/reporting/terminal-color.js";
import type { TestClassResult } from "../../models/results/test-class-result.js";
import type { TestMethodResult } from "../../models/results/test-method-result.js";
import type { TestRunResult } from "../../models/results/test-run-result.js";
import { Resources } from "../../resources.js";

export class TestReportWriter implements ITestProgressListener {
  private static readonly LABEL_WIDTH: number = 12;
  private static readonly CENTISECONDS_PER_SECOND: number = 100;
  private static readonly DURATION_DECIMAL_PLACES: number = 2;
  private static readonly MILLISECONDS_PER_CENTISECOND: number = 10;
  private static readonly MILLISECONDS_PER_SECOND: number = 1_000;
  private static readonly MINUTES_PER_HOUR: number = 60;
  private static readonly SECONDS_PER_MINUTE: number = 60;
  private readonly skipPassingDetails: boolean;

  public constructor(skipPassingDetails: boolean = false) {
    this.skipPassingDetails = skipPassingDetails;
  }

  public onClassCompleted(result: TestClassResult): void {
    for (const line of this.formatClassLines(result, this.skipPassingDetails))
      console.log(line);
  }

  public writeSummary(result: TestRunResult): void {
    for (const line of this.formatSummaryLines(result))
      console.log(line);
  }

  public write(result: TestRunResult, skipPassingDetails: boolean): void {
    for (const line of this.formatLines(result, skipPassingDetails))
      console.log(line);
  }

  public formatLines(result: TestRunResult, skipPassingDetails: boolean): string[] {
    const lines: string[] = [];

    for (const classResult of result.classResults)
      lines.push(...this.formatClassLines(classResult, skipPassingDetails));

    return [...lines, ...this.formatSummaryLines(result)];
  }

  private formatClassLines(result: TestClassResult, skipPassingDetails: boolean): string[] {
    const methodLines: string[] = [];
    for (const method of result.methodResults) {
      if (skipPassingDetails && method.outcome === TestOutcome.Passed)
        continue;
      methodLines.push(...this.formatMethodLines(method));
    }

    if (skipPassingDetails && methodLines.length === 0)
      return [];

    return [`${result.packageName}/${result.filePath} — ${result.className}`, ...methodLines, String.empty];
  }

  private formatSummaryLines(result: TestRunResult): string[] {
    const lines: string[] = [];
    lines.push(Resources.testReportSeparator);
    if (result.selection.isFiltered) {
      lines.push(this.formatRow(Resources.filtersLabel, result.selection.filters.map(t => JSON.stringify(t)).join(", ")));
      lines.push(this.formatRow(Resources.discoveredLabel, result.selection.discovered));
      lines.push(this.formatRow(Resources.selectedLabel, result.selection.selected));
      lines.push(this.formatRow(Resources.unselectedLabel, result.selection.unselected));
    }
    lines.push(this.formatRow(Resources.totalLabel, result.total));
    lines.push(this.formatRow(Resources.timeLabel, this.formatDuration(result.durationMilliseconds)));
    lines.push(this.formatRow(Resources.passedLabel, result.passed, TerminalColor.GREEN));
    if (result.failed > 0)
      lines.push(this.formatRow(Resources.failedLabel, result.failed, TerminalColor.RED));
    if (result.skipped > 0)
      lines.push(this.formatRow(Resources.skippedLabel, result.skipped, TerminalColor.YELLOW));
    if (result.unreached > 0)
      lines.push(this.formatRow(Resources.unreachedLabel, result.unreached, TerminalColor.RED));

    return lines;
  }

  private formatRow(label: string, value: string | number, color: string = String.empty): string {
    const row = `${label.padEnd(TestReportWriter.LABEL_WIDTH)}${value}`;
    return color === String.empty ? row : `${color}${row}${TerminalColor.RESET}`;
  }

  private formatDuration(durationMilliseconds: number): string {
    const roundedMilliseconds = Math.round(durationMilliseconds);
    if (roundedMilliseconds < TestReportWriter.MILLISECONDS_PER_SECOND)
      return `${roundedMilliseconds} ${Resources.millisecondUnit}`;

    const totalCentiseconds = Math.round(roundedMilliseconds / TestReportWriter.MILLISECONDS_PER_CENTISECOND);
    const centisecondsPerMinute = TestReportWriter.CENTISECONDS_PER_SECOND * TestReportWriter.SECONDS_PER_MINUTE;
    if (totalCentiseconds < centisecondsPerMinute)
      return `${(totalCentiseconds / TestReportWriter.CENTISECONDS_PER_SECOND).toFixed(TestReportWriter.DURATION_DECIMAL_PLACES)} s`;

    const totalMinutes = Math.floor(totalCentiseconds / centisecondsPerMinute);
    const seconds = totalCentiseconds % centisecondsPerMinute / TestReportWriter.CENTISECONDS_PER_SECOND;
    if (totalMinutes < TestReportWriter.MINUTES_PER_HOUR)
      return `${totalMinutes} min ${seconds.toFixed(TestReportWriter.DURATION_DECIMAL_PLACES)} s`;

    const hours = Math.floor(totalMinutes / TestReportWriter.MINUTES_PER_HOUR);
    const minutes = totalMinutes % TestReportWriter.MINUTES_PER_HOUR;
    return `${hours} h ${minutes} min ${seconds.toFixed(TestReportWriter.DURATION_DECIMAL_PLACES)} s`;
  }

  private formatMethodLines(methodResult: TestMethodResult): string[] {
    const duration = `${Math.round(methodResult.durationMilliseconds)} ${Resources.millisecondUnit}`;
    const methodName = this.formatMethodName(methodResult);

    if (methodResult.outcome === TestOutcome.Passed)
      return [`  ${TerminalColor.GREEN}${Resources.passedMark}${TerminalColor.RESET} ${methodName} (${duration})`];

    if (methodResult.outcome === TestOutcome.Unreached)
      return [`  ${TerminalColor.RED}${Resources.unreachedMark}${TerminalColor.RESET} ${Resources.formatUnreachedTest(methodName)}`];

    if (methodResult.outcome === TestOutcome.Skipped)
      return [`  ${TerminalColor.YELLOW}${Resources.skippedMark}${TerminalColor.RESET} ${Resources.formatSkippedTest(methodName, methodResult.skipReason)}`];

    const lines = [`  ${TerminalColor.RED}${Resources.failedMark}${TerminalColor.RESET} ${methodName} (${duration})`];
    lines.push(...this.formatFailureLines(methodResult.failure));
    return lines;
  }

  private formatMethodName(methodResult: TestMethodResult): string {
    if (Object.isUndefined(methodResult.testDataRow))
      return methodResult.methodName;

    return `${methodResult.methodName}[${methodResult.testDataRow.index}](${methodResult.testDataRow.values.map(t => this.formatValue(t)).join(", ")})`;
  }

  private formatFailureLines(failure: unknown): string[] {
    if (failure instanceof AssertFailedException) {
      const lines = [`    ${failure.name}: ${failure.message}`];
      if (!Object.isUndefined(failure.expected) || !Object.isUndefined(failure.actual)) {
        lines.push(`    ${Resources.expectedLabel} ${this.formatValue(failure.expected)}`);
        lines.push(`    ${Resources.actualLabel}   ${this.formatValue(failure.actual)}`);
      }

      return lines;
    }

    if (failure instanceof Error)
      return [`    ${failure.name}: ${failure.message}`];

    return [`    ${Resources.threwLabel} ${this.formatValue(failure)}`];
  }

  private formatValue(value: unknown): string {
    if (Object.isString(value))
      return JSON.stringify(value);

    if (value instanceof Error)
      return `${value.name}: ${value.message}`;

    return String(value);
  }
}
