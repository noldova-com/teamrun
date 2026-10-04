/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import CommandDoublesFixture from "../../fixtures/command-doubles.fixture.ts";
import SourceTreeFixture from "../../fixtures/source-tree.fixture.ts";
import WorkflowFileFixture from "../../fixtures/workflow-file.fixture.ts";
import WorkflowSimulation from "../../fixtures/workflow-simulation.fixture.ts";

class BuildAndTestTests {
  private static readonly SCRIPT_TIMEOUT: number = 30_000;
  private static readonly REPOSITORY_TIMEOUT: number = 60_000;
  private static readonly WORKFLOW: string = "build-and-test.yml";
  private static readonly TOOLCHAIN_STEP: string = "Verify the toolchain";
  private static readonly RESULT_STEP: string = "Require the selected verification to pass";
  private static readonly LOOKUP_STEP: string = "Look up the merge group run";
  private static readonly PLAN_STEP: string = "List the targets without a current cache";
  private static readonly UI_STEP: string = "Test the UI workflows";
  private static readonly SUMMARY_STEP: string = "Summarize the UI workflows";
  private static readonly LEGS_STEP: string = "List the build and test jobs";
  private static readonly WHOLE_LEG: Readonly<Record<string, string>> = { part: "all" };
  private static readonly UPLOAD_ACTION: string = "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1";
  private static readonly UPLOADS: readonly (readonly [string, string, string, readonly string[]])[] = [
    ["Keep the UI workflow results", "Keep the UI workflow results again", "Keep the UI workflow results a last time",
      ["name: ui-${{ matrix.runner }}-${{ matrix.architecture }}", "path: _build/ui", "retention-days: 14", "if-no-files-found: ignore"]],
    ["Keep the main window screenshot", "Keep the main window screenshot again", "Keep the main window screenshot a last time",
      ["path: _build/ui/main-window-*.png", "archive: false", "retention-days: 14", "if-no-files-found: warn"]]
  ];
  private static readonly NODE_SETUPS: readonly string[] = ["Set up Node.js to classify", "Set up Node.js", "Set up Node.js to install"];
  private static readonly NODE_ACTION: string = "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0";
  private static readonly TEST_STEP: string = "Test";
  private static readonly ANGULAR_UPLOADS: readonly string[] = ["Keep the Angular test output", "Keep the Angular test output again", "Keep the Angular test output a last time"];
  private static readonly ANGULAR_WARNING: string = "Warn that the Angular test output was not kept";
  private static readonly ANGULAR_SETTINGS: readonly string[] = [
    "name: angular-tests-${{ matrix.runner }}-${{ matrix.architecture }}", "path: |", "  _build/angular-tests.log", "  _build/angular-tests.json", "retention-days: 14",
    "if-no-files-found: ignore"
  ];
  private static readonly SHA: string ="0123456789abcdef0123456789abcdef01234567";
  private static readonly RUNS_QUERY: string = "api repos/noldova-com/teamrun/actions/workflows/build-and-test.yml/runs?event=merge_group" +
    "&head_sha=0123456789abcdef0123456789abcdef01234567&status=success&per_page=100 --jq .workflow_runs[] | select(.event == \"merge_group\" and " +
    ".head_sha == env.GITHUB_SHA and .conclusion == \"success\" and .path == \".github/workflows/build-and-test.yml\") | \"\\(.html_url)/attempts/\\(.run_attempt)\"";
  private static readonly CACHE_LIST: string = "api --paginate repos/noldova-com/teamrun/actions/caches?key=dependencies-&ref=refs/heads/main&per_page=100 --jq .actions_caches[].key";
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
      assert.equal(workflow.text.match(/node-version: '26\.7\.0'/g)?.length, 3 * BuildAndTestTests.NODE_SETUPS.length);
      assert.doesNotMatch(workflow.text, /node-version: '(?!26\.7\.0')/);
      const script = workflow.readStepScript(BuildAndTestTests.TOOLCHAIN_STEP);
      assert.ok(script.includes("test \"$(node --version)\" = v26.7.0\n"));
      assert.ok(script.includes("test \"$(npm --version)\" = 11.19.0\n"));
    });

    test("the aggregate check passes a documentation-only skip, a complete pass or a push the merge queue tested, and fails otherwise", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.RESULT_STEP);
      const run = "https://github.com/noldova-com/teamrun/actions/runs/7/attempts/2";
      const cases: readonly (readonly [string, string, string, string, string, string, number, RegExp])[] = [
        ["skipped", "", "", "success", "false", "skipped", 0, /^Only Markdown documentation changed/],
        ["skipped", "", "", "success", "true", "success", 0, /^The document checks passed, and the build and tests passed on every target/],
        ["success", "false", "", "success", "false", "skipped", 0, /^Only Markdown documentation changed/],
        ["success", "false", "", "success", "true", "success", 0, /^The document checks passed, and the build and tests passed on every target/],
        ["success", "true", run, "skipped", "", "skipped", 0,
          /^This commit was built and tested by the merge group run https:\/\/github\.com\/noldova-com\/teamrun\/actions\/runs\/7\/attempts\/2; this run only maintains the dependency caches\.\n$/],
        ["success", "true", run, "skipped", "", "skipped", 0,
          /^This merge group's tree was built and tested by the pull request run https:\/\/github\.com\/noldova-com\/teamrun\/actions\/runs\/7\/attempts\/2, so this run reused that result\.\n$/],
        ["success", "true", "", "skipped", "", "skipped", 1, /^$/],
        ["success", "true", run, "success", "true", "success", 1, /^$/],
        ["success", "false", run, "success", "true", "success", 1, /^$/],
        ["failure", "", "", "skipped", "", "skipped", 1, /^$/],
        ["success", "false", "", "skipped", "", "skipped", 1, /^$/],
        ["skipped", "", "", "success", "true", "failure", 1, /^$/],
        ["skipped", "", "", "success", "true", "cancelled", 1, /^$/],
        ["skipped", "", "", "success", "true", "skipped", 1, /^$/],
        ["skipped", "", "", "success", "false", "success", 1, /^$/],
        ["skipped", "", "", "failure", "", "skipped", 1, /^$/],
        ["skipped", "", "", "cancelled", "", "skipped", 1, /^$/]
      ];
      await Promise.all([...cases.entries()].map(async ([index, [tested, verified, testedRun, changes, runCode, validation, status, summary]]) => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await writeFile(path.join(doubles.directory, "summary.md"), "");

        const result = await doubles.runAsync(script, {
          TESTED_RESULT: tested, VERIFIED: verified, TESTED_RUN: testedRun, CHANGES_RESULT: changes, RUN_CODE: runCode, VALIDATION_RESULT: validation,
          EVENT_NAME: index === 5 ? "merge_group" : "push", DEFERRED: "",
          GITHUB_STEP_SUMMARY: "summary.md"
        });

        assert.equal(result.status, status, `${tested}:${verified}:${changes}:${runCode}:${validation}: ${result.stderr}`);
        assert.match(await doubles.readFileAsync("summary.md"), summary);
        if (status !== 0)
          assert.match(result.stdout, /^::error::/);
      }));
    });

    test("the aggregate check names the targets a passing pull request run left to main and manual runs", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.RESULT_STEP);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      await writeFile(path.join(doubles.directory, "summary.md"), "");

      const result = await doubles.runAsync(script, {
        TESTED_RESULT: "skipped", VERIFIED: "", TESTED_RUN: "", CHANGES_RESULT: "success", RUN_CODE: "true", VALIDATION_RESULT: "success",
        EVENT_NAME: "pull_request", DEFERRED: "Windows ARM64, macOS x64", GITHUB_STEP_SUMMARY: "summary.md"
      });

      assert.equal(result.status, 0, result.stderr);
      assert.equal(await doubles.readFileAsync("summary.md"),
        "The document checks passed, and the build and tests passed on every target this pull request run covers. Skipped here and run on every push to main and in manual runs: Windows ARM64, macOS x64.\n");
    });

    test("macOS targets stop Spotlight indexing before checking out", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("sudo", "mdutil -i off /System/Volumes/Data", "");

      const result = await doubles.runAsync(workflow.readStepScript("Stop Spotlight indexing"));

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), ["sudo mdutil -i off /System/Volumes/Data"]);
      assert.ok(workflow.text.indexOf("Stop Spotlight indexing\n        if: runner.os == 'macOS'") < workflow.text.indexOf("Check out the revision"));
    });

    test("every change checks the documents, and the six targets build and test unless only documentation changed", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      assert.equal(workflow.readStepScript("Check the documents"), "npm test -- documents\n");
      assert.equal(workflow.readStepScript("Select the verification scope"), "node scripts/classify-changes.ts\n");
      assert.ok(text.indexOf("Check the documents") < text.indexOf("Select the verification scope"));
      assert.ok(text.includes("    if: ${{ !cancelled() && needs.changes.result == 'success' && needs.changes.outputs.run-code == 'true' }}\n"));
      assert.deepEqual([...new Set(BuildAndTestTests.readLegs(text).map(t => t.target))], ["Linux x64", "Linux ARM64", "Windows x64", "Windows ARM64", "macOS x64", "macOS ARM64"]);
      assert.equal(workflow.readStepScript("Install dependencies"), "npm ci --no-audit --no-fund\n");
      assert.equal(workflow.readStepScript("Build"), "npm run build\n");
      assert.equal(workflow.readStepScript("Test"), "npm test\n");
      assert.ok(text.includes("    name: Build and test (all targets)\n    needs: [tested, changes, validate]\n    if: always()\n"));
    });

    test("runs read the repository only, except the cache cleanup on main, and only pull request runs are cancelled by a newer push", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      assert.ok(text.includes("permissions:\n  contents: read\n"));
      assert.deepEqual(text.match(/^ *\S+: write$/gm), ["      actions: write"]);
      assert.deepEqual(text.match(/^ *\S+: read$/gm), [
        "  contents: read", "      actions: read", "      contents: read", "      pull-requests: read", "      actions: read", "      contents: read", "      contents: read"
      ]);
      assert.ok(text.includes("    name: Remove outdated dependency caches\n    needs: [cache-plan, cache]\n" +
        "    if: ${{ !cancelled() && github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.cache-plan.result == 'success' && " +
        "(needs.cache.result == 'success' || needs.cache.result == 'skipped') }}\n"));
      assert.equal(text.match(/persist-credentials: false/g)?.length, 6);
      assert.ok(text.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
      for (const trigger of ["  pull_request:\n    branches: [main]", "  merge_group:\n    types: [checks_requested]", "  push:\n    branches: [main]", "  workflow_dispatch:"])
        assert.ok(text.includes(trigger), trigger);
      for (const action of text.matchAll(/uses: (\S+)/g))
        assert.match(action[1] ?? "", /^actions\/[a-z-]+(\/[a-z-]+)?@[0-9a-f]{40}$/);
    });

    test("each target restores both dependency caches by OS, CPU and lockfile and never saves them", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      const validate = text.slice(text.indexOf("  validate:\n"), text.indexOf("  cache-plan:\n"));
      const order = [
        "Restore the installed dependencies", "Restore the Angular project's installed dependencies", "Discard an inexact Angular install", "Install dependencies", "Build", "Test"
      ].map(t => validate.indexOf(`      - name: ${t}\n`));
      assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > (order[index - 1] ?? 0))), order.join(","));
      assert.equal(text.match(/key: dependencies-root-\$\{\{ runner\.os \}\}-\$\{\{ matrix\.architecture \}\}-\$\{\{ hashFiles\('package-lock\.json'\) \}\}\n/g)?.length, 2);
      assert.equal(text.match(/key: dependencies-src-\$\{\{ runner\.os \}\}-\$\{\{ matrix\.architecture \}\}-\$\{\{ hashFiles\('src\/package-lock\.json'\) \}\}\n/g)?.length, 2);
      assert.doesNotMatch(text, /restore-keys/);
      assert.ok(validate.includes("      - name: Install dependencies\n        if: steps.root-dependencies.outputs.cache-hit != 'true'\n"));
      assert.ok(validate.includes("      - name: Discard an inexact Angular install\n        if: steps.angular-dependencies.outputs.cache-hit != 'true'\n"));
      assert.doesNotMatch(validate, /actions\/cache\/save/);
    });

    test("a push builds and tests only when no successful merge group run of this workflow is found for its exact commit", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      assert.ok(text.includes("  tested:\n    name: Find the run that tested this tree\n" +
        "    if: github.event_name == 'merge_group' || (github.event_name == 'push' && github.ref == 'refs/heads/main')\n"));
      for (const step of ["Check out the merge group", "Look up the pull request run"])
        assert.ok(text.includes("      - name: " + step + "\n        if: github.event_name == 'merge_group'\n"), step);
      assert.ok(text.includes("      - name: Look up the merge group run\n        if: github.event_name == 'push'\n"));
      assert.ok(text.includes("    name: Classify changes\n    needs: tested\n" +
        "    if: ${{ !cancelled() && (needs.tested.result == 'skipped' || (needs.tested.result == 'success' && needs.tested.outputs.verified != 'true')) }}\n"));
      assert.ok(text.includes("      verified: ${{ steps.proof.outputs.verified || steps.reuse.outputs.verified }}\n" +
        "      run: ${{ steps.proof.outputs.run || steps.reuse.outputs.run }}\n"));
    });

    test("every job that depends on the merge group lookup, directly or through another job, states its own status condition", async () => {
      const text = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text;
      const jobs = new Map<string, { readonly needs: readonly string[]; readonly condition: string }>();
      for (const block of text.slice(text.indexOf("\njobs:\n")).split(/\n(?= {2}[a-z-]+:\n)/).slice(1)) {
        const name = /^ {2}([a-z-]+):\n/.exec(block)?.[1] ?? "";
        const needs = /^ {4}needs: (?:\[(.+)\]|(.+))$/m.exec(block);
        jobs.set(name, { needs: (needs?.[1] ?? needs?.[2] ?? "").split(",").map(t => t.trim()).filter(t => t.length > 0), condition: /^ {4}if: (.+)$/m.exec(block)?.[1] ?? "" });
      }
      const dependsOnLookup = (name: string): boolean => (jobs.get(name)?.needs ?? []).some(t => t === "tested" || dependsOnLookup(t));
      const dependents = [...jobs.keys()].filter(dependsOnLookup);

      assert.deepEqual([...jobs.keys()], ["tested", "changes", "validate", "cache-plan", "cache", "caches", "result"]);
      assert.deepEqual(dependents, ["changes", "validate", "result"]);
      for (const name of dependents)
        assert.match(jobs.get(name)?.condition ?? "", /!cancelled\(\)|always\(\)/, name);
    });

    test("the lookup cites the first successful merge group run that tested the commit, and finds none on an empty or failed answer", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.LOOKUP_STEP);
      assert.ok(script.includes("runs=$(timeout 30s gh api "));
      const first = "https://github.com/noldova-com/teamrun/actions/runs/11/attempts/2";
      const cases: readonly (readonly [string, number, string, string])[] = [
        [`${first}\n`, 0, `verified=true\nrun=${first}\n`, `The merge group run ${first} built and tested ${BuildAndTestTests.SHA}.\n`],
        [`${first}\nhttps://github.com/noldova-com/teamrun/actions/runs/12/attempts/1\n`, 0, `verified=true\nrun=${first}\n`, `The merge group run ${first} built and tested ${BuildAndTestTests.SHA}.\n`],
        ["", 0, "verified=false\n", `::notice::No successful merge group run of this workflow tested ${BuildAndTestTests.SHA}, so this run builds and tests it.\n`],
        [`${first}\n`, 1, "verified=false\n", `::notice::No successful merge group run of this workflow tested ${BuildAndTestTests.SHA}, so this run builds and tests it.\n`]
      ];
      for (const [answer, exitCode, outputs, message] of cases) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        doubles.forward("timeout");
        doubles.respond("gh", BuildAndTestTests.RUNS_QUERY, answer, exitCode);
        await doubles.runAsync("touch outputs.txt\n");

        const result = await doubles.runAsync(script, { GITHUB_REPOSITORY: "noldova-com/teamrun", GITHUB_SHA: BuildAndTestTests.SHA, GITHUB_OUTPUT: "outputs.txt" });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(await doubles.readFileAsync("outputs.txt"), outputs);
        assert.equal(result.stdout, message);
        assert.deepEqual((await doubles.readCallsAsync()).filter(call => call.startsWith("gh ")), [`gh ${BuildAndTestTests.RUNS_QUERY}`]);
      }
    });

    test("a merge group reuses the pull request's result only when its one squash on main has the tree the pull request's last attempt recorded", { timeout: BuildAndTestTests.REPOSITORY_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript("Look up the pull request run");
      const pullRequestHead = "d".repeat(40);
      const runs = "api repos/noldova-com/teamrun/actions/workflows/build-and-test.yml/runs?event=pull_request&head_sha=" + pullRequestHead + "&per_page=100 --jq " +
        "[.workflow_runs[] | select(.event == \"pull_request\" and .path == \".github/workflows/build-and-test.yml\")] | max_by(.run_number) // empty | " +
        "\"\\(.id) \\(.run_attempt) \\(.status) \\(.conclusion) \\(.html_url)\"";
      const runUrl = "https://github.com/noldova-com/teamrun/actions/runs/123";
      const commit = "git -c user.name=Fixture -c user.email=fixture@example.com commit -q";
      const histories: Readonly<Record<string, string>> = {
        squash: `git init -q -b main\n${commit} --allow-empty -m base\ngit update-ref refs/remotes/origin/main HEAD\ngit tag base\necho change > change.txt\ngit add change.txt\n${commit} -m squash\n`,
        twoCommits: `git init -q -b main\n${commit} --allow-empty -m base\ngit update-ref refs/remotes/origin/main HEAD\ngit tag base\n${commit} --allow-empty -m first\n` +
          `echo change > change.txt\ngit add change.txt\n${commit} -m second\n`,
        merge: `git init -q -b main\n${commit} --allow-empty -m base\ngit update-ref refs/remotes/origin/main HEAD\ngit tag base\ngit switch -q -c side\n${commit} --allow-empty -m side\n` +
          `git switch -q main\n${commit} --allow-empty -m main\ngit -c user.name=Fixture -c user.email=fixture@example.com merge -q --no-ff -m merge side\ngit reset -q --soft HEAD\ngit tag -d base > /dev/null\ngit tag base HEAD^1\n`,
        offMain: `git init -q -b main\n${commit} --allow-empty -m other\ngit update-ref refs/remotes/origin/main HEAD\ngit checkout -q --orphan pull\n${commit} --allow-empty -m base\ngit tag base\n` +
          `echo change > change.txt\ngit add change.txt\n${commit} -m squash\n`,
        none: ""
      };
      const repositories = new Map(await Promise.all(Object.entries(histories).map(async ([name, history]) => {
        const repository = await CommandDoublesFixture.createAsync();
        t.after(() => repository.disposeAsync());
        const prepared = await repository.runAsync(history.length === 0 ? "true\n" : `${history}git rev-parse base 'HEAD^{tree}'\n`);
        assert.equal(prepared.status, 0, `${name}: ${prepared.stderr}`);
        const [base = "b".repeat(40), tree = "a".repeat(40)] = prepared.stdout.trim().split("\n").filter(line => line.length > 0);
        return [name, { directory: repository.directory, base, tree }] as const;
      })));
      interface ICase {
        readonly name: string;
        readonly history?: string;
        readonly headRef?: string;
        readonly pullStatus?: number;
        readonly latest?: string;
        readonly runsStatus?: number;
        readonly downloadStatus?: number;
        readonly record?: string | null;
        readonly reason?: string;
      }
      const cases: readonly ICase[] = [
        { name: "a reuse" },
        { name: "a different tree", record: `${"e".repeat(40)} true true`, reason: "The pull request's last run tested a different tree (main moved or the pull request changed)" },
        { name: "a failed run", latest: `123 1 completed failure ${runUrl}`, reason: "The pull request's last run did not succeed" },
        { name: "a cancelled run", latest: `123 1 completed cancelled ${runUrl}`, reason: "The pull request's last run did not succeed" },
        { name: "a run in progress", latest: `123 1 in_progress null ${runUrl}`, reason: "The pull request's last run has not finished" },
        { name: "a re-run in progress after a success", latest: `123 3 in_progress null ${runUrl}`, reason: "The pull request's last run has not finished" },
        { name: "a re-run that failed after a success", latest: `123 3 completed failure ${runUrl}`, reason: "The pull request's last run did not succeed" },
        { name: "no run for the head", latest: "", reason: "The pull request has no run of this workflow for its head" },
        { name: "a missing record", downloadStatus: 1, reason: "The pull request's last run left no record of the tree it tested" },
        { name: "an unreadable record", record: null, reason: "The record of the pull request's last run could not be read" },
        { name: "a malformed record", record: "not-a-tree true true", reason: "The record of the pull request's last run is malformed" },
        { name: "a document-only run", record: "TREE false false", reason: "The pull request's last run checked only the documents" },
        { name: "a run that left jobs to the merge queue", record: "TREE true false", reason: "The pull request's last run did not run every build and test job" },
        { name: "a record without the jobs it ran", record: "TREE true", reason: "The pull request's last run did not run every build and test job" },
        { name: "two commits on the base", history: "twoCommits", reason: "The merge group holds more than one commit on its base" },
        { name: "a merge commit", history: "merge", reason: "The merge group holds more than one commit on its base" },
        { name: "a base off main", history: "offMain", reason: "The merge group is built on another merge group, not on main" },
        { name: "an unparseable branch", headRef: "refs/heads/gh-readonly-queue/main/pr-58", reason: "The merge group's branch names no single pull request" },
        { name: "no commit to read", history: "none", reason: "The merge group's commit could not be read" },
        { name: "an unreadable pull request", pullStatus: 1, reason: "The pull request could not be read" },
        { name: "an unlisted run", runsStatus: 1, reason: "The pull request's runs could not be listed" }
      ];
      await Promise.all(cases.map(async item => {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        const repository = repositories.get(item.history ?? "squash");
        assert.ok(repository !== undefined, item.name);
        await cp(repository.directory, doubles.directory, { recursive: true });
        const { base, tree } = repository;
        const record = item.record === undefined ? `${tree} true true` : item.record?.replace("TREE", tree) ?? null;
        await writeFile(path.join(doubles.directory, "outputs.txt"), "");
        if (record !== null) {
          await mkdir(path.join(doubles.directory, "tested-tree"));
          await writeFile(path.join(doubles.directory, "tested-tree", "tested-tree.txt"), `${record}\n`);
        }
        doubles.forward("timeout");
        doubles.respond("gh", "api repos/noldova-com/teamrun/pulls/58 --jq .head.sha", `${pullRequestHead}\n`, item.pullStatus ?? 0);
        doubles.respond("gh", runs, `${item.latest ?? `123 2 completed success ${runUrl}`}\n`, item.runsStatus ?? 0);
        doubles.respond("gh", "run download 123 --repo noldova-com/teamrun --name tested-tree-2 --dir tested-tree", "", item.downloadStatus ?? 0);

        const result = await doubles.runAsync(script, {
          GITHUB_REPOSITORY: "noldova-com/teamrun", GITHUB_OUTPUT: "outputs.txt", BASE_SHA: base,
          HEAD_REF: item.headRef ?? `refs/heads/gh-readonly-queue/main/pr-58-${base}`
        });

        assert.equal(result.status, 0, `${item.name}: ${result.stderr}`);
        if (item.reason === undefined) {
          assert.equal(await doubles.readFileAsync("outputs.txt"), `verified=true\nrun=${runUrl}/attempts/2\n`, item.name);
          assert.equal(result.stdout, `The pull request run ${runUrl}/attempts/2 built and tested the tree ${tree}.\n`, item.name);
        }
        else {
          assert.equal(await doubles.readFileAsync("outputs.txt"), "verified=false\n", item.name);
          assert.equal(result.stdout, `::notice::${item.reason}, so this run builds and tests the merge group.\n`, item.name);
        }
        const downloads = (await doubles.readCallsAsync()).filter(call => call.startsWith("gh run download"));
        const reachesDownload = item.latest === undefined && item.history === undefined && item.headRef === undefined && item.pullStatus === undefined && item.runsStatus === undefined;
        assert.equal(downloads.length, reachesDownload ? 1 : 0, item.name);
      }));
    });

    test("a passing pull request run records the tree it tested for its attempt, and an invalid tree fails the record", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      const script = workflow.readStepScript("Write the record of the tested tree");
      const tree = "a".repeat(40);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());

      const result = await doubles.runAsync(script, { TREE: tree, RUN_CODE: "true", COMPLETE: "false" });
      const written = await doubles.readFileAsync("tested-tree/tested-tree.txt");
      const empty = await CommandDoublesFixture.createAsync();
      t.after(() => empty.disposeAsync());
      const invalid = await empty.runAsync(script, { TREE: "", RUN_CODE: "true", COMPLETE: "true" });

      assert.equal(result.status, 0, result.stderr);
      assert.equal(written, `${tree} true false\n`);
      assert.equal(invalid.status, 1);
      assert.equal(invalid.stdout, "::error::The classification did not record the tested tree.\n");
      assert.equal((await empty.runAsync("test -e tested-tree\n")).status, 1);
      assert.equal(workflow.readStepScript("Record the tested tree"), "set -euo pipefail\ntree=$(git rev-parse 'HEAD^{tree}')\necho \"tree=$tree\" >> \"$GITHUB_OUTPUT\"\n");
      const resultJob = text.slice(text.indexOf("  result:\n"));
      const order = ["Require the selected verification to pass", "Write the record of the tested tree", "Keep the record of the tested tree"].map(step => resultJob.indexOf(`      - name: ${step}\n`));
      assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > (order[index - 1] ?? 0))), order.join(","));
      for (const step of ["Write the record of the tested tree", "Keep the record of the tested tree"])
        assert.ok(resultJob.includes(`      - name: ${step}\n        if: github.event_name == 'pull_request'\n`), step);
      assert.ok(resultJob.includes("          name: tested-tree-${{ github.run_attempt }}\n          path: tested-tree/tested-tree.txt\n          retention-days: 7\n          if-no-files-found: error\n"));
    });

    test("the plan lists only the targets that miss a current root or Angular cache", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript(BuildAndTestTests.PLAN_STEP);
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

        const result = await doubles.runAsync(script, { GITHUB_REPOSITORY: "noldova-com/teamrun", ROOT_HASH: "rootnew", SOURCE_HASH: "srcnew", GITHUB_OUTPUT: "outputs.txt" });

        assert.equal(result.status, 0, result.stderr);
        assert.equal(await doubles.readFileAsync("outputs.txt"), outputs);
        const parsed: unknown = JSON.parse(outputs.slice("targets=".length));
        assert.ok(Array.isArray(parsed));
        assert.equal(result.stdout, parsed.map(t => `${String((t as { target: unknown }).target)} has no current dependency cache.\n`).join(""));
      }

      const failing = await CommandDoublesFixture.createAsync();
      t.after(() => failing.disposeAsync());
      failing.respond("gh", BuildAndTestTests.CACHE_LIST, "", 1);
      assert.notEqual((await failing.runAsync(script, { GITHUB_REPOSITORY: "noldova-com/teamrun", ROOT_HASH: "rootnew", SOURCE_HASH: "srcnew", GITHUB_OUTPUT: "outputs.txt" })).status, 0);
    });

    test("the slow targets run their tests and their UI workflows as parallel jobs that each build natively", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      const legs = BuildAndTestTests.readLegs(text);

      assert.deepEqual(legs.map(t => [t.label, t.part, t.pullRequest]), [
        ["Linux x64", "all", "runs"],
        ["Linux ARM64", "all", "runs"],
        ["Windows x64, tests", "tests", "runs"],
        ["Windows x64, UI workflows", "workflows", "runs"],
        ["Windows ARM64, tests", "tests", "deferred"],
        ["Windows ARM64, UI workflows", "workflows", "deferred"],
        ["macOS x64, tests", "tests", "deferred"],
        ["macOS x64, UI workflows", "workflows", "deferred"],
        ["macOS ARM64", "all", "runs"]
      ]);
      for (const leg of legs)
        assert.equal(leg.label, leg.part === "all" ? leg.target : `${leg.target}, ${leg.part === "tests" ? "tests" : "UI workflows"}`);
      assert.ok(text.includes("    name: Build and test (${{ matrix.label }})\n    needs: changes\n"));
      assert.ok(text.includes("      matrix:\n        include: ${{ fromJSON(needs.changes.outputs.legs) }}\n    runs-on: ${{ matrix.runner }}\n"));
      assert.ok(text.includes("      legs: ${{ steps.legs.outputs.legs }}\n      deferred: ${{ steps.legs.outputs.deferred }}\n      complete: ${{ steps.legs.outputs.complete }}\n"));
      assert.ok(text.includes("      - name: Build\n        if: matrix.part != 'workflows'\n"));
      assert.ok(text.includes("      - name: Test\n        id: test\n        if: matrix.part != 'workflows'\n"));
      assert.ok(text.includes("      - name: Test the UI workflows\n        id: ui\n        if: matrix.part != 'tests'\n"));
      for (const step of ["Check out the revision", "Set up Node.js", "Restore the installed dependencies", "Restore the Angular project's installed dependencies", "Install Electron"])
        assert.ok(!new RegExp(`      - name: ${step}\\n        if: [^\\n]*matrix\\.part`).test(text), step);
      assert.ok(text.includes("    name: Build and test (all targets)\n    needs: [tested, changes, validate]\n    if: always()\n"));
    });

    test("a pull request leaves Windows ARM64 and macOS x64 to main and manual runs, and every other run lists every job", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const script = workflow.readStepScript(BuildAndTestTests.LEGS_STEP);
      const all = BuildAndTestTests.readLegs(workflow.text).map(({ label, target, part, runner, architecture }) => ({ label, target, part, runner, architecture }));

      for (const event of ["pull_request", "merge_group", "push", "workflow_dispatch"]) {
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        await writeFile(path.join(doubles.directory, "outputs.txt"), "");

        const result = await doubles.runAsync(script, { EVENT_NAME: event, GITHUB_OUTPUT: "outputs.txt" });
        const outputs = new Map((await doubles.readFileAsync("outputs.txt")).trimEnd().split("\n").map(line => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));

        assert.equal(result.status, 0, `${event}: ${result.stderr}`);
        assert.equal(result.stdout, "", event);
        assert.deepEqual([...outputs.keys()], ["legs", "deferred", "complete"], event);
        if (event === "pull_request") {
          assert.deepEqual(JSON.parse(outputs.get("legs") ?? ""), all.filter(t => t.target !== "Windows ARM64" && t.target !== "macOS x64"));
          assert.equal(outputs.get("deferred"), "Windows ARM64, macOS x64");
          assert.equal(outputs.get("complete"), "false");
        }
        else {
          assert.deepEqual(JSON.parse(outputs.get("legs") ?? ""), all, event);
          assert.equal(outputs.get("deferred"), "", event);
          assert.equal(outputs.get("complete"), "true", event);
        }
      }
      assert.equal(all.length, 9);
      assert.ok(workflow.text.includes(`      - name: ${BuildAndTestTests.LEGS_STEP}\n        id: legs\n        env:\n          EVENT_NAME: \${{ github.event_name }}\n`));
    });

    test("the plan's targets are the validated targets", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const matrix = [...new Map(BuildAndTestTests.readLegs(workflow.text).map(t => [t.target, [t.target, t.runner, t.architecture]])).values()];
      const operatingSystems: Readonly<Record<string, string>> = { ubuntu: "Linux", windows: "Windows", macos: "macOS" };
      const planned = workflow.readStepScript(BuildAndTestTests.PLAN_STEP).split("<<'TARGETS'\n")[1]?.split("TARGETS\n")[0]?.trimEnd().split("\n").map(t => t.split("|")) ?? [];

      assert.deepEqual(matrix, BuildAndTestTests.TARGETS.map(([target, runner, , architecture]) => [target, runner, architecture]));
      assert.deepEqual(planned, BuildAndTestTests.TARGETS.map(t => [...t]));
      for (const [, runner, os] of BuildAndTestTests.TARGETS)
        assert.equal(operatingSystems[runner.split("-")[0] ?? ""], os, runner);
    });

    test("a target without a current cache installs exactly as validation does and saves only what is missing", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      const cache = text.slice(text.indexOf("  cache:\n"), text.indexOf("  caches:\n"));
      assert.ok(cache.startsWith("  cache:\n    name: Save the dependency caches (${{ matrix.target }})\n    needs: cache-plan\n" +
        "    if: needs.cache-plan.outputs.targets != '[]'\n"));
      assert.ok(cache.includes("        include: ${{ fromJSON(needs.cache-plan.outputs.targets) }}\n"));
      assert.equal(workflow.readStepScript("Verify the toolchain to install"), workflow.readStepScript(BuildAndTestTests.TOOLCHAIN_STEP));
      assert.equal(workflow.readStepScript("Stop Spotlight indexing while saving"), workflow.readStepScript("Stop Spotlight indexing"));
      assert.equal(workflow.readStepScript("Install the dependencies to save"), workflow.readStepScript("Install dependencies"));
      assert.equal(workflow.readStepScript("Install Electron to save"), workflow.readStepScript("Install Electron"));
      assert.equal(workflow.readStepScript("Install the Angular project to save"), workflow.readStepScript("Build"));
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
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;

      assert.ok(workflow.readStepScript("Install Electron").includes("node node_modules/electron/install.js"));
      assert.ok(text.includes("      - name: Install Electron\n        run: "));
      assert.ok(text.indexOf("      - name: Install dependencies\n") < text.indexOf("      - name: Install Electron\n"));
      assert.ok(text.indexOf("      - name: Install Electron to save\n") < text.indexOf("      - name: Save the installed dependencies\n"));
    });

    for (const [name, exitCodes, status, sleeps] of [
      ["a download that fails and then succeeds passes after one pause", [1, 0], 0, 1],
      ["a download that succeeds at once does not wait", [0], 0, 0],
      ["a download that fails every attempt fails the step after three pauses", [1], 1, 3]
    ] as const)
      test(`Electron's binary download is retried a bounded number of times: ${name}`, { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
        const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
        const doubles = await CommandDoublesFixture.createAsync();
        t.after(() => doubles.disposeAsync());
        doubles.respondInTurn("node", "node_modules/electron/install.js", exitCodes, "HTTPError: Response code 500");
        const stoppedSleep = "sleep() { echo \"sleep $*\" >> sleeps.log; }\n";

        const result = await doubles.runAsync(stoppedSleep + workflow.readStepScript("Install Electron"));

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

    test("the UI workflows run after the tests, under Xvfb on Linux, and their results are kept from every run", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const text = workflow.text;
      const script = workflow.readStepScript("Test the UI workflows");
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("xvfb-run", "--auto-servernum --server-args=-screen 0 1920x1080x24 npm run test:ui", "");
      doubles.respond("npm", "run test:ui", "");

      const linux = await doubles.runAsync(script, { RUNNER_OS: "Linux" });
      const windows = await doubles.runAsync(script, { RUNNER_OS: "Windows" });
      const macos = await doubles.runAsync(script, { RUNNER_OS: "macOS" });

      assert.deepEqual([linux.status, windows.status, macos.status], [0, 0, 0], linux.stderr + windows.stderr + macos.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), ["xvfb-run --auto-servernum --server-args=-screen 0 1920x1080x24 npm run test:ui", "npm run test:ui", "npm run test:ui"]);
      assert.ok(text.indexOf("      - name: Test\n") < text.indexOf("      - name: Test the UI workflows\n"));
      assert.ok(text.includes("      - name: Test the UI workflows\n        id: ui\n"));
      assert.equal(workflow.readStepScript("Summarize the UI workflows"), "node scripts/ui-summary.ts\n");
      assert.ok(text.includes("          UI_TARGET: ${{ matrix.target }}\n          SCREENSHOT_URL: ${{ steps.screenshot-last.outputs.artifact-url || steps.screenshot-again.outputs.artifact-url || steps.screenshot.outputs.artifact-url }}\n"));
      assert.ok(text.includes("          SCREENSHOT_UPLOAD_FAILED: ${{ steps.screenshot-last.outcome == 'failure' }}\n"));
    });

    test("each upload of the UI results is tried three times with a pause, with the same settings", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);

      for (const [first, again, last, settings] of BuildAndTestTests.UPLOADS) {
        const attempts = [simulation.find(first), simulation.find(again), simulation.find(last)];
        const pause = `Wait before keeping the ${first.slice("Keep the ".length)}`;

        assert.deepEqual(attempts.map(t => t.uses), attempts.map(() => BuildAndTestTests.UPLOAD_ACTION));
        assert.deepEqual(attempts.map(t => t.continueOnError), [true, true, true]);
        assert.deepEqual(attempts[0]?.settings, settings);
        assert.deepEqual(attempts[1]?.settings, [...settings, "overwrite: true"]);
        assert.deepEqual(attempts[2]?.settings, [...settings, "overwrite: true"]);
        assert.equal(workflow.readStepScript(`${pause} again`), "sleep 15\n");
        assert.equal(workflow.readStepScript(`${pause} a last time`), "sleep 15\n");
      }
    });

    test("each Node.js setup is tried three times with a pause and the same settings, and fails its job only when the last attempt fails", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);

      for (const first of BuildAndTestTests.NODE_SETUPS) {
        const [again, last] = [`${first} again`, `${first} a last time`];
        const pause = `Wait before setting up ${first.slice("Set up ".length)}`;
        const simulation = new WorkflowSimulation(workflow.text, first, last);
        const attempts = [first, again, last].map(t => simulation.find(t));

        const passed = simulation.run(BuildAndTestTests.WHOLE_LEG, {});
        const retried = simulation.run(BuildAndTestTests.WHOLE_LEG, { [first]: "failure" });
        const failed = simulation.run(BuildAndTestTests.WHOLE_LEG, { [first]: "failure", [again]: "failure", [last]: "failure" });

        assert.deepEqual(attempts.map(t => [t.uses, t.continueOnError]), [[BuildAndTestTests.NODE_ACTION, true], [BuildAndTestTests.NODE_ACTION, true], [BuildAndTestTests.NODE_ACTION, false]], first);
        assert.deepEqual([attempts[1]?.settings, attempts[2]?.settings], [attempts[0]?.settings, attempts[0]?.settings], first);
        assert.ok(attempts[0]?.settings.includes("node-version: '26.7.0'"), first);
        assert.deepEqual([workflow.readStepScript(`${pause} again`), workflow.readStepScript(`${pause} a last time`)], ["sleep 30\n", "sleep 30\n"], first);
        assert.deepEqual([passed.ran, passed.isJobFailed], [[first], false], first);
        assert.deepEqual([retried.ran, retried.isJobFailed], [[first, `${pause} again`, again], false], first);
        assert.deepEqual([failed.ran, failed.isJobFailed], [[first, `${pause} again`, again, `${pause} a last time`, last], true], first);
      }
    });

    test("failed tests keep the Angular tests' output and report, tried three times with a pause, and a passing or skipped test step keeps nothing", async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, BuildAndTestTests.TEST_STEP, BuildAndTestTests.ANGULAR_WARNING);
      const [first, again, last] = BuildAndTestTests.ANGULAR_UPLOADS.map(t => simulation.find(t));
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());

      const passed = simulation.run(BuildAndTestTests.WHOLE_LEG, {});
      const skipped = simulation.run({ part: "workflows" }, {});
      const failed = simulation.run(BuildAndTestTests.WHOLE_LEG, { [BuildAndTestTests.TEST_STEP]: "failure" });
      const unkept = simulation.run(BuildAndTestTests.WHOLE_LEG,
        Object.fromEntries([BuildAndTestTests.TEST_STEP, ...BuildAndTestTests.ANGULAR_UPLOADS].map(t => [t, "failure"])));
      const warning = await doubles.runAsync(workflow.readStepScript(BuildAndTestTests.ANGULAR_WARNING));

      assert.deepEqual([passed.ran, passed.isJobFailed], [[BuildAndTestTests.TEST_STEP], false]);
      assert.deepEqual([skipped.ran, skipped.isJobFailed], [[], false]);
      assert.deepEqual([failed.ran, failed.isJobFailed], [[BuildAndTestTests.TEST_STEP, "Keep the Angular test output"], true]);
      assert.deepEqual(unkept.ran, [
        BuildAndTestTests.TEST_STEP,
        "Keep the Angular test output", "Wait before keeping the Angular test output again", "Keep the Angular test output again",
        "Wait before keeping the Angular test output a last time", "Keep the Angular test output a last time",
        BuildAndTestTests.ANGULAR_WARNING
      ]);
      assert.deepEqual([first, again, last].map(t => [t?.uses, t?.continueOnError]), [first, again, last].map(() => [BuildAndTestTests.UPLOAD_ACTION, true]));
      assert.deepEqual(first?.settings, BuildAndTestTests.ANGULAR_SETTINGS);
      assert.deepEqual([again?.settings, last?.settings], [[...BuildAndTestTests.ANGULAR_SETTINGS, "overwrite: true"], [...BuildAndTestTests.ANGULAR_SETTINGS, "overwrite: true"]]);
      assert.equal(workflow.readStepScript("Wait before keeping the Angular test output again"), "sleep 15\n");
      assert.equal(workflow.readStepScript("Wait before keeping the Angular test output a last time"), "sleep 15\n");
      assert.deepEqual([warning.status, warning.stdout], [0, "::warning title=The Angular test output was not kept::The upload failed three times, so it is not attached.\n"]);
    });

    test("an upload that fails and then succeeds is tried again once and keeps the job green", async () => {
      const simulation = new WorkflowSimulation((await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);

      const result = simulation.run(BuildAndTestTests.WHOLE_LEG, { "Keep the UI workflow results": "failure", "Keep the main window screenshot": "failure", "Keep the main window screenshot again": "failure" });

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
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const simulation = new WorkflowSimulation(workflow.text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);
      const failures = Object.fromEntries(BuildAndTestTests.UPLOADS.flatMap(([first, again, last]) => [[first, "failure"], [again, "failure"], [last, "failure"]]));
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());

      const result = simulation.run(BuildAndTestTests.WHOLE_LEG, failures);
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

    test("uploads that succeed run no retry and no warning, and failed tests still fail the job", async () => {
      const simulation = new WorkflowSimulation((await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);

      const passed = simulation.run(BuildAndTestTests.WHOLE_LEG, {});
      const failed = simulation.run(BuildAndTestTests.WHOLE_LEG, { [BuildAndTestTests.UI_STEP]: "failure" });

      assert.deepEqual(passed.ran, [BuildAndTestTests.UI_STEP, "Keep the UI workflow results", "Keep the main window screenshot", BuildAndTestTests.SUMMARY_STEP]);
      assert.equal(passed.isJobFailed, false);
      assert.equal(failed.isJobFailed, true);
      assert.deepEqual(failed.ran, passed.ran);
      assert.equal(simulation.find(BuildAndTestTests.UI_STEP).continueOnError, false);
      assert.equal(simulation.find(BuildAndTestTests.SUMMARY_STEP).continueOnError, false);
    });

    test("a tests leg runs no UI workflow, upload or summary, and a UI workflows leg runs them as a whole leg does", async () => {
      const simulation = new WorkflowSimulation((await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).text, BuildAndTestTests.UI_STEP, BuildAndTestTests.SUMMARY_STEP);
      const failures = { "Keep the UI workflow results": "failure", "Keep the main window screenshot": "failure" };

      const tests = simulation.run({ part: "tests" }, failures);
      const workflows = simulation.run({ part: "workflows" }, failures);

      assert.deepEqual(tests.ran, []);
      assert.equal(tests.isJobFailed, false);
      assert.deepEqual(workflows, simulation.run(BuildAndTestTests.WHOLE_LEG, failures));
    });

    test("the UI workflows build their own test builds, so the workflow builds none", async () => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);

      assert.ok(!workflow.text.includes("--output _build/variants"));
      assert.ok(!workflow.text.includes("npm run build -- --test"));
      assert.ok(workflow.text.indexOf("      - name: Test\n") < workflow.text.indexOf("      - name: Test the UI workflows\n"));
    });

    test("a failed UI workflow run fails its step",{ timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript("Test the UI workflows");
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("xvfb-run", "--auto-servernum --server-args=-screen 0 1920x1080x24 npm run test:ui", "", 1);
      doubles.respond("npm", "run test:ui", "", 1);

      assert.equal((await doubles.runAsync(script, { RUNNER_OS: "Linux" })).status, 1);
      assert.equal((await doubles.runAsync(script, { RUNNER_OS: "Windows" })).status, 1);
    });

    test("Linux targets let Electron's sandbox create its namespaces before the UI workflows", { timeout: BuildAndTestTests.SCRIPT_TIMEOUT }, async t => {
      const workflow = await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW);
      const doubles = await CommandDoublesFixture.createAsync();
      t.after(() => doubles.disposeAsync());
      doubles.respond("sudo", "sysctl -w kernel.apparmor_restrict_unprivileged_userns=0", "");

      const result = await doubles.runAsync(workflow.readStepScript("Let Electron's sandbox start on Linux"));

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(await doubles.readCallsAsync(), ["sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0"]);
      assert.ok(workflow.text.includes("      - name: Let Electron's sandbox start on Linux\n        if: runner.os == 'Linux' && matrix.part != 'tests'\n"));
      assert.ok(workflow.text.indexOf("Let Electron's sandbox start on Linux") < workflow.text.indexOf("Test the UI workflows"));
    });

    test("an inexact Angular restore is discarded, so a partial restore never passes as installed", async t => {
      const script = (await WorkflowFileFixture.readAsync(BuildAndTestTests.WORKFLOW)).readStepScript("Discard an inexact Angular install");
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

  private static readLegs(text: string): readonly { label: string; target: string; part: string; runner: string; architecture: string; pullRequest: string }[] {
    return [...text.matchAll(/^ {10}([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)$/gm)]
      .map(t => ({ label: t[1] ?? "", target: t[2] ?? "", part: t[3] ?? "", runner: t[4] ?? "", architecture: t[5] ?? "", pullRequest: t[6] ?? "" }));
  }
}

BuildAndTestTests.register();
