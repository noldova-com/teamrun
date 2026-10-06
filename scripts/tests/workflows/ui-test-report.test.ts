/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test, type TestContext } from "node:test";

import JsonFields from "../../totals/json-fields.ts";
import TotalsException from "../../totals/totals.exception.ts";
import UiTestReport from "../../workflows/ui-test-report.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class UiTestReportTests {
  public static register(): void {
    test("each test counts by its first result: a skip by its expected status with its reason, a cut-off or missing result as unreached, and a retried pass as failed", async t => {
      const root = await UiTestReportTests.createRootAsync(t, { "e2e/a.spec.ts": "" });
      const skip = (annotations: readonly object[]): object => ({ expectedStatus: "skipped", results: [{ status: "skipped", annotations }] });
      const report = UiTestReportTests.report(root, [{
        title: "a.spec.ts",
        specs: [UiTestReportTests.spec("a.spec.ts", "top", { expectedStatus: "passed", results: [{ status: "passed" }] })],
        suites: [{
          title: "group",
          specs: [
            UiTestReportTests.spec("a.spec.ts", "skipped", skip([{ type: "skip" }])),
            UiTestReportTests.spec("a.spec.ts", "skipped inside", skip([{ type: "fixme", description: "Not this." }, { type: "skip", description: "Inside reason." }])),
            UiTestReportTests.spec("a.spec.ts", "fails expectedly", { expectedStatus: "failed", results: [{ status: "failed" }] }),
            UiTestReportTests.spec("a.spec.ts", "flaky", { expectedStatus: "passed", results: [{ status: "failed" }, { status: "passed" }] }),
            UiTestReportTests.spec("a.spec.ts", "times out", { expectedStatus: "passed", results: [{ status: "timedOut" }] }),
            UiTestReportTests.spec("a.spec.ts", "never ran", { expectedStatus: "skipped", results: [] }),
            UiTestReportTests.spec("a.spec.ts", "interrupted", { expectedStatus: "passed", results: [{ status: "interrupted" }] }),
            UiTestReportTests.spec("a.spec.ts", "cut off", { expectedStatus: "passed", results: [{ status: "skipped", annotations: [] }] })
          ]
        }]
      }]);

      const result = await new UiTestReport(root, "report.json").readAsync(report, report);

      assert.deepEqual([result.discovered, result.selected, result.passed, result.failed, result.skipped, result.unreached], [9, 9, 2, 2, 2, 3]);
      assert.deepEqual(result.skips, [
        { file: "e2e/a.spec.ts", names: ["group", "skipped"], reason: "No reason given." },
        { file: "e2e/a.spec.ts", names: ["group", "skipped inside"], reason: "Inside reason." }
      ]);
      assert.deepEqual([result.files, result.duplicates, result.empty], [["e2e/a.spec.ts"], [], []]);
    });

    test("the full list gives the discovered tests, the files its config matches but it has no test for are empty, and a test named twice is a duplicate", async t => {
      const root = await UiTestReportTests.createRootAsync(t, {
        "e2e/a.spec.ts": "",
        "e2e/b.spec.ts": "",
        "e2e/empty.spec.ts": "",
        "e2e/nested/c.spec.ts": "",
        "e2e/ignored/d.spec.ts": "",
        "e2e/helper.ts": ""
      });
      const passed = { expectedStatus: "passed", results: [{ status: "passed" }] };
      const listed = { expectedStatus: "passed", results: [] };
      const report = UiTestReportTests.report(root, [{ title: "b.spec.ts", specs: [UiTestReportTests.spec("b.spec.ts", "twice", passed), UiTestReportTests.spec("b.spec.ts", "twice", passed)] }]);
      const list = UiTestReportTests.report(root, [
        { title: "a.spec.ts", specs: [UiTestReportTests.spec("a.spec.ts", "one", listed)], suites: [{ title: "A", specs: [UiTestReportTests.spec("a.spec.ts", "two", listed)] }] },
        { title: "b.spec.ts", specs: [UiTestReportTests.spec("b.spec.ts", "twice", listed), UiTestReportTests.spec("b.spec.ts", "twice", listed)] },
        { title: "nested/c.spec.ts", specs: [UiTestReportTests.spec("nested/c.spec.ts", "three", listed)] }
      ]);

      const result = await new UiTestReport(root, "report.json").readAsync(report, list);
      const totals = result.toTotals("ui", "UI workflows", null, result.files);

      assert.deepEqual([totals.discovered, totals.executed, totals.unselected, totals.files], [5, 2, 3, ["e2e/b.spec.ts"]]);
      assert.deepEqual(totals.duplicates, ["e2e/b.spec.ts › twice"]);
      assert.deepEqual(totals.empty, ["e2e/empty.spec.ts"]);
      assert.deepEqual(totals.missing, []);
    });

    test("a report without the fields it reads is refused with its source", async t => {
      const root = await UiTestReportTests.createRootAsync(t, {});
      const report = UiTestReportTests.report(root, [{ title: "a.spec.ts", specs: [UiTestReportTests.spec("a.spec.ts", "a", { results: [] })] }]);

      await assert.rejects(new UiTestReport(root, "report.json").readAsync(report, report), new TotalsException("report.json, suites 1, specs 1, tests 1, has no text expectedStatus."));
      await assert.rejects(new UiTestReport(root, "report.json").readAsync(new JsonFields({ suites: [] }, "report.json"), report), new TotalsException("report.json, config, is not a JSON object."));
    });
  }

  private static spec(file: string, title: string, test: object): object {
    return { title, file, tests: [test] };
  }

  private static report(root: string, suites: readonly object[]): JsonFields {
    const testDir = path.join(root, "e2e");
    return new JsonFields({ config: { rootDir: testDir, projects: [{ testDir, testMatch: ["**/*.spec.ts"], testIgnore: ["ignored/**"] }] }, suites }, "report.json");
  }

  private static async createRootAsync(t: TestContext, files: Readonly<Record<string, string>>): Promise<string> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(files);
    return repository.directory;
  }
}

UiTestReportTests.register();
