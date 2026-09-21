/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { nameof } from "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { TestingException } from "../../exceptions/testing-exception.js";
import type { ICoverageRange } from "../../interfaces/coverage/i-coverage-range.js";
import type { ICoverageReport } from "../../interfaces/coverage/i-coverage-report.js";
import type { IFunctionCoverage } from "../../interfaces/coverage/i-function-coverage.js";
import type { IScriptCoverage } from "../../interfaces/coverage/i-script-coverage.js";
import { CoverageRange } from "../../models/coverage/coverage-range.js";
import { FunctionCoverage } from "../../models/coverage/function-coverage.js";
import { Resources } from "../../resources.js";

export class CoverageReportReader {
  private static readonly COVERAGE_FILE_SUFFIX: string = ".json";
  private static readonly FILE_URL_PREFIX: string = "file://";
  private static readonly REPORT_LOCATION: string = "report";
  private static readonly TEXT_ENCODING: BufferEncoding = "utf8";

  private readonly includedDirectories: readonly string[];

  public constructor(includedDirectories: readonly string[]) {
    this.includedDirectories = [...includedDirectories];
  }

  public async readAsync(coverageDirectory: string): Promise<Map<string, FunctionCoverage[][]>> {
    const scriptEntriesByFile = new Map<string, FunctionCoverage[][]>();

    for (const reportFileName of (await readdir(coverageDirectory)).sort()) {
      if (!reportFileName.endsWith(CoverageReportReader.COVERAGE_FILE_SUFFIX))
        continue;

      const reportFilePath = join(coverageDirectory, reportFileName);
      let report: unknown;
      try {
        report = JSON.parse(await readFile(reportFilePath, CoverageReportReader.TEXT_ENCODING));
      }
      catch (error) {
        throw new TestingException(Resources.coverageReportMalformed(reportFilePath), new ExceptionOptions(error));
      }

      this.appendReport(report, reportFilePath, scriptEntriesByFile);
    }

    return scriptEntriesByFile;
  }

  private appendReport(report: unknown, reportFilePath: string, scriptEntriesByFile: Map<string, FunctionCoverage[][]>): void {
    const reportObject = this.requireObject(report, reportFilePath, CoverageReportReader.REPORT_LOCATION);
    const resultName = nameof<ICoverageReport>(t => t.result);
    const result = this.getProperty(reportObject, resultName);
    if (!Array.isArray(result))
      this.throwMalformedReport(reportFilePath, Resources.arrayRequired(resultName));

    for (let index = 0; index < result.length; index++)
      this.appendScript(result[index], reportFilePath, index, scriptEntriesByFile);
  }

  private appendScript(scriptCoverage: unknown, reportFilePath: string, scriptIndex: number, scriptEntriesByFile: Map<string, FunctionCoverage[][]>): void {
    const location = CoverageReportReader.indexedLocation(nameof<ICoverageReport>(t => t.result), scriptIndex);
    const scriptObject = this.requireObject(scriptCoverage, reportFilePath, location);
    const urlName = nameof<IScriptCoverage>(t => t.url);
    const url = this.getProperty(scriptObject, urlName);
    if (typeof url !== "string")
      this.throwMalformedReport(reportFilePath, Resources.stringRequired(CoverageReportReader.memberLocation(location, urlName)));

    const functionsName = nameof<IScriptCoverage>(t => t.functions);
    const functionsLocation = CoverageReportReader.memberLocation(location, functionsName);
    const functions = this.getProperty(scriptObject, functionsName);
    if (!Array.isArray(functions))
      this.throwMalformedReport(reportFilePath, Resources.arrayRequired(functionsLocation));

    const functionCoverages: FunctionCoverage[] = [];
    for (let index = 0; index < functions.length; index++)
      functionCoverages.push(this.toFunctionCoverage(functions[index], reportFilePath, CoverageReportReader.indexedLocation(functionsLocation, index)));

    const filePath = this.toIncludedFilePath(url, reportFilePath);
    if (Object.isUndefined(filePath))
      return;

    const scriptEntries = scriptEntriesByFile.get(filePath) ?? [];
    scriptEntriesByFile.set(filePath, scriptEntries);
    scriptEntries.push(functionCoverages);
  }

  private toFunctionCoverage(functionCoverage: unknown, reportFilePath: string, location: string): FunctionCoverage {
    const functionObject = this.requireObject(functionCoverage, reportFilePath, location);
    const rangesName = nameof<IFunctionCoverage>(t => t.ranges);
    const rangesLocation = CoverageReportReader.memberLocation(location, rangesName);
    const ranges = this.getProperty(functionObject, rangesName);
    if (!Array.isArray(ranges) || ranges.length === 0)
      this.throwMalformedReport(reportFilePath, Resources.nonEmptyArrayRequired(rangesLocation));

    return new FunctionCoverage(ranges.map((range, index) => this.toCoverageRange(
      range,
      reportFilePath,
      CoverageReportReader.indexedLocation(rangesLocation, index))));
  }

  private toCoverageRange(range: unknown, reportFilePath: string, location: string): CoverageRange {
    const rangeObject = this.requireObject(range, reportFilePath, location);
    const startOffsetName = nameof<ICoverageRange>(t => t.startOffset);
    const endOffsetName = nameof<ICoverageRange>(t => t.endOffset);
    const countName = nameof<ICoverageRange>(t => t.count);
    const startOffset = this.getProperty(rangeObject, startOffsetName);
    const endOffset = this.getProperty(rangeObject, endOffsetName);
    const count = this.getProperty(rangeObject, countName);

    if (typeof startOffset !== "number" || !Number.isInteger(startOffset) || startOffset < 0)
      this.throwMalformedReport(reportFilePath, Resources.nonNegativeIntegerRequired(CoverageReportReader.memberLocation(location, startOffsetName)));

    if (typeof endOffset !== "number" || !Number.isInteger(endOffset) || endOffset < startOffset)
      this.throwMalformedReport(
        reportFilePath,
        Resources.integerNoSmallerThanRequired(CoverageReportReader.memberLocation(location, endOffsetName), startOffsetName));

    if (typeof count !== "number" || !Number.isInteger(count) || count < 0)
      this.throwMalformedReport(reportFilePath, Resources.nonNegativeIntegerRequired(CoverageReportReader.memberLocation(location, countName)));

    return new CoverageRange(startOffset, endOffset, count);
  }

  private toIncludedFilePath(url: string, reportFilePath: string): string | undefined {
    if (!url.startsWith(CoverageReportReader.FILE_URL_PREFIX))
      return undefined;

    let filePath: string;
    try {
      filePath = fileURLToPath(url).replaceAll(Resources.windowsDirectorySeparator, Resources.directorySeparator);
    }
    catch (error) {
      throw new TestingException(Resources.coverageFileUrlInvalid(reportFilePath, url), new ExceptionOptions(error));
    }

    return this.includedDirectories.some(t => filePath.startsWith(t)) ? filePath : undefined;
  }

  private requireObject(value: unknown, reportFilePath: string, location: string): object {
    if (typeof value !== "object" || Object.isNull(value) || Array.isArray(value))
      this.throwMalformedReport(reportFilePath, Resources.objectRequired(location));

    return value;
  }

  private throwMalformedReport(reportFilePath: string, reason: string): never {
    throw new TestingException(Resources.coverageReportMalformedForReason(reportFilePath, reason));
  }

  private getProperty(owner: object, propertyName: string): unknown {
    return Object.getOwnPropertyDescriptor(owner, propertyName)?.value;
  }

  private static indexedLocation(location: string, index: number): string {
    return `${location}[${index}]`;
  }

  private static memberLocation(location: string, memberName: string): string {
    return `${location}.${memberName}`;
  }
}
