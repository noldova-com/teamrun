/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import BuildMatrix from "../../../workflows/build-matrix.ts";
import TestJobPlan from "../../../workflows/test-job-plan.ts";
import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class BuildAndTestTargetTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "build-and-test-target.yml";
  private static readonly ACTION_STEP: string = "      - name: Prepare the job\n        uses: ./.github/actions/prepare\n        with:\n          architecture: ${{ inputs.architecture }}\n";
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly DOWNLOAD_ACTION: string = "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1";
  private static readonly BUILD_ARTIFACT: string = "name: build-${{ inputs.runner }}-${{ inputs.architecture }}";
  private static readonly BUILD_UPLOAD_SETTINGS: readonly string[] = [BuildAndTestTargetTests.BUILD_ARTIFACT, "path: build.tar", "retention-days: 3", "if-no-files-found: error", "overwrite: true"];
  private static readonly PACKED: string = "_build/archives _build/modules _build/packages _build/product.json _build/records _build/tests _build/window " +
    "node_modules/.package-lock.json node_modules/@noldova src/generated";
  private static readonly SPOTLIGHT_STEPS: readonly string[] = ["Stop Spotlight indexing before building", "Stop Spotlight indexing before testing"];
  private static readonly BUILD_STEP: string = "Build for the tests";
  private static readonly PREBUILT: Readonly<Record<string, string>> = { prebuilt: "true" };
  private static readonly TEST_STEP: string = "Test";
  private static readonly ANGULAR_UPLOADS: readonly string[] = ["Keep the Angular test output", "Keep the Angular test output again", "Keep the Angular test output a last time"];
  private static readonly ANGULAR_WARNING: string = "Warn that the Angular test output was not kept";
  private static readonly ANGULAR_SETTINGS: readonly string[] = [
    "name: angular-tests-${{ inputs.runner }}-${{ inputs.architecture }}-${{ github.run_attempt }}", "path: |", "  _build/angular-tests.log", "  _build/angular-tests.json", "retention-days: 14",
    "if-no-files-found: ignore", "overwrite: true"
  ];

  public static register(): void {
    test("a call takes the target's runner, architecture and planned test jobs, reads the repository only and uses only pinned actions and the shared setup", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTargetTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  workflow_call:\n    inputs:\n      runner:\n        description: The runner label of the target.\n        type: string\n        required: true\n" +
        "      architecture:\n        description: The CPU architecture of the target.\n        type: string\n        required: true\n" +
        "      jobs:\n        description: The target's test jobs, as the classification plans them.\n        type: string\n        required: true\n\npermissions:\n  contents: read\n"));
      assert.deepEqual(text.match(/^ *\S+: (read|write)$/gm), ["  contents: read"]);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 2);
      assert.doesNotMatch(text, /concurrency|secrets|token/);
      for (const use of text.matchAll(/uses: (\S+)/g))
        assert.match(use[1] ?? "", /^(actions\/[a-z-]+@[0-9a-f]{40}|\.\/\.github\/actions\/prepare)$/);
    });

    test("a target builds once when its jobs reuse a build, and each job runs its part of the tests, or all of them", { timeout: BuildAndTestTargetTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTargetTests.WORKFLOW);
      const text = workflow.text;
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("npm", "test -- --part scripts", "");
      doubles.respond("npm", "test", "");

      const part = await doubles.runAsync(workflow.readStepScript(BuildAndTestTargetTests.TEST_STEP), { PART: "scripts" });
      const whole = await doubles.runAsync(workflow.readStepScript(BuildAndTestTargetTests.TEST_STEP), { PART: "" });

      assert.deepEqual([part.status, whole.status], [0, 0], part.stderr + whole.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), ["npm test -- --part scripts", "npm test"]);
      assert.ok(text.includes("  build:\n    name: Build\n    if: ${{ fromJSON(inputs.jobs)[0].prebuilt }}\n    runs-on: ${{ inputs.runner }}\n    timeout-minutes: 20\n"));
      assert.ok(text.includes("  tests:\n    name: ${{ matrix.name }}\n    needs: build\n" +
        "    if: ${{ !cancelled() && contains(fromJSON('[\"success\", \"skipped\"]'), needs.build.result) }}\n" +
        "    strategy:\n      fail-fast: false\n      matrix:\n        include: ${{ fromJSON(inputs.jobs) }}\n    runs-on: ${{ inputs.runner }}\n    timeout-minutes: 20\n"));
      assert.ok(text.includes("          PART: ${{ matrix.part }}\n"));
      assert.equal(workflow.readStepScript("Build"), "npm run build\n");
      assert.equal(workflow.readStepScript(BuildAndTestTargetTests.BUILD_STEP), "npm run build\n");
      const [build, tests] = [text.slice(text.indexOf("  build:\n"), text.indexOf("  tests:\n")), text.slice(text.indexOf("  tests:\n"))];
      for (const job of [build, tests])
        assert.equal(job.split(BuildAndTestTargetTests.ACTION_STEP).length, 2);
      assert.doesNotMatch(build, /npm test/);
      const order = ["Build", "Pack the build", "Keep the build for the test parts", "Fetch the build", "Unpack the build", BuildAndTestTargetTests.BUILD_STEP, BuildAndTestTargetTests.TEST_STEP]
        .map(t => text.indexOf(`      - name: ${t}\n`));
      assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > (order[index - 1] ?? 0))), order.join(","));
    });

    test("a planned part fetches the build, and only the Angular part and a target's one job build for the tests", async () => {
      const simulation = new WorkflowSimulation((await WorkflowFileFixture.readAsync(BuildAndTestTargetTests.WORKFLOW)).text, "Fetch the build", BuildAndTestTargetTests.TEST_STEP);
      const targets = new BuildMatrix("workflow_dispatch").targets;
      const jobs = [...TestJobPlan.plan(targets[0] ?? assert.fail()), ...TestJobPlan.plan(targets[targets.length - 1] ?? assert.fail())];

      const ran = jobs.map(t => simulation.run({ prebuilt: String(t.prebuilt), build: String(t.build) }, {}).ran);

      const fetched = ["Fetch the build", "Unpack the build"];
      assert.deepEqual(ran, [
        [...fetched, BuildAndTestTargetTests.TEST_STEP],
        [...fetched, BuildAndTestTargetTests.TEST_STEP],
        [...fetched, BuildAndTestTargetTests.BUILD_STEP, BuildAndTestTargetTests.TEST_STEP],
        [BuildAndTestTargetTests.BUILD_STEP, BuildAndTestTargetTests.TEST_STEP]
      ]);
    });

    test("the packed build holds the outputs the parts reuse and unpacks to the same files", { timeout: BuildAndTestTargetTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTargetTests.WORKFLOW);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      const paths = BuildAndTestTargetTests.PACKED.split(" ");
      const listing = `for path in ${BuildAndTestTargetTests.PACKED}; do if [ -d "$path" ]; then cat "$path/content"; else cat "$path"; fi; done\n`;
      await doubles.runAsync(paths.map(t => t.includes(".") ? `mkdir -p "$(dirname ${t})" && echo ${t} > ${t}\n` : `mkdir -p ${t} && echo ${t} > ${t}/content\n`).join(""));

      const packed = await doubles.runAsync(workflow.readStepScript("Pack the build"));
      await doubles.runAsync(`rm -rf ${BuildAndTestTargetTests.PACKED}\n`);
      const removed = await doubles.runAsync(listing);
      const unpacked = await doubles.runAsync(workflow.readStepScript("Unpack the build"));
      const restored = await doubles.runAsync(listing);
      const archive = await doubles.runAsync("test -e build.tar\n");

      assert.deepEqual([packed.status, removed.status, unpacked.status, restored.status, archive.status], [0, 1, 0, 0, 1], packed.stderr + unpacked.stderr + restored.stderr);
      assert.equal(restored.stdout, paths.map(t => `${t}\n`).join(""));
    });

    test("every macOS job stops Spotlight indexing before checking out", { timeout: BuildAndTestTargetTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTargetTests.WORKFLOW);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("sudo", "mdutil -i off /System/Volumes/Data", "");

      for (const step of BuildAndTestTargetTests.SPOTLIGHT_STEPS)
        assert.equal((await doubles.runAsync(workflow.readStepScript(step))).status, 0, step);

      assert.deepEqual(await doubles.readCallsAsync(), BuildAndTestTargetTests.SPOTLIGHT_STEPS.map(() => "sudo mdutil -i off /System/Volumes/Data"));
      for (const jobSteps of workflow.text.split("    steps:\n").slice(1))
        assert.match(jobSteps, /^ {6}- name: Stop Spotlight indexing[^\n]*\n {8}if: runner\.os == 'macOS'\n {8}run: sudo mdutil -i off \/System\/Volumes\/Data\n\n {6}- name: Check out the revision/);
    });

    test("keeping and fetching the build are each tried three times with a pause, and fail the job only when the last attempt fails", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTargetTests.WORKFLOW);

      for (const [first, pause, action, settings] of [
        ["Keep the build for the test parts", "Wait before keeping the build", BuildAndTestTargetTests.UPLOAD_ACTION, BuildAndTestTargetTests.BUILD_UPLOAD_SETTINGS],
        ["Fetch the build", "Wait before fetching the build", BuildAndTestTargetTests.DOWNLOAD_ACTION, [BuildAndTestTargetTests.BUILD_ARTIFACT]]
      ] as const) {
        const [again, last] = [`${first} again`, `${first} a last time`];
        const simulation = new WorkflowSimulation(workflow.text, first, last);
        const attempts = [first, again, last].map(t => simulation.find(t));

        const passed = simulation.run(BuildAndTestTargetTests.PREBUILT, {});
        const retried = simulation.run(BuildAndTestTargetTests.PREBUILT, { [first]: "failure" });
        const failed = simulation.run(BuildAndTestTargetTests.PREBUILT, { [first]: "failure", [again]: "failure", [last]: "failure" });

        assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[action, true], [action, true], [action, false]], first);
        assert.deepEqual(attempts.map(t => t.settings), [settings, settings, settings], first);
        assert.deepEqual([workflow.readStepScript(`${pause} again`), workflow.readStepScript(`${pause} a last time`)], ["sleep 15\n", "sleep 15\n"], first);
        assert.deepEqual([passed.ran, passed.isJobFailed], [[first], false], first);
        assert.deepEqual([retried.ran, retried.isJobFailed], [[first, `${pause} again`, again], false], first);
        assert.deepEqual([failed.ran, failed.isJobFailed], [[first, `${pause} again`, again, `${pause} a last time`, last], true], first);
      }
    });

    test("a failed job that runs the Angular tests keeps their output and report, tried three times with a pause, and other parts and a passing test keep nothing", async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTargetTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, BuildAndTestTargetTests.TEST_STEP, BuildAndTestTargetTests.ANGULAR_WARNING);
      const [first, again, last] = BuildAndTestTargetTests.ANGULAR_UPLOADS.map(u => simulation.find(u));
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      const angular = { angular: "true" };
      const testFailed = { [BuildAndTestTargetTests.TEST_STEP]: "failure" };

      const passed = simulation.run(angular, {});
      const failed = simulation.run(angular, testFailed);
      const otherPart = simulation.run({ angular: "false" }, testFailed);
      const unkept = simulation.run(angular, Object.fromEntries([BuildAndTestTargetTests.TEST_STEP, ...BuildAndTestTargetTests.ANGULAR_UPLOADS].map(u => [u, "failure"])));
      const warning = await doubles.runAsync(workflow.readStepScript(BuildAndTestTargetTests.ANGULAR_WARNING));

      assert.deepEqual([passed.ran, passed.isJobFailed], [[BuildAndTestTargetTests.TEST_STEP], false]);
      assert.deepEqual([failed.ran, failed.isJobFailed], [[BuildAndTestTargetTests.TEST_STEP, "Keep the Angular test output"], true]);
      assert.deepEqual([otherPart.ran, otherPart.isJobFailed], [[BuildAndTestTargetTests.TEST_STEP], true]);
      assert.deepEqual(unkept.ran, [
        BuildAndTestTargetTests.TEST_STEP,
        "Keep the Angular test output", "Wait before keeping the Angular test output again", "Keep the Angular test output again",
        "Wait before keeping the Angular test output a last time", "Keep the Angular test output a last time",
        BuildAndTestTargetTests.ANGULAR_WARNING
      ]);
      assert.deepEqual([first, again, last].map(u => [u?.uses, u?.continueOnError]), [first, again, last].map(() => [BuildAndTestTargetTests.UPLOAD_ACTION, true]));
      assert.deepEqual([first, again, last].map(u => u?.settings), [first, again, last].map(() => BuildAndTestTargetTests.ANGULAR_SETTINGS));
      assert.equal(workflow.readStepScript("Wait before keeping the Angular test output again"), "sleep 15\n");
      assert.equal(workflow.readStepScript("Wait before keeping the Angular test output a last time"), "sleep 15\n");
      assert.deepEqual([warning.status, warning.stdout], [0, "::warning title=The Angular test output was not kept::The upload failed three times, so it is not attached.\n"]);
    });
  }
}

BuildAndTestTargetTests.register();
