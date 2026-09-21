/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { TestOutcome } from "../../enums/test-outcome.js";
import { AssertFailedException } from "../../exceptions/assert-failed-exception.js";
import { TerminalColor } from "../../models/reporting/terminal-color.js";
import type { TestMethodResult } from "../../models/results/test-method-result.js";
import type { TestRunResult } from "../../models/results/test-run-result.js";
import { Resources } from "../../resources.js";

export class TestReportWriter {
  private static readonly CENTISECONDS_PER_SECOND: number = 100;
  private static readonly DURATION_DECIMAL_PLACES: number = 2;
  private static readonly MILLISECONDS_PER_CENTISECOND: number = 10;
  private static readonly MILLISECONDS_PER_SECOND: number = 1_000;
  private static readonly MINUTES_PER_HOUR: number = 60;
  private static readonly SECONDS_PER_MINUTE: number = 60;

  public write(result: TestRunResult, skipPassingDetails: boolean): void {
    for (const line of this.formatLines(result, skipPassingDetails))
      console.log(line);
  }

  public formatLines(result: TestRunResult, skipPassingDetails: boolean): string[] {
    const lines: string[] = [];

    for (const classResult of result.classResults) {
      const methodLines: string[] = [];
      for (const methodResult of classResult.methodResults) {
        if (skipPassingDetails && methodResult.outcome === TestOutcome.Passed)
          continue;

        methodLines.push(...this.formatMethodLines(methodResult));
      }

      if (skipPassingDetails && methodLines.length === 0)
        continue;

      lines.push(`${classResult.packageName}/${classResult.filePath} — ${classResult.className}`, ...methodLines, String.empty);
    }

    lines.push(Resources.testReportSeparator);
    lines.push(`${Resources.totalLabel}   ${result.total}`);
    lines.push(`${Resources.timeLabel}    ${this.formatDuration(result.durationMilliseconds)}`);
    lines.push(`${TerminalColor.GREEN}${Resources.passedLabel}  ${result.passed}${TerminalColor.RESET}`);
    if (result.failed > 0)
      lines.push(`${TerminalColor.RED}${Resources.failedLabel}  ${result.failed}${TerminalColor.RESET}`);
    if (result.skipped > 0)
      lines.push(`${TerminalColor.YELLOW}${Resources.skippedLabel} ${result.skipped}${TerminalColor.RESET}`);

    return lines;
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

    if (methodResult.outcome === TestOutcome.Skipped)
      return [`  ${TerminalColor.YELLOW}${Resources.skippedMark}${TerminalColor.RESET} ${Resources.skippedTest(methodName, methodResult.skipReason)}`];

    const lines = [`  ${TerminalColor.RED}${Resources.failedMark}${TerminalColor.RESET} ${methodName} (${duration})`];
    lines.push(...this.formatFailureLines(methodResult.failure));
    return lines;
  }

  private formatMethodName(methodResult: TestMethodResult): string {
    if (Object.isUndefined(methodResult.testDataIndex))
      return methodResult.methodName;

    return `${methodResult.methodName}[${methodResult.testDataIndex}](${methodResult.testData.map(t => this.formatValue(t)).join(", ")})`;
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
    if (typeof value === "string")
      return JSON.stringify(value);

    if (value instanceof Error)
      return `${value.name}: ${value.message}`;

    return String(value);
  }
}
