/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, mkdirSync, readdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstructionFile, PersonInstructions } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class PersonInstructionsTests {
  @TestMethod
  public readsAFileAsItIsAndNoneThroughALinkOutsideTheBoundary(): void {
    using directory = new TemporaryDirectory();
    const project = directory.resolve("project");
    mkdirSync(project);
    mkdirSync(directory.resolve("outside"));
    writeFileSync(directory.resolve("outside", "instructions.md"), "external-only-fixture-text");
    symlinkSync(directory.resolve("outside"), directory.resolve("project", "linked"), process.platform === "win32" ? "junction" : "dir");
    writeFileSync(directory.resolve("project", "CLAUDE.md"), "own\n@linked/instructions.md");

    Assert.areEqual("own\n@linked/instructions.md", PersonInstructions.read(directory.resolve("project", "CLAUDE.md"), project)?.content);
    Assert.isNull(PersonInstructions.read(directory.resolve("project", "linked", "instructions.md"), project));
    Assert.areEqual("external-only-fixture-text", PersonInstructions.read(directory.resolve("project", "linked", "instructions.md"), null)?.content);
  }

  @TestMethod
  public readsInternalLinksWhenTheProjectItselfIsOpenedThroughAnAlias(): void {
    using directory = new TemporaryDirectory();
    const nested = directory.resolve("project", "nested");
    const alias = directory.resolve("alias");
    mkdirSync(nested, { recursive: true });
    writeFileSync(directory.resolve("project", "nested", "instructions.md"), "internal-fixture-instructions");
    symlinkSync(nested, directory.resolve("project", "linked"), process.platform === "win32" ? "junction" : "dir");
    symlinkSync(directory.resolve("project"), alias, process.platform === "win32" ? "junction" : "dir");

    const result = PersonInstructions.read(directory.resolve("alias", "linked", "instructions.md"), alias);

    Assert.areEqual("internal-fixture-instructions", result?.content);
    Assert.areEqual(directory.resolve("alias", "linked", "instructions.md"), result?.path);
  }

  @TestMethod
  public capsEachFileAndReadsNoneThatIsMissing(): void {
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve("CLAUDE.md"), "x".repeat(70_000));

    Assert.areEqual(65_536, PersonInstructions.read(directory.resolve("CLAUDE.md"), directory.path)?.content.length);
    Assert.isNull(PersonInstructions.read(directory.resolve("nowhere.md"), directory.path));
    Assert.isNull(PersonInstructions.read(directory.path, directory.path));
  }

  @TestMethod
  public listsMarkdownFilesSortedWithSubfoldersOnlyWhenRecursive(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("rules", "team", "folder.md"), { recursive: true });
    writeFileSync(directory.resolve("rules", "b.md"), "rule-b");
    writeFileSync(directory.resolve("rules", "a.md"), "rule-a");
    writeFileSync(directory.resolve("rules", "team", "c.md"), "rule-c");
    writeFileSync(directory.resolve("rules", "notes.txt"), "not-a-rule");

    const all = PersonInstructions.markdownFiles(directory.resolve("rules"), directory.path, true);
    const top = PersonInstructions.markdownFiles(directory.resolve("rules"), directory.path, false);

    Assert.areEqual("a.md b.md team/c.md", PersonInstructionsTests.names(directory.resolve("rules"), all));
    Assert.areEqual("a.md b.md", PersonInstructionsTests.names(directory.resolve("rules"), top));
    Assert.areEqual(0, PersonInstructions.markdownFiles(directory.resolve("none"), directory.path, true).length);
  }

  @TestMethod
  public skipsASubfolderItCannotReadAndListsTheRest(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("rules", "locked"), { recursive: true });
    writeFileSync(directory.resolve("rules", "a.md"), "rule-a");
    writeFileSync(directory.resolve("rules", "locked", "b.md"), "rule-b");
    writeFileSync(directory.resolve("rules", "z.md"), "rule-z");
    mkdirSync(directory.resolve("moved"));
    symlinkSync(directory.resolve("moved"), directory.resolve("rules", "gone"), process.platform === "win32" ? "junction" : "dir");
    renameSync(directory.resolve("moved"), directory.resolve("elsewhere"));
    chmodSync(directory.resolve("rules", "locked"), 0);

    const readable = PersonInstructionsTests.isReadable(directory.resolve("rules", "locked"));
    const files = PersonInstructions.markdownFiles(directory.resolve("rules"), directory.path, true);
    chmodSync(directory.resolve("rules", "locked"), 0o700);

    Assert.areEqual(readable ? "a.md locked/b.md z.md" : "a.md z.md", PersonInstructionsTests.names(directory.resolve("rules"), files));
  }

  @TestMethod
  public followsALinkedFolderInsideTheBoundaryAndThePersonsAnywhere(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", "rules"), { recursive: true });
    mkdirSync(directory.resolve("repo", "shared"));
    mkdirSync(directory.resolve("outside"));
    writeFileSync(directory.resolve("repo", "shared", "inside.md"), "inside");
    writeFileSync(directory.resolve("outside", "outside.md"), "outside");
    symlinkSync(directory.resolve("repo", "shared"), directory.resolve("repo", "rules", "in"), process.platform === "win32" ? "junction" : "dir");
    symlinkSync(directory.resolve("outside"), directory.resolve("repo", "rules", "out"), process.platform === "win32" ? "junction" : "dir");

    const bounded = PersonInstructions.markdownFiles(directory.resolve("repo", "rules"), directory.resolve("repo"), true);
    const own = PersonInstructions.markdownFiles(directory.resolve("repo", "rules"), null, true);

    Assert.areEqual("in/inside.md", PersonInstructionsTests.names(directory.resolve("repo", "rules"), bounded));
    Assert.areEqual("in/inside.md out/outside.md", PersonInstructionsTests.names(directory.resolve("repo", "rules"), own));
  }

  @TestMethod
  public readsEachFolderOnceWhenALinkMakesACycle(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("rules", "team"), { recursive: true });
    writeFileSync(directory.resolve("rules", "a.md"), "rule-a");
    writeFileSync(directory.resolve("rules", "team", "b.md"), "rule-b");
    symlinkSync(directory.resolve("rules"), directory.resolve("rules", "team", "loop"), process.platform === "win32" ? "junction" : "dir");

    Assert.areEqual("a.md team/b.md", PersonInstructionsTests.names(directory.resolve("rules"), PersonInstructions.markdownFiles(directory.resolve("rules"), null, true)));
  }

  @TestMethod
  public keepsTheFilesBeforeTheFirstThatPassesTheTotal(): void {
    const files = [new InstructionFile("a", "aaa"), new InstructionFile("b", "bbb"), new InstructionFile("c", "c")];

    Assert.areEqual("a b", PersonInstructions.fit(files, 6).map(t => t.path).join(" "));
    Assert.areEqual("a", PersonInstructions.fit(files, 5).map(t => t.path).join(" "));
    Assert.areEqual("a b c", PersonInstructions.fit(files, 7).map(t => t.path).join(" "));
    Assert.areEqual(0, PersonInstructions.fit(files, 2).length);
  }

  @TestMethod
  public findsTheRepositoryRootAndListsItsFoldersDownToTheWorkingDirectory(): void {
    using directory = new TemporaryDirectory();
    mkdirSync(directory.resolve("repo", ".git"), { recursive: true });
    mkdirSync(directory.resolve("repo", "a", "b"), { recursive: true });
    mkdirSync(directory.resolve("plain"));

    Assert.areEqual(directory.resolve("repo"), PersonInstructions.repositoryRoot(directory.resolve("repo", "a", "b")));
    Assert.areEqual([directory.resolve("repo"), directory.resolve("repo", "a"), directory.resolve("repo", "a", "b")].join("|"),
      PersonInstructions.foldersOf(directory.resolve("repo", "a", "b")).join("|"));
    Assert.areEqual(directory.resolve("repo"), PersonInstructions.foldersOf(directory.resolve("repo")).join("|"));
    Assert.areEqual(directory.resolve("plain"), PersonInstructions.foldersOf(directory.resolve("plain")).join("|"));
  }

  private static names(folder: string, paths: readonly string[]): string {
    return paths.map(t => t.slice(folder.length + 1).replaceAll("\\", "/")).join(" ");
  }

  private static isReadable(folder: string): boolean {
    try {
      readdirSync(folder);
      return true;
    }
    catch {
      return false;
    }
  }
}
