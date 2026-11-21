/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, FileChangeReader, Message, MessageAuthor, MessageDetail, MessageStatus, Resources } from "@noldova/teamrun.protocol";

@TestClass
export class FileChangeReaderTests {
  @TestMethod
  public mergesCodexChangesAndPreservesLineClassification(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { changes: [{ path: "a", kind: "update", diff: "--- a\n+++ b\n@@ h\n context\n-old\n+new\n+more\nplain\n" },
        { path: "b", kind: "{\"type\":\"update\",\"move_path\":\"d\"}" }, { path: "c" }, { path: "" }, "junk"] },
      { changes: [{ path: "a", diff: "+again" }] }, null, [], { changes: {} }
    ]));
    Assert.areEqual("a,b,c", edits.map(t => t.path).join(","));
    Assert.areEqual(3, edits[0]?.additions);
    Assert.areEqual(1, edits[0]?.deletions);
    Assert.areEqual("Meta,Meta,Meta,Context,Removed,Added,Added,Context,Added", edits[0]?.lines.map(t => t.kind).join(","));
    Assert.areEqual("context", edits[0]?.lines[3]?.text);
    Assert.isTrue(edits[0]?.hasDiff ?? false);
    Assert.isFalse(edits[1]?.hasDiff ?? true);
    Assert.areEqual("move", edits[1]?.kind);
    Assert.areEqual("update", edits[2]?.kind);
  }

  @TestMethod
  public keepsTheNewPathOfAMoveWhoseLaterChangesMergeIntoIt(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { changes: [{ path: "plan.md", kind: "{\"type\":\"update\",\"move_path\":\"docs/plan.md\"}", diff: "-a" }] },
      { changes: [{ path: "plan.md", diff: "+b" }] }
    ]));

    Assert.areEqual("plan.md:move:docs/plan.md:1:1", edits.map(t => `${t.path}:${t.kind}:${t.movePath ?? ""}:${t.additions}:${t.deletions}`).join(","));
  }

  @TestMethod
  public readsCodexKindsAndCountsANewOrDeletedFilesContentAsItsLines(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { changes: [
        { path: "new.ts", kind: { type: "add" }, diff: "one\ntwo\n\nfour\n" },
        { path: "stored.ts", kind: "{\"type\":\"add\"}", diff: "x" },
        { path: "gone.ts", kind: "{\"type\":\"delete\"}", diff: "a\nb\n" },
        { path: "moved.ts", kind: { type: "update", move_path: "to.ts" }, diff: "@@ -1 +1 @@\n-a\n+b\n\nMoved to: to.ts" },
        { path: "edited.ts", kind: "{\"type\":\"update\",\"move_path\":null}", diff: "@@ -1 +1 @@\n-a\n+b" },
        { path: "patch.diff", kind: "add", diff: "@@ -1 +1 @@\n-a\n+b\n" },
        { path: "list.yml", kind: "delete", diff: "- a\n- b\n\n- c\n" },
        { path: "plus.txt", kind: "add", diff: "+one\n+two" },
        { path: "empty.ts", kind: "add", diff: "" },
        { path: "number.ts", kind: { type: 5 } }, { path: "broken.ts", kind: "{type" }, { path: "list.ts", kind: [] }, { path: "other.ts", kind: { type: "rename" } }
      ] },
      { tool: "edit", toolCallId: "t1", changes: [{ path: "acp.ts", kind: "add", diff: "+one\n+two" }, { path: "removed.ts", kind: "delete", diff: "-a\n-b" }] },
      { source: "workingTree", changes: [{ path: "hunk.ts", kind: "add", diff: "@@ -0,0 +1 @@\n+one" }] }
    ]));

    Assert.areEqual("new.ts:add:4:0,stored.ts:add:1:0,gone.ts:delete:0:2,moved.ts:move:1:1,edited.ts:update:1:1,patch.diff:add:3:0,list.yml:delete:0:4,"
      + "plus.txt:add:2:0,empty.ts:add:0:0,number.ts:update:0:0,broken.ts:update:0:0,list.ts:update:0:0,other.ts:rename:0:0,acp.ts:add:2:0,removed.ts:delete:0:2,"
      + "hunk.ts:add:1:0", edits.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
    Assert.areEqual(",,,to.ts,,,,,,,,,,,,", edits.map(t => t.movePath ?? "").join(","));
    Assert.areEqual("one|two||four", edits[0]?.lines.map(t => t.text).join("|"));
    Assert.areEqual("a|b", edits[2]?.lines.map(t => t.text).join("|"));
    Assert.areEqual("@@ -1 +1 @@|-a|+b", edits[5]?.lines.map(t => t.text).join("|"));
    Assert.areEqual("- a|- b||- c", edits[6]?.lines.map(t => t.text).join("|"));
    Assert.areEqual("+one|+two", edits[7]?.lines.map(t => t.text).join("|"));
    Assert.areEqual("one|two", edits[13]?.lines.map(t => t.text).join("|"));
    Assert.isTrue(edits[0]?.hasDiff ?? false);
  }

  @TestMethod
  public readsClaudeToolsAndIgnoresUnsupportedPayloads(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { tool: "Edit", input: { file_path: "a", old_string: "one\ntwo", new_string: "uno" } },
      { tool: "Write", input: { file_path: "b", content: "a\nb\nc" } },
      { tool: "MultiEdit", input: { file_path: "c", edits: [{ old_string: "x", new_string: "y" }, 5, { new_string: "z" }] } },
      { tool: "MultiEdit", input: { file_path: "d" } },
      { tool: "Read", input: { file_path: "a" } }, { tool: "Bash", input: { command: "ls" } },
      { tool: "Edit", input: { file_path: " " } }, { tool: "Edit", input: "text" }, { toolUseId: "x" },
      { tool: "Edit", input: { file_path: "deleted", old_string: "gone" } }
    ]));
    Assert.areEqual("a:update:1:2,b:add:3:0,c:update:2:1,d:update:0:0,deleted:update:0:1", edits.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
  }

  @TestMethod
  public readsAClaudeNotebookEditAsItsNotebookWithTheCellsNewSourceAdded(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { tool: "NotebookEdit", input: { notebook_path: "/elsewhere/n.ipynb", cell_id: "c1", new_source: "import os\nprint(1)", edit_mode: "replace" } },
      { tool: "NotebookEdit", input: { notebook_path: "inside.ipynb", new_source: "x = 1", cell_type: "code", edit_mode: "insert" } },
      { tool: "NotebookEdit", input: { notebook_path: "deleted.ipynb", cell_id: "c2", new_source: "not added", edit_mode: "delete" } },
      { tool: "NotebookEdit", input: { notebook_path: "unsourced.ipynb" } },
      { tool: "NotebookEdit", input: { file_path: "wrong.ipynb", new_source: "x" } }, { tool: "NotebookEdit", input: { notebook_path: " ", new_source: "x" } },
      { tool: "Edit", input: { notebook_path: "edit.ipynb", new_string: "x" } }
    ]));

    Assert.areEqual("/elsewhere/n.ipynb:update:2:0,inside.ipynb:update:1:0,deleted.ipynb:update:0:0,unsourced.ipynb:update:0:0",
      edits.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
    Assert.areEqual("import os|print(1)", edits[0]?.lines.map(t => t.text).join("|"));
  }

  @TestMethod
  public showsAFileTheWorkingTreeComparedOnceByItsDiffInPlaceOfTheToolCallsLines(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { tool: "Edit", input: { file_path: "/repo/src/distance.js", old_string: "km * KM_PER_MILE", new_string: "km / KM_PER_MILE" }, toolUseId: "t1" },
      { tool: "Write", input: { file_path: "/repo/notes.md", content: "one" }, toolUseId: "t2" },
      { tool: "Edit", input: { file_path: "/repo/kept.js", old_string: "a", new_string: "b" }, toolUseId: "t3" },
      { files: ["/repo/src/distance.js", "/repo/notes.md"], status: "completed", source: "workingTree", changes: [
        { path: "/repo/src/distance.js", kind: "update",
          diff: "@@ -1,3 +1,3 @@\n export function toMiles(km) {\n-  return km * KM_PER_MILE;\n+  return km / KM_PER_MILE;\n }\n" },
        { path: "/repo/notes.md", kind: "update", diff: "@@ -1 +1 @@\n-zero\n+one\n" }
      ] },
      { files: ["/repo/notes.md"], status: "completed", source: "workingTree", changes: [{ path: "/repo/notes.md", kind: "update", diff: "@@ -2,0 +2 @@\n+two\n" }] }
    ]));

    Assert.areEqual("/repo/src/distance.js:update:1:1,/repo/notes.md:update:2:1,/repo/kept.js:update:1:1",
      edits.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
    Assert.areEqual("Meta,Context,Removed,Added,Context", edits[0]?.lines.map(t => t.kind).join(","));
    Assert.areEqual("@@ -1,3 +1,3 @@|export function toMiles(km) {|  return km * KM_PER_MILE;|  return km / KM_PER_MILE;|}", edits[0]?.lines.map(t => t.text).join("|"));
    Assert.areEqual("@@ -1 +1 @@|zero|one|@@ -2,0 +2 @@|two", edits[1]?.lines.map(t => t.text).join("|"));
  }

  @TestMethod
  public keepsTheToolCallsLinesForAFileTheWorkingTreeComparedWithoutItsWholeDiff(): void {
    const cut = Array.from({ length: Resources.maximumDiffLines }, (_, i) => i === 0 ? "@@ -1,500 +1,500 @@" : ` line ${i}`).join("\n");
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { tool: "Edit", input: { file_path: "/repo/large.js", old_string: "a", new_string: "b" }, toolUseId: "t1" },
      { tool: "Edit", input: { file_path: "/repo/long.js", old_string: "c", new_string: "d" }, toolUseId: "t2" },
      { files: ["/repo/large.js", "/repo/long.js"], status: "completed", source: "workingTree", changes: [
        { path: "/repo/large.js", kind: "update", diff: null },
        { path: "/repo/long.js", kind: "update", diff: cut }
      ] },
      { files: ["/repo/long.js"], status: "completed", source: "workingTree", changes: [{ path: "/repo/long.js", kind: "update", diff: "@@ -9 +9 @@\n-c\n+d\n" }] }
    ]));

    Assert.areEqual("/repo/large.js:update:1:1,/repo/long.js:update:1:1",
      edits.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
    Assert.areEqual("a|b", edits[0]?.lines.map(t => t.text).join("|"));
    Assert.areEqual("@@ -9 +9 @@|c|d", edits[1]?.lines.map(t => t.text).join("|"));
  }

  @TestMethod
  public matchesAToolCallsWindowsPathToTheWorkingTreesWhateverItsCaseAndSeparators(): void {
    const edits = new FileChangeReader().editsOf(FileChangeReaderTests.message([
      { tool: "Edit", input: { file_path: "c:/Repo/src/Distance.js", old_string: "a", new_string: "b" }, toolUseId: "t1" },
      { files: ["C:\\repo\\src\\distance.js"], status: "completed", source: "workingTree", changes: [
        { path: "C:\\repo\\src\\distance.js", kind: "update", diff: "@@ -1 +1 @@\n-a\n+b\n" }
      ] }
    ]));

    Assert.areEqual("C:\\repo\\src\\distance.js:update:1:1", edits.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
    Assert.areEqual("@@ -1 +1 @@|a|b", edits[0]?.lines.map(t => t.text).join("|"));
  }

  @TestMethod
  public readsSomeOfAReplysDetailsLikeTheWholeReply(): void {
    const message = FileChangeReaderTests.message([
      { changes: [{ path: "a", kind: "add", diff: "+one" }] },
      { tool: "Edit", input: { file_path: "a", old_string: "one", new_string: "two" } },
      { changes: [{ path: "b", kind: "update", diff: "-x\n+y" }] }
    ]);

    const some = new FileChangeReader().editsIn(message.details.slice(0, 2));

    Assert.areEqual("a:add:2:1", some.map(t => `${t.path}:${t.kind}:${t.additions}:${t.deletions}`).join(","));
    Assert.areEqual(JSON.stringify(new FileChangeReader().editsOf(message)), JSON.stringify(new FileChangeReader().editsIn(message.details)));
  }

  private static message(payloads: readonly JsonValue[]): Message {
    return new Message("m", "c", 0, MessageAuthor.User, null, MessageStatus.Completed,
      payloads.map((payload, i) => new MessageDetail(i, DetailKind.FileChange, "change", payload, "t")), null, "t", null, "t");
  }
}
