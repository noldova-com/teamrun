/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { glob } from "node:fs/promises";
import path from "node:path";

import type IRunnerSkip from "../totals/interfaces/i-runner-skip.ts";
import JsonFields from "../totals/json-fields.ts";
import RunnerResult from "../totals/runner-result.ts";
import TestNames from "../totals/test-names.ts";
import type IUiTest from "./interfaces/i-ui-test.ts";

export default class UiTestReport {
  private static readonly SKIPPED: string = "skipped";
  private static readonly STOPPED: ReadonlySet<string> = new Set(["interrupted", "skipped"]);
  private static readonly SKIP_ANNOTATION: string = "skip";
  private static readonly NO_REASON: string = "No reason given.";

  private readonly root: string;
  private readonly source: string;
  private readonly skips: IRunnerSkip[] = [];
  private readonly tests: TestNames = new TestNames();
  private passed: number = 0;
  private failed: number = 0;
  private unreached: number = 0;

  public constructor(root: string, source: string) {
    this.root = root;
    this.source = source;
  }

  public async readAsync(report: JsonFields, list: JsonFields): Promise<RunnerResult> {
    const ran = this.collect(report);
    const listed = this.collect(list);
    const listedFiles = new Set(listed.map(t => t.file));
    ran.forEach(t => this.count(t));
    const testFiles = await this.listTestFilesAsync(list.object("config"));
    return new RunnerResult(new JsonFields({
      discovered: listed.length,
      selected: ran.length,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skips.length,
      unreached: this.unreached,
      skips: this.skips,
      files: [...new Set(ran.map(t => t.file))].sort(),
      duplicates: this.tests.duplicates,
      empty: testFiles.filter(t => !listedFiles.has(t))
    }, this.source));
  }

  private collect(report: JsonFields): IUiTest[] {
    const rootDir = report.object("config").text("rootDir");
    return report.objects("suites").flatMap(t => this.collectSuite(t, rootDir, []));
  }

  private collectSuite(suite: JsonFields, rootDir: string, titles: readonly string[]): IUiTest[] {
    const tests = suite.objects("specs").flatMap(t => t.objects("tests").map(u => ({ file: this.relate(rootDir, t.text("file")), names: [...titles, t.text("title")], test: u })));
    const suites = suite.has("suites") ? suite.objects("suites") : [];
    return [...tests, ...suites.flatMap(t => this.collectSuite(t, rootDir, [...titles, t.text("title")]))];
  }

  private count(test: IUiTest): void {
    const result = test.test.objects("results").at(0);
    const expected = test.test.text("expectedStatus");
    this.tests.add(test.file, test.names);
    if (result === undefined)
      this.unreached++;
    else if (expected === UiTestReport.SKIPPED)
      this.skips.push({ file: test.file, names: test.names, reason: UiTestReport.findReason(result.objects("annotations")) });
    else if (result.text("status") === expected)
      this.passed++;
    else if (UiTestReport.STOPPED.has(result.text("status")))
      this.unreached++;
    else
      this.failed++;
  }

  private async listTestFilesAsync(config: JsonFields): Promise<string[]> {
    const files = new Set<string>();
    for (const project of config.objects("projects"))
      for await (const file of glob([...project.texts("testMatch")], { cwd: project.text("testDir"), exclude: [...project.texts("testIgnore")] }))
        files.add(this.relate(project.text("testDir"), file));
    return [...files].sort();
  }

  private relate(directory: string, file: string): string {
    return path.relative(this.root, path.resolve(directory, file)).split(path.sep).join(path.posix.sep);
  }

  private static findReason(annotations: readonly JsonFields[]): string {
    const annotation = annotations.find(t => t.text("type") === UiTestReport.SKIP_ANNOTATION && t.has("description"));
    return annotation?.text("description") ?? UiTestReport.NO_REASON;
  }
}
