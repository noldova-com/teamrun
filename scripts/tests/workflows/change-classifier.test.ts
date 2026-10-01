/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import ChangeClassifier from "../../workflows/change-classifier.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class ChangeClassifierTests {
  public static register(): void {
    test("events other than pull requests, merge groups and pushes verify everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);

      for (const eventName of ["workflow_dispatch", "schedule", undefined]) {
        const scope = await classifier.classifyAsync(eventName, base, base);
        assert.equal(scope.runCode, true);
        assert.equal(scope.reason, "Events other than pull requests, merge groups and pushes verify everything.");
      }
    });

    test("missing, malformed or unknown revisions verify everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      const unknown = "1".repeat(40);

      for (const [baseRevision, headRevision] of [[undefined, base], [base, undefined], ["", base], [base, "main"], [unknown, base], [base, unknown], ["0".repeat(40), base]]) {
        const scope = await classifier.classifyAsync("push", baseRevision, headRevision);
        assert.equal(scope.runCode, true);
        assert.equal(scope.reason, "The revisions to compare are unavailable.");
      }
    });

    test("pull requests and merge groups compare with the merge base, so later changes on main do not count", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      repository.git(["switch", "--quiet", "--create", "change"]);
      const head = await repository.commitAsync({ "docs/guide.md": "# Guide\n" });
      repository.git(["switch", "--quiet", "main"]);
      const main = await repository.commitAsync({ "src/index.ts": "export {};\n" });

      for (const eventName of ["pull_request", "merge_group"]) {
        const scope = await classifier.classifyAsync(eventName, main, head);
        assert.equal(scope.runCode, false);
        assert.equal(scope.reason, `Only Markdown documentation changed since the merge base ${base}.`);
      }
    });

    test("pushes compare with the previous revision", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      const code = await repository.commitAsync({ "src/index.ts": "export {};\n" });
      const documents = await repository.commitAsync({ "README.md": "# Changed\n" });

      assert.equal((await classifier.classifyAsync("push", code, documents)).runCode, false);
      const both = await classifier.classifyAsync("push", base, documents);
      assert.equal(both.runCode, true);
      assert.equal(both.reason, `Files other than Markdown documentation changed since the previous revision ${base}.`);
    });

    test("an empty comparison verifies everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);

      const scope = await classifier.classifyAsync("push", base, base);

      assert.equal(scope.runCode, true);
      assert.equal(scope.reason, "The comparison found no changed files.");
    });

    test("only Markdown at the root, under docs or .github, or a module's README counts as documentation", async t => {
      const cases: readonly (readonly [string, boolean])[] = [
        ["CHANGELOG.md", false],
        ["docs/deep/guide.md", false],
        [".github/CONTRIBUTING.md", false],
        ["src/modules/terminal/README.md", false],
        ["src/modules/terminal/runtime/README.md", true],
        ["src/README.md", true],
        ["notes/guide.md", true],
        ["docs/diagram.svg", true],
        [".github/workflows/build-and-test.yml", true],
        ["README.txt", true]
      ];
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      for (const [index, [file, runCode]] of cases.entries()) {
        repository.git(["switch", "--quiet", "--create", `case-${index}`, base]);
        const head = await repository.commitAsync({ [file]: "changed\n" });

        assert.equal((await classifier.classifyAsync("pull_request", base, head)).runCode, runCode, file);
      }
    });

    test("a rename counts both its old and its new path", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      await repository.writeAsync({ "docs/notes.md": "export const notes = \"A long enough text for rename detection.\";\n" });
      await rm(path.join(repository.directory, "src", "notes.ts"));
      const head = await repository.commitAsync({});

      assert.equal((await classifier.classifyAsync("pull_request", base, head)).runCode, true);
    });
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.commitAsync({ "README.md": "# TeamRun\n", "src/notes.ts": "export const notes = \"A long enough text for rename detection.\";\n" });
    return repository;
  }

  private static createClassifier(repository: RepositoryFixture): ChangeClassifier {
    return new ChangeClassifier(new Git(repository.directory, new ProcessRunner()));
  }

  private static readHead(repository: RepositoryFixture): string {
    return repository.git(["rev-parse", "HEAD"]).trim();
  }
}

ChangeClassifierTests.register();
