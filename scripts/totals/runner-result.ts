/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type ICoverageCount from "./interfaces/i-coverage-count.ts";
import type IRunnerSkip from "./interfaces/i-runner-skip.ts";
import type ITestName from "./interfaces/i-test-name.ts";
import JsonFields from "./json-fields.ts";
import RunnerTotals from "./runner-totals.ts";
import TestIdentity from "./test-identity.ts";
import TotalsException from "./totals.exception.ts";

export default class RunnerResult {
  private static readonly ENCODING: BufferEncoding = "utf8";

  public readonly discovered: number;
  public readonly selected: number;
  public readonly passed: number;
  public readonly failed: number;
  public readonly skipped: number;
  public readonly unreached: number;
  public readonly skips: readonly IRunnerSkip[];
  public readonly files: readonly string[];
  public readonly duplicates: readonly ITestName[];
  public readonly empty: readonly string[];

  public constructor(fields: JsonFields) {
    this.passed = fields.count("passed");
    this.failed = fields.count("failed");
    this.skipped = fields.count("skipped");
    this.unreached = fields.count("unreached");
    const total = this.passed + this.failed + this.skipped + this.unreached;
    this.discovered = fields.has("discovered") ? fields.count("discovered") : total;
    this.selected = fields.has("selected") ? fields.count("selected") : total;
    this.skips = fields.objects("skips").map(t => ({ file: t.text("file"), names: t.texts("names"), reason: t.text("reason") }));
    this.files = fields.texts("files");
    this.duplicates = fields.has("duplicates") ? fields.objects("duplicates").map(t => ({ file: t.text("file"), names: t.texts("names") })) : [];
    this.empty = fields.has("empty") ? fields.texts("empty") : [];
  }

  public static parse(text: string, source: string): RunnerResult {
    return new RunnerResult(JsonFields.parse(text, source));
  }

  public static async readAsync(root: string, file: string): Promise<RunnerResult> {
    const source = path.relative(root, file).split(path.sep).join(path.posix.sep);
    if (!existsSync(file))
      throw new TotalsException(`The test runner wrote no result to ${source}.`);
    return RunnerResult.parse(await readFile(file, RunnerResult.ENCODING), source);
  }

  public toTotals(runner: string, title: string, coverage: ICoverageCount | null, expected: readonly string[]): RunnerTotals {
    const files = new Set(this.files);
    return new RunnerTotals(
      runner,
      title,
      { discovered: this.discovered, passed: this.passed, failed: this.failed, skipped: this.skipped, unselected: this.discovered - this.selected, unreached: this.unreached },
      this.skips.map(t => ({ test: TestIdentity.of(t.file, t.names), reason: t.reason })),
      this.files,
      coverage,
      { duplicates: this.duplicates.map(t => TestIdentity.of(t.file, t.names)), empty: this.empty, missing: expected.filter(t => !files.has(t)) });
  }
}
