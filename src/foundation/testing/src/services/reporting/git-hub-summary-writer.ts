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
      Resources.summaryRow(Resources.summaryFilesLabel, files.size),
      Resources.summaryRow(Resources.totalLabel, result.total),
      Resources.summaryRow(Resources.passedLabel, result.passed),
      Resources.summaryRow(Resources.failedLabel, result.failed),
      Resources.summaryRow(Resources.skippedLabel, result.skipped),
      Resources.summaryRow(Resources.timeLabel, Resources.summarySeconds(result.durationMilliseconds))
    ];
    if (result.failed > 0 || result.skipped > 0)
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
      Resources.summaryRow(Resources.summaryGateLabel, result.isComplete ? Resources.summaryPassed : Resources.summaryFailed),
      Resources.summaryRow(Resources.summaryCoveredFilesLabel, `${fullyCovered}/${result.executableFileCoverages.length}`),
      Resources.summaryRow(Resources.coverageHeading, percentage),
      Resources.summaryRow(Resources.blocksHeading, `${result.takenBlockCount}/${result.blockCount}`)
    ];
    if (!result.isComplete)
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
    return Resources.summaryDetails(escaped, plain.length > excerpt.length);
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
