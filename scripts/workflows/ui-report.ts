/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stripVTControlCharacters } from "node:util";

import FlakyTest from "../checks/flaky-test.ts";
import UiFailure from "./ui-failure.ts";
import UiReportException from "./ui-report.exception.ts";

export default class UiReport {
  private static readonly FAILED_STATUS: string = "unexpected";
  private static readonly FLAKY_STATUS: string = "flaky";
  private static readonly RUNNER: string = "UI workflows";
  private static readonly WORKFLOW_FOLDER: string = "src/shell/desktop/tests/e2e";
  private static readonly PLATFORM_LOG: string = "platform-log";
  private static readonly MAXIMUM_FAILURES: number = 20;
  private static readonly MAXIMUM_MESSAGE_LENGTH: number = 300;
  private static readonly TITLE_SEPARATOR: string = " › ";
  private static readonly MALFORMED: string = "The UI workflow report is not a Playwright JSON report.";

  public readonly passed: number;
  public readonly failed: number;
  public readonly flaky: number;
  public readonly skipped: number;
  public readonly durationMs: number;
  public readonly failures: readonly UiFailure[];
  public readonly platformLogLines: number;
  public readonly flakyTests: readonly FlakyTest[];

  public constructor(passed: number, failed: number, flaky: number, skipped: number, durationMs: number, failures: readonly UiFailure[], platformLogLines: number, flakyTests: readonly FlakyTest[]) {
    this.passed = passed;
    this.failed = failed;
    this.flaky = flaky;
    this.skipped = skipped;
    this.durationMs = durationMs;
    this.failures = [...failures];
    this.platformLogLines = platformLogLines;
    this.flakyTests = [...flakyTests];
  }

  public static parse(text: string): UiReport {
    let report: unknown;
    try {
      report = JSON.parse(text);
    }
    catch (error) {
      throw new UiReportException(UiReport.MALFORMED, { cause: error });
    }

    const stats = UiReport.read(report, "stats");
    const failures: UiFailure[] = [];
    const flakyTests: FlakyTest[] = [];
    let platformLogLines = 0;
    for (const suite of UiReport.readList(report, "suites"))
      platformLogLines += UiReport.collect(suite, [], failures, flakyTests);
    return new UiReport(
      UiReport.readCount(stats, "expected"),
      UiReport.readCount(stats, "unexpected"),
      UiReport.readCount(stats, "flaky"),
      UiReport.readCount(stats, "skipped"),
      UiReport.readCount(stats, "duration"),
      failures,
      platformLogLines,
      flakyTests);
  }

  public formatSummary(target: string, screenshotUrl: string | undefined, isUploadFailed: boolean = false): string {
    const lines = [
      `### UI workflows: ${UiReport.escape(target)}`,
      "",
      "| Passed | Failed | Flaky | Skipped | Duration | Platform log lines |",
      "|---|---|---|---|---|---|",
      `| ${this.passed} | ${this.failed} | ${this.flaky} | ${this.skipped} | ${(this.durationMs / 1000).toFixed(1)} s | ${this.platformLogLines} |`,
      "",
      screenshotUrl === undefined || screenshotUrl.length === 0 ? (isUploadFailed ? "No main-window screenshot link: its upload failed." : "No main-window screenshot was kept.") : `[Main window screenshot](${encodeURI(screenshotUrl)})`
    ];
    if (this.failures.length > 0) {
      lines.push("", `<details><summary>Failures (${this.failures.length})</summary>`, "");
      for (const failure of this.failures.slice(0, UiReport.MAXIMUM_FAILURES))
        lines.push(`- ${UiReport.escape(failure.title)}: ${UiReport.escape(failure.message)}`);
      if (this.failures.length > UiReport.MAXIMUM_FAILURES)
        lines.push(`- and ${this.failures.length - UiReport.MAXIMUM_FAILURES} more`);
      lines.push("", "</details>");
    }
    return `${lines.join("\n")}\n`;
  }

  private static collect(suite: unknown, titles: readonly string[], failures: UiFailure[], flakyTests: FlakyTest[]): number {
    const title = UiReport.readText(suite, "title");
    const path = title.length === 0 ? titles : [...titles, title];
    let platformLogLines = 0;
    for (const spec of UiReport.readList(suite, "specs"))
      for (const test of UiReport.readList(spec, "tests")) {
        platformLogLines += UiReport.countPlatformLog(test);
        const status = UiReport.readText(test, "status");
        const name = [...path, UiReport.readText(spec, "title")].join(UiReport.TITLE_SEPARATOR);
        if (status === UiReport.FAILED_STATUS)
          failures.push(new UiFailure(name, UiReport.firstError(test)));
        if (status === UiReport.FLAKY_STATUS)
          flakyTests.push(new FlakyTest(UiReport.RUNNER, `${UiReport.WORKFLOW_FOLDER}/${UiReport.readText(spec, "file")}`, name, UiReport.firstFailure(test)));
      }
    for (const child of UiReport.readList(suite, "suites"))
      platformLogLines += UiReport.collect(child, path, failures, flakyTests);
    return platformLogLines;
  }

  private static countPlatformLog(test: unknown): number {
    return UiReport.readList(test, "results").reduce<number>(
      (sum, result) => sum + UiReport.readList(result, "annotations").filter(t => UiReport.readText(t, "type") === UiReport.PLATFORM_LOG).length,
      0);
  }

  private static firstError(test: unknown): string {
    for (const result of UiReport.readList(test, "results"))
      for (const error of UiReport.readList(result, "errors")) {
        const line = stripVTControlCharacters(UiReport.readText(error, "message")).split("\n").find(t => t.trim().length > 0);
        if (line !== undefined)
          return line.trim().slice(0, UiReport.MAXIMUM_MESSAGE_LENGTH);
      }
    return "No error message was reported.";
  }

  private static firstFailure(test: unknown): string {
    const error = UiReport.readList(test, "results").flatMap(t => UiReport.readList(t, "errors")).at(0);
    return error === undefined ? "" : stripVTControlCharacters(UiReport.readText(error, "message"));
  }

  private static read(value: unknown, name: string): unknown {
    if (typeof value !== "object" || value === null || !(name in value))
      throw new UiReportException(UiReport.MALFORMED);
    return (value as Record<string, unknown>)[name];
  }

  private static readList(value: unknown, name: string): readonly unknown[] {
    if (typeof value !== "object" || value === null)
      throw new UiReportException(UiReport.MALFORMED);
    const list = name in value ? (value as Record<string, unknown>)[name] : [];
    if (!Array.isArray(list))
      throw new UiReportException(UiReport.MALFORMED);
    return list;
  }

  private static readCount(value: unknown, name: string): number {
    const count = UiReport.read(value, name);
    if (typeof count !== "number" || !Number.isFinite(count) || count < 0)
      throw new UiReportException(UiReport.MALFORMED);
    return count;
  }

  private static readText(value: unknown, name: string): string {
    const text = UiReport.read(value, name);
    if (typeof text !== "string")
      throw new UiReportException(UiReport.MALFORMED);
    return text;
  }

  private static escape(text: string): string {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("|", "&#124;").replaceAll("`", "&#96;").replaceAll("\n", " ");
  }
}
