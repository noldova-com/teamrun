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

import BuildMatrix from "../../../workflows/build-matrix.ts";
import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class ReleaseWorkflowTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "release.yml";
  private static readonly MAIN_STEP: string = "Require the workflow from main";
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly UPLOADS: readonly [string, string, string] = ["Keep the release files", "Keep the release files again", "Keep the release files a last time"];
  private static readonly REPORT_UPLOADS: readonly [string, string, string] = ["Keep the package report", "Keep the package report again", "Keep the package report a last time"];
  private static readonly SIGNED: string = "matrix.signed == 'true'";
  private static readonly LIST_STEP: string = "List the targets, apart from those the release signs";
  private static readonly PUBLISH_NEEDS: string = "    needs: [build, build-signed]\n"
    + "    if: ${{ !cancelled() && needs.build.result == 'success' && (needs.build-signed.result == 'success' || needs.build-signed.result == 'skipped') }}\n";
  private static readonly CREDENTIALS: readonly (readonly [string, string])[] = [
    ["windows", "AZURE_TENANT_ID"], ["windows", "AZURE_CLIENT_ID"], ["windows", "AZURE_CLIENT_SECRET"], ["macos", "MAC_CERTIFICATE"], ["macos", "MAC_CERTIFICATE_PASSWORD"],
    ["macos", "APPLE_API_KEY_P8"], ["macos", "APPLE_API_KEY_ID"], ["macos", "APPLE_API_ISSUER"]
  ];
  private static readonly REQUEST: string = "          RELEASE_REPOSITORY: ${{ github.repository }}\n          RELEASE_VERSION: ${{ inputs.version }}\n"
    + "          RELEASE_REVISION: ${{ inputs.revision }}\n";

  public static register(): void {
    test("a release starts only by hand with a version and a revision, one per repository at a time, and only its publish job may write, behind the publish environment", async () => {
      const text = (await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  workflow_dispatch:\n    inputs:\n      version:\n"));
      assert.ok(text.includes("      revision:\n        description: The full commit SHA on main to release.\n        required: true\n        type: string\n\npermissions:\n  contents: read\n\n"));
      assert.ok(text.includes("concurrency:\n  group: release-${{ github.repository }}\n  cancel-in-progress: false\n"));
      assert.deepEqual(text.match(/^\s+\w[\w-]*: write$/gm), ["      contents: write"]);
      assert.ok(text.includes(`${ReleaseWorkflowTests.PUBLISH_NEEDS}    runs-on: ubuntu-24.04\n    timeout-minutes: 30\n    environment: publish\n    permissions:\n      contents: write\n`
        + "    concurrency:\n      group: release-publish-${{ github.repository }}\n      cancel-in-progress: false\n"));
      assert.deepEqual([...text.matchAll(/\$\{\{ ([^}]+) \}\}/g)].map(t => t[1] ?? "").filter(t => t.includes("secrets.")),
        ReleaseWorkflowTests.CREDENTIALS.map(([platform, name]) => `${ReleaseWorkflowTests.SIGNED} && matrix.platform == '${platform}' && secrets.${name} || ''`));
      assert.equal(text.match(/^ {4}env:$/gm), null);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 3);
      assert.equal(text.match(/          ref: \$\{\{ inputs\.revision \}\}\n/g)?.length, 3);
      assert.deepEqual(text.split("\n").filter(t => /run: .*\$\{\{/.test(t) || /^ {10}[^ ].*\$\{\{ inputs\./.test(t) && !/^ {10}(RELEASE_\w+|ref): /.test(t)), []);
    });

    test("the check refuses a workflow from another branch than main, then checks the request with the repository's own token", { timeout: ReleaseWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const run = async (step: string, environment: Readonly<Record<string, string>> = {}): Promise<readonly [number | null, string]> => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        const result = await doubles.runAsync(workflow.readStepScript(step), environment);
        return [result.status, result.stdout];
      };

      assert.deepEqual(await run(ReleaseWorkflowTests.MAIN_STEP, { REFERENCE: "refs/heads/main" }), [0, ""]);
      assert.deepEqual(await run(ReleaseWorkflowTests.MAIN_STEP, { REFERENCE: "refs/heads/rr/1-release" }),
        [1, "::error::A release runs the workflow from main, not from refs/heads/rr/1-release.\n"]);
      assert.ok(workflow.text.includes(`        env:\n          REFERENCE: \${{ github.ref }}\n`));
      assert.ok(workflow.text.includes(`        env:\n          GH_TOKEN: \${{ github.token }}\n${ReleaseWorkflowTests.REQUEST}        run: node scripts/release-check.ts\n`));
      assert.ok(workflow.text.includes("    steps:\n      - name: Require the workflow from main\n"));
      assert.ok(workflow.text.indexOf(ReleaseWorkflowTests.MAIN_STEP) < workflow.text.indexOf("Check out the revision"));
    });

    test("every target builds, tests, packages, starts its package and writes its release files on its own runner after the check, and every step has its own time limit", { timeout: ReleaseWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const package_ = await WorkflowFileFixture.readAsync("package.yml");
      const targets = new BuildMatrix("workflow_dispatch").targets
        .map(t => ({ target: t.name, runner: t.runner, architecture: t.architecture, platform: t.name.split(" ")[0]?.toLowerCase() ?? "" }));
      const steps = workflow.text.split(/\n(?= +- name: )/).slice(1);
      const list = async (signing: string): Promise<readonly unknown[]> => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await writeFile(path.join(doubles.directory, "outputs.txt"), "");
        const result = await doubles.runAsync(workflow.readStepScript(ReleaseWorkflowTests.LIST_STEP), { GITHUB_OUTPUT: "outputs.txt", SIGNING: signing });
        assert.equal(result.status, 0, result.stderr);
        return (await doubles.readFileAsync("outputs.txt")).split("\n").filter(t => t.length > 0).map(t => JSON.parse(t.slice(t.indexOf("=") + 1)));
      };
      const isSigned = (platform: string): boolean => platform === "windows" || platform === "macos";

      assert.deepEqual(await list(""), [targets.map(t => ({ ...t, signed: "false" })), []]);
      assert.deepEqual(await list("windows macos"), [
        targets.filter(t => !isSigned(t.platform)).map(t => ({ ...t, signed: "false" })),
        targets.filter(t => isSigned(t.platform)).map(t => ({ ...t, signed: "true" }))
      ]);
      assert.ok(workflow.text.includes("    needs: check\n    strategy:\n      fail-fast: true\n      matrix:\n        include: ${{ fromJSON(needs.check.outputs.targets) }}\n"
        + "    runs-on: ${{ matrix.runner }}\n    timeout-minutes: 105\n    steps: &build-steps\n"));
      for (const step of ["Build", "Test", "Make the package", "Install, start and quit the package", "Write the checksums and the update information"])
        assert.ok(workflow.text.includes(`      - name: ${step}\n`), step);
      assert.deepEqual(["Build", "Test", "Write the checksums and the update information"].map(t => workflow.readStepScript(t)),
        ["npm run build\n", "npm test\n", "npm run release:assets\n"]);
      for (const step of ["Install, start and quit the package", "Remove libfuse2, which a stock Ubuntu does not install", "Make the package", "Read the product's name"])
        assert.equal(workflow.readStepScript(step), package_.readStepScript(step), step);
      assert.deepEqual(steps.filter(t => !/\n {8}timeout-minutes: \d+\n/.test(t)), []);
    });

    test("the check tells the build which platforms it signs, and only their jobs enter the release environment and get their own platform's credentials, in the packaging step alone",
      { timeout: ReleaseWorkflowTests.SCRIPT_TIMEOUT }, async t => {
        const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
        const run = async (signed: string): Promise<readonly string[]> => {
          const doubles = await CommandDoublesFixture.createAsync();
          t.after(() => doubles.disposeAsync());
          doubles.respond("npm", "run package -- --signed", "");
          doubles.respond("npm", "run package", "");
          const result = await doubles.runAsync(workflow.readStepScript("Make the package"), { SIGNED: signed });
          assert.equal(result.status, 0, result.stderr);
          return doubles.readCallsAsync();
        };

        assert.deepEqual(await run("true"), ["npm run package -- --signed"]);
        assert.deepEqual(await run("false"), ["npm run package"]);
        assert.ok(workflow.text.includes("    outputs:\n      targets: ${{ steps.targets.outputs.targets }}\n      signed-targets: ${{ steps.targets.outputs.signed-targets }}\n"));
        assert.ok(workflow.text.includes("      - name: Check the version and the revision\n        id: check\n"));
        assert.ok(workflow.text.includes(`      - name: ${ReleaseWorkflowTests.LIST_STEP}\n        id: targets\n        timeout-minutes: 1\n        env:\n          SIGNING: \${{ steps.check.outputs.signed }}\n`));
        assert.ok(workflow.text.includes("  build-signed:\n    name: Build, test, package and sign (${{ matrix.target }})\n    needs: check\n    if: needs.check.outputs.signed-targets != '[]'\n"
          + "    strategy:\n      fail-fast: true\n      matrix:\n        include: ${{ fromJSON(needs.check.outputs.signed-targets) }}\n"
          + "    runs-on: ${{ matrix.runner }}\n    environment: release\n    timeout-minutes: 105\n    steps: *build-steps\n\n  publish:\n"));
        assert.equal(workflow.text.match(/&build-steps|\*build-steps/g)?.length, 2);
        assert.ok(workflow.text.includes(`      - name: Make the package\n        timeout-minutes: 40\n        env:\n          SIGNED: \${{ matrix.signed }}\n`
          + ReleaseWorkflowTests.CREDENTIALS.map(([platform, name]) => `          ${name}: \${{ ${ReleaseWorkflowTests.SIGNED} && matrix.platform == '${platform}' && secrets.${name} || '' }}\n`).join("")
          + "        run: |\n"));
        assert.deepEqual(workflow.text.match(/environment: .*/g), ["environment: release", "environment: publish"]);
      });

    test("a build keeps its package report with three tries apart from the release files, and fails when there is none", async () => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, ReleaseWorkflowTests.REPORT_UPLOADS[0], ReleaseWorkflowTests.REPORT_UPLOADS[2]);
      const uploads = ReleaseWorkflowTests.REPORT_UPLOADS.map(t => simulation.find(t));

      assert.deepEqual(uploads.map(t => [t.uses, t.continueOnError]), [[ReleaseWorkflowTests.UPLOAD_ACTION, true], [ReleaseWorkflowTests.UPLOAD_ACTION, true], [ReleaseWorkflowTests.UPLOAD_ACTION, false]]);
      assert.deepEqual(uploads.map(t => t.settings), uploads.map(() => [
        "name: report-${{ matrix.runner }}-${{ matrix.architecture }}",
        "path: _build/package/package-report.json",
        "retention-days: 14",
        "if-no-files-found: error",
        "overwrite: true"
      ]));
      assert.deepEqual(simulation.run({}, {}).ran, [ReleaseWorkflowTests.REPORT_UPLOADS[0]]);
      assert.deepEqual(simulation.run({}, { [ReleaseWorkflowTests.REPORT_UPLOADS[0]]: "failure", [ReleaseWorkflowTests.REPORT_UPLOADS[1]]: "failure" }).ran, [
        ReleaseWorkflowTests.REPORT_UPLOADS[0], "Wait before keeping the package report again", ReleaseWorkflowTests.REPORT_UPLOADS[1],
        "Wait before keeping the package report a last time", ReleaseWorkflowTests.REPORT_UPLOADS[2]
      ]);
    });

    test("a build keeps exactly its release files with three tries, and fails when there are none", async () => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, ReleaseWorkflowTests.UPLOADS[0], ReleaseWorkflowTests.UPLOADS[2]);
      const uploads = ReleaseWorkflowTests.UPLOADS.map(t => simulation.find(t));

      assert.deepEqual(uploads.map(t => [t.uses, t.continueOnError]), [[ReleaseWorkflowTests.UPLOAD_ACTION, true], [ReleaseWorkflowTests.UPLOAD_ACTION, true], [ReleaseWorkflowTests.UPLOAD_ACTION, false]]);
      assert.deepEqual(uploads.map(t => t.settings), uploads.map(() => [
        "name: release-${{ matrix.runner }}-${{ matrix.architecture }}",
        "path: |",
        "  _build/package/out/${{ steps.product.outputs.name }}-*.exe",
        "  _build/package/out/${{ steps.product.outputs.name }}-*.dmg",
        "  _build/package/out/${{ steps.product.outputs.name }}-*.zip",
        "  _build/package/out/${{ steps.product.outputs.name }}-*.AppImage",
        "  _build/package/out/${{ steps.product.outputs.name }}-*.sha256",
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

    test("the publish job takes every target's files and package report from this run, also when only it is run again, and publishes them with notes that link the run", async () => {
      const workflow = await WorkflowFileFixture.readAsync(ReleaseWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, "Take this run's release files", "Publish the release");
      const [download, reports] = [simulation.find("Take this run's release files"), simulation.find("Take this run's package reports")];

      assert.deepEqual([download.uses, reports.uses], ["actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1",
        "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1"]);
      assert.deepEqual(download.settings, ["pattern: release-*", "merge-multiple: true", "path: _build/release"]);
      assert.deepEqual(reports.settings, ["pattern: report-*", "path: _build/release-reports"]);
      assert.ok(workflow.text.includes(`        env:\n          GH_TOKEN: \${{ github.token }}\n${ReleaseWorkflowTests.REQUEST}`
        + "          RELEASE_FOLDER: ${{ github.workspace }}/_build/release\n"
        + "          RELEASE_REPORTS: ${{ github.workspace }}/_build/release-reports\n"
        + "          RELEASE_RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}\n        run: node scripts/release-publish.ts\n"));
      assert.ok(workflow.text.includes(`    name: Publish the release\n${ReleaseWorkflowTests.PUBLISH_NEEDS}`));
      assert.ok(workflow.text.indexOf("Take this run's release files") < workflow.text.indexOf("      - name: Publish the release\n"));
    });
  }
}

ReleaseWorkflowTests.register();
