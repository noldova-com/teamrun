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
      const environment = { GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath, EVENT_NAME: "push", BASE_SHA: base, HEAD_SHA: head };

      assert.equal(await classify.runAsync(environment), 0);
      assert.equal(await classify.runAsync({ GITHUB_OUTPUT: outputPath, GITHUB_STEP_SUMMARY: summaryPath }), 0);

      assert.equal(await readFile(outputPath, "utf8"), "run-code=false\nrun-code=true\n");
      const skipped = `Code builds and tests are not required; the document checks still run. Only Markdown documentation changed since the previous revision ${base}.`;
      const full = "Full build and test verification selected. Events other than pull requests, merge groups and pushes verify everything.";
      assert.equal(await readFile(summaryPath, "utf8"), `${skipped}\n${full}\n`);
      assert.equal(log.text, `${skipped}\n${full}\n`);
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
      const head = await repository.commitAsync({ "src/index.ts": "export {};\n" });
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
      assert.equal(await readFile(environment.GITHUB_OUTPUT, "utf8"), "run-code=true\n");
      assert.equal(refused.status, 1);
    });
  }
}

ClassifyChangesTests.register();
