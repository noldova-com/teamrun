/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class RepeatWorkflowTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "repeat.yml";
  private static readonly REPORT_STEP: string = "Require every repeat to pass";
  private static readonly TESTS_STEP: string = "Repeat the tests";
  private static readonly WORKFLOWS_STEP: string = "Repeat the UI workflows";
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly UPLOADS: readonly string[] = ["Keep what the failures left", "Keep what the failures left again", "Keep what the failures left a last time"];
  private static readonly WARNING_STEP: string = "Warn that what the failures left was not kept";
  private static readonly LEGS: string = "[{\"name\":\"Linux x64, pass 1 of 5\"}]";

  public static register(): void {
    test("a pull request runs it on every push and label change and a merge group on every check, a newer run cancels an older one, and it only reads", async () => {
      const text = (await WorkflowFileFixture.readAsync(RepeatWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  pull_request:\n    branches: [main]\n    types: [opened, synchronize, reopened, ready_for_review, labeled, unlabeled]\n" +
        "  merge_group:\n    types: [checks_requested]\n\npermissions:\n  contents: read\n\n"));
      assert.ok(text.includes("concurrency:\n  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}\n  cancel-in-progress: true\n"));
      assert.deepEqual(text.match(/^ *\S+: (read|write)$/gm), ["  contents: read"]);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 2);
      assert.doesNotMatch(text, /secrets|token/);
    });

    test("only a pull request with the repeat label selects its repeats, from its own base, head and body", async () => {
      const workflow = await WorkflowFileFixture.readAsync(RepeatWorkflowTests.WORKFLOW);

      assert.ok(workflow.text.includes("  plan:\n    name: Select the repeats\n" +
        "    if: ${{ github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'repeat') }}\n"));
      assert.ok(workflow.text.includes("          fetch-depth: 0\n"));
      assert.equal(workflow.readStepScript("Select the tests and the jobs"), "node scripts/repeat-plan.ts\n");
      assert.ok(workflow.text.includes("          BASE_SHA: ${{ github.event.pull_request.base.sha }}\n          HEAD_SHA: ${{ github.event.pull_request.head.sha }}\n" +
        "          PR_BODY: ${{ github.event.pull_request.body }}\n"));
      for (const output of ["legs", "test-arguments", "workflow-arguments"])
        assert.ok(workflow.text.includes(`      ${output}: \${{ steps.select.outputs.${output} }}\n`), output);
    });

    test("each planned job prepares its target as build and test does, stopping Spotlight first on macOS, and runs only when the plan has jobs", async () => {
      const text = (await WorkflowFileFixture.readAsync(RepeatWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("  repeat:\n    name: Repeat (${{ matrix.name }})\n    needs: plan\n    if: ${{ needs.plan.outputs.legs != '[]' }}\n" +
        "    strategy:\n      fail-fast: false\n      matrix:\n        include: ${{ fromJSON(needs.plan.outputs.legs) }}\n    runs-on: ${{ matrix.runner }}\n"));
      assert.ok(text.includes("    steps:\n      - name: Stop Spotlight indexing\n        if: runner.os == 'macOS'\n        run: sudo mdutil -i off /System/Volumes/Data\n\n" +
        "      - name: Check out the revision\n"));
      assert.ok(text.includes("      - name: Prepare the job\n        uses: ./.github/actions/prepare\n        with:\n          architecture: ${{ matrix.architecture }}\n"));
      assert.ok(text.includes("      - name: Build\n        if: needs.plan.outputs.test-arguments != ''\n        run: npm run build\n"));
      assert.ok(text.includes("      - name: Let Electron's sandbox start on Linux\n        if: runner.os == 'Linux' && needs.plan.outputs.workflow-arguments != ''\n"));
    });

    test("a job runs the selected tests and the selected UI workflows its number of times, without retries and under Xvfb on Linux", { timeout: RepeatWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(RepeatWorkflowTests.WORKFLOW);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      const specs = "src/shell/desktop/tests/e2e/menus.spec.ts src/shell/desktop/tests/e2e/quit.spec.ts";
      const run = `run test:ui -- ${specs} --repeat-each 5 --retries 0`;
      doubles.respond("npm", "test -- --filter scripts/tests/a.test.ts --filter shell/window/tests/b.spec.ts --repeat 1", "");
      doubles.respond("xvfb-run", `--auto-servernum --server-args=-screen 0 1920x1080x24 npm ${run}`, "");
      doubles.respond("npm", run, "");
      doubles.respond("npm", `run test:ui -- ${specs} --repeat-each 1 --retries 0`, "", 1);

      const tests = await doubles.runAsync(workflow.readStepScript(RepeatWorkflowTests.TESTS_STEP),
        { TEST_ARGUMENTS: "--filter scripts/tests/a.test.ts --filter shell/window/tests/b.spec.ts", REPEATS: "1" });
      const linux = await doubles.runAsync(workflow.readStepScript(RepeatWorkflowTests.WORKFLOWS_STEP), { RUNNER_OS: "Linux", WORKFLOW_ARGUMENTS: specs, REPEATS: "5" });
      const macos = await doubles.runAsync(workflow.readStepScript(RepeatWorkflowTests.WORKFLOWS_STEP), { RUNNER_OS: "macOS", WORKFLOW_ARGUMENTS: specs, REPEATS: "5" });
      const failed = await doubles.runAsync(workflow.readStepScript(RepeatWorkflowTests.WORKFLOWS_STEP), { RUNNER_OS: "Windows", WORKFLOW_ARGUMENTS: specs, REPEATS: "1" });

      assert.deepEqual([tests.status, linux.status, macos.status, failed.status], [0, 0, 0, 1], tests.stderr + linux.stderr + macos.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), [
        "npm test -- --filter scripts/tests/a.test.ts --filter shell/window/tests/b.spec.ts --repeat 1",
        `xvfb-run --auto-servernum --server-args=-screen 0 1920x1080x24 npm ${run}`,
        `npm ${run}`,
        `npm run test:ui -- ${specs} --repeat-each 1 --retries 0`
      ]);
      assert.ok(workflow.text.includes("          TEST_ARGUMENTS: ${{ needs.plan.outputs.test-arguments }}\n          REPEATS: ${{ matrix.repeats }}\n"));
      assert.ok(workflow.text.includes("          WORKFLOW_ARGUMENTS: ${{ needs.plan.outputs.workflow-arguments }}\n          REPEATS: ${{ matrix.repeats }}\n"));
    });

    test("a failed job keeps what its failures left, tried three times with a pause and the same settings, and a passing job keeps nothing", async () => {
      const workflow = await WorkflowFileFixture.readAsync(RepeatWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, RepeatWorkflowTests.UPLOADS[0] ?? "", RepeatWorkflowTests.WARNING_STEP);
      const attempts = RepeatWorkflowTests.UPLOADS.map(t => simulation.find(t));
      const settings = [
        "name: repeat-failures-${{ matrix.key }}-${{ github.run_attempt }}", "path: |", "  _build/angular-tests.log", "  _build/angular-tests.json", "  _build/ui",
        "retention-days: 14", "if-no-files-found: ignore", "overwrite: true"
      ];

      assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError, t.settings]), attempts.map(() => [RepeatWorkflowTests.UPLOAD_ACTION, true, settings]));
      assert.deepEqual(attempts.map(t => t.condition), ["failure()", "failure() && steps.failures.outcome == 'failure'", "failure() && steps.failures-again.outcome == 'failure'"]);
      assert.equal(simulation.find(RepeatWorkflowTests.WARNING_STEP).condition, "failure() && steps.failures-last.outcome == 'failure'");
      assert.equal(workflow.readStepScript("Wait before keeping what the failures left again"), "sleep 15\n");
      assert.equal(workflow.readStepScript("Wait before keeping what the failures left a last time"), "sleep 15\n");
      assert.deepEqual(simulation.run({}, {}).ran, []);
    });

    test("the one check passes without the label or in a merge group, and with the label only when every planned repeat passed", { timeout: RepeatWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(RepeatWorkflowTests.WORKFLOW);
      const script = workflow.readStepScript(RepeatWorkflowTests.REPORT_STEP);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      const labelled = { LABELLED: "true", PLAN_RESULT: "success", LEGS: RepeatWorkflowTests.LEGS };
      const cases = [
        [{ LABELLED: "false", PLAN_RESULT: "skipped", LEGS: "", REPEAT_RESULT: "skipped" }, 0, "Nothing is repeated: only a pull request with the repeat label repeats its tests."],
        [{ ...labelled, REPEAT_RESULT: "success" }, 0, "Every repeat passed on every target."],
        [{ ...labelled, LEGS: "[]", REPEAT_RESULT: "skipped" }, 0, "Nothing is repeated: the change affects no test or UI workflow file."],
        [{ ...labelled, REPEAT_RESULT: "failure" }, 1, "::error title=A repeat did not pass::The repeat jobs ended with the result failure."],
        [{ ...labelled, REPEAT_RESULT: "cancelled" }, 1, "::error title=A repeat did not pass::The repeat jobs ended with the result cancelled."],
        [{ ...labelled, PLAN_RESULT: "failure", LEGS: "", REPEAT_RESULT: "skipped" }, 1, "::error title=The repeats were not selected::Selecting the repeats ended with the result failure."]
      ] as const;

      for (const [environment, status, message] of cases) {
        const result = await doubles.runAsync(script, environment);
        assert.deepEqual([result.status, result.stdout], [status, `${message}\n`], result.stderr);
      }
      const callers = workflow.text.slice(workflow.text.indexOf("  report:\n"));
      assert.ok(callers.startsWith("  report:\n    name: Repeat (all targets)\n    needs: [plan, repeat]\n    if: always()\n"));
      assert.ok(callers.includes("          LABELLED: ${{ github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'repeat') }}\n" +
        "          PLAN_RESULT: ${{ needs.plan.result }}\n          LEGS: ${{ needs.plan.outputs.legs }}\n          REPEAT_RESULT: ${{ needs.repeat.result }}\n"));
    });
  }
}

RepeatWorkflowTests.register();
