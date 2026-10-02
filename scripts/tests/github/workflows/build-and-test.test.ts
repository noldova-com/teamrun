/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import SourceTreeFixture from "../../fixtures/source-tree.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";

class BuildAndTestTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "build-and-test.yml";
  private static readonly TOOLCHAIN_STEP: string = "Verify the toolchain";
  private static readonly RESULT_STEP: string = "Require the selected verification to pass";

  public static register(): void {
    test("the toolchain check passes only for the pinned Node.js and npm versions on the expected architecture", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.TOOLCHAIN_STEP);
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

    test("the workflow pins the versions the root manifest requires", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const manifest: unknown = JSON.parse(await readFile(path.join(SourceTreeFixture.root, "package.json"), "utf8"));
      assert.ok(typeof manifest === "object" && manifest !== null && "engines" in manifest && "packageManager" in manifest);
      assert.deepEqual(manifest.engines, { node: ">=26.7.0 <27", npm: "11.19.0" });
      assert.equal(manifest.packageManager, "npm@11.19.0");
      assert.equal(workflow.text.match(/node-version: '26\.7\.0'/g)?.length, 2);
      assert.doesNotMatch(workflow.text, /node-version: '(?!26\.7\.0')/);
      const script = workflow.readStepScript(BuildAndTestTests.TOOLCHAIN_STEP);
      assert.ok(script.includes("test \"$(node --version)\" = v26.7.0\n"));
      assert.ok(script.includes("test \"$(npm --version)\" = 11.19.0\n"));
    });

    test("the aggregate check passes a documentation-only skip or a complete pass, and fails otherwise", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.RESULT_STEP);
      const cases: readonly (readonly [string, string, string, number, RegExp])[] = [
        ["success", "false", "skipped", 0, /^Only Markdown documentation changed/],
        ["success", "true", "success", 0, /^The document checks passed, and the build and tests passed on every target/],
        ["success", "true", "failure", 1, /^$/],
        ["success", "true", "cancelled", 1, /^$/],
        ["success", "true", "skipped", 1, /^$/],
        ["success", "false", "success", 1, /^$/],
        ["failure", "", "skipped", 1, /^$/],
        ["cancelled", "", "skipped", 1, /^$/]
      ];
      for (const [changes, runCode, validation, status, summary] of cases) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await doubles.runAsync("touch summary.md\n");

        const result = await doubles.runAsync(script, {
          CHANGES_RESULT: changes, RUN_CODE: runCode, VALIDATION_RESULT: validation, GITHUB_STEP_SUMMARY: "summary.md"
        });

        assert.equal(result.status, status, `${changes}:${runCode}:${validation}: ${result.stderr}`);
        assert.match(await doubles.readFileAsync("summary.md"), summary);
        if (status !== 0)
          assert.match(result.stdout, /^::error::/);
      }
    });

    test("macOS targets stop Spotlight indexing before checking out", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("sudo", "mdutil -a -i off", "");

      const result = await doubles.runAsync(workflow.readStepScript("Stop Spotlight indexing"));

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), ["sudo mdutil -a -i off"]);
      assert.ok(workflow.text.indexOf("Stop Spotlight indexing\n        if: runner.os == 'macOS'") < workflow.text.indexOf("Check out the revision"));
    });

    test("every change checks the documents, and the six targets build and test unless only documentation changed", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      assert.equal(workflow.readStepScript("Check the documents"), "npm test -- documents\n");
      assert.equal(workflow.readStepScript("Select the verification scope"), "node scripts/classify-changes.ts\n");
      assert.ok(text.indexOf("Check the documents") < text.indexOf("Select the verification scope"));
      assert.ok(text.includes("    if: needs.changes.outputs.run-code == 'true'\n"));
      for (const target of ["Linux x64", "Linux ARM64", "Windows x64", "Windows ARM64", "macOS x64", "macOS ARM64"])
        assert.ok(text.includes(`          - target: ${target}\n`), target);
      assert.equal(workflow.readStepScript("Install dependencies"), "npm ci --no-audit --no-fund\n");
      assert.equal(workflow.readStepScript("Build"), "npm run build\n");
      assert.equal(workflow.readStepScript("Test"), "npm test\n");
      assert.ok(text.includes("    name: Build and test (all targets)\n    needs: [changes, validate]\n    if: always()\n"));
    });

    test("runs read the repository only, and only pull request runs are cancelled by a newer push", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      assert.ok(text.includes("permissions:\n  contents: read\n"));
      assert.doesNotMatch(text, /: write/);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 2);
      assert.ok(text.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
      for (const trigger of ["  pull_request:\n    branches: [main]", "  merge_group:\n    types: [checks_requested]", "  push:\n    branches: [main]", "  workflow_dispatch:"])
        assert.ok(text.includes(trigger), trigger);
      for (const action of text.matchAll(/uses: (\S+)/g))
        assert.match(action[1] ?? "", /^actions\/[a-z-]+@[0-9a-f]{40}$/);
    });
  }
}

BuildAndTestTests.register();
