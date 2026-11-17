/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandWrites, Resources, type ReplyEvidence } from "@noldova/teamrun.core";

import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class CommandWritesTests {
  @TestMethod
  public readsAStepsTargetsAgainstTheFolderItRanIn(): void {
    const root = join(homedir(), "repo");
    const outside = join(homedir(), "out");
    const absolute = join(homedir(), "b.txt");

    const targets = CommandWrites.targetsOf({ cwd: "../out", writes: ["a.txt", "~/n.txt", absolute, 3], unnamedWrites: [".", "sub", null] }, root);

    Assert.areEqual([join(outside, "a.txt"), join(homedir(), "n.txt"), absolute].join("|"), targets.files.join("|"));
    Assert.areEqual([outside, outside, join(outside, "sub"), outside].join("|"), targets.unnamedIn.join("|"));
  }

  @TestMethod
  public letsAStepWithoutTargetsWriteAnywhereInTheFolderItRanIn(): void {
    const root = join(homedir(), "repo");

    Assert.areEqual("|" + join(homedir(), "out"), CommandWritesTests.render(CommandWrites.targetsOf({ cwd: join(homedir(), "out") }, root)));
    Assert.areEqual("|" + root, CommandWritesTests.render(CommandWrites.targetsOf({ command: "ls", writes: ["a"] }, root)));
    Assert.areEqual(String.empty, CommandWritesTests.render(CommandWrites.targetsOf(null, root)));
    Assert.areEqual(String.empty, CommandWritesTests.render(CommandWrites.targetsOf(["a"], root)));
  }

  @TestMethod
  public countsAPathRootedWithoutADriveOnWindowsAsUnnamedInItsOwnFolderOutsideTheChatsFolder(): void {
    const root = join(homedir(), "repo");

    const step = { writes: ["/tmp/a.txt", "\\b.txt"], unnamedWrites: ["/tmp/x"] };

    const targets = CommandWrites.targetsOf(step, root, "win32");
    Assert.areEqual("|/tmp|\\|/tmp/x", CommandWritesTests.render(targets));
    Assert.isTrue(targets.unnamedIn.every(t => CommandWrites.isOutside(CommandWrites.folderKey(root), CommandWrites.folderKey(t))));
    Assert.areEqual(`${resolve(root, "/tmp/a.txt")}|${resolve(root, "/tmp/x")}`,
      CommandWritesTests.render(CommandWrites.targetsOf({ writes: ["/tmp/a.txt"], unnamedWrites: ["/tmp/x"] }, root, "linux")));
  }

  @TestMethod
  public listsTheNamedFilesACommandAddedUpdatedOrDeletedOutsideTheFolderWithTheirDiffs(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const added = join(outside, "new.txt");
    const updated = join(outside, "old.txt");
    const deleted = join(outside, "gone.txt");
    writeFileSync(updated, "a\nb\nc\nd\ne\nf\ng\nh\n");
    writeFileSync(deleted, "x\r\n");
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [added, updated, deleted, join(outside, "never.txt"), join(root, "inside.txt")], unnamedWrites: [] });
    writes.note({ writes: [added], unnamedWrites: [] });
    writeFileSync(added, "hi\n");
    writeFileSync(updated, "a\nb\nc\nD\ne\nf\ng\nh\n");
    rmSync(deleted);
    writeFileSync(join(root, "inside.txt"), "in\n");
    const evidence = writes.changesSince(() => false);

    Assert.isTrue(evidence.isComplete);
    Assert.areEqual([
      `${added}:add:--- /dev/null\n+++ ${added}\n@@ -0,0 +1,1 @@\n+hi`,
      `${updated}:update:--- ${updated}\n+++ ${updated}\n@@ -1,7 +1,7 @@\n a\n b\n c\n-d\n+D\n e\n f\n g`,
      `${deleted}:delete:--- ${deleted}\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-x`
    ].join("|"), CommandWritesTests.changes(evidence));
  }

  @TestMethod
  public splitsAFilesDiffIntoHunksAroundEditsFarApart(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const edited = join(outside, "edited.txt");
    const lines = Array.from({ length: 20 }, (_, index) => `l${index + 1}`);
    writeFileSync(edited, `${lines.join("\n")}\n`);
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [edited], unnamedWrites: [] });
    writeFileSync(edited, `${lines.map((t, index) => [1, 15, 17].includes(index) ? t.toUpperCase() : t).join("\n")}\n`);

    Assert.areEqual(`${edited}:update:--- ${edited}\n+++ ${edited}\n@@ -1,5 +1,5 @@\n l1\n-l2\n+L2\n l3\n l4\n l5\n`
      + "@@ -13,8 +13,8 @@\n l13\n l14\n l15\n-l16\n+L16\n l17\n-l18\n+L18\n l19\n l20", CommandWritesTests.changes(writes.changesSince(() => false)));
  }

  @TestMethod
  public splitsAFilesDiffIntoHunksAroundEditsFarApartThatAddAndRemoveLines(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const edited = join(outside, "edited.txt");
    const lines = Array.from({ length: 20 }, (_, index) => `l${index + 1}`);
    writeFileSync(edited, `${lines.join("\n")}\n`);
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [edited], unnamedWrites: [] });
    writeFileSync(edited, `${[...lines.slice(0, 2), "a", "b", ...lines.slice(2, 16), ...lines.slice(17)].join("\n")}\n`);

    Assert.areEqual(`${edited}:update:--- ${edited}\n+++ ${edited}\n@@ -1,5 +1,7 @@\n l1\n l2\n+a\n+b\n l3\n l4\n l5\n`
      + "@@ -14,7 +16,6 @@\n l14\n l15\n l16\n-l17\n l18\n l19\n l20", CommandWritesTests.changes(writes.changesSince(() => false)));
  }

  @TestMethod
  public comparesTextsTooLongToCompareLineByLineLineAgainstLineOrInOneHunk(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const paired = join(outside, "paired.txt");
    const rewritten = join(outside, "rewritten.txt");
    const lines = Array.from({ length: 1_001 }, (_, index) => `x${index}`);
    writeFileSync(paired, `${lines.join("\n")}\n`);
    writeFileSync(rewritten, `${lines.join("\n")}\n`);
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [paired, rewritten], unnamedWrites: [] });
    writeFileSync(paired, `${lines.map((t, index) => index === 0 || index === 1_000 ? t.toUpperCase() : t).join("\n")}\n`);
    writeFileSync(rewritten, `${[...lines, "y"].map(t => `${t}!`).join("\n")}\n`);
    const [first, second] = writes.changesSince(() => false).changes.map(t => (t.diff ?? String.empty).split("\n"));

    Assert.areEqual(`--- ${paired}|+++ ${paired}|@@ -1,4 +1,4 @@|-x0|+X0|x1|x2|x3|@@ -998,4 +998,4 @@|x997|x998|x999|-x1000|+X1000`,
      (first ?? []).map(t => t.trim()).join("|"));
    Assert.areEqual(`@@ -1,1001 +1,1002 @@|-x0|-x1`, (second ?? []).slice(2, 5).join("|"));
    Assert.areEqual(Resources.maximumDiffLines + 1, second?.length);
  }

  @TestMethod
  public leavesOutAnUntouchedFileWhoseSecondReadFindsTheReadsSpent(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const files = Array.from({ length: 4 }, (_, index) => join(outside, `f-${index}.txt`));
    const hourAgo = new Date(Date.now() - 3_600_000);
    for (const file of files) {
      writeFileSync(file, "x".repeat(Resources.maximumDiffBytes - 1));
      utimesSync(file, hourAgo, hourAgo);
    }
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: files, unnamedWrites: [] });
    const evidence = writes.changesSince(() => false);

    Assert.isTrue(evidence.isComplete);
    Assert.areEqual(String.empty, CommandWritesTests.changes(evidence));
  }

  @TestMethod
  public readsAPathUnderAFileAsMissingSoACopyOntoAFileListsOnlyThatFile(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const file = join(outside, "b.txt");
    writeFileSync(file, "b\n");
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [file, join(file, "a.txt")], unnamedWrites: [] });
    writeFileSync(file, "a\n");
    const evidence = writes.changesSince(() => false);

    Assert.isTrue(evidence.isComplete);
    Assert.areEqual(`${file}:update:--- ${file}\n+++ ${file}\n@@ -1,1 +1,1 @@\n-b\n+a`, CommandWritesTests.changes(evidence));
  }

  @TestMethod
  public listsAFileWrittenBeforeItsFirstReadByItsTimeWithoutADiff(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const raced = join(outside, "raced.txt");
    const older = join(outside, "older.txt");
    const binary = join(outside, "image.bin");
    const folder = join(outside, "folder");
    writeFileSync(raced, "done\n");
    writeFileSync(older, "kept\n");
    const hourAgo = new Date(Date.now() - 3_600_000);
    utimesSync(older, hourAgo, hourAgo);
    mkdirSync(folder);
    const writes = new CommandWrites(root, Date.now() - 60_000);

    writes.note({ writes: [raced, older, binary, folder], unnamedWrites: [] });
    writeFileSync(binary, Buffer.from([0, 1, 2]));
    const evidence = writes.changesSince(() => false);

    Assert.areEqual(`${raced}:update:null|${binary}:add:null`, CommandWritesTests.changes(evidence));
  }

  @TestMethod
  public listsAFileTooLargeToCompareWithoutADiffAndSaysItLeftOutOneItCouldNotRead(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const large = join(outside, "large.txt");
    const short = join(outside, "short.txt");
    const unreadable = join(outside, "bad\0name.txt");
    writeFileSync(large, "x".repeat(Resources.maximumDiffBytes + 1));
    writeFileSync(short, "a");
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [large, short, unreadable], unnamedWrites: [] });
    writeFileSync(large, "y".repeat(Resources.maximumDiffBytes + 2));
    writeFileSync(short, "b");
    const evidence = writes.changesSince(() => false);

    Assert.isFalse(evidence.isComplete);
    Assert.areEqual(`${large}:update:null|${short}:update:--- ${short}\n+++ ${short}\n@@ -1,1 +1,1 @@\n-a\n+b`, CommandWritesTests.changes(evidence));
  }

  @TestMethod
  public leavesOutAFileACommandTouchedWithoutChangingItsText(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const touched = join(outside, "touched.txt");
    writeFileSync(touched, "same\n");
    const hourAgo = new Date(Date.now() - 3_600_000);
    utimesSync(touched, hourAgo, hourAgo);
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [touched], unnamedWrites: [] });
    const now = new Date();
    utimesSync(touched, now, now);

    Assert.areEqual(String.empty, CommandWritesTests.changes(writes.changesSince(() => false)));
  }

  @TestMethod
  public leavesOutAFileTheProviderReported(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const reported = join(outside, "reported.txt");
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: [reported], unnamedWrites: [] });
    writeFileSync(reported, "x\n");

    Assert.areEqual(String.empty, CommandWritesTests.changes(writes.changesSince(t => t === reported)));
  }

  @TestMethod
  public readsNoMoreThanItsBoundOfFilesAndSaysItLeftSomeOut(): void {
    using directory = new TemporaryDataDirectory();
    const { root, outside } = CommandWritesTests.folders(directory);
    const files = Array.from({ length: Resources.maximumEvidenceFiles + 1 }, (_, index) => join(outside, `f-${index}.txt`));
    const writes = new CommandWrites(root, Date.now());

    writes.note({ writes: files, unnamedWrites: [] });
    writeFileSync(files.at(-1) as string, "late\n");
    const evidence = writes.changesSince(() => false);

    Assert.isFalse(evidence.isComplete);
    Assert.areEqual(String.empty, CommandWritesTests.changes(evidence));
  }

  private static folders(directory: TemporaryDataDirectory): { readonly root: string; readonly outside: string } {
    const root = join(directory.path, "repo");
    const outside = join(directory.path, "out");
    mkdirSync(root);
    mkdirSync(outside);
    return { root, outside };
  }

  private static render(targets: { readonly files: readonly string[]; readonly unnamedIn: readonly string[] }): string {
    return [targets.files.join(","), ...targets.unnamedIn].join("|");
  }

  private static changes(evidence: ReplyEvidence): string {
    return evidence.changes.map(t => `${t.path}:${t.kind}:${t.diff ?? "null"}`).join("|");
  }
}
