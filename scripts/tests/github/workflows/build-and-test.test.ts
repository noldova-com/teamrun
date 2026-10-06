/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import BuildMatrix from "../../../workflows/build-matrix.ts";
import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import SourceTreeFixture from "../../fixtures/source-tree.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class BuildAndTestTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "build-and-test.yml";
  private static readonly UI_WORKFLOW: string = "ui-workflows.yml";
  private static readonly UI_ACTION: string = "ui-workflows";
  private static readonly TARGET_WORKFLOW: string = "build-and-test-target.yml";
  private static readonly ACTION: string = "prepare";
  private static readonly ACTION_STEP: string = "      - name: Prepare the job\n        uses: ./.github/actions/prepare\n        with:\n          architecture: ${{ matrix.architecture }}\n";
  private static readonly TOOLCHAIN_STEP: string = "Verify the toolchain";
  private static readonly RESULT_STEP: string = "Require the selected verification to pass";
  private static readonly PLAN_STEP: string = "List the targets without a current cache";
  private static readonly UI_STEP: string = "Test the UI workflows";
  private static readonly SUMMARY_STEP: string = "Summarize the UI workflows";
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly DOWNLOAD_ACTION: string = "actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1";
  private static readonly UPLOADS: readonly (readonly [string, string, string, readonly string[]])[] = [
    ["Keep the UI workflow results", "Keep the UI workflow results again", "Keep the UI workflow results a last time",
      ["name: ui-${{ inputs.runner }}-${{ inputs.architecture }}-${{ inputs.shard }}-${{ github.run_attempt }}", "path: _build/ui", "retention-days: 14", "if-no-files-found: ignore", "overwrite: true"]],
    ["Keep the main window screenshot", "Keep the main window screenshot again", "Keep the main window screenshot a last time",
      ["path: _build/ui/main-window-*.png", "archive: false", "retention-days: 14", "if-no-files-found: ignore", "overwrite: true"]]
  ];
  private static readonly BUILD_ARTIFACT: string = "name: build-${{ matrix.runner }}-${{ matrix.architecture }}";
  private static readonly BUILD_UPLOAD_SETTINGS: readonly string[] = [BuildAndTestTests.BUILD_ARTIFACT, "path: build.tar", "retention-days: 3", "if-no-files-found: error", "overwrite: true"];
  private static readonly PACKED: string = "_build/archives _build/modules _build/packages _build/product.json _build/records _build/tests _build/variants _build/window _build/ui-builds.record " +
    "node_modules/.package-lock.json node_modules/@noldova src/generated";
  private static readonly WORKFLOW_NODE_SETUPS: readonly string[] = ["Set up Node.js to classify", "Set up Node.js to install", "Set up Node.js to add up the totals"];
  private static readonly ACTION_NODE_SETUP: string = "Set up Node.js";
  private static readonly NODE_ACTION: string = "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0";
  private static readonly FLAKY_STEPS: readonly string[] = ["Keep the flaky test record", "Keep the flaky test record again", "Keep the flaky test record a last time"];
  private static readonly FLAKY_WARNING: string = "Warn that the flaky test record was not kept";
  private static readonly TOTALS_UPLOADS: readonly (readonly [string, string, string, string, string, string])[] = [
    [BuildAndTestTests.TARGET_WORKFLOW, "Test", "Test", "test totals", "totals-${{ inputs.runner }}-${{ inputs.architecture }}-${{ matrix.part || 'all' }}", "_build/totals/"],
    [BuildAndTestTests.UI_ACTION, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP, "UI workflow totals", "totals-ui-${{ inputs.runner }}-${{ inputs.architecture }}-${{ inputs.shard }}", "_build/totals/ui.json"]
  ];
  private static readonly FLAKY_UPLOADS: readonly (readonly [string, string, string, string])[] = [
    [BuildAndTestTests.TARGET_WORKFLOW, "Test", "flaky-tests-${{ inputs.runner }}-${{ inputs.architecture }}-${{ matrix.part || 'all' }}-${{ github.run_attempt }}", "job"],
    [BuildAndTestTests.UI_ACTION, BuildAndTestTests.UI_STEP, "flaky-tests-ui-${{ inputs.runner }}-${{ inputs.architecture }}-${{ inputs.shard }}-${{ github.run_attempt }}", "shard"]
  ];
  private static readonly CACHE_LIST: string = "api --paginate repos/noldova-com/teamrun/actions/caches?key=dependencies-&ref=refs/heads/main&per_page=100 --jq .actions_caches[].key";
  private static readonly SPOTLIGHT_STEPS: readonly string[] = ["Stop Spotlight indexing while saving"];
  private static readonly UI_SPOTLIGHT_STEPS: readonly string[] = ["Stop Spotlight indexing before building", "Stop Spotlight indexing before the UI workflows"];
  private static readonly PULL_REQUEST_UI_TARGETS: string = "linux-x64 linux-arm64 windows-x64 macos-arm64";
  private static readonly ALL_UI_TARGETS: string = "linux-x64 linux-arm64 windows-x64 windows-arm64 macos-x64 macos-arm64";
  private static readonly TARGETS: readonly (readonly [string, string, string, string])[] = [
    ["Linux x64", "ubuntu-24.04", "Linux", "x64"],
    ["Linux ARM64", "ubuntu-24.04-arm", "Linux", "arm64"],
    ["Windows x64", "windows-2025", "Windows", "x64"],
    ["Windows ARM64", "windows-11-arm", "Windows", "arm64"],
    ["macOS x64", "macos-15-intel", "macOS", "x64"],
    ["macOS ARM64", "macos-15", "macOS", "arm64"]
  ];

  public static register(): void {
    test("the toolchain check passes only for the pinned Node.js and npm versions on the expected architecture", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION)).readStepScript(BuildAndTestTests.TOOLCHAIN_STEP);
      const cases: readonly (readonly [string, string, string, number])[] = [
        ["v26.7.0", "11.19.0", "arm64", 0],
        ["v26.8.0", "11.19.0", "arm64", 1],
        ["v26.7.0", "11.20.0", "arm64", 1],
        ["v26.7.0", "11.19.0", "x64", 1]
      ];
      for (const [nodeVersion, npmVersion, architecture, status] of cases) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        doubles.respond("node", "--version", nodeVersion);
        doubles.respond("npm", "--version", npmVersion);
        doubles.respond("node", "--print process.platform + '/' + process.arch", `linux/${architecture}`);
        doubles.respond("node", "--print process.arch", architecture);

        const result = await doubles.runAsync(script, { EXPECTED_ARCHITECTURE: "arm64" });

        assert.equal(result.status, status, `${nodeVersion} ${npmVersion} ${architecture}: ${result.stderr}`);
        assert.match(result.stdout, new RegExp(`^${nodeVersion}\\n?${npmVersion}\\n?linux/${architecture}`));
      }
    });

    test("the workflow and its shared setup pin the versions the root manifest requires", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const action = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION);
      const ui = await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW);
      const manifest: unknown = JSON.parse(await readFile(path.join(SourceTreeFixture.root, "package.json"), "utf8"));
      assert.ok(typeof manifest === "object" && manifest !== null && "engines" in manifest && "packageManager" in manifest);
      assert.deepEqual(manifest.engines, { node: ">=26.7.0 <27", npm: "11.19.0" });
      assert.equal(manifest.packageManager, "npm@11.19.0");
      assert.equal(workflow.text.match(/node-version: '26\.7\.0'/g)?.length, 3 * BuildAndTestTests.WORKFLOW_NODE_SETUPS.length);
      assert.equal(action.text.match(/node-version: '26\.7\.0'/g)?.length, 3);
      assert.doesNotMatch(ui.text, /node-version|setup-node/);
      for (const text of [workflow.text, action.text])
        assert.doesNotMatch(text, /node-version: '(?!26\.7\.0')/);
      const script = action.readStepScript(BuildAndTestTests.TOOLCHAIN_STEP);
      assert.ok(script.includes("test \"$(node --version)\" = v26.7.0\n"));
      assert.ok(script.includes("test \"$(npm --version)\" = 11.19.0\n"));
    });

    test("the aggregate check passes a documentation-only skip, a run without UI workflows or a complete pass, and fails otherwise", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.RESULT_STEP);
      const all = BuildAndTestTests.ALL_UI_TARGETS;
      const pullRequest = BuildAndTestTests.PULL_REQUEST_UI_TARGETS;
      const cases: readonly (readonly [string, string, string, string, string, string, number, RegExp])[] = [
        ["success", "false", "false", "skipped", "skipped", pullRequest, 0, /^Only Markdown documentation changed/],
        ["success", "true", "false", "success", "success", pullRequest, 0, /^Only documentation, CI and test tooling or repository configuration changed: .* The UI workflows were not required\.\n$/],
        ["success", "true", "true", "success", "success", pullRequest, 0, /^The document checks passed, and the build, tests and UI workflows passed on every target\.\n$/],
        ["success", "true", "true", "success", "success", all, 0, /^The document checks passed, and the build, tests and UI workflows passed on every target\.\n$/],
        ["success", "true", "true", "success", "success", "", 1, /^$/],
        ["success", "true", "true", "success", "failure", pullRequest, 1, /^$/],
        ["success", "true", "true", "success", "cancelled", pullRequest, 1, /^$/],
        ["success", "true", "true", "success", "skipped", pullRequest, 1, /^$/],
        ["success", "true", "false", "success", "failure", pullRequest, 1, /^$/],
        ["success", "true", "false", "success", "skipped", pullRequest, 1, /^$/],
        ["success", "false", "false", "skipped", "success", pullRequest, 1, /^$/],
        ["success", "true", "true", "failure", "success", pullRequest, 1, /^$/],
        ["success", "true", "true", "cancelled", "skipped", pullRequest, 1, /^$/],
        ["success", "true", "true", "skipped", "success", pullRequest, 1, /^$/],
        ["success", "false", "true", "skipped", "skipped", pullRequest, 1, /^$/],
        ["success", "true", "false", "failure", "success", pullRequest, 1, /^$/],
        ["success", "true", "false", "skipped", "success", pullRequest, 1, /^$/],
        ["success", "false", "false", "success", "skipped", pullRequest, 1, /^$/],
        ["failure", "", "", "skipped", "skipped", "", 1, /^$/],
        ["cancelled", "", "", "skipped", "skipped", "", 1, /^$/],
        ["skipped", "", "", "skipped", "skipped", "", 1, /^$/]
      ];
      await Promise.all(cases.map(async ([changes, runCode, runUi, validation, totals, uiTargets, status, summary]) => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await writeFile(path.join(doubles.directory, "summary.md"), "");

        const result = await doubles.runAsync(script, {
          CHANGES_RESULT: changes, RUN_CODE: runCode, RUN_UI: runUi, VALIDATION_RESULT: validation, TOTALS_RESULT: totals, UI_TARGETS: uiTargets, DEFERRED: "", UI_DEFERRED: "",
          GITHUB_STEP_SUMMARY: "summary.md"
        });

        const label = [changes, runCode, runUi, validation, totals, uiTargets].join(":");
        assert.equal(result.status, status, `${label}: ${result.stderr}`);
        assert.match(await doubles.readFileAsync("summary.md"), summary, label);
        if (status !== 0)
          assert.match(result.stdout, /^::error::/);
      }));
    });

    test("the aggregate check names the targets a passing pull request run left to main and manual runs", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.RESULT_STEP);
      const deferred = "Windows ARM64 (on every push to main and in manual runs), macOS x64 (every night and in manual runs)";
      const left = `every target this run covers. Skipped here: ${deferred}.`;
      for (const [runUi, summary] of [
        ["true", `The document checks passed, and the build, tests and UI workflows passed on ${left}\n`],
        ["false", `Only documentation, CI and test tooling or repository configuration changed: the document checks passed, the build and tests passed on ${left} The UI workflows were not required.\n`]
      ] as const) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await writeFile(path.join(doubles.directory, "summary.md"), "");

        const result = await doubles.runAsync(script, {
          CHANGES_RESULT: "success", RUN_CODE: "true", RUN_UI: runUi, VALIDATION_RESULT: "success", TOTALS_RESULT: "success", UI_TARGETS: BuildAndTestTests.PULL_REQUEST_UI_TARGETS, DEFERRED: deferred,
          GITHUB_STEP_SUMMARY: "summary.md"
        });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(await doubles.readFileAsync("summary.md"), summary);
      }
    });

    test("the aggregate check names macOS x64, which a push leaves to nightly and manual runs, and still requires every target it runs to pass", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.RESULT_STEP);
      const uiTargets = BuildAndTestTests.ALL_UI_TARGETS.split(" ").filter(t => t !== "macos-x64").join(" ");
      for (const [validation, status, summary] of [
        ["success", 0, "The document checks passed, and the build, tests and UI workflows passed on every target this run covers. Skipped here: macOS x64 (every night and in manual runs).\n"],
        ["failure", 1, ""]
      ] as const) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await writeFile(path.join(doubles.directory, "summary.md"), "");

        const result = await doubles.runAsync(script, {
          CHANGES_RESULT: "success", RUN_CODE: "true", RUN_UI: "true", VALIDATION_RESULT: validation, TOTALS_RESULT: "success", UI_TARGETS: uiTargets, DEFERRED: "macOS x64 (every night and in manual runs)",
          GITHUB_STEP_SUMMARY: "summary.md"
        });

        assert.equal(result.status, status, `${validation}: ${result.stderr}`);
        assert.equal(await doubles.readFileAsync("summary.md"), summary);
      }
    });

    test("every macOS job stops Spotlight indexing before checking out", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const ui = await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("sudo", "mdutil -i off /System/Volumes/Data", "");
      const steps = [...BuildAndTestTests.SPOTLIGHT_STEPS.map(t => [workflow, t] as const), ...BuildAndTestTests.UI_SPOTLIGHT_STEPS.map(t => [ui, t] as const)];

      for (const [file, step] of steps)
        assert.equal((await doubles.runAsync(file.readStepScript(step))).status, 0, step);

      assert.deepEqual(await doubles.readCallsAsync(), steps.map(() => "sudo mdutil -i off /System/Volumes/Data"));
      for (const [text, job, next] of [[workflow.text, "cache", "caches"], [ui.text, "build", "shards"], [ui.text, "shards", ""]] as const) {
        const end = next === "" ? text.length : text.indexOf(`  ${next}:\n`);
        const jobSteps = text.slice(text.indexOf(`  ${job}:\n`), end).split("    steps:\n")[1] ?? "";
        assert.match(jobSteps, /^ {6}- name: Stop Spotlight indexing[^\n]*\n {8}if: runner\.os == 'macOS'\n {8}run: sudo mdutil -i off \/System\/Volumes\/Data\n\n {6}- name: Check out the revision/, job);
      }
    });

    test("every change checks the documents, and the targets build and test unless only documentation changed", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      assert.equal(workflow.readStepScript("Check the documents"), "npm test -- documents\n");
      assert.equal(workflow.readStepScript("Select the verification scope and the jobs"), "node scripts/classify-changes.ts\n");
      assert.ok(text.indexOf("Check the documents") < text.indexOf("Select the verification scope and the jobs"));
      assert.ok(text.includes("          EVENT_NAME: ${{ github.event_name }}\n          BASE_SHA: ${{ github.event.pull_request.base.sha || github.event.merge_group.base_sha }}\n" +
        "          HEAD_SHA: ${{ github.event.pull_request.head.sha || github.event.merge_group.head_sha || github.sha }}\n"));
      for (const output of ["run-code", "run-ui", "targets", "target-table", "ui-targets", "deferred"])
        assert.ok(text.includes(`      ${output}: \${{ steps.scope.outputs.${output} }}\n`), output);
      assert.ok(text.includes("  validate:\n    name: Build and test (${{ matrix.target }})\n    needs: changes\n" +
        "    if: ${{ !cancelled() && needs.changes.result == 'success' && needs.changes.outputs.run-code == 'true' }}\n" +
        "    strategy:\n      fail-fast: false\n      matrix:\n        include: ${{ fromJSON(needs.changes.outputs.targets) }}\n" +
        "    uses: ./.github/workflows/build-and-test-target.yml\n    with:\n      runner: ${{ matrix.runner }}\n      architecture: ${{ matrix.architecture }}\n      jobs: ${{ toJSON(matrix.jobs) }}\n      ui: ${{ needs.changes.outputs.run-ui == 'true' && toJSON(matrix.ui) || 'null' }}\n\n"));
      assert.ok(text.includes("    name: Build and test (all targets)\n    needs: [changes, validate, totals]\n    if: always()\n"));
      assert.ok(text.includes("          TOTALS_RESULT: ${{ needs.totals.result }}\n"));
      assert.doesNotMatch(text, /UI_RESULTS|ui-plan/);
      assert.ok(text.includes("          UI_TARGETS: ${{ needs.changes.outputs.ui-targets }}\n"));
      assert.doesNotMatch(text, /ui-deferred|UI_DEFERRED/);
    });

    test("each target's workflow calls its UI workflows, after its Build job when they share its build and at once otherwise", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      const target = (await WorkflowFileFixture.readAsync(BuildAndTestTests.TARGET_WORKFLOW)).text;
      const ui = (await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW)).text;

      assert.doesNotMatch(text, /ui-workflows\.yml/);
      assert.ok(target.endsWith("  shared-ui:\n    name: UI workflows\n    needs: build\n    if: ${{ inputs.ui != 'null' && fromJSON(inputs.ui).shared }}\n" +
        "    uses: ./.github/workflows/ui-workflows.yml\n    with:\n      plan: ${{ inputs.ui }}\n\n" +
        "  ui:\n    name: UI workflows\n    if: ${{ inputs.ui != 'null' && !fromJSON(inputs.ui).shared && !fromJSON(inputs.ui).folded }}\n" +
        "    uses: ./.github/workflows/ui-workflows.yml\n    with:\n      plan: ${{ inputs.ui }}\n"));
      assert.ok(ui.includes("on:\n  workflow_call:\n    inputs:\n      plan:\n"));
      assert.ok(ui.includes("  build:\n    name: Build (${{ matrix.target }})\n    if: ${{ fromJSON(inputs.plan).build[0] != null }}\n" +
        "    strategy:\n      matrix:\n        include: ${{ fromJSON(inputs.plan).build }}\n    runs-on: ${{ matrix.runner }}\n"));
      assert.ok(ui.includes("  shards:\n    name: ${{ matrix.grep == '' && format('Shard {0} of {1}', matrix.shard, matrix.shards) || 'Smoke set' }}\n    needs: build\n" +
        "    if: ${{ !cancelled() && contains(fromJSON('[\"success\", \"skipped\"]'), needs.build.result) }}\n" +
        "    strategy:\n      fail-fast: false\n      matrix:\n        include: ${{ fromJSON(inputs.plan).shards }}\n    runs-on: ${{ matrix.runner }}\n"));
      assert.deepEqual(ui.match(/^ {2}[a-z-]+:(?=\n {4}name: )/gm), ["  build:", "  shards:"]);
    });

    test("a target that doesn't share its build builds once for its UI workflows and runs them in shards that reuse that build", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW);
      const text = workflow.text;
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      const paths = BuildAndTestTests.PACKED.split(" ");
      const listing = `for path in ${BuildAndTestTests.PACKED}; do if [ -d "$path" ]; then cat "$path/content"; else cat "$path"; fi; done\n`;
      await doubles.runAsync(paths.map(t => t.includes(".") ? `mkdir -p "$(dirname ${t})" && echo ${t} > ${t}\n` : `mkdir -p ${t} && echo ${t} > ${t}/content\n`).join(""));

      const packed = await doubles.runAsync(workflow.readStepScript("Pack the builds"));
      await doubles.runAsync(`rm -rf ${BuildAndTestTests.PACKED}\n`);
      const removed = await doubles.runAsync(listing);
      const unpacked = await doubles.runAsync(workflow.readStepScript("Unpack the builds"));
      const restored = await doubles.runAsync(listing);
      const archive = await doubles.runAsync("test -e build.tar\n");

      assert.deepEqual([packed.status, removed.status, unpacked.status, restored.status, archive.status], [0, 1, 0, 0, 1], packed.stderr + unpacked.stderr + restored.stderr);
      assert.equal(restored.stdout, paths.map(t => `${t}\n`).join(""));
      assert.equal(workflow.readStepScript("Build the test build and its variants"), "npm run test:ui -- --list\n");
      const main = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      const [build, shards] = [text.slice(text.indexOf("  build:\n"), text.indexOf("  shards:\n")), text.slice(text.indexOf("  shards:\n"))];
      for (const job of [build, shards])
        assert.equal(job.split(BuildAndTestTests.ACTION_STEP).length, 2);
      assert.doesNotMatch(main, /test:ui|Test the UI workflows/);
      assert.doesNotMatch(build, /npm run build|npm test\n|--shard/);
      assert.doesNotMatch(shards, /npm run build|npm test\n|--list/);
      const order = ["Build the test build and its variants", "Pack the builds", "Keep the builds for the UI workflows", "Fetch the builds", "Unpack the builds", "Run the UI workflows"]
        .map(t => text.indexOf(`      - name: ${t}\n`));
      assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > (order[index - 1] ?? 0))), order.join(","));
    });

    test("the cache plan reads its targets from the classification, whose table lists every target", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      const operatingSystems: Readonly<Record<string, string>> = { ubuntu: "Linux", windows: "Windows", macos: "macOS" };

      assert.deepEqual(BuildMatrix.TARGETS.map(t => [t.name, t.runner, t.operatingSystem, t.architecture]), BuildAndTestTests.TARGETS.map(t => [...t]));
      for (const [, runner, os] of BuildAndTestTests.TARGETS)
        assert.equal(operatingSystems[runner.split("-")[0] ?? ""], os, runner);
      assert.ok(text.includes("  cache-plan:\n    name: Find the missing dependency caches\n    needs: changes\n"));
      assert.ok(text.includes("          TARGET_TABLE: ${{ needs.changes.outputs.target-table }}\n"));
    });

    test("runs read the repository only, except the cache cleanup on main, and only pull request runs are cancelled by a newer push", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      const ui = (await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW)).text;
      const action = (await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION)).text;
      const uiAction = (await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION)).text;
      assert.ok(text.includes("permissions:\n  contents: read\n"));
      assert.ok(ui.includes("permissions:\n  contents: read\n"));
      assert.deepEqual(ui.match(/^ *\S+: (read|write)$/gm), ["  contents: read"]);
      assert.equal(ui.match(/persist-credentials: false/g)?.length, 2);
      assert.doesNotMatch(ui, /concurrency|secrets|token/);
      assert.deepEqual(text.match(/^ *\S+: write$/gm), ["      actions: write"]);
      assert.deepEqual(text.match(/^ *\S+: read$/gm), [
        "  contents: read", "      actions: read", "      contents: read", "      contents: read"
      ]);
      assert.ok(text.includes("    name: Remove outdated dependency caches\n    needs: [cache-plan, cache]\n" +
        "    if: ${{ !cancelled() && github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.cache-plan.result == 'success' && " +
        "(needs.cache.result == 'success' || needs.cache.result == 'skipped') }}\n"));
      assert.equal(text.match(/persist-credentials: false/g)?.length, 5);
      assert.ok(text.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
      for (const trigger of ["  pull_request:\n    branches: [main]", "  merge_group:\n    types: [checks_requested]\n", "  push:\n    branches: [main]", "  workflow_dispatch:"])
        assert.ok(text.includes(trigger), trigger);
      for (const use of [...text.matchAll(/uses: (\S+)/g), ...ui.matchAll(/uses: (\S+)/g), ...action.matchAll(/uses: (\S+)/g), ...uiAction.matchAll(/uses: (\S+)/g)])
        assert.match(use[1] ?? "", /^(actions\/[a-z-]+(\/[a-z-]+)?@[0-9a-f]{40}|\.\/\.github\/actions\/(prepare|ui-workflows)|\.\/\.github\/workflows\/(ui-workflows|build-and-test-target)\.yml)$/);
      for (const composite of [action, uiAction])
        assert.doesNotMatch(composite, /permissions|secrets|token/);
    });

    test("each job restores both dependency caches by OS, CPU and lockfile and never saves them", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      const action = (await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION)).text;
      const order = ["Restore the installed dependencies", "Restore the Angular project's installed dependencies", "Discard an inexact Angular install", "Install dependencies", "Install Electron"]
        .map(t => action.indexOf(`    - name: ${t}\n`));
      assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > (order[index - 1] ?? 0))), order.join(","));
      assert.equal(action.match(/key: dependencies-root-\$\{\{ runner\.os \}\}-\$\{\{ inputs\.architecture \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}\n/g)?.length, 1);
      assert.equal(action.match(/key: dependencies-src-\$\{\{ runner\.os \}\}-\$\{\{ inputs\.architecture \}\}-\$\{\{ hashFiles\('src\/package-lock\.json'\) \}\}\n/g)?.length, 1);
      assert.equal(text.match(/key: dependencies-root-\$\{\{ runner\.os \}\}-\$\{\{ matrix\.architecture \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}\n/g)?.length, 1);
      assert.equal(text.match(/key: dependencies-src-\$\{\{ runner\.os \}\}-\$\{\{ matrix\.architecture \}\}-\$\{\{ hashFiles\('src\/package-lock\.json'\) \}\}\n/g)?.length, 1);
      for (const file of [text, action])
        assert.doesNotMatch(file, /restore-keys/);
      assert.ok(action.includes("    - name: Install dependencies\n      if: steps.root-dependencies.outputs.cache-hit != 'true'\n"));
      assert.ok(action.includes("    - name: Discard an inexact Angular install\n      if: steps.angular-dependencies.outputs.cache-hit != 'true'\n"));
      assert.doesNotMatch(action, /actions\/cache\/save/);
      assert.doesNotMatch(text.slice(0, text.indexOf("  cache-plan:\n")), /actions\/cache\/save/);
      assert.doesNotMatch((await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW)).text, /actions\/cache/);
    });

    test("the plan lists only the targets that miss a current root or Angular cache", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.PLAN_STEP);
      const table = BuildAndTestTests.TARGETS.map(t => t.join("|")).join(";");
      const complete = BuildAndTestTests.TARGETS.flatMap(([, , os, architecture]) => [`dependencies-root-${os}-${architecture}-rootnew`, `dependencies-src-${os}-${architecture}-srcnew`]);
      const entry = ([target, runner, , architecture]: readonly [string, string, string, string]): string =>
        `{"target":"${target}","runner":"${runner}","architecture":"${architecture}"}`;
      const cases: readonly (readonly [readonly string[], string])[] = [
        [complete, "targets=[]\n"],
        [[...complete, "dependencies-root-Linux-x64-rootold"], "targets=[]\n"],
        [complete.filter(t => t !== "dependencies-src-macOS-arm64-srcnew"), `targets=[${entry(BuildAndTestTests.TARGETS[5] ?? ["", "", "", ""])}]\n`],
        [complete.filter(t => t !== "dependencies-root-Windows-x64-rootnew" && t !== "dependencies-src-Linux-arm64-srcnew"),
          `targets=[${entry(BuildAndTestTests.TARGETS[1] ?? ["", "", "", ""])},${entry(BuildAndTestTests.TARGETS[2] ?? ["", "", "", ""])}]\n`],
        [complete.map(t => `${t}x`), `targets=[${BuildAndTestTests.TARGETS.map(entry).join(",")}]\n`],
        [[], `targets=[${BuildAndTestTests.TARGETS.map(entry).join(",")}]\n`]
      ];
      for (const [keys, outputs] of cases) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        doubles.respond("gh", BuildAndTestTests.CACHE_LIST, keys.length === 0 ? "" : `${keys.join("\n")}\n`);
        await doubles.runAsync("touch outputs.txt\n");

        const result = await doubles.runAsync(script, { GITHUB_REPOSITORY: "noldova-com/teamrun", ROOT_HASH: "rootnew", SOURCE_HASH: "srcnew", GITHUB_OUTPUT: "outputs.txt", TARGET_TABLE: table });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(await doubles.readFileAsync("outputs.txt"), outputs);
        const parsed: unknown = JSON.parse(outputs.slice("targets=".length));
        assert.ok(Array.isArray(parsed));
        assert.equal(result.stdout, parsed.map(t => `${String((t as { target: unknown }).target)} has no current dependency cache.\n`).join(""));
      }

      const failing = await CommandDoublesFixture.createAsync();
      t.after(() => failing.disposeAsync());
      failing.respond("gh", BuildAndTestTests.CACHE_LIST, "", 1);
      assert.notEqual((await failing.runAsync(script, { GITHUB_REPOSITORY: "noldova-com/teamrun", ROOT_HASH: "rootnew", SOURCE_HASH: "srcnew", GITHUB_OUTPUT: "outputs.txt", TARGET_TABLE: table })).status, 0);
      const unplanned = await CommandDoublesFixture.createAsync();
      t.after(() => unplanned.disposeAsync());
      unplanned.respond("gh", BuildAndTestTests.CACHE_LIST, "");
      await unplanned.runAsync("touch outputs.txt\n");
      assert.notEqual((await unplanned.runAsync(script, { GITHUB_REPOSITORY: "noldova-com/teamrun", ROOT_HASH: "rootnew", SOURCE_HASH: "srcnew", GITHUB_OUTPUT: "outputs.txt", TARGET_TABLE: "" })).status, 0);
      assert.equal(await unplanned.readFileAsync("outputs.txt"), "");
    });

    test("a target without a current cache installs exactly as the jobs' shared setup does and saves only what is missing", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const action = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION);
      const text = workflow.text;
      const cache = text.slice(text.indexOf("  cache:\n"), text.indexOf("  caches:\n"));
      assert.ok(cache.startsWith("  cache:\n    name: Save the dependency caches (${{ matrix.target }})\n    needs: cache-plan\n" +
        "    if: needs.cache-plan.outputs.targets != '[]'\n"));
      assert.ok(cache.includes("        include: ${{ fromJSON(needs.cache-plan.outputs.targets) }}\n"));
      assert.equal(workflow.readStepScript("Verify the toolchain to install"), action.readStepScript(BuildAndTestTests.TOOLCHAIN_STEP));
      assert.equal(workflow.readStepScript("Install the dependencies to save"), action.readStepScript("Install dependencies"));
      assert.equal(workflow.readStepScript("Install Electron to save"), action.readStepScript("Install Electron"));
      assert.equal(workflow.readStepScript("Install the Angular project to save"), (await WorkflowFileFixture.readAsync(BuildAndTestTests.TARGET_WORKFLOW)).readStepScript("Build"));
      const order = [
        "Stop Spotlight indexing while saving", "Check out the revision to install", "Set up Node.js to install", "Verify the toolchain to install",
        "Restore the saved installed dependencies", "Look up the Angular project's saved dependencies", "Install the dependencies to save", "Install Electron to save",
        "Save the installed dependencies", "Install the Angular project to save", "Save the Angular project's installed dependencies"
      ].map(t => cache.indexOf(`      - name: ${t}\n`));
      assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > (order[index - 1] ?? 0))), order.join(","));
      for (const step of ["Install the dependencies to save", "Install Electron to save", "Save the installed dependencies"])
        assert.ok(cache.includes(`      - name: ${step}\n        if: steps.root-dependencies.outputs.cache-hit != 'true'\n`), step);
      for (const step of ["Install the Angular project to save", "Save the Angular project's installed dependencies"])
        assert.ok(cache.includes(`      - name: ${step}\n        if: steps.angular-dependencies.outputs.cache-hit != 'true'\n`), step);
      assert.ok(cache.includes("          path: src/node_modules\n          key: dependencies-src-${{ runner.os }}-${{ matrix.architecture }}-${{ hashFiles('src/package-lock.json') }}\n" +
        "          lookup-only: true\n"));
      assert.equal(cache.match(/key: \$\{\{ steps\.(root|angular)-dependencies\.outputs\.cache-primary-key \}\}/g)?.length, 2);
    });

    test("Electron's binary is installed before the dependencies are saved, so a saved install includes it", async () => {
      const action = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION);
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;

      assert.ok(action.readStepScript("Install Electron").includes("node node_modules/electron/install.js"));
      assert.ok(action.text.includes("    - name: Install Electron\n      shell: bash\n      run: "));
      assert.ok(action.text.indexOf("    - name: Install dependencies\n") < action.text.indexOf("    - name: Install Electron\n"));
      assert.ok(text.indexOf("      - name: Install Electron to save\n") < text.indexOf("      - name: Save the installed dependencies\n"));
    });

    for (const [name, exitCodes, status, sleeps] of [
      ["a download that fails and then succeeds passes after one pause", [1, 0], 0, 1],
      ["a download that succeeds at once does not wait", [0], 0, 0],
      ["a download that fails every attempt fails the step after three pauses", [1], 1, 3]
    ] as const)
      test(`Electron's binary download is retried a bounded number of times: ${name}`, { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
        const action = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION);
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        doubles.respondInTurn("node", "node_modules/electron/install.js", exitCodes, "HTTPError: Response code 500");
        const stoppedSleep = "sleep() { echo \"sleep $*\" >> sleeps.log; }\n";

        const result = await doubles.runAsync(stoppedSleep + action.readStepScript("Install Electron"));

        const calls = await doubles.readCallsAsync();
        const waits = (await doubles.readFileAsync("sleeps.log").catch(() => "")).split("\n").filter(t => t.length > 0);
        assert.equal(result.status, status, result.stderr);
        assert.deepEqual(waits, Array<string>(sleeps).fill("sleep 15"));
        assert.equal(calls.filter(t => t.startsWith("node ")).length, status === 0 ? exitCodes.length : 4);
        if (status !== 0) {
          assert.match(result.stderr, /HTTPError: Response code 500/);
          assert.match(result.stdout, /^::error::Electron's binary could not be downloaded in 4 attempts\.$/m);
        }
      });

    test("each shard runs its part of the UI workflows, under Xvfb on Linux, and keeps its results", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION);
      const text = workflow.text;
      const shards = (await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW)).text;
      const script = workflow.readStepScript(BuildAndTestTests.UI_STEP);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("dbus-run-session", "-- xvfb-run --auto-servernum --server-args=-screen 0 1920x1080x24 npm run test:ui -- --require-current --shard 2/3 --retries 1", "");
      doubles.respond("npm", "run test:ui -- --require-current --shard 2/3 --retries 1", "");

      doubles.respond("npm", "run test:ui -- --shard 1/1 --retries 1 --grep @smoke", "");
      const shard = { SHARD: "2/3", REQUIRE_CURRENT: "--require-current", GREP: "" };

      const linux = await doubles.runAsync(script, { RUNNER_OS: "Linux", ...shard });
      const windows = await doubles.runAsync(script, { RUNNER_OS: "Windows", ...shard });
      const macos = await doubles.runAsync(script, { RUNNER_OS: "macOS", ...shard });
      const smoke = await doubles.runAsync(script, { RUNNER_OS: "macOS", SHARD: "1/1", REQUIRE_CURRENT: "", GREP: "@smoke" });

      assert.deepEqual([linux.status, windows.status, macos.status, smoke.status], [0, 0, 0, 0], linux.stderr + windows.stderr + macos.stderr + smoke.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), [
        "dbus-run-session -- xvfb-run --auto-servernum --server-args=-screen 0 1920x1080x24 npm run test:ui -- --require-current --shard 2/3 --retries 1", "npm run test:ui -- --require-current --shard 2/3 --retries 1",
        "npm run test:ui -- --require-current --shard 2/3 --retries 1", "npm run test:ui -- --shard 1/1 --retries 1 --grep @smoke"
      ]);
      assert.ok(text.includes("    - name: Test the UI workflows\n      id: ui\n      env:\n        SHARD: ${{ inputs.shard }}/${{ inputs.shards }}\n" +
        "        REQUIRE_CURRENT: ${{ inputs.prebuilt == 'true' && '--require-current' || '' }}\n        GREP: ${{ inputs.grep }}\n"));
      assert.ok(shards.includes("      - name: Fetch the builds\n        id: fetch\n        if: matrix.prebuilt\n"));
      assert.ok(shards.includes("      - name: Unpack the builds\n        if: matrix.prebuilt\n"));
      assert.ok(shards.endsWith("      - name: Run the UI workflows\n        uses: ./.github/actions/ui-workflows\n        with:\n          target: ${{ matrix.target }}\n" +
        "          runner: ${{ matrix.runner }}\n          architecture: ${{ matrix.architecture }}\n          shard: ${{ matrix.shard }}\n          shards: ${{ matrix.shards }}\n" +
        "          grep: ${{ matrix.grep }}\n          prebuilt: ${{ matrix.prebuilt }}\n"));
      assert.equal(workflow.readStepScript(BuildAndTestTests.SUMMARY_STEP), "node scripts/ui-summary.ts\n");
      assert.ok(text.includes("    - name: Summarize the UI workflows\n      id: summary\n      if: always() && steps.ui.outcome != 'skipped'\n      env:\n" +
        "        UI_TARGET: ${{ inputs.target }}, ${{ inputs.shard }} of ${{ inputs.shards }}\n        UI_SHARD: ${{ inputs.shard }}/${{ inputs.shards }}\n        GREP: ${{ inputs.grep }}\n" +
        "        SCREENSHOT_URL: ${{ steps.screenshot-last.outputs.artifact-url || steps.screenshot-again.outputs.artifact-url || steps.screenshot.outputs.artifact-url }}\n"));
      assert.ok(text.includes("        SCREENSHOT_UPLOAD_FAILED: ${{ steps.screenshot-last.outcome == 'failure' }}\n"));
    });

    test("each upload of the UI results is tried three times with a pause, with the same settings", async () => {
      const workflow = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION);
      const simulation = new WorkflowSimulation(workflow.text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);

      for (const [first, again, last, settings] of BuildAndTestTests.UPLOADS) {
        const attempts = [simulation.find(first), simulation.find(again), simulation.find(last)];
        const pause = `Wait before keeping the ${first.slice("Keep the ".length)}`;

        assert.deepEqual(attempts.map(t => t.uses), attempts.map(() => BuildAndTestTests.UPLOAD_ACTION));
        assert.deepEqual(attempts.map(t => t.continueOnError), [true, true, true]);
        assert.deepEqual(attempts.map(t => t.settings), BuildAndTestTests.threeTimes(settings));
        assert.equal(workflow.readStepScript(`${pause} again`), "sleep 15\n");
        assert.equal(workflow.readStepScript(`${pause} a last time`), "sleep 15\n");
      }
    });

    test("keeping and fetching a target's builds are each tried three times with a pause, and fail the job only when the last attempt fails", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW);

      for (const [first, pause, action, settings] of [
        ["Keep the builds for the UI workflows", "Wait before keeping the builds", BuildAndTestTests.UPLOAD_ACTION, BuildAndTestTests.BUILD_UPLOAD_SETTINGS],
        ["Fetch the builds", "Wait before fetching the builds", BuildAndTestTests.DOWNLOAD_ACTION, [BuildAndTestTests.BUILD_ARTIFACT]]
      ] as const) {
        const [again, last] = [`${first} again`, `${first} a last time`];
        const simulation = new WorkflowSimulation(workflow.text, first, last);
        const attempts = [first, again, last].map(t => simulation.find(t));

        const prebuilt = { prebuilt: "true" };
        const passed = simulation.run(prebuilt, {});
        const retried = simulation.run(prebuilt, { [first]: "failure" });
        const failed = simulation.run(prebuilt, { [first]: "failure", [again]: "failure", [last]: "failure" });
        const selfBuilt = simulation.run({ prebuilt: "false" }, {});

        assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[action, true], [action, true], [action, false]], first);
        assert.deepEqual(selfBuilt.ran, first === "Fetch the builds" ? [] : [first], first);
        assert.deepEqual(attempts.map(t => t.settings), BuildAndTestTests.threeTimes(settings), first);
        assert.deepEqual([workflow.readStepScript(`${pause} again`), workflow.readStepScript(`${pause} a last time`)], ["sleep 15\n", "sleep 15\n"], first);
        assert.deepEqual([passed.ran, passed.isJobFailed], [[first], false], first);
        assert.deepEqual([retried.ran, retried.isJobFailed], [[first, `${pause} again`, again], false], first);
        assert.deepEqual([failed.ran, failed.isJobFailed], [[first, `${pause} again`, again, `${pause} a last time`, last], true], first);
      }
    });

    test("each Node.js setup is tried three times with a pause and the same settings, and fails its job only when the last attempt fails", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const action = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION);

      for (const [file, first] of [...BuildAndTestTests.WORKFLOW_NODE_SETUPS.map(t => [workflow, t] as const), [action, BuildAndTestTests.ACTION_NODE_SETUP] as const]) {
        const [again, last] = [`${first} again`, `${first} a last time`];
        const pause = `Wait before setting up ${first.slice("Set up ".length)}`;
        const simulation = new WorkflowSimulation(file.text, first, last);
        const attempts = [first, again, last].map(t => simulation.find(t));

        const passed = simulation.run({}, {});
        const retried = simulation.run({}, { [first]: "failure" });
        const failed = simulation.run({}, { [first]: "failure", [again]: "failure", [last]: "failure" });

        assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[BuildAndTestTests.NODE_ACTION, true], [BuildAndTestTests.NODE_ACTION, true], [BuildAndTestTests.NODE_ACTION, false]], first);
        assert.deepEqual([attempts[1]?.settings, attempts[2]?.settings], [attempts[0]?.settings, attempts[0]?.settings], first);
        assert.ok(attempts[0]?.settings.includes("node-version: '26.7.0'"), first);
        assert.deepEqual([file.readStepScript(`${pause} again`), file.readStepScript(`${pause} a last time`)], ["sleep 30\n", "sleep 30\n"], first);
        assert.deepEqual([passed.ran, passed.isJobFailed], [[first], false], first);
        assert.deepEqual([retried.ran, retried.isJobFailed], [[first, `${pause} again`, again], false], first);
        assert.deepEqual([failed.ran, failed.isJobFailed], [[first, `${pause} again`, again, `${pause} a last time`, last], true], first);
      }
    });

    test("each test job and UI shard keeps its test totals whenever its tests ran, tried three times with a pause, and fails the job only when the last attempt fails", async () => {
      for (const [name, first, recording, record, artifact, totalsPath] of BuildAndTestTests.TOTALS_UPLOADS) {
        const workflow = await BuildAndTestTests.readFileAsync(name);
        const keep = `Keep the ${record}`;
        const [again, last] = [`${keep} again`, `${keep} a last time`];
        const [pause, lastPause] = [`Wait before keeping the ${record} again`, `Wait before keeping the ${record} a last time`];
        const simulation = new WorkflowSimulation(workflow.text, first, last);
        const attempts = [keep, again, last].map(t => simulation.find(t));
        const matrix = { angular: "false" };
        const totals = (result: { readonly ran: readonly string[] }): readonly string[] => result.ran.filter(t => t.includes(record));

        const passed = simulation.run(matrix, {});
        const testsFailed = simulation.run(matrix, { [recording]: "failure" });
        const notRun = simulation.run(matrix, { [first]: "skipped" });
        const retried = simulation.run(matrix, { [keep]: "failure" });
        const failed = simulation.run(matrix, { [keep]: "failure", [again]: "failure", [last]: "failure" });

        assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[BuildAndTestTests.UPLOAD_ACTION, true], [BuildAndTestTests.UPLOAD_ACTION, true], [BuildAndTestTests.UPLOAD_ACTION, false]], name);
        assert.deepEqual(attempts.map(t => t.settings), BuildAndTestTests.threeTimes([`name: ${artifact}`, `path: ${totalsPath}`, "retention-days: 3", "if-no-files-found: error", "overwrite: true"]), name);
        assert.deepEqual([workflow.readStepScript(pause), workflow.readStepScript(lastPause)], ["sleep 15\n", "sleep 15\n"], name);
        assert.deepEqual([totals(passed), passed.isJobFailed], [[keep], false], name);
        assert.deepEqual([totals(testsFailed), testsFailed.isJobFailed], [[keep], true], name);
        assert.deepEqual(totals(notRun), [], name);
        assert.deepEqual([totals(retried), retried.isJobFailed], [[keep, pause, again], false], name);
        assert.deepEqual([totals(failed), failed.isJobFailed], [[keep, pause, again, lastPause, last], true], name);
      }
    });

    test("the test totals job adds up every target's records after the targets finish, and does nothing in a cancelled or documentation-only run", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      const job = text.slice(text.indexOf("  totals:\n"), text.indexOf("  result:\n"));
      const simulation = new WorkflowSimulation(text, "Fetch the totals records", "Fetch the totals records a last time");
      const attempts = ["Fetch the totals records", "Fetch the totals records again", "Fetch the totals records a last time"].map(t => simulation.find(t));
      const failed = simulation.run({}, Object.fromEntries(attempts.map(t => [t.name, "failure"])));

      assert.ok(job.startsWith("  totals:\n    name: Test totals\n    needs: [changes, validate]\n" +
        "    if: ${{ !cancelled() && needs.changes.result == 'success' && needs.changes.outputs.run-code == 'true' }}\n    runs-on: ubuntu-24.04\n"));
      assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[BuildAndTestTests.DOWNLOAD_ACTION, true], [BuildAndTestTests.DOWNLOAD_ACTION, true], [BuildAndTestTests.DOWNLOAD_ACTION, false]]);
      assert.deepEqual(attempts.map(t => t.settings), BuildAndTestTests.threeTimes(["pattern: totals-*", "path: _build/run-totals"]));
      assert.deepEqual([workflow.readStepScript("Wait before fetching the totals records again"), workflow.readStepScript("Wait before fetching the totals records a last time")], ["sleep 15\n", "sleep 15\n"]);
      assert.equal(failed.isJobFailed, true);
      assert.equal(workflow.readStepScript("Add up the totals"), "node scripts/run-totals.ts\n");
      assert.ok(job.includes("          TARGETS: ${{ needs.changes.outputs.targets }}\n          RUN_UI: ${{ needs.changes.outputs.run-ui }}\n" +
        "          VALIDATION_RESULT: ${{ needs.validate.result }}\n"));
      assert.doesNotMatch(job, /actions\/cache|Prepare the job/);
    });

    test("each test job and UI shard keeps its flaky test record whatever happened, tried three times with a pause, and only warns when every upload fails", async t => {
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());

      for (const [name, first, artifact, scope] of BuildAndTestTests.FLAKY_UPLOADS) {
        const workflow = await BuildAndTestTests.readFileAsync(name);
        const simulation = new WorkflowSimulation(workflow.text, first, BuildAndTestTests.FLAKY_WARNING);
        const attempts = BuildAndTestTests.FLAKY_STEPS.map(t => simulation.find(t));
        const passed = simulation.run({ angular: "false" }, {});
        const failed = simulation.run({ angular: "false" }, { [first]: "failure" });
        const unkept = simulation.run({ angular: "false" }, Object.fromEntries([first, ...BuildAndTestTests.FLAKY_STEPS].map(t => [t, "failure"])));
        const warning = await doubles.runAsync(workflow.readStepScript(BuildAndTestTests.FLAKY_WARNING));
        const flaky = (result: { readonly ran: readonly string[] }): readonly string[] => result.ran.filter(u => u.includes("flaky test record"));

        assert.deepEqual([flaky(passed), passed.isJobFailed], [["Keep the flaky test record"], false]);
        assert.deepEqual([flaky(failed), failed.isJobFailed], [["Keep the flaky test record"], true]);
        assert.deepEqual([flaky(unkept), unkept.isJobFailed], [[
          "Keep the flaky test record", "Wait before keeping the flaky test record again", "Keep the flaky test record again",
          "Wait before keeping the flaky test record a last time", "Keep the flaky test record a last time", BuildAndTestTests.FLAKY_WARNING
        ], true]);
        assert.deepEqual(attempts.map(u => [u.uses, u.continueOnError]), attempts.map(() => [BuildAndTestTests.UPLOAD_ACTION, true]));
        assert.deepEqual(attempts.map(u => u.settings), BuildAndTestTests.threeTimes([`name: ${artifact}`, "path: _build/flaky-tests.json", "retention-days: 14", "if-no-files-found: ignore", "overwrite: true"]));
        assert.equal(workflow.readStepScript("Wait before keeping the flaky test record again"), "sleep 15\n");
        assert.equal(workflow.readStepScript("Wait before keeping the flaky test record a last time"), "sleep 15\n");
        assert.deepEqual([warning.status, warning.stdout],
          [0, `::warning title=The flaky test record was not kept::The upload failed three times, so no issue is recorded for this ${scope}'s flaky tests. The tests are not affected.\n`]);
      }
    });

    test("an upload that fails and then succeeds is tried again once and keeps the job green", async () => {
      const simulation = new WorkflowSimulation((await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION)).text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);

      const result = simulation.run({}, { "Keep the UI workflow results": "failure", "Keep the main window screenshot": "failure", "Keep the main window screenshot again": "failure" });

      assert.equal(result.isJobFailed, false);
      assert.deepEqual(result.ran, [
        "Test the UI workflows",
        "Keep the UI workflow results", "Wait before keeping the UI workflow results again", "Keep the UI workflow results again",
        "Keep the main window screenshot", "Wait before keeping the main window screenshot again", "Keep the main window screenshot again",
        "Wait before keeping the main window screenshot a last time", "Keep the main window screenshot a last time",
        "Summarize the UI workflows"
      ]);
    });

    test("an upload that fails every time warns, leaves the job green and tells the summary", async t => {
      const workflow = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION);
      const simulation = new WorkflowSimulation(workflow.text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);
      const failures = Object.fromEntries(BuildAndTestTests.UPLOADS.flatMap(([first, again, last]) => [[first, "failure"], [again, "failure"], [last, "failure"]]));
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());

      const result = simulation.run({}, failures);
      const results = await doubles.runAsync(workflow.readStepScript("Warn that the UI workflow results were not kept"));
      const screenshot = await doubles.runAsync(workflow.readStepScript("Warn that the main window screenshot was not kept"));

      assert.equal(result.isJobFailed, false);
      assert.ok(result.ran.includes("Warn that the UI workflow results were not kept"));
      assert.ok(result.ran.includes("Warn that the main window screenshot was not kept"));
      assert.equal(result.ran.at(-1), "Summarize the UI workflows");
      assert.deepEqual([results.status, screenshot.status], [0, 0]);
      assert.equal(results.stdout, "::warning title=The UI workflow results were not kept::The upload failed three times, so they are not attached. The tests are not affected.\n");
      assert.equal(screenshot.stdout, "::warning title=The main window screenshot was not kept::The upload failed three times, so it is not attached. The tests are not affected.\n");
    });

    test("uploads that succeed run no retry and no warning, and failed UI workflows still fail the job", async () => {
      const simulation = new WorkflowSimulation((await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION)).text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);

      const passed = simulation.run({}, {});
      const failed = simulation.run({}, { [BuildAndTestTests.UI_STEP]: "failure" });

      assert.deepEqual(passed.ran, [BuildAndTestTests.UI_STEP, "Keep the UI workflow results", "Keep the main window screenshot", BuildAndTestTests.SUMMARY_STEP]);
      assert.equal(passed.isJobFailed, false);
      assert.equal(failed.isJobFailed, true);
      assert.deepEqual(failed.ran, passed.ran);
      assert.equal(simulation.find(BuildAndTestTests.UI_STEP).continueOnError, false);
      assert.equal(simulation.find(BuildAndTestTests.SUMMARY_STEP).continueOnError, false);
    });

    test("the UI workflows make their own test builds, so the workflow names no variant", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.UI_WORKFLOW);
      const main = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const action = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION);

      for (const text of [workflow.text, main.text, action.text]) {
        assert.ok(!text.includes("--output _build/variants"));
        assert.ok(!text.includes("npm run build -- --test"));
      }
    });

    test("a failed UI workflow run fails its step", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION)).readStepScript(BuildAndTestTests.UI_STEP);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("dbus-run-session", "-- xvfb-run --auto-servernum --server-args=-screen 0 1920x1080x24 npm run test:ui -- --require-current --shard 1/3 --retries 1", "", 1);
      doubles.respond("npm", "run test:ui -- --require-current --shard 1/3 --retries 1", "", 1);

      assert.equal((await doubles.runAsync(script, { RUNNER_OS: "Linux", SHARD: "1/3", REQUIRE_CURRENT: "--require-current", GREP: "" })).status, 1);
      assert.equal((await doubles.runAsync(script, { RUNNER_OS: "Windows", SHARD: "1/3", REQUIRE_CURRENT: "--require-current", GREP: "" })).status, 1);
    });

    test("Linux shards let Electron's sandbox create its namespaces before the UI workflows", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readActionAsync(BuildAndTestTests.UI_ACTION);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("sudo", "sysctl -w kernel.apparmor_restrict_unprivileged_userns=0", "");

      const result = await doubles.runAsync(workflow.readStepScript("Let Electron's sandbox start on Linux"));

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), ["sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0"]);
      assert.ok(workflow.text.includes("    - name: Let Electron's sandbox start on Linux\n      if: runner.os == 'Linux'\n"));
      assert.ok(workflow.text.indexOf("Let Electron's sandbox start on Linux") < workflow.text.indexOf("Test the UI workflows"));
    });

    test("an inexact Angular restore is discarded, so a partial restore never passes as installed", async t => {
      const script = (await WorkflowFileFixture.readActionAsync(BuildAndTestTests.ACTION)).readStepScript("Discard an inexact Angular install");
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      await doubles.runAsync("mkdir -p src/node_modules/partial && touch src/node_modules/.teamrun-install src/package-lock.json\n");

      const result = await doubles.runAsync(script);

      assert.equal(script, "rm -rf src/node_modules\n");
      assert.equal(result.status, 0, result.stderr);
      assert.equal((await doubles.runAsync("test -e src/node_modules\n")).status, 1);
      assert.equal((await doubles.runAsync("test -e src/package-lock.json\n")).status, 0);
    });

    test("the cleanup deletes only the caches whose key belongs to another lockfile", async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript("Delete caches of other lockfiles");
      const list = "api --paginate repos/noldova-com/teamrun/actions/caches?key=dependencies-&ref=refs/heads/main&per_page=100 --jq .actions_caches[].key";
      const keys = [
        "dependencies-root-Linux-x64-rootnew",
        "dependencies-root-Windows-arm64-rootold",
        "dependencies-src-macOS-arm64-srcnew",
        "dependencies-src-Linux-x64-srcold",
        "dependencies-src-Linux-x64-rootnew"
      ];
      const environment = { GITHUB_REPOSITORY: "noldova-com/teamrun", ROOT_HASH: "rootnew", SOURCE_HASH: "srcnew" };
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("gh", list, `${keys.join("\n")}\n`);
      for (const key of [keys[1], keys[3], keys[4]])
        doubles.respond("gh", `api --method DELETE repos/noldova-com/teamrun/actions/caches?key=${key}&ref=refs/heads/main`, "{}");

      const result = await doubles.runAsync(script, environment);

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), [
        `gh ${list}`,
        "gh api --method DELETE repos/noldova-com/teamrun/actions/caches?key=dependencies-root-Windows-arm64-rootold&ref=refs/heads/main",
        "gh api --method DELETE repos/noldova-com/teamrun/actions/caches?key=dependencies-src-Linux-x64-srcold&ref=refs/heads/main",
        "gh api --method DELETE repos/noldova-com/teamrun/actions/caches?key=dependencies-src-Linux-x64-rootnew&ref=refs/heads/main"
      ]);
      assert.equal(result.stdout, [keys[1], keys[3], keys[4]].map(t => `Deleted the outdated cache ${t}.\n`).join(""));

      const empty = await CommandDoublesFixture.createAsync();
      t.after(() => empty.disposeAsync());
      empty.respond("gh", list, "");
      assert.equal((await empty.runAsync(script, environment)).status, 0);
      assert.deepEqual(await empty.readCallsAsync(), [`gh ${list}`]);
    });

    test("a failed listing or deletion fails the cleanup", async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript("Delete caches of other lockfiles");
      const list = "api --paginate repos/noldova-com/teamrun/actions/caches?key=dependencies-&ref=refs/heads/main&per_page=100 --jq .actions_caches[].key";
      const environment = { GITHUB_REPOSITORY: "noldova-com/teamrun", ROOT_HASH: "rootnew", SOURCE_HASH: "srcnew" };
      const listing = await CommandDoublesFixture.createAsync();
      t.after(() => listing.disposeAsync());
      listing.respond("gh", list, "", 1);
      const deletion = await CommandDoublesFixture.createAsync();
      t.after(() => deletion.disposeAsync());
      deletion.respond("gh", list, "dependencies-root-Linux-x64-rootold\n");
      deletion.respond("gh", "api --method DELETE repos/noldova-com/teamrun/actions/caches?key=dependencies-root-Linux-x64-rootold&ref=refs/heads/main", "", 1);

      assert.notEqual((await listing.runAsync(script, environment)).status, 0);
      assert.notEqual((await deletion.runAsync(script, environment)).status, 0);
    });
  }

  private static async readFileAsync(name: string): Promise<WorkflowFileFixture> {
    return name === BuildAndTestTests.UI_ACTION ? await WorkflowFileFixture.readActionAsync(name) : await WorkflowFileFixture.readAsync(name);
  }

  private static threeTimes<T>(value: T): readonly T[] {
    return [value, value, value];
  }
}

BuildAndTestTests.register();
