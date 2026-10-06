/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class FlakyTestsWorkflowTests {
  private static readonly WORKFLOW: string = "flaky-tests.yml";
  private static readonly NODE_ACTION: string = "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0";
  private static readonly GATHER_STEPS: readonly [string, string, string] = ["Gather the flaky test records", "Gather the flaky test records again", "Gather the flaky test records a last time"];

  public static register(): void {
    test("the record follows each completed build and test run, and the week's count runs on its schedule or on request", async () => {
      const text = (await WorkflowFileFixture.readAsync(FlakyTestsWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  workflow_run:\n    workflows: [Build and test]\n    types: [completed]\n  schedule:\n    - cron: '41 6 * * 1'\n  workflow_dispatch:\n\npermissions:\n"));
      assert.ok(text.includes("    if: github.event_name != 'workflow_run'\n"));
      assert.ok(text.includes("    concurrency:\n      group: ${{ github.workflow }}-record\n      cancel-in-progress: false\n"));
    });

    test("only runs of this repository record, on main, in the merge queue or for a pull request, so a fork's records never reach an issue", async () => {
      const text = (await WorkflowFileFixture.readAsync(FlakyTestsWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes([
        "    if: >-",
        "      github.event_name == 'workflow_run' &&",
        "      github.event.workflow_run.head_repository.full_name == github.repository &&",
        "      (github.event.workflow_run.event == 'merge_group' || github.event.workflow_run.event == 'pull_request' ||",
        "      (github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main'))",
        ""
      ].join("\n")));
    });

    test("only the record writes, and only issues, reading the build's artifacts with its own token and no secret", async () => {
      const text = (await WorkflowFileFixture.readAsync(FlakyTestsWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("permissions:\n  contents: read\n\n"));
      assert.deepEqual(text.match(/^\s+\w[\w-]*: write$/gm), ["      issues: write"]);
      assert.ok(text.includes("    permissions:\n      actions: read\n      contents: read\n      issues: write\n"));
      assert.ok(text.includes("    permissions:\n      contents: read\n      issues: read\n"));
      assert.deepEqual([...text.matchAll(/\$\{\{ ([^}]+) \}\}/g)].map(t => t[1] ?? "").filter(t => t.startsWith("secrets.")), []);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 2);
    });

    test("each job sets up Node.js with three tries", async () => {
      const text = (await WorkflowFileFixture.readAsync(FlakyTestsWorkflowTests.WORKFLOW)).text;

      for (const first of ["Set up Node.js to record", "Set up Node.js to count"]) {
        const [again, last] = [`${first} again`, `${first} a last time`];
        const simulation = new WorkflowSimulation(text, first, last);
        const attempts = [first, again, last].map(t => simulation.find(t));

        assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[FlakyTestsWorkflowTests.NODE_ACTION, true], [FlakyTestsWorkflowTests.NODE_ACTION, true], [FlakyTestsWorkflowTests.NODE_ACTION, false]], first);
        assert.deepEqual([attempts[1]?.settings, attempts[2]?.settings], [attempts[0]?.settings, attempts[0]?.settings], first);
        assert.ok(attempts[0]?.settings.includes("node-version: '26.7.0'"), first);
        assert.deepEqual(simulation.run({}, {}).ran, [first], first);
        assert.deepEqual(simulation.run({}, { [first]: "failure" }).ran, [first, `Wait before setting up ${first.slice("Set up ".length)} again`, again], first);
      }
    });

    test("the record gathers every flaky test record of the completed run with three tries, each in its job's folder", async () => {
      const text = (await WorkflowFileFixture.readAsync(FlakyTestsWorkflowTests.WORKFLOW)).text;
      const simulation = new WorkflowSimulation(text, FlakyTestsWorkflowTests.GATHER_STEPS[0], FlakyTestsWorkflowTests.GATHER_STEPS[2]);
      const attempts = FlakyTestsWorkflowTests.GATHER_STEPS.map(t => simulation.find(t));

      assert.ok(/^actions\/download-artifact@[0-9a-f]{40} # v[\d.]+$/.test(attempts[0]?.uses ?? ""));
      assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [true, true, false].map(t => [attempts[0]?.uses, t]));
      assert.deepEqual(attempts.map(t => t.settings), attempts.map(() => [
        "pattern: flaky-tests-*", "path: _build/flaky", "run-id: ${{ github.event.workflow_run.id }}", "github-token: ${{ github.token }}"
      ]));
      assert.deepEqual(simulation.run({}, {}).ran, [FlakyTestsWorkflowTests.GATHER_STEPS[0]]);
      assert.deepEqual(simulation.run({}, { [FlakyTestsWorkflowTests.GATHER_STEPS[0]]: "failure", [FlakyTestsWorkflowTests.GATHER_STEPS[1]]: "failure" }).ran, [
        FlakyTestsWorkflowTests.GATHER_STEPS[0], "Wait before gathering the flaky test records again", FlakyTestsWorkflowTests.GATHER_STEPS[1],
        "Wait before gathering the flaky test records a last time", FlakyTestsWorkflowTests.GATHER_STEPS[2]
      ]);
    });

    test("the record files the flaky tests of the completed run, and the week's count reads the issues", async () => {
      const text = (await WorkflowFileFixture.readAsync(FlakyTestsWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("        env:\n          GH_TOKEN: ${{ github.token }}\n          FLAKY_RUN_URL: ${{ github.event.workflow_run.html_url }}\n          FLAKY_RECORDS: _build/flaky\n"
        + "        run: node scripts/flaky-report.ts\n"));
      assert.ok(text.includes("        env:\n          GH_TOKEN: ${{ github.token }}\n        run: node scripts/flaky-week-summary.ts\n"));
    });
  }
}

FlakyTestsWorkflowTests.register();
