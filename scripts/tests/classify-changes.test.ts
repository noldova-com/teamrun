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
import ProcessRunner from "../processes/process-runner.ts";
import Git from "../repository/git.ts";
import ChangeClassifier from "../workflows/change-classifier.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class ClassifyChangesTests {
  public static register(): void {
    test("the selected scope goes to the step output, the step summary and the log", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const base = await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const head = await repository.commitAsync({ "docs/guide.md": "# Guide\n" });
      const outputPath = path.join(repository.directory, "output.txt");
      const summaryPath = path.join(repository.directory, "summary.md");
      const log = new TextOutputFixture();
      const classify = new ClassifyChanges(new ChangeClassifier(new Git(repository.directory, new ProcessRunner())), log);
      const environment = { GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath, EVENT_NAME: "pull_request", BASE_SHA: base, HEAD_SHA: head };

      assert.equal(await classify.runAsync(environment), 0);
      assert.equal(await classify.runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath }), 0);

      const outputs = (await readFile(outputPath, "utf8")).split("\n");
      assert.deepEqual(outputs.filter(t => /^(run-code|run-ui|deferred)=/.test(t)), ["run-code=false", "run-ui=false", "deferred=Windows ARM64, macOS x64", "run-code=true", "run-ui=true", "deferred="]);
      const skipped = `Code builds and tests are not required; the document checks still run. Only Markdown documentation changed since the merge base ${base}.`;
      const full = "Full build and test verification selected. Events other than pull requests and merge groups verify everything.";
      assert.equal(await readFile(summaryPath, "utf8"), `${skipped}\n${full}\n`);
      assert.equal(log.text, `${skipped}\n${full}\n`);
    });

    test("a push plans the UI workflows of every target but macOS x64 and names it, and a manual run plans every target's", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const outputPath = path.join(repository.directory, "output.txt");
      const classify = new ClassifyChanges(new ChangeClassifier(new Git(repository.directory, new ProcessRunner())), new TextOutputFixture());
      const classifyAsync = async (eventName: string): Promise<ReadonlyMap<string, string>> => {
        await writeFile(outputPath, "");
        assert.equal(await classify.runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), EVENT_NAME: eventName }), 0);
        return new Map((await readFile(outputPath, "utf8")).trim().split("\n").map(t => [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)]));
      };
      const describe = (outputs: ReadonlyMap<string, string>): readonly unknown[] =>
        [JSON.parse(outputs.get("targets") ?? "").length, outputs.get("ui-targets"), Object.keys(JSON.parse(outputs.get("ui-plan") ?? "")).join(" "), outputs.get("ui-deferred")];

      const push = await classifyAsync("push");
      const manual = await classifyAsync("workflow_dispatch");

      const all = "linux-x64 linux-arm64 windows-x64 windows-arm64 macos-x64 macos-arm64";
      const withoutMacOsX64 = "linux-x64 linux-arm64 windows-x64 windows-arm64 macos-arm64";
      assert.deepEqual(describe(push), [6, withoutMacOsX64, withoutMacOsX64, "macOS x64"]);
      assert.deepEqual(describe(manual), [6, all, all, ""]);
    });

    test("missing or empty output and summary files fail before classifying", async () => {
      const classifier = new ChangeClassifier(new Git("unused", new ProcessRunner()));
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
      const outputs = new Map((await readFile(environment.GITHUB_OUTPUT, "utf8")).trim().split("\n").map(t => [t.slice(0, t.indexOf("=")), t.slice(t.indexOf("=") + 1)]));
      assert.equal(outputs.get("run-code"), "true");
      assert.equal(outputs.get("run-ui"), "false");
      assert.equal(outputs.get("deferred"), "Windows ARM64, macOS x64");
      assert.deepEqual(JSON.parse(outputs.get("targets") ?? ""), [
        { target: "Linux x64", runner: "ubuntu-24.04", architecture: "x64" },
        { target: "Linux ARM64", runner: "ubuntu-24.04-arm", architecture: "arm64" },
        { target: "Windows x64", runner: "windows-2025", architecture: "x64" },
        { target: "macOS ARM64", runner: "macos-15", architecture: "arm64" }
      ]);
      assert.equal(outputs.get("target-table"), "Linux x64|ubuntu-24.04|Linux|x64;Linux ARM64|ubuntu-24.04-arm|Linux|arm64;Windows x64|windows-2025|Windows|x64;macOS ARM64|macos-15|macOS|arm64");
      assert.equal(outputs.get("ui-targets"), "linux-x64 linux-arm64 windows-x64 macos-arm64");
      assert.equal(outputs.get("ui-deferred"), "");
      const plan: Record<string, { build: unknown[]; shards: unknown[] }> = JSON.parse(outputs.get("ui-plan") ?? "");
      const windows = { target: "Windows x64", runner: "windows-2025", architecture: "x64" };
      assert.deepEqual(Object.keys(plan), ["linux-x64", "linux-arm64", "windows-x64", "macos-arm64"]);
      const linux = { target: "Linux x64", runner: "ubuntu-24.04", architecture: "x64" };
      assert.deepEqual(plan["windows-x64"], { build: [], shards: [{ ...windows, shard: 1, shards: 1, grep: "@smoke", prebuilt: false }] });
      assert.deepEqual(plan["linux-x64"], { build: [linux], shards: [1, 2].map(t => ({ ...linux, shard: t, shards: 2, grep: "", prebuilt: true })) });
      assert.equal(refused.status, 1);
    });
  }
}

ClassifyChangesTests.register();
