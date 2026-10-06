/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import FlakyTest from "../../checks/flaky-test.ts";
import RunnerTotals from "../../totals/runner-totals.ts";
import UiReport from "../../workflows/ui-report.ts";
import UiReportException from "../../workflows/ui-report.exception.ts";

class UiReportTests {
  private static readonly STATS: object = { duration: 12345.6 };
  private static readonly TOTALS: RunnerTotals = new RunnerTotals("ui", "UI workflows", { discovered: 6, passed: 5, failed: 0, rerunPassed: 0, skipped: 1, unselected: 0, unreached: 0 }, [{ test: "e2e/a.spec.ts › waits", reason: "Later." }], ["e2e/a.spec.ts"], null, { duplicates: [], empty: [] }, { expected: ["e2e/a.spec.ts"], shard: null });

  public static register(): void {
    test("the report keeps the run's duration and platform log lines and names each failure with its first error line", () => {
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

      assert.deepEqual([report.durationMs, report.platformLogLines], [12345.6, 2]);
      assert.deepEqual(report.failures.map(t => [t.title, t.message]), [
        ["empty-window.spec.ts › the empty window › closes", "Error: expected 0"],
        ["empty-window.spec.ts › the empty window › is quiet", "No error message was reported."],
        ["top-level", "No error message was reported."]
      ]);
    });

    test("each test that passed only on retry is flaky, named with its suites, its spec file and its first full error", () => {
      const report = UiReport.parse(JSON.stringify({
        stats: UiReportTests.STATS,
        suites: [{
          title: "docking.spec.ts",
          specs: [
            { title: "docks", file: "docking.spec.ts", tests: [{ status: "flaky", results: [{ errors: [] }, { errors: [{ message: "\u001b[31mError: first\u001b[39m\n    at docking.spec.ts:3" }] }, { errors: [] }] }] },
            { title: "undocks", file: "docking.spec.ts", tests: [{ status: "flaky", results: [] }] },
            { title: "stays", file: "docking.spec.ts", tests: [{ status: "expected", results: [] }] }
          ]
        }]
      }));

      assert.deepEqual(report.flakyTests, [
        new FlakyTest("UI workflows", "src/shell/desktop/tests/e2e/docking.spec.ts", "docking.spec.ts › docks", "Error: first\n    at docking.spec.ts:3"),
        new FlakyTest("UI workflows", "src/shell/desktop/tests/e2e/docking.spec.ts", "docking.spec.ts › undocks", "")
      ]);
      assert.deepEqual(report.failures, []);
    });

    test("the summary shows the totals with their skipped tests, the duration and the screenshot link, or says there is no screenshot", () => {
      const report = new UiReport(2500, [], 3, []);

      assert.equal(report.formatSummary("Linux x64", UiReportTests.TOTALS, "https://github.com/noldova-com/teamrun/actions/runs/1/artifacts/2", false),
        "### UI workflows: Linux x64\n\n| Tests | Discovered | Executed | Passed | Failed | Skipped | Unselected | Unreached | Coverage |\n|---|---|---|---|---|---|---|---|---|\n" +
        "| UI workflows | 6 | 5 | 5 | 0 | 1 | 0 | 0 | Not measured |\n\n<details><summary>UI workflows skipped (1)</summary>\n\n- e2e/a.spec.ts › waits: Later.\n\n</details>\n\n" +
        "Duration 2.5 s, 3 platform log lines.\n\n[Main window screenshot](https://github.com/noldova-com/teamrun/actions/runs/1/artifacts/2)\n");
      assert.ok(report.formatSummary("Linux x64", UiReportTests.TOTALS, undefined, false).endsWith("\n\nNo main-window screenshot was kept.\n"));
      assert.ok(report.formatSummary("Linux x64", UiReportTests.TOTALS, "", false).endsWith("\n\nNo main-window screenshot was kept.\n"));
      assert.ok(report.formatSummary("Linux x64", UiReportTests.TOTALS, "", true).endsWith("\n\nNo main-window screenshot link: its upload failed.\n"));
      assert.ok(report.formatSummary("Linux x64", UiReportTests.TOTALS, "https://example.com/a", true).endsWith("[Main window screenshot](https://example.com/a)\n"));
    });

    test("the summary says beside the failed count how many tests the totals record as passing only when run again", () => {
      const totals = new RunnerTotals("ui", "UI workflows", { discovered: 2, passed: 1, failed: 1, rerunPassed: 1, skipped: 0, unselected: 0, unreached: 0 }, [], ["e2e/a.spec.ts"], null, { duplicates: [], empty: [] }, { expected: ["e2e/a.spec.ts"], shard: "1/2" });
      const report = new UiReport(0, [], 0, [new FlakyTest("UI workflows", "src/shell/desktop/tests/e2e/a.spec.ts", "a.spec.ts › docks", "Error: first")]);

      assert.ok(report.formatSummary("Linux x64", totals, undefined, false).includes("| UI workflows | 2 | 2 | 1 | 1 (1 passed when run again; see the flaky record) | 0 | 0 | 0 | Not measured |\n"));
    });

    test("the summary lists at most twenty failures, escaped, and counts the rest", () => {
      const failures = Array.from({ length: 22 }, (_, index) => ({ title: `case ${index}`, message: "a <b> & c | `d`" }));
      const report = new UiReport(0, failures, 0, []);

      const summary = report.formatSummary("macOS <ARM64>", UiReportTests.TOTALS, undefined, false);

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
        JSON.stringify({ stats: { ...UiReportTests.STATS, duration: -1 } }),
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
