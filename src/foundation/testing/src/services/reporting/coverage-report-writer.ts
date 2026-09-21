/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CoverageResult } from "../../models/coverage/coverage-result.js";
import { CoverageReportRow } from "../../models/reporting/coverage-report-row.js";
import { TerminalColor } from "../../models/reporting/terminal-color.js";
import { Resources } from "../../resources.js";

export class CoverageReportWriter {
  private static readonly GREEN_THRESHOLD: number = 90;
  private static readonly YELLOW_THRESHOLD: number = 60;

  public formatLines(result: CoverageResult, skipCoveredDetails: boolean): string[] {
    const fileRows = this.buildFileRows(result, skipCoveredDetails);
    const overallRow = this.buildOverallRow(result);
    const rows = [...fileRows, overallRow];

    const fileWidth = rows.reduce((width, row) => Math.max(width, row.fileCell.length), Resources.coverageFileHeading.length);
    const sourceWidth = rows.reduce((width, row) => Math.max(width, row.sourceCell.length), Resources.coverageHeading.length);
    const blocksWidth = rows.reduce((width, row) => Math.max(width, row.blocksCell.length), Resources.blocksHeading.length);

    const lines = [this.formatHorizontal(fileWidth, sourceWidth, blocksWidth, Resources.tableTopLeft, Resources.tableTopMiddle, Resources.tableTopRight)];
    const headingRow = new CoverageReportRow(Resources.coverageFileHeading, Resources.coverageHeading, Resources.blocksHeading, String.empty, false);
    lines.push(this.formatRow(headingRow, fileWidth, sourceWidth, blocksWidth));
    lines.push(this.formatHorizontal(fileWidth, sourceWidth, blocksWidth, Resources.tableMiddleLeft, Resources.tableMiddle, Resources.tableMiddleRight));

    for (const row of fileRows)
      lines.push(this.formatRow(row, fileWidth, sourceWidth, blocksWidth));

    lines.push(this.formatHorizontal(fileWidth, sourceWidth, blocksWidth, Resources.tableMiddleLeft, Resources.tableMiddle, Resources.tableMiddleRight));
    lines.push(this.formatRow(overallRow, fileWidth, sourceWidth, blocksWidth));
    lines.push(this.formatHorizontal(fileWidth, sourceWidth, blocksWidth, Resources.tableBottomLeft, Resources.tableBottomMiddle, Resources.tableBottomRight));

    return lines;
  }

  private buildFileRows(result: CoverageResult, skipCoveredDetails: boolean): CoverageReportRow[] {
    const rows: CoverageReportRow[] = [];
    const shownFileCoverages = skipCoveredDetails ? result.incompleteFileCoverages : result.fileCoverages;

    let currentProject = String.empty;
    for (const fileCoverage of shownFileCoverages) {
      if (fileCoverage.projectName !== currentProject) {
        currentProject = fileCoverage.projectName;
        rows.push(new CoverageReportRow(currentProject, String.empty, String.empty, String.empty, false));
      }

      const color = fileCoverage.isExecutable ? this.colorOf(fileCoverage.totalLength, fileCoverage.uncoveredLength) : String.empty;
      rows.push(new CoverageReportRow(
        `${Resources.reportIndent}${fileCoverage.relativePath}`,
        fileCoverage.isExecutable ? this.formatPercentage(fileCoverage.totalLength, fileCoverage.uncoveredLength) : Resources.coverageNotApplicable,
        this.formatBlocks(fileCoverage.takenBlockCount, fileCoverage.blockCount),
        color,
        false));

      for (const lineRange of fileCoverage.uncoveredLineRanges)
        rows.push(new CoverageReportRow(Resources.uncoveredLines(lineRange.displayText), String.empty, String.empty, TerminalColor.RED, true));
    }

    return rows;
  }

  private buildOverallRow(result: CoverageResult): CoverageReportRow {
    const executableFileCoverages = result.executableFileCoverages;
    const fullyCovered = executableFileCoverages.filter(t => t.isFullyCovered).length;
    const hasExecutableFiles = executableFileCoverages.length > 0;

    return new CoverageReportRow(
      Resources.overallCoverage(fullyCovered, executableFileCoverages.length),
      hasExecutableFiles ? this.formatPercentage(result.totalLength, result.uncoveredLength) : Resources.coverageNotApplicable,
      this.formatBlocks(result.takenBlockCount, result.blockCount),
      hasExecutableFiles ? this.colorOf(result.totalLength, result.uncoveredLength) : String.empty,
      true);
  }

  private percentageOf(totalLength: number, uncoveredLength: number): number {
    return (1 - uncoveredLength / totalLength) * 100;
  }

  private formatPercentage(totalLength: number, uncoveredLength: number): string {
    return `${this.percentageOf(totalLength, uncoveredLength).toFixed(1)}${Resources.coveragePercentSuffix}`;
  }

  private formatBlocks(takenBlockCount: number, blockCount: number): string {
    return blockCount === 0
      ? Resources.coverageNotApplicable
      : `${takenBlockCount}${Resources.coverageBlockSeparator}${blockCount}`;
  }

  private colorOf(totalLength: number, uncoveredLength: number): string {
    const percentage = this.percentageOf(totalLength, uncoveredLength);
    if (percentage >= CoverageReportWriter.GREEN_THRESHOLD)
      return TerminalColor.GREEN;

    return percentage >= CoverageReportWriter.YELLOW_THRESHOLD ? TerminalColor.YELLOW : TerminalColor.RED;
  }

  private colorize(text: string, color: string): string {
    return color === String.empty ? text : `${color}${text}${TerminalColor.RESET}`;
  }

  private formatHorizontal(fileWidth: number, sourceWidth: number, blocksWidth: number, left: string, middle: string, right: string): string {
    return `${left}${Resources.tableHorizontal.repeat(fileWidth + 2)}${middle}${Resources.tableHorizontal.repeat(sourceWidth + 2)}${middle}${Resources.tableHorizontal.repeat(blocksWidth + 2)}${right}`;
  }

  private formatRow(row: CoverageReportRow, fileWidth: number, sourceWidth: number, blocksWidth: number): string {
    const fileCell = this.colorize(row.fileCell.padEnd(fileWidth), row.colorsFileCell ? row.color : String.empty);
    const sourceCell = this.colorize(row.sourceCell.padStart(sourceWidth), row.color);
    const blocksCell = this.colorize(row.blocksCell.padStart(blocksWidth), row.color);

    return `${Resources.tableVertical} ${fileCell} ${Resources.tableVertical} ${sourceCell} ${Resources.tableVertical} ${blocksCell} ${Resources.tableVertical}`;
  }
}
