/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import type ICoverageCount from "./interfaces/coverage-count.ts";
import type IRunnerCounts from "./interfaces/runner-counts.ts";
import type IRunnerFindings from "./interfaces/runner-findings.ts";
import type ITestSkip from "./interfaces/test-skip.ts";
import JsonFields from "./json-fields.ts";
import TotalsException from "./totals.exception.ts";

export default class RunnerTotals {
  public static readonly VERSION: number = 1;

  private static readonly FOLDER_SEGMENTS: readonly string[] = ["_build", "totals"];
  private static readonly EXTENSION: string = ".json";
  private static readonly ENCODING: BufferEncoding = "utf8";
  private static readonly TABLE_HEADER: string = "| Tests | Discovered | Executed | Passed | Failed | Skipped | Unselected | Unreached | Coverage |\n|---|---|---|---|---|---|---|---|---|\n";
  private static readonly NOT_MEASURED: string = "Not measured";
  private static readonly RERUN_NOTE: string = "passed when run again; see the flaky record";

  public readonly runner: string;
  public readonly title: string;
  public readonly discovered: number;
  public readonly passed: number;
  public readonly failed: number;
  public readonly skipped: number;
  public readonly unselected: number;
  public readonly unreached: number;
  public readonly skips: readonly ITestSkip[];
  public readonly files: readonly string[];
  public readonly coverage: ICoverageCount | null;
  public readonly duplicates: readonly string[];
  public readonly empty: readonly string[];
  public readonly missing: readonly string[];

  public constructor(runner: string, title: string, counts: IRunnerCounts, skips: readonly ITestSkip[], files: readonly string[], coverage: ICoverageCount | null, findings: IRunnerFindings) {
    this.runner = runner;
    this.title = title;
    this.discovered = counts.discovered;
    this.passed = counts.passed;
    this.failed = counts.failed;
    this.skipped = counts.skipped;
    this.unselected = counts.unselected;
    this.unreached = counts.unreached;
    this.skips = [...skips];
    this.files = [...files];
    this.coverage = coverage;
    this.duplicates = [...findings.duplicates];
    this.empty = [...findings.empty];
    this.missing = [...findings.missing];
  }

  public get executed(): number {
    return this.passed + this.failed;
  }

  public get problems(): readonly string[] {
    return [
      this.countProblem,
      RunnerTotals.formatList(`${this.title} name more than one test the same:`, this.duplicates),
      RunnerTotals.formatList(`${this.title} found no tests in these files:`, this.empty),
      RunnerTotals.formatList(`${this.title} have no result for these files:`, this.missing)
    ].filter(t => t !== null);
  }

  public static parse(text: string, source: string): RunnerTotals {
    const fields = JsonFields.parse(text, source);
    if (fields.count("version") !== RunnerTotals.VERSION)
      throw new TotalsException(`${source} is version ${fields.count("version")} of the test totals, not ${RunnerTotals.VERSION}.`);
    const coverage = fields.has("coverage") ? fields.object("coverage") : null;
    return new RunnerTotals(
      fields.text("runner"),
      fields.text("title"),
      { discovered: fields.count("discovered"), passed: fields.count("passed"), failed: fields.count("failed"), skipped: fields.count("skipped"), unselected: fields.count("unselected"), unreached: fields.count("unreached") },
      fields.objects("skips").map(t => ({ test: t.text("test"), reason: t.text("reason") })),
      fields.texts("files"),
      coverage === null ? null : { unit: coverage.text("unit"), covered: coverage.count("covered"), total: coverage.count("total") },
      { duplicates: fields.texts("duplicates"), empty: fields.texts("empty"), missing: fields.texts("missing") });
  }

  public static async clearAsync(root: string): Promise<void> {
    await rm(path.join(root, ...RunnerTotals.FOLDER_SEGMENTS), { recursive: true, force: true });
  }

  public static async readAllAsync(root: string, runners: readonly string[]): Promise<readonly RunnerTotals[]> {
    const totals: RunnerTotals[] = [];
    for (const runner of runners) {
      const file = RunnerTotals.locate(root, runner);
      if (existsSync(file))
        totals.push(RunnerTotals.parse(await readFile(file, RunnerTotals.ENCODING), path.relative(root, file).split(path.sep).join(path.posix.sep)));
    }
    return totals;
  }

  public static formatTable(totals: readonly RunnerTotals[], rerunPassed: ReadonlyMap<string, number> = new Map()): string {
    const skips = totals.filter(t => t.skips.length > 0).map(t =>
      `\n<details><summary>${RunnerTotals.escape(t.title)} skipped (${t.skips.length})</summary>\n\n${t.skips.map(u => `- ${RunnerTotals.escape(u.test)}: ${RunnerTotals.escape(u.reason)}\n`).join("")}\n</details>\n`);
    return `${RunnerTotals.TABLE_HEADER}${totals.map(t => `| ${RunnerTotals.escape(t.title)} | ${t.discovered} | ${t.executed} | ${t.passed} | ${t.failed}${RunnerTotals.formatRerun(rerunPassed.get(t.title) ?? 0)} | ${t.skipped} | ${t.unselected} | ${t.unreached} | ${t.formatCoverage()} |\n`).join("")}${skips.join("")}`;
  }

  public formatLine(rerunPassed: number = 0): string {
    return `${this.title}: ${this.discovered} discovered, ${this.executed} executed, ${this.passed} passed, ${this.failed} failed${RunnerTotals.formatRerun(rerunPassed)}, ${this.skipped} skipped, ${this.unselected} unselected, ${this.unreached} unreached; coverage ${this.formatCoverage()}.\n` +
      this.skips.map(t => `  Skipped ${t.test}: ${t.reason}\n`).join("");
  }

  public toJson(): string {
    return JSON.stringify({
      version: RunnerTotals.VERSION,
      runner: this.runner,
      title: this.title,
      discovered: this.discovered,
      executed: this.executed,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      unselected: this.unselected,
      unreached: this.unreached,
      skips: this.skips,
      files: this.files,
      coverage: this.coverage,
      duplicates: this.duplicates,
      empty: this.empty,
      missing: this.missing
    });
  }

  public async writeAsync(root: string): Promise<void> {
    const file = RunnerTotals.locate(root, this.runner);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, this.toJson(), RunnerTotals.ENCODING);
  }

  public async recordAsync(root: string, output: Writable): Promise<boolean> {
    await this.writeAsync(root);
    return this.report(output);
  }

  public report(output: Writable): boolean {
    const problems = this.problems;
    output.write(problems.map(t => `${t}\n`).join(""));
    return problems.length === 0;
  }

  private get countProblem(): string | null {
    if (this.unselected < 0)
      return `${this.title} selected more tests than they discovered: ${this.discovered} discovered, but ${this.discovered - this.unselected} selected.`;
    if (this.discovered !== this.executed + this.skipped + this.unselected + this.unreached)
      return `${this.title} don't add up: ${this.discovered} discovered, but ${this.executed} executed, ${this.skipped} skipped, ${this.unselected} unselected and ${this.unreached} unreached.`;
    if (this.skips.length !== this.skipped)
      return `${this.title} name ${this.skips.length} skipped tests but count ${this.skipped}.`;
    return null;
  }

  private formatCoverage(): string {
    if (this.coverage === null)
      return RunnerTotals.NOT_MEASURED;
    const share = this.coverage.total === 0 ? 100 : this.coverage.covered / this.coverage.total * 100;
    return `${share.toFixed(1)}% of ${this.coverage.total} ${this.coverage.unit}`;
  }

  private static locate(root: string, runner: string): string {
    return path.join(root, ...RunnerTotals.FOLDER_SEGMENTS, `${runner}${RunnerTotals.EXTENSION}`);
  }

  private static formatRerun(rerunPassed: number): string {
    return rerunPassed === 0 ? "" : ` (${rerunPassed} ${RunnerTotals.RERUN_NOTE})`;
  }

  private static formatList(heading: string, items: readonly string[]): string | null {
    return items.length === 0 ? null : `${heading}${items.map(t => `\n  ${t}`).join("")}`;
  }

  private static escape(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;").replaceAll("\n", " ");
  }
}
