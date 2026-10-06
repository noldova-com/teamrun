/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import PackageCatalog from "../../packages/package-catalog.ts";
import PackageManifest from "../../packages/package-manifest.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import ChangeClassifier from "../../workflows/change-classifier.ts";
import ChangeSelection from "../../workflows/change-selection.ts";
import ChangeSelector from "../../workflows/change-selector.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class ChangeClassifierTests {
  private static readonly MERGE_BASE: string = "1".repeat(40);
  private static readonly RELATIVE_IMPORT: RegExp = /(?:\bfrom |^import )"(\.{1,2}\/[^"]+)";$/gm;
  private static readonly SELECTION: ChangeSelection = ChangeSelection.everything("Not part of these cases.");
  private static readonly CORE_MANIFEST: string = "{\"name\": \"@noldova/teamrun-foundation-core\", \"version\": \"__VERSION__\"}\n";

  public static register(): void {
    test("pushes and events other than pull requests and merge groups verify everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      const documents = await repository.commitAsync({ "README.md": "# Changed\n" });

      const push = await classifier.classifyAsync("push", base, documents);
      assert.deepEqual([push.runCode, push.runUi, push.reason, push.selection.summary], [true, true, "A push to main verifies everything.", "Selection: everything. A push to main verifies everything."]);
      for (const eventName of ["workflow_dispatch", "schedule", undefined]) {
        const scope = await classifier.classifyAsync(eventName, base, documents);
        assert.deepEqual([scope.runCode, scope.runUi, scope.reason], [true, true, "Events other than pull requests and merge groups verify everything."]);
        assert.equal(scope.selection.summary, "Selection: everything. Events other than pull requests and merge groups verify everything.");
      }
    });

    test("a merge group compares its queued changes with the main it was built on", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const main = await repository.commitAsync({ "src/index.ts": "export {};\n" });
      repository.git(["switch", "--quiet", "--create", "gh-readonly-queue/main/pr-7"]);
      const documents = await repository.commitAsync({ "docs/guide.md": "# Guide\n" });
      const tooling = await repository.commitAsync({ ".github/workflows/check.yml": "name: Check\n" });

      const documentsScope = await classifier.classifyAsync("merge_group", main, documents);
      const toolingScope = await classifier.classifyAsync("merge_group", main, tooling);
      const unavailable = await classifier.classifyAsync("merge_group", main, undefined);

      assert.deepEqual([documentsScope.runCode, documentsScope.runUi, documentsScope.reason], [false, false, `Only Markdown documentation changed since the merge base ${main}.`]);
      assert.deepEqual([toolingScope.runCode, toolingScope.runUi, toolingScope.selection.summary], [true, false, "Selection: everything. A merge group always runs its level in full."]);
      assert.deepEqual([unavailable.runCode, unavailable.runUi, unavailable.reason], [true, true, "The revisions to compare are unavailable."]);
    });

    test("missing, malformed or unknown revisions verify everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      const unknown = "1".repeat(40);

      for (const [baseRevision, headRevision] of [[undefined, base], [base, undefined], ["", base], [base, "main"], [unknown, base], [base, unknown], ["0".repeat(40), base]]) {
        const scope = await classifier.classifyAsync("pull_request", baseRevision, headRevision);
        assert.deepEqual([scope.runCode, scope.runUi, scope.reason, scope.selection.isEverything], [true, true, "The revisions to compare are unavailable.", true]);
      }
    });

    test("pull requests compare with the merge base, so later changes on main do not count", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      repository.git(["switch", "--quiet", "--create", "change"]);
      const head = await repository.commitAsync({ "docs/guide.md": "# Guide\n" });
      repository.git(["switch", "--quiet", "main"]);
      const main = await repository.commitAsync({ "src/index.ts": "export {};\n" });

      const scope = await classifier.classifyAsync("pull_request", main, head);

      assert.deepEqual([scope.runCode, scope.runUi, scope.reason], [false, false, `Only Markdown documentation changed since the merge base ${base}.`]);
    });

    test("an empty comparison verifies everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);

      const scope = await classifier.classifyAsync("pull_request", base, base);

      assert.deepEqual([scope.runCode, scope.runUi, scope.reason], [true, true, "The comparison found no changed files."]);
      assert.equal(scope.selection.summary, "Selection: everything. The comparison found no changed files.");
    });

    test("only Markdown at the root, under docs or .github, or a module's README counts as documentation", () => {
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
      for (const [file, runCode] of cases)
        assert.equal(ChangeClassifier.classifyPaths([file], ChangeClassifierTests.MERGE_BASE, ChangeClassifierTests.SELECTION).runCode, runCode, file);
    });

    test("CI, test tooling and repository configuration outside the app run the builds and tests without the UI workflows", () => {
      const cases: readonly (readonly [string, boolean])[] = [
        [".github/workflows/watch-pull-requests.yml", false],
        [".github/workflows/build-and-test.yml", true],
        [".github/workflows/ui-workflows.yml", true],
        [".github/actions/prepare/action.yml", true],
        [".gitignore", false],
        [".gitattributes", true],
        ["scripts/api/declarations.ts", false],
        ["scripts/checks/notes.md", false],
        ["scripts/documents/links.ts", false],
        ["scripts/tests/fixtures/new.fixture.ts", false],
        ["scripts/workflows/new-rule.ts", false],
        ["scripts/packaging/package-stage.ts", false],
        ["scripts/package.ts", false],
        ["scripts/package-smoke.ts", false],
        ["scripts/release/release-publisher.ts", false],
        ["scripts/release-assets.ts", false],
        ["scripts/release-check.ts", false],
        ["scripts/release-publish.ts", false],
        ["scripts/repeat-plan.ts", false],
        ["scripts/classify-changes.ts", false],
        ["scripts/test.ts", false],
        ["scripts/ui-summary.ts", false],
        ["scripts/build.ts", true],
        ["scripts/ui-workflows.ts", true],
        ["scripts/packages/package-build.ts", true],
        ["scripts/tests.ts", true],
        ["src/shell/desktop/tests/e2e/new.spec.ts", true],
        ["package.json", true]
      ];
      for (const [file, runUi] of cases) {
        const scope = ChangeClassifier.classifyPaths([file, "docs/guide.md"], ChangeClassifierTests.MERGE_BASE, ChangeClassifierTests.SELECTION);

        assert.deepEqual([scope.runCode, scope.runUi], [true, runUi], file);
        assert.equal(scope.reason, runUi
          ? `Files the app is built or tested from changed since the merge base ${ChangeClassifierTests.MERGE_BASE}.`
          : `Only documentation, CI and test tooling or repository configuration changed since the merge base ${ChangeClassifierTests.MERGE_BASE}.`);
      }
    });

    test("the changed files of a pull request decide its scope", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      const cases: readonly (readonly [string, boolean])[] = [[".github/workflows/watch-pull-requests.yml", false], ["scripts/build.ts", true]];
      for (const [index, [file, runUi]] of cases.entries()) {
        repository.git(["switch", "--quiet", "--create", `case-${index}`, base]);
        const head = await repository.commitAsync({ [file]: "changed\n", "docs/guide.md": "# Guide\n" });

        const scope = await classifier.classifyAsync("pull_request", base, head);

        assert.deepEqual([scope.runCode, scope.runUi], [true, runUi], file);
      }
    });

    test("a pull request's selection follows its changed packages, and packages that cannot be read select everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = await repository.commitAsync({ "src/foundation/core/package.json": ChangeClassifierTests.CORE_MANIFEST });
      repository.git(["switch", "--quiet", "--create", "change"]);
      const head = await repository.commitAsync({ "src/foundation/core/tests/notes.test.ts": "export {};\n", "docs/guide.md": "# Guide\n" });
      repository.git(["switch", "--quiet", "--create", "unreadable", base]);
      const unreadable = await repository.commitAsync({ "src/foundation/text/package.json": "{\n", "docs/guide.md": "# Guide\n" });
      repository.git(["switch", "--quiet", "change"]);

      const scope = await classifier.classifyAsync("pull_request", base, head);
      repository.git(["switch", "--quiet", "unreadable"]);
      const failed = await classifier.classifyAsync("pull_request", base, unreadable);

      assert.equal(scope.selection.summary, "Selection: every check other than the tests, the package tests of @noldova/teamrun-foundation-core, and no UI workflow.");
      assert.equal(failed.selection.summary, "Selection: everything. The packages could not be read: src/foundation/text/package.json could not be read as JSON.");
    });

    test("a failure other than unreadable packages reaches the caller instead of selecting everything", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const catalog = new PackageCatalog(repository.directory);
      const failure = new RangeError("The packages could not be listed.");
      t.mock.method(catalog, "listPackagesAsync", () => Promise.reject(failure));
      const classifier = new ChangeClassifier(new Git(repository.directory, new ProcessRunner()), catalog);
      const base = ChangeClassifierTests.readHead(repository);
      const head = await repository.commitAsync({ "src/notes.ts": "export {};\n" });

      await assert.rejects(classifier.classifyAsync("pull_request", base, head), failure);
    });

    test("documentation leaves the selection, and tooling outside the app selects the script tests", () => {
      const selector = new ChangeSelector([new PackageManifest("src/foundation/core", "@noldova/teamrun-foundation-core", [])]);

      const documents = ChangeClassifier.selectPaths(["docs/guide.md", "README.md"], selector);
      const tooling = ChangeClassifier.selectPaths([".github/workflows/watch-pull-requests.yml", "scripts/release/release-publisher.ts", "docs/guide.md"], selector);
      const app = ChangeClassifier.selectPaths(["src/foundation/core/src/index.ts", "docs/guide.md"], selector);

      assert.equal(documents.summary, "Selection: every check other than the tests, no tests, and no UI workflow.");
      assert.equal(tooling.summary, "Selection: every check other than the tests, the script tests, and no UI workflow.");
      assert.equal(app.summary, "Selection: every check other than the tests, the package tests of @noldova/teamrun-foundation-core and the Angular tests, and every UI workflow.");
    });

    test("every script that builds or runs the UI workflows counts as affecting them", async () => {
      const closure = await ChangeClassifierTests.listImportClosureAsync(["scripts/build.ts", "scripts/ui-workflows.ts"]);

      assert.ok(closure.includes("scripts/packages/package-build.ts"), closure.join("\n"));
      assert.deepEqual(closure.filter(t => !ChangeClassifier.affectsUiWorkflows(t)), []);
    });

    test("a rename counts both its old and its new path", async t => {
      const repository = await ChangeClassifierTests.createRepositoryAsync(t);
      const classifier = ChangeClassifierTests.createClassifier(repository);
      const base = ChangeClassifierTests.readHead(repository);
      await repository.writeAsync({ "docs/notes.md": "export const notes = \"A long enough text for rename detection.\";\n" });
      await rm(path.join(repository.directory, "src", "notes.ts"));
      const head = await repository.commitAsync({});

      const scope = await classifier.classifyAsync("pull_request", base, head);

      assert.deepEqual([scope.runCode, scope.runUi], [true, true]);
    });
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.commitAsync({ "README.md": "# TeamRun\n", "src/notes.ts": "export const notes = \"A long enough text for rename detection.\";\n" });
    return repository;
  }

  private static createClassifier(repository: RepositoryFixture): ChangeClassifier {
    return new ChangeClassifier(new Git(repository.directory, new ProcessRunner()), new PackageCatalog(repository.directory));
  }

  private static readHead(repository: RepositoryFixture): string {
    return repository.git(["rev-parse", "HEAD"]).trim();
  }

  private static async listImportClosureAsync(entries: readonly string[]): Promise<readonly string[]> {
    const found = new Set<string>(entries);
    const pending = [...entries];
    for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
      const text = await readFile(path.join(SourceTreeFixture.root, file), "utf8");
      for (const match of text.matchAll(ChangeClassifierTests.RELATIVE_IMPORT)) {
        const imported = path.posix.join(path.posix.dirname(file), match[1] ?? "");
        if (!found.has(imported)) {
          found.add(imported);
          pending.push(imported);
        }
      }
    }
    return [...found].sort();
  }
}

ChangeClassifierTests.register();
