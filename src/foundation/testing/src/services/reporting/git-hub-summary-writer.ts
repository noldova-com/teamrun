/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { appendFileSync } from "node:fs";
import { stripVTControlCharacters } from "node:util";

import type { CoverageResult } from "../../models/coverage/coverage-result.js";
import type { TestRunResult } from "../../models/results/test-run-result.js";
import { Resources } from "../../resources.js";
import { CoverageReportWriter } from "./coverage-report-writer.js";
import { TestReportWriter } from "./test-report-writer.js";

export class GitHubSummaryWriter {
  private readonly path: string | undefined;

  public constructor(path: string | undefined) {
    this.path = path;
  }

  public writeTests(result: TestRunResult): void {
    const files = new Set(result.classResults.map(t => JSON.stringify([t.packageName, t.filePath])));
    const lines = [
      Resources.summaryTestHeading,
      String.empty,
      Resources.summaryTableHeading,
      Resources.summaryTableSeparator,
      Resources.formatSummaryRow(Resources.summaryFilesLabel, files.size),
      Resources.formatSummaryRow(Resources.totalLabel, result.total),
      Resources.formatSummaryRow(Resources.passedLabel, result.passed),
      Resources.formatSummaryRow(Resources.failedLabel, result.failed),
      Resources.formatSummaryRow(Resources.skippedLabel, result.skipped),
      Resources.formatSummaryRow(Resources.unreachedLabel, result.unreached),
      Resources.formatSummaryRow(Resources.timeLabel, Resources.formatSummarySeconds(result.durationMilliseconds))
    ];
    if (result.failed > 0 || result.skipped > 0 || result.unreached > 0)
      lines.push(this.details(new TestReportWriter().formatLines(result, true).join(Resources.summaryNewline)));
    this.append(lines);
  }

  public writeCoverage(result: CoverageResult): void {
    const fullyCovered = result.executableFileCoverages.filter(t => t.isFullyCovered).length;
    const percentage = result.totalLength === 0
      ? Resources.coverageNotApplicable
      : `${((1 - result.uncoveredLength / result.totalLength) * 100).toFixed(1)}${Resources.coveragePercentSuffix}`;
    const lines = [
      Resources.summaryCoverageHeading,
      String.empty,
      Resources.summaryTableHeading,
      Resources.summaryTableSeparator,
      Resources.formatSummaryRow(Resources.summaryGateLabel, result.isComplete ? Resources.summaryPassed : Resources.summaryFailed),
      Resources.formatSummaryRow(Resources.summaryCoveredFilesLabel, `${fullyCovered}/${result.executableFileCoverages.length}`),
      Resources.formatSummaryRow(Resources.summaryExcludedFilesLabel, String(result.excludedFileCoverages.length)),
      Resources.formatSummaryRow(Resources.coverageHeading, percentage),
      Resources.formatSummaryRow(Resources.blocksHeading, `${result.takenBlockCount}/${result.blockCount}`)
    ];
    if (!result.isComplete || result.excludedFileCoverages.length > 0)
      lines.push(this.details(new CoverageReportWriter().formatLines(result, true).join(Resources.summaryNewline)));
    this.append(lines);
  }

  public writeFailure(message: string): void {
    this.append([Resources.summaryFailureHeading, this.details(message)]);
  }

  private details(text: string): string {
    const plain = stripVTControlCharacters(text);
    const excerpt = plain.slice(0, Resources.summaryDetailLimit);
    const escaped = excerpt.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return Resources.formatSummaryDetails(escaped, plain.length > excerpt.length);
  }

  private append(lines: readonly string[]): void {
    if (Object.isUndefined(this.path) || String.isNullOrWhitespace(this.path))
      return;

    try {
      appendFileSync(this.path, `${Resources.summaryNewline}${lines.join(Resources.summaryNewline)}${Resources.summaryNewline}`, Resources.summaryEncoding);
    }
    catch {
      console.error(Resources.summaryWriteFailed);
    }
  }
}
