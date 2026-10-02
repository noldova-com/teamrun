/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stripVTControlCharacters } from "node:util";

import UiFailure from "./ui-failure.ts";
import UiReportException from "./ui-report.exception.ts";

export default class UiReport {
  private static readonly FAILED_STATUS: string = "unexpected";
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

  public constructor(passed: number, failed: number, flaky: number, skipped: number, durationMs: number, failures: readonly UiFailure[]) {
    this.passed = passed;
    this.failed = failed;
    this.flaky = flaky;
    this.skipped = skipped;
    this.durationMs = durationMs;
    this.failures = [...failures];
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
    for (const suite of UiReport.readList(report, "suites"))
      UiReport.collectFailures(suite, [], failures);
    return new UiReport(
      UiReport.readCount(stats, "expected"),
      UiReport.readCount(stats, "unexpected"),
      UiReport.readCount(stats, "flaky"),
      UiReport.readCount(stats, "skipped"),
      UiReport.readCount(stats, "duration"),
      failures);
  }

  public formatSummary(target: string, screenshotUrl: string | undefined): string {
    const lines = [
      `### UI workflows: ${UiReport.escape(target)}`,
      "",
      "| Passed | Failed | Flaky | Skipped | Duration |",
      "|---|---|---|---|---|",
      `| ${this.passed} | ${this.failed} | ${this.flaky} | ${this.skipped} | ${(this.durationMs / 1000).toFixed(1)} s |`,
      "",
      screenshotUrl === undefined || screenshotUrl.length === 0 ? "No main-window screenshot was kept." : `[Main window screenshot](${encodeURI(screenshotUrl)})`
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

  private static collectFailures(suite: unknown, titles: readonly string[], failures: UiFailure[]): void {
    const title = UiReport.readText(suite, "title");
    const path = title.length === 0 ? titles : [...titles, title];
    for (const spec of UiReport.readList(suite, "specs"))
      for (const test of UiReport.readList(spec, "tests"))
        if (UiReport.readText(test, "status") === UiReport.FAILED_STATUS)
          failures.push(new UiFailure([...path, UiReport.readText(spec, "title")].join(UiReport.TITLE_SEPARATOR), UiReport.firstError(test)));
    for (const child of UiReport.readList(suite, "suites"))
      UiReport.collectFailures(child, path, failures);
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
