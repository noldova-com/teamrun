/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class NightlyWorkflowTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "nightly.yml";
  private static readonly PLAN_STEP: string = "List each target's tests and UI workflows";
  private static readonly FIRST_STEP: string = "Build";
  private static readonly LAST_STEP: string = "Keep what the failures left";
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly NODE_ACTION: string = "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0";
  private static readonly RESULT_UPLOADS: readonly string[] = ["Keep the result", "Keep the result again", "Keep the result a last time"];
  private static readonly SHARED_STEPS: readonly string[] = ["Verify the toolchain", "Discard an inexact Angular install", "Install dependencies", "Install Electron"];

  public static register(): void {
    test("the nightly run starts on its schedule or on request, one run at a time, and never for a push or a pull request", async () => {
      const text = (await WorkflowFileFixture.readAsync(NightlyWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  schedule:\n    - cron: '23 2 * * *'\n  workflow_dispatch:\n\npermissions:\n"));
      assert.ok(text.includes("concurrency:\n  group: ${{ github.workflow }}\n  cancel-in-progress: false\n"));
    });

    test("only the report writes, and only issues, with no secret besides its own token", async () => {
      const text = (await WorkflowFileFixture.readAsync(NightlyWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("permissions:\n  contents: read\n\n"));
      assert.deepEqual(text.match(/^\s+\w[\w-]*: write$/gm), ["      issues: write"]);
      assert.ok(text.includes("    permissions:\n      contents: read\n      issues: write\n"));
      assert.deepEqual([...text.matchAll(/\$\{\{ ([^}]+) \}\}/g)].map(t => t[1] ?? "").filter(t => t.startsWith("secrets.")), []);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 2);
    });

    test("each target's tests and UI workflows are jobs of their own, on the targets every build and test run validates", { timeout: NightlyWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(NightlyWorkflowTests.WORKFLOW);
      const validated = (await WorkflowFileFixture.readAsync("build-and-test.yml")).readStepScript("List the build and test jobs")
        .split("<<'LEGS'\n")[1]?.split("LEGS\n")[0]?.trimEnd().split("\n").map(t => t.split("|")) ?? [];
      const targets = [...new Map(validated.map(([, target, , runner, architecture]) => [target, { target, runner, architecture }])).values()];
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      await writeFile(path.join(doubles.directory, "outputs.txt"), "");

      const result = await doubles.runAsync(workflow.readStepScript(NightlyWorkflowTests.PLAN_STEP), { GITHUB_OUTPUT: "outputs.txt" });
      const outputs = new Map((await doubles.readFileAsync("outputs.txt")).trimEnd().split("\n").map(line => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));

      const legs = targets.flatMap(({ target, runner, architecture }) => [
        { label: `${target}, tests`, part: "tests", runner, architecture },
        { label: `${target}, UI workflows`, part: "workflows", runner, architecture }
      ]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(targets.length, 6);
      assert.deepEqual(JSON.parse(outputs.get("legs") ?? ""), legs);
      assert.deepEqual(JSON.parse(outputs.get("labels") ?? ""), legs.map(leg => leg.label));
      assert.ok(workflow.text.includes("      fail-fast: false\n      matrix:\n        include: ${{ fromJSON(needs.plan.outputs.legs) }}\n    runs-on: ${{ matrix.runner }}\n    timeout-minutes: 150\n"));
    });

    test("a job prepares its target exactly as build and test does, setting up Node.js with three tries", async () => {
      const nightly = await WorkflowFileFixture.readAsync(NightlyWorkflowTests.WORKFLOW);
      const validation = await WorkflowFileFixture.readAsync("build-and-test.yml");

      for (const step of NightlyWorkflowTests.SHARED_STEPS)
        assert.equal(nightly.readStepScript(step), validation.readStepScript(step), step);
      for (const step of ["Restore the installed dependencies", "Restore the Angular project's installed dependencies"]) {
        const [own, validated] = [nightly, validation].map(t => new WorkflowSimulation(t.text, step, step).find(step));
        assert.deepEqual([own?.uses, own?.settings], [validated?.uses, validated?.settings], step);
      }
      for (const first of ["Set up Node.js", "Set up Node.js to report"]) {
        const [again, last] = [`${first} again`, `${first} a last time`];
        const simulation = new WorkflowSimulation(nightly.text, first, last);
        const attempts = [first, again, last].map(t => simulation.find(t));

        assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[NightlyWorkflowTests.NODE_ACTION, true], [NightlyWorkflowTests.NODE_ACTION, true], [NightlyWorkflowTests.NODE_ACTION, false]], first);
        assert.deepEqual([attempts[1]?.settings, attempts[2]?.settings], [attempts[0]?.settings, attempts[0]?.settings], first);
        assert.ok(attempts[0]?.settings.includes("node-version: '26.7.0'"), first);
        assert.deepEqual(simulation.run({}, { [first]: "failure" }).ran, [first, `Wait before setting up ${first.slice("Set up ".length)} again`, again], first);
      }
      assert.ok(nightly.text.includes("      - name: Stop Spotlight indexing\n        if: runner.os == 'macOS'\n        run: sudo mdutil -i off /System/Volumes/Data\n"));
      assert.ok(nightly.text.includes("      - name: Let Electron's sandbox start on Linux\n        if: runner.os == 'Linux' && matrix.part == 'workflows'\n        run: sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0\n"));
    });

    test("a tests job builds and runs every test five times into its log, and a UI workflows job runs every workflow five times without retries", async () => {
      const workflow = await WorkflowFileFixture.readAsync(NightlyWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, NightlyWorkflowTests.FIRST_STEP, NightlyWorkflowTests.LAST_STEP);

      assert.equal(workflow.readStepScript("Repeat the tests"), "set -o pipefail\nmkdir -p _build/nightly\nnpm test -- --repeat 5 2>&1 | tee _build/nightly/tests.log\n");
      assert.ok(workflow.readStepScript("Repeat the UI workflows").includes("xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' npm run test:ui -- --repeat-each 5 --retries 0\n"));
      assert.ok(workflow.readStepScript("Repeat the UI workflows").includes("else\n  npm run test:ui -- --repeat-each 5 --retries 0\n"));
      assert.deepEqual(simulation.run({ part: "tests" }, {}).ran, ["Build", "Repeat the tests", "Record the result", "Keep the result"]);
      assert.deepEqual(simulation.run({ part: "workflows" }, {}).ran, ["Repeat the UI workflows", "Record the result", "Keep the result"]);
    });

    test("a job records its result whatever happened, keeps it with three tries, and keeps what its failures left only when it failed", async () => {
      const workflow = await WorkflowFileFixture.readAsync(NightlyWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, NightlyWorkflowTests.FIRST_STEP, NightlyWorkflowTests.LAST_STEP);
      const uploads = NightlyWorkflowTests.RESULT_UPLOADS.map(t => simulation.find(t));

      const failed = simulation.run({ part: "tests" }, { "Repeat the tests": "failure", "Keep the result": "failure" });
      const unbuilt = simulation.run({ part: "tests" }, { Build: "failure" });

      assert.deepEqual(failed.ran, ["Build", "Repeat the tests", "Record the result", "Keep the result", "Wait before keeping the result again", "Keep the result again", "Keep what the failures left"]);
      assert.deepEqual(unbuilt.ran, ["Build", "Record the result", "Keep the result", "Keep what the failures left"]);
      assert.deepEqual(uploads.map(t => [t.uses, t.continueOnError]), [[NightlyWorkflowTests.UPLOAD_ACTION, true], [NightlyWorkflowTests.UPLOAD_ACTION, true], [NightlyWorkflowTests.UPLOAD_ACTION, false]]);
      assert.deepEqual(uploads.map(t => t.settings), uploads.map(() => [
        "name: nightly-result-${{ matrix.runner }}-${{ matrix.part }}", "path: _build/nightly/results", "retention-days: 14", "if-no-files-found: ignore"
      ]));
      assert.ok(workflow.text.includes("          NIGHTLY_LABEL: ${{ matrix.label }}\n          NIGHTLY_PART: ${{ matrix.part }}\n"
        + "          NIGHTLY_OUTCOME: ${{ matrix.part == 'tests' && steps.tests.outcome || steps.workflows.outcome }}\n        run: node scripts/nightly-result.ts\n"));
      assert.deepEqual(simulation.find("Keep what the failures left").settings, [
        "name: nightly-failures-${{ matrix.runner }}-${{ matrix.part }}", "path: |", "  _build/nightly/tests.log", "  _build/angular-tests.log", "  _build/ui/results", "retention-days: 14",
        "if-no-files-found: ignore"
      ]);
    });

    test("the report runs unless the run was cancelled, gathers every job's result and opens or updates the bugs", async () => {
      const text = (await WorkflowFileFixture.readAsync(NightlyWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("  report:\n    name: Report the failures\n    needs: [plan, repeat]\n    if: ${{ !cancelled() && needs.plan.result == 'success' }}\n"));
      assert.ok(/uses: actions\/download-artifact@[0-9a-f]{40} # v[\d.]+\n {8}with:\n {10}pattern: nightly-result-\*\n {10}path: _build\/nightly\/results\n {10}merge-multiple: true\n/.test(text));
      assert.ok(text.includes("        env:\n          GH_TOKEN: ${{ github.token }}\n"
        + "          NIGHTLY_RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\n"
        + "          NIGHTLY_LEGS: ${{ needs.plan.outputs.labels }}\n          NIGHTLY_RESULTS: _build/nightly/results\n        run: node scripts/nightly-report.ts\n"));
    });
  }
}

NightlyWorkflowTests.register();
