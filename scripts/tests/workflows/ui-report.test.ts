/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import UiReport from "../../workflows/ui-report.ts";
import UiReportException from "../../workflows/ui-report.exception.ts";

class UiReportTests {
  private static readonly STATS: object = { expected: 4, unexpected: 1, flaky: 1, skipped: 2, duration: 12345.6 };

  public static register(): void {
    test("the report counts the outcomes and names each failure with its first error line", () => {
      const report = UiReport.parse(JSON.stringify({
        stats: UiReportTests.STATS,
        suites: [{
          title: "empty-window.spec.ts",
          specs: [],
          suites: [{
            title: "the empty window",
            specs: [
              { title: "starts", tests: [{ status: "expected", results: [] }] },
              { title: "closes", tests: [{ status: "unexpected", results: [{ errors: [] }, { errors: [{ message: "\n\u001b[31mError: expected 0\u001b[39m\nReceived 1" }] }] }] },
              { title: "logs", tests: [{ status: "expected", results: [{ annotations: [{ type: "platform-log", description: "a" }, { type: "environment", description: "{}" }, { type: "platform-log", description: "b" }] }] }] },
              { title: "is quiet", tests: [{ status: "unexpected", results: [{ errors: [{ message: " " }] }] }] }
            ]
          }]
        }, { title: "", specs: [{ title: "top-level", tests: [{ status: "unexpected" }] }] }]
      }));

      assert.deepEqual([report.passed, report.failed, report.flaky, report.skipped, report.durationMs, report.platformLogLines], [4, 1, 1, 2, 12345.6, 2]);
      assert.deepEqual(report.failures.map(t => [t.title, t.message]), [
        ["empty-window.spec.ts › the empty window › closes", "Error: expected 0"],
        ["empty-window.spec.ts › the empty window › is quiet", "No error message was reported."],
        ["top-level", "No error message was reported."]
      ]);
    });

    test("the summary shows the counts, the duration and the screenshot link, or says there is no screenshot", () => {
      const report = new UiReport(5, 0, 0, 0, 2500, [], 3);

      assert.equal(report.formatSummary("Linux x64", "https://github.com/noldova-com/teamrun/actions/runs/1/artifacts/2"),
        "### UI workflows: Linux x64\n\n| Passed | Failed | Flaky | Skipped | Duration | Platform log lines |\n|---|---|---|---|---|---|\n| 5 | 0 | 0 | 0 | 2.5 s | 3 |\n\n" +
        "[Main window screenshot](https://github.com/noldova-com/teamrun/actions/runs/1/artifacts/2)\n");
      assert.ok(report.formatSummary("Linux x64", undefined).endsWith("\n\nNo main-window screenshot was kept.\n"));
      assert.ok(report.formatSummary("Linux x64", "").endsWith("\n\nNo main-window screenshot was kept.\n"));
    });

    test("the summary lists at most twenty failures, escaped, and counts the rest", () => {
      const failures = Array.from({ length: 22 }, (_, index) => ({ title: `case ${index}`, message: "a <b> & c | `d`" }));
      const report = new UiReport(0, 22, 0, 0, 0, failures, 0);

      const summary = report.formatSummary("macOS <ARM64>", undefined);

      assert.ok(summary.startsWith("### UI workflows: macOS &lt;ARM64&gt;\n"));
      assert.ok(summary.includes("\n<details><summary>Failures (22)</summary>\n\n- case 0: a &lt;b&gt; &amp; c &#124; &#96;d&#96;\n"));
      assert.ok(summary.includes("\n- case 19: "));
      assert.ok(!summary.includes("case 20"));
      assert.ok(summary.endsWith("\n- and 2 more\n\n</details>\n"));
    });

    test("a long error line is cut to three hundred characters", () => {
      const report = UiReport.parse(JSON.stringify({
        stats: UiReportTests.STATS,
        suites: [{ title: "a", specs: [{ title: "b", tests: [{ status: "unexpected", results: [{ errors: [{ message: "x".repeat(400) }] }] }] }] }]
      }));

      assert.equal(report.failures[0]?.message.length, 300);
    });

    test("text that is not a Playwright JSON report is refused", () => {
      const malformed = [
        "{",
        "null",
        "{}",
        JSON.stringify({ stats: { ...UiReportTests.STATS, expected: -1 } }),
        JSON.stringify({ stats: { ...UiReportTests.STATS, duration: "1" } }),
        JSON.stringify({ stats: UiReportTests.STATS, suites: {} }),
        JSON.stringify({ stats: UiReportTests.STATS, suites: [1] }),
        JSON.stringify({ stats: UiReportTests.STATS, suites: [{ title: 1 }] }),
        JSON.stringify({ stats: UiReportTests.STATS, suites: [{ title: "a", specs: [null] }] }),
        JSON.stringify({ stats: UiReportTests.STATS, suites: [{ title: "a", specs: [{ title: "b", tests: [{ status: 2 }] }] }] }),
        JSON.stringify({ stats: UiReportTests.STATS, suites: [{ title: "a", specs: [{ title: "b", tests: [{ status: "expected", results: [{ annotations: [{ type: 3 }] }] }] }] }] })
      ];

      for (const text of malformed)
        assert.throws(() => UiReport.parse(text), new UiReportException("The UI workflow report is not a Playwright JSON report."), text);
    });
  }
}

UiReportTests.register();
