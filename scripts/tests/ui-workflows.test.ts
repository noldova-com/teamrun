/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import DesktopException from "../desktop/desktop.exception.ts";
import UiWorkflows from "../ui-workflows.ts";
import PreparedBinaryFixture from "./fixtures/prepared-binary.fixture.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class UiWorkflowsTests {
  private static readonly BUILD_ARGUMENTS: readonly (readonly string[])[] = [
    ["--test", "--without", "notes", "--without", "clock", "--output", "_build/variants/no-modules"],
    ["--test", "--without", "clock", "--output", "_build/variants/without-clock"],
    ["--test"]
  ];

  public static register(): void {
    test("the UI workflows build the no-modules, without-clock and full test builds in that order, prepare the development app, then type-check and run", async t => {
      const repository = await UiWorkflowsTests.createRepositoryAsync(t);
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      const exitCode = await new UiWorkflows(repository.directory, runner, output, new PreparedBinaryFixture()).runAsync(["docking.spec.ts"]);

      assert.equal(exitCode, 0);
      assert.deepEqual(UiWorkflowsTests.describeRuns(runner, repository.directory), [
        ...UiWorkflowsTests.BUILD_ARGUMENTS.map(t => `scripts/build.ts ${t.join(" ")}`),
        "node_modules/typescript/bin/tsc --project src/shell/desktop/tests/e2e",
        "node_modules/playwright/cli.js test --config src/shell/desktop/tests/e2e/playwright.config.ts docking.spec.ts"
      ]);
      assert.equal(output.text, "Building the test build and its variants for the UI workflows...\nprepared\n");
    });

    test("unchanged inputs and outputs rebuild nothing", async t => {
      const repository = await UiWorkflowsTests.createRepositoryAsync(t);
      await new UiWorkflows(repository.directory, new ProcessRunnerFixture(), new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      const exitCode = await new UiWorkflows(repository.directory, runner, output, new PreparedBinaryFixture()).runAsync([]);

      assert.equal(exitCode, 0);
      assert.deepEqual(UiWorkflowsTests.describeRuns(runner, repository.directory).map(t => t.split(" ")[0]), ["node_modules/typescript/bin/tsc", "node_modules/playwright/cli.js"]);
      assert.equal(output.text, "The builds of the UI workflows are current.\nprepared\n");
    });

    test("a changed source file or a missing or changed output rebuilds all three", async t => {
      const repository = await UiWorkflowsTests.createRepositoryAsync(t);
      await new UiWorkflows(repository.directory, new ProcessRunnerFixture(), new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);
      const changes: readonly [string, () => Promise<void>][] = [
        ["a source file", () => repository.writeAsync({ "src/shell/source.ts": "export const changed = 2;\n" })],
        ["a missing variant", () => rm(path.join(repository.directory, "_build", "variants", "without-clock"), { recursive: true })],
        ["a changed declaration", () => repository.writeAsync({ "_build/modules/declarations.json": "{\"modules\":[]}\n" })]
      ];

      for (const [reason, change] of changes) {
        await change();
        const runner = new ProcessRunnerFixture();
        const run = runner.runAsync.bind(runner);
        runner.runAsync = async (...runArguments) => {
          await UiWorkflowsTests.writeOutputsAsync(repository);
          return run(...runArguments);
        };

        await new UiWorkflows(repository.directory, runner, new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);

        assert.equal(runner.runs.length, 5, reason);
        const unchanged = new ProcessRunnerFixture();
        await new UiWorkflows(repository.directory, unchanged, new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);
        assert.equal(unchanged.runs.length, 2, reason);
      }
    });

    test("a failed build stops the builds, fails the command and records nothing", async t => {
      const repository = await UiWorkflowsTests.createRepositoryAsync(t);
      const runner = new ProcessRunnerFixture([0, 1]);

      const exitCode = await new UiWorkflows(repository.directory, runner, new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);
      const nextRunner = new ProcessRunnerFixture([null]);
      const nextExitCode = await new UiWorkflows(repository.directory, nextRunner, new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);

      assert.equal(exitCode, 1);
      assert.equal(runner.runs.length, 2);
      assert.equal(nextExitCode, 1);
      assert.equal(nextRunner.runs.length, 1);
    });

    test("a development app that cannot be prepared stops the command before the type check", async t => {
      const repository = await UiWorkflowsTests.createRepositoryAsync(t);
      const runner = new ProcessRunnerFixture();
      const failure = new DesktopException("The development binary is supported on Windows, macOS and Linux only.");

      await assert.rejects(new UiWorkflows(repository.directory, runner, new TextOutputFixture(), new PreparedBinaryFixture(failure)).runAsync([]), failure);
      assert.equal(runner.runs.length, 3);
    });

    test("a failed type check or UI run fails the command with its exit code", async t => {
      const repository = await UiWorkflowsTests.createRepositoryAsync(t);

      const typeCheck = await new UiWorkflows(repository.directory, new ProcessRunnerFixture([0, 0, 0, 2]), new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);
      const unknown = await new UiWorkflows(repository.directory, new ProcessRunnerFixture([null]), new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);
      const workflows = await new UiWorkflows(repository.directory, new ProcessRunnerFixture([0, 0]), new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);
      const killed = await new UiWorkflows(repository.directory, new ProcessRunnerFixture([0, null]), new TextOutputFixture(), new PreparedBinaryFixture()).runAsync([]);

      assert.equal(typeCheck, 2);
      assert.equal(unknown, 1);
      assert.equal(workflows, 0);
      assert.equal(killed, 1);
    });

    test("the command runs as a program and passes the UI run's exit code on", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ ".gitignore": "_build/\n" });
      await UiWorkflowsTests.writeOutputsAsync(repository);

      const result = spawnSync(process.execPath, [SourceTreeFixture.locateScript("ui-workflows.ts")], { cwd: repository.directory, encoding: "utf8", timeout: 60_000 });

      assert.notEqual(result.status, 0);
      assert.ok(result.stdout.startsWith("Building the test build and its variants for the UI workflows...\n"));
    });
  }

  private static describeRuns(runner: ProcessRunnerFixture, directory: string): readonly string[] {
    return runner.runs.map(t => t.slice(2).map((u, i) => i === 0 ? path.relative(directory, u).split(path.sep).join("/") : u).join(" "));
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({ ".gitignore": "_build/\n", "src/shell/source.ts": "export const changed = 1;\n" });
    await UiWorkflowsTests.writeOutputsAsync(repository);
    return repository;
  }

  private static writeOutputsAsync(repository: RepositoryFixture): Promise<void> {
    return repository.writeAsync({
      "_build/modules/declarations.json": "{\"modules\":[1]}\n",
      "_build/window/index.html": "<html></html>\n",
      "_build/variants/no-modules/window/index.html": "<html>none</html>\n",
      "_build/variants/without-clock/window/index.html": "<html>no clock</html>\n"
    });
  }
}

UiWorkflowsTests.register();
