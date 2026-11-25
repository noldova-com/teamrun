/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import type { CoverageResult } from "@noldova/context.testing";

import type { ICoverageCount } from "../totals/interfaces/i-coverage-count.ts";
import { TotalsException } from "../totals/totals.exception.ts";
import type { ICoverageProject } from "./interfaces/i-coverage-project.ts";

export class PackageCoverage {
  private static readonly UNIT: string = "files";
  private static readonly REPORT_SUFFIX: string = ".json";
  private static readonly REPORT_ENCODING: BufferEncoding = "utf8";
  private static readonly SCRIPT_PATTERN: RegExp = /"url":"(file:[^"]+)"/gu;
  private static readonly NAMED_SCRIPTS: number = 5;
  private static readonly SETTLE_MILLISECONDS: number = 5_000;
  private static readonly POLL_MILLISECONDS: number = 250;

  private readonly skipsCoveredDetails: boolean;
  private readonly settleMilliseconds: number;
  private readonly pollMilliseconds: number;

  public constructor(skipsCoveredDetails: boolean, settleMilliseconds: number = PackageCoverage.SETTLE_MILLISECONDS, pollMilliseconds: number = PackageCoverage.POLL_MILLISECONDS) {
    this.skipsCoveredDetails = skipsCoveredDetails;
    this.settleMilliseconds = settleMilliseconds;
    this.pollMilliseconds = pollMilliseconds;
  }

  private static locateReal(directory: string): string {
    return existsSync(directory) ? realpathSync(directory) : directory;
  }

  public async measureAsync(coverageDirectory: string, projects: readonly ICoverageProject[], output: Writable, leftOut: ReadonlySet<string> = new Set()): Promise<ICoverageCount> {
    const testing = await import("@noldova/context.testing");
    const analyzer = new testing.CoverageAnalyzer();
    const covered = projects.map(t => new testing.CoverageProject(t.name, PackageCoverage.locateReal(t.productionDirectory), t.sourceDirectory));
    const deadline = Date.now() + this.settleMilliseconds;
    let analyzed: CoverageResult | null = null;
    while (Object.isNull(analyzed)) {
      try {
        analyzed = await analyzer.analyzeAsync(coverageDirectory, covered);
      }
      catch (error) {
        if (!(error instanceof testing.TestingException))
          throw error;
        await this.awaitWholeReportsAsync(coverageDirectory, deadline, error, output);
      }
    }
    const result = new testing.CoverageResult(analyzed.fileCoverages.filter(t => !leftOut.has(`${t.projectName}/${t.relativePath}`)));
    output.write(new testing.CoverageReportWriter().formatLines(result, this.skipsCoveredDetails).map(t => `${t}\n`).join(""));
    const total = result.executableFileCoverages.length;
    return { unit: PackageCoverage.UNIT, covered: total - result.incompleteFileCoverages.length, total };
  }

  private async awaitWholeReportsAsync(coverageDirectory: string, deadline: number, error: Error, output: Writable): Promise<void> {
    const first = await PackageCoverage.findPartialReportAsync(coverageDirectory);
    if (Object.isNull(first))
      throw new TotalsException(error.message, { cause: error });
    const described = await PackageCoverage.describeAsync(coverageDirectory, first);
    let partial: string | null = first;
    while (!Object.isNull(partial) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, this.pollMilliseconds));
      partial = await PackageCoverage.findPartialReportAsync(coverageDirectory);
    }
    if (!Object.isNull(partial))
      throw new TotalsException(`${await PackageCoverage.describeAsync(coverageDirectory, partial)}; it is still not whole after ${this.settleMilliseconds} ms.`, { cause: error });
    output.write(`${described}; it became whole, so the coverage is measured again.\n`);
  }

  private static async findPartialReportAsync(coverageDirectory: string): Promise<string | null> {
    for (const name of (await readdir(coverageDirectory)).filter(t => t.endsWith(PackageCoverage.REPORT_SUFFIX)).toSorted()) {
      try {
        JSON.parse(await readFile(path.join(coverageDirectory, name), PackageCoverage.REPORT_ENCODING));
      }
      catch {
        return name;
      }
    }
    return null;
  }

  private static async describeAsync(coverageDirectory: string, name: string): Promise<string> {
    const file = path.join(coverageDirectory, name);
    const [text, details] = await Promise.all([readFile(file, PackageCoverage.REPORT_ENCODING), stat(file)]);
    const scripts = [...new Set([...text.matchAll(PackageCoverage.SCRIPT_PATTERN)].flatMap(t => Object.isUndefined(t[1]) ? [] : [path.relative(process.cwd(), fileURLToPath(t[1]))]))];
    const named = scripts.slice(0, PackageCoverage.NAMED_SCRIPTS).join(", ");
    const more = scripts.length > PackageCoverage.NAMED_SCRIPTS ? ` and ${scripts.length - PackageCoverage.NAMED_SCRIPTS} more` : "";
    return `The coverage report ${name} is not whole JSON: ${details.size} bytes, written ${Math.round(Date.now() - details.mtimeMs)} ms ago, covering ${named.length > 0 ? `${named}${more}` : "no script"}`;
  }
}
