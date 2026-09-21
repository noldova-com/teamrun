/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative } from "node:path";

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { EcmaScriptLineTerminator } from "@noldova/teamrun-foundation-text";

import { TestingException } from "../../exceptions/testing.exception.js";
import type { ISourceMapData } from "../../interfaces/coverage/i-source-map-data.js";
import { BlockCoverage } from "../../models/coverage/block-coverage.js";
import type { CoverageProject } from "../../models/coverage/coverage-project.js";
import { CoverageRange } from "../../models/coverage/coverage-range.js";
import { FileCoverage } from "../../models/coverage/file-coverage.js";
import type { FunctionCoverage } from "../../models/coverage/function-coverage.js";
import { LineRange } from "../../models/coverage/line-range.js";
import { Resources } from "../../resources.js";
import { SourceMap } from "./source-map.js";

export class FileCoverageAnalyzer {
  private static readonly BLOCK_COMMENT_PATTERN: RegExp = /\/\*[\s\S]*?\*\//gu;
  private static readonly MISSING_FILE_ERROR_CODE: string = "ENOENT";
  private static readonly SOURCE_MAP_SUFFIX: string = ".map";
  private static readonly TEXT_ENCODING: BufferEncoding = "utf8";

  private readonly lineTerminator: EcmaScriptLineTerminator = new EcmaScriptLineTerminator();
  private readonly project: CoverageProject;

  public constructor(project: CoverageProject) {
    this.project = project;
  }

  public async analyzeAsync(filePath: string, scriptEntries: readonly (readonly FunctionCoverage[])[]): Promise<FileCoverage> {
    const fileText = await readFile(filePath, FileCoverageAnalyzer.TEXT_ENCODING);
    const lineStartOffsets = this.computeLineStartOffsets(fileText);
    const sourceMap = await this.tryLoadSourceMapAsync(filePath);
    const sourcePath = this.tryDetermineSourcePath(lineStartOffsets, sourceMap);
    const relativePath = Object.isUndefined(sourcePath)
      ? this.toRelativePath(filePath, this.project.productionDirectory)
      : this.toRelativePath(sourcePath, this.project.sourceDirectory);
    const toLine = (t: number): number => this.toSourceLine(t, lineStartOffsets, sourceMap);

    if (this.isInertModule(fileText))
      return new FileCoverage(this.project.name, relativePath, [], 0, 0, []);

    if (scriptEntries.length === 0)
      return this.toNeverLoadedFileCoverage(relativePath, fileText, toLine);

    const coveredPositions = this.computeCoveredPositions(scriptEntries, fileText);
    const blockCoverages = this.computeBlockCoverages(scriptEntries, coveredPositions, toLine, fileText);
    const uncoveredRanges = this.toUncoveredRanges(coveredPositions);

    if (uncoveredRanges.length === 0)
      return new FileCoverage(this.project.name, relativePath, [], fileText.length, 0, blockCoverages);

    const uncoveredLength = uncoveredRanges.reduce((sum, range) => sum + range.endOffset - range.startOffset, 0);
    const uncoveredLineRanges = uncoveredRanges
      .map(t => {
        const startLine = toLine(t.startOffset);

        return new LineRange(startLine, Math.max(startLine, toLine(Math.max(t.startOffset, t.endOffset - 1))));
      })
      .sort((first, second) => first.startLine - second.startLine);

    return new FileCoverage(this.project.name, relativePath, this.mergeLineRanges(uncoveredLineRanges), fileText.length, uncoveredLength, blockCoverages);
  }

  private toNeverLoadedFileCoverage(relativePath: string, fileText: string, toLine: (offset: number) => number): FileCoverage {
    const firstLine = toLine(0);
    const lastLine = toLine(fileText.length - 1);

    return new FileCoverage(
      this.project.name,
      relativePath,
      [new LineRange(Math.min(firstLine, lastLine), Math.max(firstLine, lastLine))],
      fileText.length,
      fileText.length,
      []);
  }

  private isInertModule(fileText: string): boolean {
    const strippedText = fileText.replace(FileCoverageAnalyzer.BLOCK_COMMENT_PATTERN, String.empty);

    return strippedText.split(Resources.lineFeed).every(t => {
      const trimmedLine = t.trim();

      return trimmedLine === String.empty
        || trimmedLine.startsWith(Resources.lineCommentPrefix)
        || trimmedLine === Resources.emptyExport;
    });
  }

  private computeBlockCoverages(
    scriptEntries: readonly (readonly FunctionCoverage[])[],
    coveredPositions: Uint8Array,
    toLine: (offset: number) => number,
    fileText: string): BlockCoverage[] {
    const blockRangesByKey = new Map<string, CoverageRange>();
    for (const functionCoverages of scriptEntries)
      for (const functionCoverage of functionCoverages)
        for (const range of functionCoverage.ranges.slice(1))
          if (fileText.slice(range.startOffset, range.endOffset).trim().length > 0)
            blockRangesByKey.set(`${range.startOffset}:${range.endOffset}`, range);

    const sortedRanges = [...blockRangesByKey.values()].sort((first, second) => first.startOffset - second.startOffset || first.endOffset - second.endOffset);

    return sortedRanges.map(t => new BlockCoverage(
      toLine(t.startOffset),
      this.spanHasCoveredPosition(t, coveredPositions)));
  }

  private async tryLoadSourceMapAsync(filePath: string): Promise<SourceMap | undefined> {
    const sourceMapText = await readFile(`${filePath}${FileCoverageAnalyzer.SOURCE_MAP_SUFFIX}`, FileCoverageAnalyzer.TEXT_ENCODING)
      .catch((error: NodeJS.ErrnoException): string | undefined => {
        if (error.code === FileCoverageAnalyzer.MISSING_FILE_ERROR_CODE)
          return undefined;

        throw error;
      });
    if (Object.isUndefined(sourceMapText))
      return undefined;

    try {
      const data: ISourceMapData = JSON.parse(sourceMapText);
      return new SourceMap(data, dirname(filePath));
    }
    catch (error) {
      throw new TestingException(Resources.sourceMapMalformed(filePath), new ExceptionOptions(error));
    }
  }

  private tryDetermineSourcePath(lineStartOffsets: readonly number[], sourceMap: SourceMap | undefined): string | undefined {
    if (Object.isUndefined(sourceMap))
      return undefined;

    for (let line = 1; line <= lineStartOffsets.length; line++) {
      const position = sourceMap.mapToSource(line, Number.MAX_SAFE_INTEGER);
      if (!Object.isUndefined(position))
        return position.sourcePath;
    }

    return undefined;
  }

  private toSourceLine(offset: number, lineStartOffsets: readonly number[], sourceMap: SourceMap | undefined): number {
    const generatedLine = this.lineOf(offset, lineStartOffsets);
    if (Object.isUndefined(sourceMap))
      return generatedLine;

    const position = sourceMap.mapToSource(generatedLine, this.columnOf(offset, lineStartOffsets));

    return Object.isUndefined(position) ? generatedLine : position.line;
  }

  private columnOf(offset: number, lineStartOffsets: readonly number[]): number {
    let lineStartOffset = 0;
    for (let index = 1; index < lineStartOffsets.length; index++) {
      const candidate = lineStartOffsets[index];
      if (Object.isUndefined(candidate) || candidate > offset)
        break;

      lineStartOffset = candidate;
    }

    return offset - lineStartOffset;
  }

  private spanHasCoveredPosition(range: CoverageRange, coveredPositions: Uint8Array): boolean {
    for (let position = range.startOffset; position < range.endOffset && position < coveredPositions.length; position++)
      if (coveredPositions[position] === 1)
        return true;

    return false;
  }

  private computeCoveredPositions(scriptEntries: readonly (readonly FunctionCoverage[])[], fileText: string): Uint8Array {
    const fileTextLength = fileText.length;
    for (const functionCoverages of scriptEntries)
      for (const functionCoverage of functionCoverages)
        for (const range of functionCoverage.ranges)
          if (range.endOffset > fileTextLength)
            throw new TestingException(Resources.coverageRangeBeyondFile(range.endOffset, fileTextLength));

    const coveredPositions = new Uint8Array(fileTextLength);
    const paintedCounts = new Int32Array(fileTextLength);

    for (const functionCoverages of scriptEntries) {
      paintedCounts.fill(-1);

      const paintOrder = functionCoverages
        .flatMap(t => t.ranges)
        .sort((first, second) => first.startOffset - second.startOffset || second.endOffset - first.endOffset);
      for (const range of paintOrder)
        // V8 can emit an untaken whitespace-only span between catch and finally; it is not a code branch.
        if (range.count > 0 || fileText.slice(range.startOffset, range.endOffset).trim().length > 0)
          paintedCounts.fill(range.count, range.startOffset, range.endOffset);

      for (const [position, count] of paintedCounts.entries())
        if (count > 0)
          coveredPositions[position] = 1;
    }

    return coveredPositions;
  }

  private toUncoveredRanges(coveredPositions: Uint8Array): CoverageRange[] {
    const uncoveredRanges: CoverageRange[] = [];
    let runStart = -1;

    for (let position = 0; position <= coveredPositions.length; position++) {
      const isUncovered = position < coveredPositions.length && coveredPositions[position] === 0;

      if (isUncovered && runStart === -1)
        runStart = position;

      if (!isUncovered && runStart !== -1) {
        uncoveredRanges.push(new CoverageRange(runStart, position, 0));
        runStart = -1;
      }
    }

    return uncoveredRanges;
  }

  private toRelativePath(filePath: string, rootDirectory: string): string {
    const relativePath = relative(rootDirectory, filePath).replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator);
    if (relativePath === ".." || relativePath.startsWith(`..${Resources.directorySeparator}`) || isAbsolute(relativePath))
      throw new TestingException(Resources.coverageFileOutsideProject(filePath, this.project.name));

    return relativePath;
  }

  private computeLineStartOffsets(fileText: string): number[] {
    const lineStartOffsets = [0];
    for (let offset = 0; offset < fileText.length; offset++) {
      const lineBreakLength = this.lineTerminator.getLength(fileText, offset);
      if (lineBreakLength === 0)
        continue;

      offset += lineBreakLength - 1;
      lineStartOffsets.push(offset + 1);
    }

    return lineStartOffsets;
  }

  private lineOf(offset: number, lineStartOffsets: readonly number[]): number {
    let line = 1;
    for (let index = 1; index < lineStartOffsets.length; index++) {
      const lineStartOffset = lineStartOffsets[index];
      if (Object.isUndefined(lineStartOffset) || lineStartOffset > offset)
        break;

      line = index + 1;
    }

    return line;
  }

  private mergeLineRanges(sortedLineRanges: readonly LineRange[]): LineRange[] {
    const mergedLineRanges: LineRange[] = [];
    for (const lineRange of sortedLineRanges) {
      const lastLineRange = mergedLineRanges[mergedLineRanges.length - 1];
      if (!Object.isUndefined(lastLineRange) && lineRange.startLine <= lastLineRange.endLine + 1) {
        mergedLineRanges[mergedLineRanges.length - 1] = new LineRange(lastLineRange.startLine, Math.max(lastLineRange.endLine, lineRange.endLine));
        continue;
      }

      mergedLineRanges.push(lineRange);
    }

    return mergedLineRanges;
  }
}
