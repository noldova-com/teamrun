/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClaudeInstructions, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ClaudeInstructionsTests {
  @TestMethod
  public readsTheManagedFileThenThePersonsThenTheProjectsFromTheRepositoryRootDownInClaudeCodesOrder(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    const files = ClaudeInstructionsTests.write(directory, [
      ["config/CLAUDE.md", "user"], ["config/rules/style.md", "user-rule"], ["CLAUDE.md", "above-root"], ["managed/CLAUDE.md", "managed"],
      ["repo/AGENTS.md", "root-agents"], ["repo/.claude/rules/build.md", "root-rule"], ["repo/CLAUDE.local.md", "root-local"],
      ["repo/.claude/CLAUDE.md", "root-dot"], ["repo/CLAUDE.md", "root"], ["repo/sub/.claude/rules/tests.md", "cwd-rule"], ["repo/sub/CLAUDE.md", "cwd"],
      ["repo/sub/.claude/rules/scoped.md", "---\npaths: src/**\n---\ncwd-scoped"], ["repo/other/CLAUDE.md", "sibling"]
    ]);

    const result = ClaudeInstructionsTests.read(directory, ["repo", "sub"], directory.resolve("managed", "CLAUDE.md"));

    Assert.areEqual(ClaudeInstructionsTests.expected(files, ["managed", "user", "user-rule", "root", "root-dot", "root-rule", "root-local", "cwd", "cwd-rule"]), result);
  }

  @TestMethod
  public readsAgentsMdAndItsDotClaudeCopyOnlyWhenNoClaudeMdExistsInTheProject(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    mkdirSync(directory.resolve("local", ".git"), { recursive: true });
    mkdirSync(directory.resolve("unreadable", ".git"), { recursive: true });
    mkdirSync(directory.resolve("unreadable", "CLAUDE.md"), { recursive: true });
    const files = ClaudeInstructionsTests.write(directory, [
      ["config/CLAUDE.md", "user"], ["repo/AGENTS.md", "root-agents"], ["repo/.claude/AGENTS.md", "root-dot-agents"],
      ["repo/.claude/rules/build.md", "root-rule"], ["repo/sub/AGENTS.md", "cwd-agents"],
      ["local/AGENTS.md", "local-agents"], ["local/sub/CLAUDE.local.md", "local-only"], ["unreadable/AGENTS.md", "unreadable-agents"]
    ]);

    const agents = ClaudeInstructionsTests.read(directory, ["repo", "sub"]);
    const local = ClaudeInstructionsTests.read(directory, ["local", "sub"]);
    const unreadable = ClaudeInstructionsTests.read(directory, ["unreadable"]);

    Assert.areEqual(ClaudeInstructionsTests.expected(files, ["user", "root-rule", "root-agents", "root-dot-agents", "cwd-agents"]), agents);
    Assert.areEqual(ClaudeInstructionsTests.expected(files, ["user", "local-only"]), local);
    Assert.areEqual(ClaudeInstructionsTests.expected(files, ["user"]), unreadable);
  }

  @TestMethod
  public followsImportsAnywhereInALineButNotInCodeOrQuotes(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    const project = [
      "See @docs/a.md and `@docs/code.md` too, or me@docs/mail.md.", "@docs/with\\ space.md", "\"@docs/quoted.md\" and @\"docs/quoted.md\"",
      "```md", "@docs/fenced.md", "```", "~~~", "@docs/tilde.md", "~~~", "@~/home-project.md", "@../outside.md", "@docs/missing.md"
    ].join("\n");
    const user = `user\n@~/home-user.md\n@${directory.resolve("absolute.md")}`;
    const files = ClaudeInstructionsTests.write(directory, [
      ["config/CLAUDE.md", user], ["home/home-user.md", "home-user"], ["home/home-project.md", "home-project"], ["absolute.md", "absolute"],
      ["repo/CLAUDE.md", project], ["repo/docs/a.md", "a"], ["repo/docs/with space.md", "spaced"], ["repo/docs/code.md", "code"],
      ["repo/docs/mail.md", "mail"], ["repo/docs/quoted.md", "quoted"], ["repo/docs/fenced.md", "fenced"], ["repo/docs/tilde.md", "tilde"],
      ["outside.md", "outside"]
    ]);

    const result = ClaudeInstructionsTests.read(directory, ["repo"]);

    Assert.areEqual(ClaudeInstructionsTests.expected(files, [user, "home-user", "absolute", project, "a", "spaced"]), result);
  }

  @TestMethod
  public leavesALocalFilesImportFromTheHomeFolderAsTextSinceClaudeCodeAsksBeforeReadingIt(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    const files = ClaudeInstructionsTests.write(directory, [
      ["repo/CLAUDE.local.md", "local\n@~/.claude/my-project-instructions.md"], ["home/.claude/my-project-instructions.md", "home-instructions"]
    ]);

    const result = ClaudeInstructionsTests.read(directory, ["repo"]);

    Assert.areEqual(ClaudeInstructionsTests.expected(files, ["local\n@~/.claude/my-project-instructions.md"]), result);
  }

  @TestMethod
  public followsImportsFourDeepAndReadsEachFileOnce(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    const files = ClaudeInstructionsTests.write(directory, [
      ["repo/CLAUDE.md", "top\n@a/one.md\n@a/one.md"], ["repo/a/one.md", "one\n@b/two.md"], ["repo/a/b/two.md", "two\n@c/three.md\n@../../CLAUDE.md"],
      ["repo/a/b/c/three.md", "three\n@d/four.md"], ["repo/a/b/c/d/four.md", "four\n@five.md"], ["repo/a/b/c/d/five.md", "five"]
    ]);

    const result = ClaudeInstructionsTests.read(directory, ["repo"]);

    Assert.areEqual(ClaudeInstructionsTests.expected(files, ["top\n@a/one.md\n@a/one.md", "one\n@b/two.md", "two\n@c/three.md\n@../../CLAUDE.md",
      "three\n@d/four.md", "four\n@five.md"]), result);
  }

  @TestMethod
  public leavesOutBlockLevelCommentsOutsideCodeAndTheirImports(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    const content = ["<!-- a note", "@hidden.md -->", "kept", "  <!-- one line --> after", "```", "<!-- in a fence -->", "```", "inline <!-- stays -->"].join("\n");
    const files = ClaudeInstructionsTests.write(directory, [["repo/CLAUDE.md", content], ["repo/hidden.md", "hidden"]]);

    const result = ClaudeInstructionsTests.read(directory, ["repo"]);

    Assert.areEqual(Resources.formatPersonInstructions(Resources.formatInstructionFile(files.get(content)!,
      ["kept", " after", "```", "<!-- in a fence -->", "```", "inline <!-- stays -->"].join("\n"))), result);
  }

  @TestMethod
  public namesTheFilesLeftOutPastTheTotalLength(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    const files = ClaudeInstructionsTests.write(directory, [
      ["config/CLAUDE.md", "u".repeat(65_536)], ["repo/CLAUDE.md", "r".repeat(65_536)], ["repo/sub/CLAUDE.md", "last"]
    ]);

    const result = ClaudeInstructionsTests.read(directory, ["repo", "sub"]);

    Assert.areEqual(Resources.formatPersonInstructions([Resources.formatInstructionFile(files.get("u".repeat(65_536))!, "u".repeat(65_536)),
      Resources.formatInstructionFile(files.get("r".repeat(65_536))!, "r".repeat(65_536)), Resources.formatInstructionsLeftOut([files.get("last")!])].join("\n\n")), result);
  }

  @TestMethod
  public findsTheManagedFileForEachPlatform(): void {
    Assert.areEqual("/Library/Application Support/ClaudeCode/CLAUDE.md", ClaudeInstructions.managedFile("darwin"));
    Assert.areEqual("/etc/claude-code/CLAUDE.md", ClaudeInstructions.managedFile("linux"));
    Assert.areEqual("C:\\Program Files\\ClaudeCode\\CLAUDE.md", ClaudeInstructions.managedFile("win32"));
    Assert.areEqual("/etc/claude-code/CLAUDE.md", ClaudeInstructions.managedFile("freebsd"));
  }

  @TestMethod
  public readsNothingWhenThereIsNoInstructionFile(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("project"));

    Assert.isNull(ClaudeInstructionsTests.read(directory, ["project"], directory.resolve("managed", "CLAUDE.md")));
  }

  private static read(directory: TemporaryDirectory, workingDirectory: readonly string[], managedFile: string | null = null): string | null {
    return ClaudeInstructions.read(directory.resolve(...workingDirectory), directory.resolve("config"), managedFile, directory.resolve("home"));
  }

  private static write(directory: TemporaryDirectory, files: readonly (readonly [string, string])[]): ReadonlyMap<string, string> {
    for (const [path, text] of files) {
      mkdirSync(dirname(directory.resolve(...path.split("/"))), { recursive: true });
      writeFileSync(directory.resolve(...path.split("/")), text);
    }
    return new Map(files.map(([path, text]) => [text, directory.resolve(...path.split("/"))]));
  }

  private static expected(files: ReadonlyMap<string, string>, texts: readonly string[]): string {
    return Resources.formatPersonInstructions(texts.map(t => Resources.formatInstructionFile(files.get(t)!, t)).join("\n\n"));
  }
}
