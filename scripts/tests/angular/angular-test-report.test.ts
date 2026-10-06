/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import AngularTestReport from "../../angular/angular-test-report.ts";
import TotalsException from "../../totals/totals.exception.ts";

class AngularTestReportTests {
  public static register(): void {
    test("each test in the report counts by its status, skipped and to-do tests are named by their file, suites and title, and the files are sorted", () => {
      const result = new AngularTestReport("report.json", t => `named/${t}`).read([
        {
          name: "b.spec.ts",
          status: "failed",
          assertionResults: [
            { ancestorTitles: ["B"], title: "passes", status: "passed" },
            { ancestorTitles: ["B"], title: "fails", status: "failed" },
            { ancestorTitles: ["B", "later"], title: "waits", status: "skipped" },
            { ancestorTitles: [], title: "someday", status: "todo" },
            { ancestorTitles: ["B"], title: "never ran", status: "pending" }
          ]
        },
        { name: "a.spec.ts", status: "passed", assertionResults: [{ ancestorTitles: ["A"], title: "passes", status: "passed" }] }
      ]);

      assert.deepEqual([result.passed, result.failed, result.skipped, result.unreached, result.discovered, result.selected], [2, 1, 2, 1, 6, 6]);
      assert.deepEqual(result.skips, [
        { file: "named/b.spec.ts", names: ["B", "later", "waits"], reason: "No reason given." },
        { file: "named/b.spec.ts", names: ["someday"], reason: "To do." }
      ]);
      assert.deepEqual(result.files, ["named/a.spec.ts", "named/b.spec.ts"]);
    });

    test("a file that failed without a failed test, as when it cannot load or, as Vitest reports it, has no test, counts as one failed test", () => {
      const result = new AngularTestReport("report.json", t => t).read([
        { name: "broken.spec.ts", status: "failed", message: "Cannot find module './missing'", assertionResults: [] },
        { name: "empty.spec.ts", status: "failed", message: "No test suite found in file /repository/src/empty.spec.ts", assertionResults: [] }
      ]);

      assert.deepEqual([result.passed, result.failed, result.files, result.empty], [0, 2, ["broken.spec.ts", "empty.spec.ts"], []]);
    });

    test("a file that did not fail without tests is empty, and tests of one file with the same suites and title are named once as duplicates", () => {
      const same = { ancestorTitles: ["D"], title: "same", status: "passed" };
      const result = new AngularTestReport("report.json", t => t).read([
        { name: "z.spec.ts", status: "passed", assertionResults: [] },
        { name: "b.spec.ts", status: "passed", assertionResults: [same, same, { ...same, status: "skipped" }, { ancestorTitles: [], title: "D same", status: "passed" }] },
        { name: "c.spec.ts", status: "passed", assertionResults: [same] },
        { name: "a.spec.ts", status: "skipped", assertionResults: [] }
      ]);

      assert.deepEqual([result.passed, result.skipped, result.failed], [4, 1, 0]);
      assert.deepEqual(result.duplicates, [{ file: "b.spec.ts", names: ["D", "same"] }]);
      assert.deepEqual(result.empty, ["a.spec.ts", "z.spec.ts"]);
    });

    test("a test that passed only when Vitest ran it again counts as failed, as it did in its first run", () => {
      const result = new AngularTestReport("report.json", t => t).read([{
        name: "a.spec.ts",
        status: "passed",
        assertionResults: [
          { ancestorTitles: ["A"], title: "steady", status: "passed", failureMessages: [] },
          { ancestorTitles: ["A"], title: "retried", status: "passed", failureMessages: ["Error: timed out"] }
        ]
      }]);

      assert.deepEqual([result.passed, result.failed], [1, 1]);
    });

    test("a test with an unknown status, or a file without its tests, is refused with its place in the report", () => {
      const read = (results: readonly unknown[]): unknown => new AngularTestReport("report.json", t => t).read(results);

      assert.throws(() => read([{ name: "a.spec.ts", status: "passed", assertionResults: [{ ancestorTitles: [], title: "x", status: "flaky" }] }]),
        new TotalsException("report.json gives a.spec.ts an unknown test status \"flaky\"."));
      assert.throws(() => read([{ name: "a.spec.ts", status: "passed" }]), new TotalsException("report.json, test file 1, has no list assertionResults."));
    });
  }
}

AngularTestReportTests.register();
