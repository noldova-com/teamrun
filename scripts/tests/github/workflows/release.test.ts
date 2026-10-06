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
import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class ReleaseWorkflowTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "release.yml";
  private static readonly REFUSE_STEP: string = "Refuse an unsigned release of TeamRun";
  private static readonly MAIN_STEP: string = "Require the workflow from main";
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly UPLOADS: readonly [string, string, string] = ["Keep the release files", "Keep the release files again", "Keep the release files a last time"];
  private static readonly REQUEST: string = "          RELEASE_REPOSITORY: ${{ github.repository }}\n          RELEASE_VERSION: ${{ inputs.version }}\n"
    + "          RELEASE_REVISION: ${{ inputs.revision }}\n";

  public static register(): void {
    test("a release starts only by hand with a version and a revision, one per repository at a time, and only its publish job may write, behind the publish environment", async () => {
      const text = (await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  workflow_dispatch:\n    inputs:\n      version:\n"));
      assert.ok(text.includes("      revision:\n        description: The full commit SHA on main to release.\n        required: true\n        type: string\n\npermissions:\n  contents: read\n\n"));
      assert.ok(text.includes("concurrency:\n  group: release-${{ github.repository }}\n  cancel-in-progress: false\n"));
      assert.deepEqual(text.match(/^\s+\w[\w-]*: write$/gm), ["      contents: write"]);
      assert.ok(text.includes("    needs: build\n    runs-on: ubuntu-24.04\n    timeout-minutes: 30\n    environment: publish\n    permissions:\n      contents: write\n"
        + "    concurrency:\n      group: release-publish-${{ github.repository }}\n      cancel-in-progress: false\n"));
      assert.deepEqual([...text.matchAll(/\$\{\{ ([^}]+) \}\}/g)].map(t => t[1] ?? "").filter(t => t.startsWith("secrets.")), []);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 3);
      assert.equal(text.match(/          ref: \$\{\{ inputs\.revision \}\}\n/g)?.length, 3);
      assert.deepEqual(text.split("\n").filter(t => /run: .*\$\{\{/.test(t) || /^ {10}[^ ].*\$\{\{ inputs\./.test(t) && !/^ {10}(RELEASE_\w+|ref): /.test(t)), []);
    });

    test("the check refuses an unsigned release of noldova-com/teamrun and a workflow from another branch than main, then checks the request with the repository's own token", { timeout: ReleaseWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const run = async (step: string, environment: NodeJS.ProcessEnv = {}): Promise<readonly [number | null, string]> => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        const result = await doubles.runAsync(workflow.readStepScript(step), environment);
        return [result.status, result.stdout];
      };

      assert.ok(workflow.text.includes(`      - name: ${ReleaseWorkflowTests.REFUSE_STEP}\n        if: github.repository == 'noldova-com/teamrun'\n`));
      assert.deepEqual(await run(ReleaseWorkflowTests.REFUSE_STEP),
        [1, "::error::TeamRun publishes no unsigned release, so its releases start once its packages are signed. Run a trial in a test repository.\n"]);
      assert.deepEqual(await run(ReleaseWorkflowTests.MAIN_STEP, { REFERENCE: "refs/heads/main" }), [0, ""]);
      assert.deepEqual(await run(ReleaseWorkflowTests.MAIN_STEP, { REFERENCE: "refs/heads/rr/1-release" }),
        [1, "::error::A release runs the workflow from main, not from refs/heads/rr/1-release.\n"]);
      assert.ok(workflow.text.includes(`        env:\n          REFERENCE: \${{ github.ref }}\n`));
      assert.ok(workflow.text.includes(`        env:\n          GH_TOKEN: \${{ github.token }}\n${ReleaseWorkflowTests.REQUEST}        run: node scripts/release-check.ts\n`));
      assert.ok(workflow.text.indexOf(ReleaseWorkflowTests.REFUSE_STEP) < workflow.text.indexOf(ReleaseWorkflowTests.MAIN_STEP));
      assert.ok(workflow.text.indexOf(ReleaseWorkflowTests.MAIN_STEP) < workflow.text.indexOf("Check out the revision"));
    });

    test("every target builds, tests, packages, starts its package and writes its release files on its own runner after the check, and every step has its own time limit", async () => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const package_ = await WorkflowFileFixture.readAsync("package.yml");
      const targets = new BuildMatrix("workflow_dispatch").targets.map(t => `          - { target: ${t.name}, runner: ${t.runner}, architecture: ${t.architecture} }\n`).join("");
      const steps = workflow.text.split(/\n(?= +- name: )/).slice(1);

      assert.ok(workflow.text.includes(`    needs: check\n    strategy:\n      fail-fast: true\n      matrix:\n        include:\n${targets}    runs-on: \${{ matrix.runner }}\n    timeout-minutes: 90\n`));
      for (const step of ["Build", "Test", "Make the package", "Install, start and quit the package", "Write the checksums and the update information"])
        assert.ok(workflow.text.includes(`      - name: ${step}\n`), step);
      assert.deepEqual(["Build", "Test", "Make the package", "Write the checksums and the update information"].map(t => workflow.readStepScript(t)),
        ["npm run build\n", "npm test\n", "npm run package\n", "npm run release:assets\n"]);
      for (const step of ["Install, start and quit the package", "Remove libfuse2, which a stock Ubuntu does not install"])
        assert.equal(workflow.readStepScript(step), package_.readStepScript(step), step);
      assert.deepEqual(steps.filter(t => !/\n {8}timeout-minutes: \d+\n/.test(t)), []);
    });

    test("a build keeps exactly its release files with three tries, and fails when there are none", async () => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, ReleaseWorkflowTests.UPLOADS[0], ReleaseWorkflowTests.UPLOADS[2]);
      const uploads = ReleaseWorkflowTests.UPLOADS.map(t => simulation.find(t));

      assert.deepEqual(uploads.map(t => [t.uses, t.continueOnError]), [[ReleaseWorkflowTests.UPLOAD_ACTION, true], [ReleaseWorkflowTests.UPLOAD_ACTION, true], [ReleaseWorkflowTests.UPLOAD_ACTION, false]]);
      assert.deepEqual(uploads.map(t => t.settings), uploads.map(() => [
        "name: release-${{ matrix.runner }}-${{ matrix.architecture }}",
        "path: |",
        "  _build/package/out/TeamRun-*.exe",
        "  _build/package/out/TeamRun-*.dmg",
        "  _build/package/out/TeamRun-*.zip",
        "  _build/package/out/TeamRun-*.AppImage",
        "  _build/package/out/TeamRun-*.sha256",
        "  _build/package/out/latest-*.yml",
        "retention-days: 14",
        "if-no-files-found: error",
        "overwrite: true"
      ]));
      assert.deepEqual(simulation.run({}, {}).ran, [ReleaseWorkflowTests.UPLOADS[0]]);
      assert.deepEqual(simulation.run({}, { [ReleaseWorkflowTests.UPLOADS[0]]: "failure", [ReleaseWorkflowTests.UPLOADS[1]]: "failure" }).ran, [
        ReleaseWorkflowTests.UPLOADS[0], "Wait before keeping the release files again", ReleaseWorkflowTests.UPLOADS[1], "Wait before keeping the release files a last time",
        ReleaseWorkflowTests.UPLOADS[2]
      ]);
    });

    test("the publish job takes every target's files from this run, also when only it is run again, and publishes them with the release notes", async () => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const download = new WorkflowSimulation(workflow.text, "Take this run's release files", "Take this run's release files").find("Take this run's release files");

      assert.equal(download.uses, "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1");
      assert.deepEqual(download.settings, ["pattern: release-*", "merge-multiple: true", "path: _build/release"]);
      assert.ok(workflow.text.includes(`        env:\n          GH_TOKEN: \${{ github.token }}\n${ReleaseWorkflowTests.REQUEST}`
        + "          RELEASE_FOLDER: ${{ github.workspace }}/_build/release\n          RELEASE_NOTES: >-\n"));
      assert.ok(workflow.text.includes("            Windows ARM64, Linux ARM64 and macOS ARM64 passed it in CI runs only.\n        run: node scripts/release-publish.ts\n"));
      assert.ok(workflow.text.indexOf("Take this run's release files") < workflow.text.indexOf("      - name: Publish the release\n"));
    });
  }
}

ReleaseWorkflowTests.register();
