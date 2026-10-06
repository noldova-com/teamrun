/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ProcessRunner from "../processes/process-runner.ts";
import RepeatPlan from "../repeat-plan.ts";
import Git from "../repository/git.ts";
import RepositoryFiles from "../repository/repository-files.ts";
import RepeatMatrix from "../workflows/repeat-matrix.ts";
import type RepeatSelection from "../workflows/repeat-selection.ts";
import RepeatSelector from "../workflows/repeat-selector.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class BrokenSelectorFixture extends RepeatSelector {
  public override selectAsync(): Promise<RepeatSelection> {
    return Promise.reject(new TypeError("the selector broke"));
  }
}

class RepeatPlanTests {
  private static readonly BASE: Readonly<Record<string, string>> = {
    "scripts/desktop/electron-binary.ts": "export {};\n",
    "scripts/tests/desktop/electron-binary.test.ts": "export {};\n",
    "src/shell/desktop/tests/e2e/quit.spec.ts": "export {};\n",
    "docs/guide.md": "# Guide\n"
  };

  public static register(): void {
    test("the selected files and every repeat job go to the step output, and the selection to the summary and the log", async t => {
      const repository = await RepeatPlanTests.createAsync(t);
      const base = await repository.commitAsync(RepeatPlanTests.BASE);
      const head = await repository.commitAsync({ "scripts/desktop/electron-binary.ts": "export const changed = true;\n" });
      const log = new TextOutputFixture();
      const body = "Agent: C1 (developer)\n\nRepeat: src/shell/desktop/tests/e2e/quit.spec.ts\n";

      const outputs = await RepeatPlanTests.runAsync(repository, log, { BASE_SHA: base, HEAD_SHA: head, PR_BODY: body }, 0);

      const summary = "Repeated test files:\n- scripts/tests/desktop/electron-binary.test.ts\nRepeated UI workflow files:\n- src/shell/desktop/tests/e2e/quit.spec.ts\n";
      assert.deepEqual(outputs, [
        `legs=${JSON.stringify(RepeatMatrix.plan(0))}`,
        "test-arguments=--filter scripts/tests/desktop/electron-binary.test.ts",
        "workflow-arguments=src/shell/desktop/tests/e2e/quit.spec.ts",
        ""
      ]);
      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"), summary);
      assert.equal(log.text, summary);
    });

    test("the selected UI workflows' test count decides the macOS jobs, one up to the 40-minute boundary and two past it", async t => {
      const repository = await RepeatPlanTests.createAsync(t);
      const base = await repository.commitAsync(RepeatPlanTests.BASE);
      const serialLegs = (outputs: readonly string[]): readonly string[] =>
        (JSON.parse(outputs[0]?.slice("legs=".length) ?? "") as readonly { readonly name: string; readonly runner: string }[]).filter(t => t.runner === "macos-15").map(t => t.name);

      const fits = await repository.commitAsync({ "src/shell/desktop/tests/e2e/quit.spec.ts": "test(\"quits\", async () => {});\n".repeat(133) });
      const one = await RepeatPlanTests.runAsync(repository, new TextOutputFixture(), { BASE_SHA: base, HEAD_SHA: fits }, 0);
      const overflows = await repository.commitAsync({ "src/shell/desktop/tests/e2e/quit.spec.ts": "test(\"quits\", async () => {});\n".repeat(134) });
      const two = await RepeatPlanTests.runAsync(repository, new TextOutputFixture(), { BASE_SHA: base, HEAD_SHA: overflows }, 0);

      assert.deepEqual(serialLegs(one), ["macOS ARM64, 5 passes"]);
      assert.deepEqual(serialLegs(two), ["macOS ARM64, 5 passes, shard 1 of 2", "macOS ARM64, 5 passes, shard 2 of 2"]);
    });

    test("a change that affects no test plans no job", async t => {
      const repository = await RepeatPlanTests.createAsync(t);
      const base = await repository.commitAsync(RepeatPlanTests.BASE);
      const head = await repository.commitAsync({ "docs/guide.md": "# Guide, changed\n" });
      const log = new TextOutputFixture();

      const outputs = await RepeatPlanTests.runAsync(repository, log, { BASE_SHA: base, HEAD_SHA: head }, 0);

      assert.deepEqual(outputs, ["legs=[]", "test-arguments=", "workflow-arguments=", ""]);
      assert.equal(log.text, "No test or UI workflow file is affected by the change, so nothing is repeated.\n");
    });

    test("missing outputs, missing revisions, an unknown Repeat file and a path with whitespace fail with the reason and plan nothing", async t => {
      const repository = await RepeatPlanTests.createAsync(t);
      const base = await repository.commitAsync(RepeatPlanTests.BASE);
      const head = await repository.commitAsync({ "scripts/tests/desktop/new case.test.ts": "export {};\n" });
      const plan = (log: TextOutputFixture): RepeatPlan => RepeatPlanTests.createPlan(repository, log);
      const outputs = new TextOutputFixture();
      const revisions = new TextOutputFixture();
      const missing = new TextOutputFixture();
      const unknown = new TextOutputFixture();
      const spaced = new TextOutputFixture();

      assert.equal(await plan(outputs).runAsync({ BASE_SHA: base, HEAD_SHA: head }), 1);
      assert.deepEqual(await RepeatPlanTests.runAsync(repository, revisions, {}, 1), [""]);
      assert.deepEqual(await RepeatPlanTests.runAsync(repository, revisions, { BASE_SHA: "main", HEAD_SHA: head }, 1), [""]);
      assert.deepEqual(await RepeatPlanTests.runAsync(repository, missing, { BASE_SHA: base, HEAD_SHA: "0".repeat(40) }, 1), [""]);
      assert.deepEqual(await RepeatPlanTests.runAsync(repository, unknown, { BASE_SHA: base, HEAD_SHA: head, PR_BODY: "Repeat: quit.spec.ts, docs/guide.md\n" }, 1), [""]);
      assert.deepEqual(await RepeatPlanTests.runAsync(repository, spaced, { BASE_SHA: base, HEAD_SHA: head }, 1), [""]);

      const revisionsRequired = "BASE_SHA and HEAD_SHA must name the pull request's base and head commits.\n";
      assert.deepEqual([outputs.text, revisions.text, missing.text, unknown.text, spaced.text], [
        "GITHUB_OUTPUT and GITHUB_STEP_SUMMARY must name the step's output and summary files.\n",
        revisionsRequired.repeat(2),
        revisionsRequired,
        "The Repeat line names files that are not test or UI workflow files of this revision: quit.spec.ts, docs/guide.md. It names files by their path from the repository's root.\n",
        "The repeats pass file paths as words, so a path with whitespace can't be repeated: scripts/tests/desktop/new case.test.ts.\n"
      ]);
    });

    test("the command plans the working directory's repository from its environment and terminates", async t => {
      const repository = await RepeatPlanTests.createAsync(t);
      const base = await repository.commitAsync(RepeatPlanTests.BASE);
      const head = await repository.commitAsync({ "scripts/tests/desktop/electron-binary.test.ts": "export const changed = true;\n" });
      const outputPath = path.join(repository.directory, "output.txt");
      const environment = { ...process.env, GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), BASE_SHA: base, HEAD_SHA: head };

      const planned = spawnSync(process.execPath, [SourceTreeFixture.locateScript("repeat-plan.ts")], { cwd: repository.directory, env: environment, encoding: "utf8", timeout: 10_000 });

      assert.equal(planned.status, 0, planned.stderr);
      assert.equal(planned.stdout, "Repeated test files:\n- scripts/tests/desktop/electron-binary.test.ts\n");
      assert.ok((await readFile(outputPath, "utf8")).includes("test-arguments=--filter scripts/tests/desktop/electron-binary.test.ts\n"));
    });

    test("an unexpected selection error reaches the caller", async t => {
      const repository = await RepeatPlanTests.createAsync(t);
      const base = await repository.commitAsync(RepeatPlanTests.BASE);
      const git = new Git(repository.directory, new ProcessRunner());
      const plan = new RepeatPlan(git, new BrokenSelectorFixture(repository.directory, new RepositoryFiles(repository.directory, git)), new TextOutputFixture());
      const environment = { GITHUB_OUTPUT: path.join(repository.directory, "output.txt"), GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), BASE_SHA: base, HEAD_SHA: base };

      await assert.rejects(plan.runAsync(environment), new TypeError("the selector broke"));
    });
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository;
  }

  private static createPlan(repository: RepositoryFixture, log: TextOutputFixture): RepeatPlan {
    const git = new Git(repository.directory, new ProcessRunner());
    return new RepeatPlan(git, new RepeatSelector(repository.directory, new RepositoryFiles(repository.directory, git)), log);
  }

  private static async runAsync(repository: RepositoryFixture, log: TextOutputFixture, environment: NodeJS.ProcessEnv, exitCode: number): Promise<readonly string[]> {
    const outputPath = path.join(repository.directory, "_build", "output.txt");
    const summaryPath = path.join(repository.directory, "summary.md");
    await repository.writeAsync({ "_build/output.txt": "" });

    assert.equal(await RepeatPlanTests.createPlan(repository, log).runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath, ...environment }), exitCode, log.text);
    return (await readFile(outputPath, "utf8")).split("\n");
  }
}

RepeatPlanTests.register();
