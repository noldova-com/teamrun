/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ClassifyChanges from "../classify-changes.ts";
import PackageCatalog from "../packages/package-catalog.ts";
import ProcessRunner from "../processes/process-runner.ts";
import Git from "../repository/git.ts";
import BuildMatrix from "../workflows/build-matrix.ts";
import ChangeClassifier from "../workflows/change-classifier.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class ClassifyChangesTests {
  private static readonly EVENTS: readonly string[] = ["push", "pull_request", "merge_group", "workflow_dispatch"];

  public static register(): void {
    test("the selected scope goes to the step output, the step summary and the log", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const base = await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const head = await repository.commitAsync({ "docs/guide.md": "# Guide\n" });
      const outputPath = path.join(repository.directory, "output.txt");
      const summaryPath = path.join(repository.directory, "summary.md");
      const log = new TextOutputFixture();
      const classify = new ClassifyChanges(ClassifyChangesTests.createClassifier(repository.directory), log);
      const environment = { GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath, EVENT_NAME: "pull_request", BASE_SHA: base, HEAD_SHA: head };

      assert.equal(await classify.runAsync(environment), 0);
      assert.equal(await classify.runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath }), 0);

      const outputs = (await readFile(outputPath, "utf8")).split("\n");
      assert.deepEqual(outputs.filter(t => /^(run-code|run-ui|deferred)=/.test(t)), ["run-code=false", "run-ui=false", "deferred=Windows ARM64 (on every push to main and in manual runs), macOS x64 (every night and in manual runs)", "run-code=true", "run-ui=true", "deferred="]);
      const skipped = `Code builds and tests are not required; the document checks still run. Only Markdown documentation changed since the merge base ${base}.`;
      const none = "Selection: every check other than the tests, no tests, and no UI workflow. This run does not narrow its jobs to the selection yet.";
      const full = "Full build and test verification selected. Events other than pull requests and merge groups verify everything.";
      const everything = "Selection: everything. Events other than pull requests and merge groups verify everything. This run does not narrow its jobs to the selection yet.";
      assert.equal(await readFile(summaryPath, "utf8"), `${skipped}\n${none}\n${full}\n${everything}\n`);
      assert.equal(log.text, `${skipped}\n${none}\n${full}\n${everything}\n`);
    });

    test("a push plans every target but macOS x64 and names it, and a manual run plans every target", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const outputPath = path.join(repository.directory, "output.txt");
      const classify = new ClassifyChanges(ClassifyChangesTests.createClassifier(repository.directory), new TextOutputFixture());
      const classifyAsync = async (eventName: string): Promise<ReadonlyMap<string, string>> => {
        await writeFile(outputPath, "");
        assert.equal(await classify.runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), EVENT_NAME: eventName }), 0);
        return new Map((await readFile(outputPath, "utf8")).trim().split("\n").map(t => [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)]));
      };
      const describe = (outputs: ReadonlyMap<string, string>): readonly unknown[] => {
        const targets: readonly { target: string; ui: unknown }[] = JSON.parse(outputs.get("targets") ?? "");
        return [targets.length, outputs.get("ui-targets"), targets.filter(t => t.ui !== null).map(t => t.target).join(", "), outputs.get("deferred")];
      };

      const push = await classifyAsync("push");
      const manual = await classifyAsync("workflow_dispatch");

      assert.deepEqual(describe(push), [5, "linux-x64 linux-arm64 windows-x64 windows-arm64 macos-arm64", "Linux x64, Linux ARM64, Windows x64, Windows ARM64, macOS ARM64", "macOS x64 (every night and in manual runs)"]);
      assert.deepEqual(describe(manual), [6, "linux-x64 linux-arm64 windows-x64 windows-arm64 macos-x64 macos-arm64", "Linux x64, Linux ARM64, Windows x64, Windows ARM64, macOS x64, macOS ARM64", ""]);
      assert.deepEqual([push.has("ui-plan"), push.has("ui-deferred")], [false, false]);
    });

    test("a split target's Build job makes the builds its UI shards reuse, and any other target's UI workflows build their own", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const outputPath = path.join(repository.directory, "output.txt");
      await writeFile(outputPath, "");
      const classify = new ClassifyChanges(ClassifyChangesTests.createClassifier(repository.directory), new TextOutputFixture());

      assert.equal(await classify.runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), EVENT_NAME: "push" }), 0);

      const line = (await readFile(outputPath, "utf8")).split("\n").find(u => u.startsWith("targets=")) ?? "";
      const plans = new Map<string, unknown>(JSON.parse(line.slice("targets=".length)).map((u: { target: string; ui: unknown }) => [u.target, u.ui]));
      const windows = { target: "Windows x64", runner: "windows-2025", architecture: "x64" };
      const macOs = { target: "macOS ARM64", runner: "macos-15", architecture: "arm64" };
      const shards = (target: object, count: number): readonly object[] => Array.from({ length: count }, (_, i) => ({ ...target, shard: i + 1, shards: count, grep: "", prebuilt: true }));
      const counts = new Map(new BuildMatrix("push").targets.map(u => [u.name, u.uiShards.length]));
      assert.deepEqual(plans.get("Windows x64"), { shared: true, folded: false, build: [], shards: shards(windows, counts.get("Windows x64") ?? 0) });
      assert.deepEqual(plans.get("macOS ARM64"), { shared: false, folded: false, build: [macOs], shards: shards(macOs, counts.get("macOS ARM64") ?? 0) });
      assert.equal(plans.has("macOS x64"), false);
    });

    test("every event plans UI workflows only for targets it builds, since a target's UI workflows run inside its build and test jobs", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const names = new Map(new BuildMatrix("workflow_dispatch").targets.map(u => [u.key, u.name]));

      for (const eventName of ClassifyChangesTests.EVENTS) {
        const outputs = await ClassifyChangesTests.classifyAsync(repository.directory, eventName);

        const targets: readonly { target: string; ui: unknown }[] = JSON.parse(outputs.get("targets") ?? "");
        const uiTargets = (outputs.get("ui-targets") ?? "").split(" ").filter(u => u.length > 0).map(u => names.get(u));
        assert.ok(uiTargets.length > 0, eventName);
        assert.deepEqual(uiTargets, targets.filter(u => u.ui !== null).map(u => u.target), eventName);
      }
    });

    test("no target both reuses its Build job's builds for its UI shards and plans its own UI build, so their build artifacts cannot share a name", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const plans: { target: string; shared: boolean; builds: boolean }[] = [];

      for (const eventName of ClassifyChangesTests.EVENTS) {
        const outputs = await ClassifyChangesTests.classifyAsync(repository.directory, eventName);
        const targets: readonly { target: string; ui: { shared: boolean; build: readonly unknown[] } | null }[] = JSON.parse(outputs.get("targets") ?? "");
        plans.push(...targets.flatMap(u => u.ui === null ? [] : [{ target: `${eventName} ${u.target}`, shared: u.ui.shared, builds: u.ui.build.length > 0 }]));
      }

      assert.deepEqual(plans.filter(u => u.shared && u.builds), []);
      assert.ok(plans.some(u => u.shared), JSON.stringify(plans));
      assert.ok(plans.some(u => u.builds), JSON.stringify(plans));
    });

    test("missing or empty output and summary files fail before classifying", async () => {
      const classifier = ClassifyChangesTests.createClassifier("unused");
      for (const environment of [{}, { GITHUB_OUTPUT: "", GITHUB_STEP_SUMMARY: "summary.md" }, { GITHUB_OUTPUT: "output.txt" }, { GITHUB_OUTPUT: "output.txt", GITHUB_STEP_SUMMARY: "" }]) {
        const log = new TextOutputFixture();

        assert.equal(await new ClassifyChanges(classifier, log).runAsync(environment), 1);
        assert.equal(log.text, "GITHUB_OUTPUT and GITHUB_STEP_SUMMARY must name the step's output and summary files.\n");
      }
    });

    test("the command classifies the working directory's repository from its environment and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const base = await repository.commitAsync({ "README.md": "# TeamRun\n" });
      const head = await repository.commitAsync({ "scripts/tests/new.test.ts": "export {};\n" });
      const command = SourceTreeFixture.locateScript("classify-changes.ts");
      const environment = {
        ...process.env,
        GITHUB_OUTPUT: path.join(repository.directory, "output.txt"),
        GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"),
        EVENT_NAME: "pull_request",
        BASE_SHA: base,
        HEAD_SHA: head
      };

      const classified = spawnSync(process.execPath, [command], { cwd: repository.directory, env: environment, encoding: "utf8", timeout: 10_000 });
      const refused = spawnSync(process.execPath, [command], { cwd: repository.directory, env: { ...environment, GITHUB_OUTPUT: "" }, encoding: "utf8", timeout: 10_000 });

      assert.equal(classified.status, 0, classified.stderr);
      assert.match(classified.stdout, /^Selection: every check other than the tests, the script tests, and no UI workflow\. /m);
      const outputs = new Map((await readFile(environment.GITHUB_OUTPUT, "utf8")).trim().split("\n").map(t => [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)]));
      assert.equal(outputs.get("run-code"), "true");
      assert.equal(outputs.get("run-ui"), "false");
      assert.equal(outputs.get("deferred"), "Windows ARM64 (on every push to main and in manual runs), macOS x64 (every night and in manual runs)");
      const parts = [
        { part: "packages", name: "Package tests", prebuilt: true, build: false, angular: false },
        { part: "scripts", name: "Script tests", prebuilt: true, build: false, angular: false },
        { part: "angular-and-checks", name: "Angular tests and checks", prebuilt: true, build: true, angular: true }
      ];
      const linux = { target: "Linux x64", runner: "ubuntu-24.04", architecture: "x64" };
      const linuxArm = { target: "Linux ARM64", runner: "ubuntu-24.04-arm", architecture: "arm64" };
      const windows = { target: "Windows x64", runner: "windows-2025", architecture: "x64" };
      const macOs = { target: "macOS ARM64", runner: "macos-15", architecture: "arm64" };
      const matrix = new BuildMatrix("pull_request");
      const prebuilt = (target: { target: string }): object => {
        const count = matrix.targets.find(u => u.name === target.target)?.uiShards.length ?? 0;
        return { shared: true, folded: false, build: [], shards: Array.from({ length: count }, (_, i) => ({ ...target, shard: i + 1, shards: count, grep: "", prebuilt: true })) };
      };
      const smoke = (target: object, folded: boolean): object => ({ shared: false, folded, build: [], shards: [{ ...target, shard: 1, shards: 1, grep: "@smoke", prebuilt: false }] });
      assert.deepEqual(JSON.parse(outputs.get("targets") ?? ""), [
        { ...linux, jobs: parts, ui: prebuilt(linux) },
        { ...linuxArm, jobs: parts, ui: prebuilt(linuxArm) },
        { ...windows, jobs: parts, ui: smoke(windows, false) },
        { ...macOs, jobs: [{ part: "", name: "Build and test", prebuilt: false, build: true, angular: true }], ui: smoke(macOs, true) }
      ]);
      assert.equal(outputs.get("target-table"), "Linux x64|ubuntu-24.04|Linux|x64;Linux ARM64|ubuntu-24.04-arm|Linux|arm64;Windows x64|windows-2025|Windows|x64;" +
        "Windows ARM64|windows-11-arm|Windows|arm64;macOS x64|macos-15-intel|macOS|x64;macOS ARM64|macos-15|macOS|arm64");
      assert.equal(outputs.get("ui-targets"), "linux-x64 linux-arm64 windows-x64 macos-arm64");
      assert.equal(outputs.has("ui-deferred"), false);
      assert.equal(refused.status, 1);
    });
  }

  private static createClassifier(directory: string): ChangeClassifier {
    return new ChangeClassifier(new Git(directory, new ProcessRunner()), new PackageCatalog(directory));
  }

  private static async classifyAsync(directory: string, eventName: string): Promise<ReadonlyMap<string, string>> {
    const outputPath = path.join(directory, "output.txt");
    await writeFile(outputPath, "");
    const classify = new ClassifyChanges(ClassifyChangesTests.createClassifier(directory), new TextOutputFixture());
    assert.equal(await classify.runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: path.join(directory, "summary.md"), EVENT_NAME: eventName }), 0);
    return new Map((await readFile(outputPath, "utf8")).trim().split("\n").map(t => [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)]));
  }
}

ClassifyChangesTests.register();
