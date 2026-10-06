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
import { test, type TestContext } from "node:test";

import BuildMatrix from "../../../workflows/build-matrix.ts";
import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class PackageWorkflowTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly WORKFLOW: string = "package.yml";
  private static readonly PLAN_STEP: string = "List every target by hand and Windows x64 and Linux x64 each night";
  private static readonly NIGHTLY_PLAN_STEP: string = "List each target's tests and UI workflows";
  private static readonly LIBFUSE_STEP: string = "Remove libfuse2, which a stock Ubuntu does not install";
  private static readonly SMOKE_STEP: string = "Install, start and quit the package";
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly UPLOADS: readonly [string, string, string] = ["Keep the package", "Keep the package again", "Keep the package a last time"];
  private static readonly RESULTS: readonly [string, string, string] = ["Keep the nightly result", "Keep the nightly result again", "Keep the nightly result a last time"];
  private static readonly STATUS: string = "-W -f=${Status} ";
  private static readonly NIGHTLY_TARGETS: readonly string[] = ["Linux x64", "Windows x64"];
  private static readonly JQ_ARGUMENTS: string = "-r .teamrun.signedPlatforms // [] | join(\" \") package.json";
  private static readonly CREDENTIALS: readonly (readonly [string, string])[] = [
    ["windows", "AZURE_TENANT_ID"], ["windows", "AZURE_CLIENT_ID"], ["windows", "AZURE_CLIENT_SECRET"], ["macos", "MAC_CERTIFICATE"], ["macos", "MAC_CERTIFICATE_PASSWORD"],
    ["macos", "APPLE_API_KEY_P8"], ["macos", "APPLE_API_KEY_ID"], ["macos", "APPLE_API_ISSUER"]
  ];

  public static register(): void {
    test("packaging runs by hand or when the nightly run calls it, one nightly and one run by hand at a time, never for a push or a pull request, and only reads the repository", async () => {
      const text = (await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW)).text;

      assert.ok(text.includes("on:\n  workflow_call:\n    inputs:\n      nightly:\n"));
      assert.ok(text.includes("        type: boolean\n        required: true\n  workflow_dispatch:\n    inputs:\n      signed:\n"));
      assert.ok(text.includes("        type: boolean\n        default: false\n\npermissions:\n  contents: read\n\n"));
      assert.ok(text.includes("concurrency:\n  group: package-${{ inputs.nightly && 'nightly' || 'manual' }}\n  cancel-in-progress: false\n"));
      assert.equal(text.match(/^\s+\w[\w-]*: write$/gm), null);
      assert.equal(text.match(/persist-credentials: false/g)?.length, 2);
    });

    test("only a signed run by hand enters the release environment, for the declared platforms' jobs, and gives each its own platform's credentials in the packaging step alone", async () => {
      const workflow = await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW);
      const release = await WorkflowFileFixture.readAsync("release.yml");
      const signed = "matrix.signed == 'true'";

      assert.deepEqual([...workflow.text.matchAll(/\$\{\{ ([^}]+) \}\}/g)].map(t => t[1] ?? "").filter(t => t.includes("secrets.")),
        PackageWorkflowTests.CREDENTIALS.map(([platform, name]) => `${signed} && matrix.platform == '${platform}' && secrets.${name} || ''`));
      assert.ok(workflow.text.includes(`      - name: Make the package\n        id: package\n        timeout-minutes: 40\n        env:\n          SIGNED: \${{ matrix.signed }}\n`
        + PackageWorkflowTests.CREDENTIALS.map(([platform, name]) => `          ${name}: \${{ ${signed} && matrix.platform == '${platform}' && secrets.${name} || '' }}\n`).join("")
        + "        run: |\n"));
      assert.ok(workflow.text.includes(`    runs-on: \${{ matrix.runner }}\n    environment: \${{ ${signed} && 'release' || '' }}\n    timeout-minutes: 75\n`));
      assert.ok(workflow.text.includes("      - name: Read the platforms to sign\n        if: github.event_name == 'workflow_dispatch' && inputs.signed\n"));
      assert.ok(workflow.text.includes("          sparse-checkout: package.json\n          sparse-checkout-cone-mode: false\n"));
      assert.ok(workflow.text.includes("          SIGNED: ${{ github.event_name == 'workflow_dispatch' && inputs.signed }}\n          REFERENCE: ${{ github.ref }}\n"));
      assert.equal(workflow.text.match(/^ {4}env:$/gm), null);
      assert.equal(workflow.text.match(/environment: /g)?.length, 1);
      assert.equal(workflow.readStepScript("Make the package"), release.readStepScript("Make the package"));
    });

    test("a run by hand packages every target and keeps the packages two weeks, and the nightly run packages Windows x64 and Linux x64 for three days, whose results its report expects", { timeout: PackageWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW);
      const nightly = await WorkflowFileFixture.readAsync("nightly.yml");
      const targets = new BuildMatrix("workflow_dispatch").targets
        .map(t => ({ target: t.name, runner: t.runner, architecture: t.architecture, platform: t.name.split(" ")[0]?.toLowerCase(), signed: "false" }));
      const nightlyTargets = targets.filter(t => PackageWorkflowTests.NIGHTLY_TARGETS.includes(t.target));
      const listed = (value: string): Promise<unknown> => PackageWorkflowTests.readOutputAsync(t, workflow.readStepScript(PackageWorkflowTests.PLAN_STEP), { NIGHTLY: value, SIGNED: "false", REFERENCE: "refs/heads/main" }, "targets");

      const labels = await PackageWorkflowTests.readOutputAsync(t, nightly.readStepScript(PackageWorkflowTests.NIGHTLY_PLAN_STEP), {}, "labels") as readonly string[];

      assert.equal(targets.length, 6);
      assert.deepEqual(await listed(""), targets.map(t => ({ ...t, nightly: "false", retention: 14 })));
      assert.deepEqual(await listed("false"), targets.map(t => ({ ...t, nightly: "false", retention: 14 })));
      assert.deepEqual(await listed("true"), nightlyTargets.map(t => ({ ...t, nightly: "true", retention: 3 })));
      assert.deepEqual(labels.filter(t => t.startsWith("packaging ")), nightlyTargets.map(t => `packaging ${t.target}`));
      assert.ok(workflow.text.includes("    needs: plan\n    strategy:\n      fail-fast: false\n      matrix:\n        include: ${{ fromJSON(needs.plan.outputs.targets) }}\n"
        + "    runs-on: ${{ matrix.runner }}\n"));
      assert.ok(nightly.text.includes("  package:\n    name: Package\n    uses: ./.github/workflows/package.yml\n    with:\n      nightly: true\n\n"));
      assert.ok(nightly.text.includes("    needs: [plan, repeat, package]\n"));
    });

    test("a job prepares its target like build and test, makes the package and starts it, under a virtual display on Linux both mounted and extracted, and every step has its own time limit", async () => {
      const workflow = await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW);
      const steps = workflow.text.split(/\n(?= +- name: )/).slice(1);

      assert.ok(workflow.text.includes("      - name: Stop Spotlight indexing\n        if: runner.os == 'macOS'\n        timeout-minutes: 2\n        run: sudo mdutil -i off /System/Volumes/Data\n"));
      assert.ok(workflow.text.includes("      - name: Prepare the job\n        timeout-minutes: 15\n        uses: ./.github/actions/prepare\n        with:\n          architecture: ${{ matrix.architecture }}\n"));
      assert.ok(workflow.text.includes(`      - name: ${PackageWorkflowTests.LIBFUSE_STEP}\n        if: runner.os == 'Linux'\n`));
      assert.ok(workflow.text.includes(`      - name: ${PackageWorkflowTests.SMOKE_STEP}\n        id: smoke\n        timeout-minutes: 15\n`));
      assert.equal(workflow.readStepScript(PackageWorkflowTests.SMOKE_STEP), [
        "if [ \"$RUNNER_OS\" = Linux ]; then",
        "  xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' npm run package:smoke",
        "  APPIMAGE_EXTRACT_AND_RUN=1 xvfb-run --auto-servernum --server-args='-screen 0 1920x1080x24' npm run package:smoke",
        "else",
        "  npm run package:smoke",
        "fi",
        ""
      ].join("\n"));
      assert.equal(steps.length, 19);
      assert.deepEqual(steps.filter(t => !/\n {8}timeout-minutes: \d+\n/.test(t)), []);
    });

    test("a signed run by hand marks the declared platforms' targets signed, and is refused off main before reading anything", { timeout: PackageWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW)).readStepScript(PackageWorkflowTests.PLAN_STEP);
      const run = async (reference: string, declared: string): Promise<{ readonly status: number | null; readonly stdout: string; readonly outputs: string; readonly calls: readonly string[] }> => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await writeFile(path.join(doubles.directory, "outputs.txt"), "");
        doubles.respond("jq", PackageWorkflowTests.JQ_ARGUMENTS, declared);
        const result = await doubles.runAsync(script, { GITHUB_OUTPUT: "outputs.txt", NIGHTLY: "", SIGNED: "true", REFERENCE: reference });
        return { status: result.status, stdout: result.stdout, outputs: await doubles.readFileAsync("outputs.txt"), calls: await doubles.readCallsAsync() };
      };

      const signed = await run("refs/heads/main", "windows macos");
      const none = await run("refs/heads/main", "");
      const branch = await run("refs/heads/rr/1-signing", "windows macos");

      const listed = JSON.parse(signed.outputs.slice("targets=".length)) as readonly Readonly<Record<string, string>>[];
      assert.equal(signed.status, 0);
      assert.equal(signed.stdout, "Signing the packages of: windows macos.\n");
      assert.deepEqual(listed.map(t => [t["target"], t["signed"]]), [
        ["Linux x64", "false"], ["Linux ARM64", "false"], ["Windows x64", "true"], ["Windows ARM64", "true"], ["macOS x64", "true"], ["macOS ARM64", "true"]
      ]);
      assert.deepEqual([none.status, none.stdout, none.outputs.includes("\"signed\":\"true\"")], [0, "Signing the packages of: no platform.\n", false]);
      assert.deepEqual([branch.status, branch.stdout, branch.outputs, branch.calls], [1, "::error::A signed package run starts from main, not from refs/heads/rr/1-signing.\n", "", []]);
    });

    test("an installed libfuse2 is removed before the package starts, and the job fails when it is still there", { timeout: PackageWorkflowTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW)).readStepScript(PackageWorkflowTests.LIBFUSE_STEP);
      const run = async (installed: string, libraries: string): Promise<{ readonly status: number | null; readonly stdout: string; readonly calls: readonly string[] }> => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        for (const name of ["libfuse2", "libfuse2t64"])
          doubles.respond("dpkg-query", `${PackageWorkflowTests.STATUS}${name}`, name === installed ? "install ok installed" : "", name === installed ? 0 : 1);
        doubles.respond("sudo", `apt-get remove -y ${installed}`, "");
        doubles.respond("ldconfig", "-p", libraries);
        const result = await doubles.runAsync(script);
        return { status: result.status, stdout: result.stdout, calls: await doubles.readCallsAsync() };
      };

      const absent = await run("none", "\tlibfuse3.so.3 (libc6,x86-64) => /lib/x86_64-linux-gnu/libfuse3.so.3\n");
      const removed = await run("libfuse2t64", "\tlibfuse3.so.3 (libc6,x86-64) => /lib/x86_64-linux-gnu/libfuse3.so.3\n");
      const kept = await run("libfuse2", "\tlibfuse.so.2 (libc6,x86-64) => /lib/x86_64-linux-gnu/libfuse.so.2\n");

      assert.deepEqual([absent.status, absent.stdout], [0, "libfuse2 is not installed.\n"]);
      assert.deepEqual(absent.calls, [`dpkg-query ${PackageWorkflowTests.STATUS}libfuse2`, `dpkg-query ${PackageWorkflowTests.STATUS}libfuse2t64`, "ldconfig -p"]);
      assert.deepEqual([removed.status, removed.calls.includes("sudo apt-get remove -y libfuse2t64")], [0, true]);
      assert.deepEqual([kept.status, kept.stdout], [1, "::error::libfuse2 is still installed.\n"]);
    });

    test("a job keeps its packages with three tries, and fails when none was made", async () => {
      const workflow = await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, PackageWorkflowTests.UPLOADS[0], PackageWorkflowTests.UPLOADS[2]);
      const uploads = PackageWorkflowTests.UPLOADS.map(t => simulation.find(t));

      assert.deepEqual(uploads.map(t => [t.uses, t.continueOnError]), [[PackageWorkflowTests.UPLOAD_ACTION, true], [PackageWorkflowTests.UPLOAD_ACTION, true], [PackageWorkflowTests.UPLOAD_ACTION, false]]);
      assert.deepEqual(uploads.map(t => t.settings), uploads.map(() => [
        "name: package-${{ matrix.runner }}-${{ matrix.architecture }}",
        "path: |",
        "  _build/package/out/TeamRun-*.exe",
        "  _build/package/out/TeamRun-*.dmg",
        "  _build/package/out/TeamRun-*.zip",
        "  _build/package/out/TeamRun-*.AppImage",
        "  _build/package/smoke/*.png",
        "  _build/package/package-report.json",
        "retention-days: ${{ matrix.retention }}",
        "if-no-files-found: error",
        "overwrite: true"
      ]));
      assert.deepEqual(simulation.run({}, {}).ran, [PackageWorkflowTests.UPLOADS[0]]);
      assert.deepEqual(simulation.run({}, { [PackageWorkflowTests.UPLOADS[0]]: "failure", [PackageWorkflowTests.UPLOADS[1]]: "failure" }).ran, [
        PackageWorkflowTests.UPLOADS[0], "Wait before keeping the package again", PackageWorkflowTests.UPLOADS[1], "Wait before keeping the package a last time", PackageWorkflowTests.UPLOADS[2]
      ]);
    });

    test("a nightly job records whether it made and started its package, whatever happened, and keeps that result with three tries for the report", async () => {
      const workflow = await WorkflowFileFixture.readAsync(PackageWorkflowTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, "Make the package", PackageWorkflowTests.RESULTS[2]);
      const results = PackageWorkflowTests.RESULTS.map(t => simulation.find(t));

      assert.deepEqual(simulation.run({ nightly: "false" }, {}).ran, ["Make the package", PackageWorkflowTests.SMOKE_STEP, PackageWorkflowTests.UPLOADS[0]]);
      assert.deepEqual(simulation.run({ nightly: "true" }, {}).ran, ["Make the package", PackageWorkflowTests.SMOKE_STEP, PackageWorkflowTests.UPLOADS[0], "Record the nightly result", PackageWorkflowTests.RESULTS[0]]);
      assert.deepEqual(simulation.run({ nightly: "true" }, { "Make the package": "failure", [PackageWorkflowTests.RESULTS[0]]: "failure" }).ran, [
        "Make the package", "Record the nightly result", PackageWorkflowTests.RESULTS[0], "Wait before keeping the nightly result again", PackageWorkflowTests.RESULTS[1]
      ]);
      assert.deepEqual(results.map(t => [t.uses, t.continueOnError]), [[PackageWorkflowTests.UPLOAD_ACTION, true], [PackageWorkflowTests.UPLOAD_ACTION, true], [PackageWorkflowTests.UPLOAD_ACTION, false]]);
      assert.deepEqual(results.map(t => t.settings), results.map(() => [
        "name: nightly-result-${{ matrix.runner }}-packaging", "path: _build/nightly/results", "retention-days: 14", "if-no-files-found: ignore", "overwrite: true"
      ]));
      assert.ok(workflow.text.includes("        env:\n          NIGHTLY_LABEL: packaging ${{ matrix.target }}\n          NIGHTLY_PART: packaging\n"
        + "          NIGHTLY_OUTCOME: ${{ steps.smoke.outcome }}\n        run: node scripts/nightly-result.ts\n"));
    });
  }

  private static async readOutputAsync(t: TestContext, script: string, environment: Readonly<Record<string, string>>, name: string): Promise<unknown> {
    const doubles = await CommandDoublesFixture.createAsync();
    t.after(() => doubles.disposeAsync());
    await writeFile(path.join(doubles.directory, "outputs.txt"), "");
    const result = await doubles.runAsync(script, { GITHUB_OUTPUT: "outputs.txt", ...environment });
    assert.equal(result.status, 0, result.stderr);
    const line = (await doubles.readFileAsync("outputs.txt")).split("\n").find(t => t.startsWith(`${name}=`));
    assert.ok(line !== undefined, `No output named ${name}.`);
    return JSON.parse(line.slice(name.length + 1));
  }
}

PackageWorkflowTests.register();
