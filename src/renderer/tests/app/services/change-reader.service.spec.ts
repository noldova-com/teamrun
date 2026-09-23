/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DetailKind, MessageDetail, MessageStatus } from "@noldova/teamrun-protocol";

import { SampleData } from "../../fixtures/sample-data";
import { DiffLineKind } from "../../../src/app/enums/diff-line-kind";
import type { ImageSource } from "../../../src/app/models/image-source";
import { ChangeReader } from "../../../src/app/services/change-reader.service";

describe("ChangeReader", () => {
  const reader = (): ChangeReader => TestBed.inject(ChangeReader);
  const detail = (sequence: number, kind: DetailKind, text: string, payload: unknown): MessageDetail =>
    new MessageDetail(sequence, kind, text, JSON.parse(JSON.stringify(payload)), SampleData.timestamp);

  it("reads Codex file changes with their diffs and merges repeated files", () => {
    const message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.FileChange, "File changes", {
        status: "completed",
        files: ["D:\\repo\\a.ts", "D:\\repo\\b.ts", "D:\\repo\\c.ts"],
        changes: [
          { path: "D:\\repo\\a.ts", kind: "update", diff: "--- a.ts\n+++ a.ts\n@@ -1,2 +1,2 @@\n context\n-old\n+new\n+more" },
          { path: "D:\\repo\\b.ts", kind: "{\"move\":{\"from\":\"x\"}}", diff: null },
          { path: "D:\\repo\\c.ts" },
          { path: "" },
          "junk"
        ]
      }),
      detail(1, DetailKind.FileChange, "File changes", { status: "completed", changes: [{ path: "D:\\repo\\a.ts", kind: "update", diff: "+again" }] }),
      detail(2, DetailKind.FileChange, "Legacy", { files: ["x"], status: "completed" }),
      detail(3, DetailKind.Note, "plain", null)
    ]);

    const edits = reader().editsOf(message);

    expect(edits.map(t => t.path)).toEqual(["D:\\repo\\a.ts", "D:\\repo\\b.ts", "D:\\repo\\c.ts"]);
    expect(edits[0]?.additions).toBe(3);
    expect(edits[0]?.deletions).toBe(1);
    expect(edits[0]?.lines.map(t => t.kind)).toEqual([
      DiffLineKind.Meta, DiffLineKind.Meta, DiffLineKind.Meta, DiffLineKind.Context, DiffLineKind.Removed, DiffLineKind.Added, DiffLineKind.Added,
      DiffLineKind.Added
    ]);
    expect(edits[0]?.lines[3]?.text).toBe("context");
    expect(edits[0]?.hasDiff).toBe(true);
    expect(edits[1]?.kind).toBe("move");
    expect(edits[1]?.hasDiff).toBe(false);
    expect(edits[2]?.kind).toBe("update");
  });

  it("reads Claude Code's edit, multi-edit, and write tools", () => {
    const message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.FileChange, "Edit", {
        tool: "Edit", toolUseId: "t1", input: { file_path: "/repo/a.ts", old_string: "one\ntwo", new_string: "uno" }
      }),
      detail(1, DetailKind.FileChange, "Write", { tool: "Write", toolUseId: "t2", input: { file_path: "/repo/new.ts", content: "a\nb\nc" } }),
      detail(2, DetailKind.FileChange, "MultiEdit", {
        tool: "MultiEdit", toolUseId: "t3", input: { file_path: "/repo/m.ts", edits: [{ old_string: "x", new_string: "y" }, 5, { new_string: "z" }] }
      }),
      detail(3, DetailKind.FileChange, "MultiEdit", { tool: "MultiEdit", toolUseId: "t4", input: { file_path: "/repo/n.ts" } }),
      detail(4, DetailKind.Note, "Read", { tool: "Read", toolUseId: "t5", input: { file_path: "/repo/a.ts" } }),
      detail(5, DetailKind.Note, "Bash", { tool: "Bash", toolUseId: "t6", input: { command: "ls" } }),
      detail(6, DetailKind.Note, "Edit", { tool: "Edit", toolUseId: "t7", input: { file_path: " " } }),
      detail(7, DetailKind.Note, "Edit", { tool: "Edit", toolUseId: "t8", input: "text" }),
      detail(8, DetailKind.Note, "result", { toolUseId: "t1", isError: false })
    ]);

    const edits = reader().editsOf(message);

    expect(edits.map(t => `${t.path}:${t.kind}:+${t.additions}-${t.deletions}`))
      .toEqual(["/repo/a.ts:update:+1-2", "/repo/new.ts:add:+3-0", "/repo/m.ts:update:+2-1", "/repo/n.ts:update:+0-0"]);
  });

  it("finds image files under the project root in edits and texts, apart from generated ones", () => {
    const message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      detail(0, DetailKind.FileChange, "Write", { tool: "Write", toolUseId: "t1", input: { file_path: "D:\\repo\\out\\sphere.png", content: "" } }),
      detail(1, DetailKind.Command, "$ python gen.py --out D:\\repo\\out\\second.PNG\nsaved D:\\repo\\out\\second.PNG", null),
      detail(2, DetailKind.Text, "Saved to /other/place/elsewhere.png and D:\\repo\\notes.txt", null),
      detail(3, DetailKind.Note, "Generated image (completed): D:\\repo\\out\\sphere.png",
        { itemType: "imageGeneration", savedPath: "D:\\repo\\out\\sphere.png", imageData: "AAAA", mediaType: "image/png" }),
      detail(4, DetailKind.Note, "Generated image (completed): not saved",
        { itemType: "imageGeneration", savedPath: null, imageData: "BBBB/" + "A".repeat(200_000) + "/fake.png", mediaType: "image/jpeg" })
    ]);

    expect(reader().imageFilesOf(message, "D:\\repo").map(t => `${t.key}|${t.label}|${t.path}|${t.data}`))
      .toEqual(["D:\\repo\\out\\second.PNG|second.PNG|D:\\repo\\out\\second.PNG|null"]);
    expect(reader().imageFilesOf(message, null)).toEqual([]);
    expect(reader().imageFilesOf(message, " ")).toEqual([]);
  });

  it("reads the image a provider generated in a detail", () => {
    const generated = (sequence: number, payload: Record<string, unknown>): MessageDetail => detail(sequence, DetailKind.Note, "Generated image", payload);
    const describe = (image: ImageSource | null): string | null => image === null ? null : `${image.key}|${image.label}|${image.path}|${image.data}`;

    const saved = generated(3, { itemType: "imageGeneration", savedPath: "D:\\repo\\out\\sphere.png", imageData: "AAAA", mediaType: "image/png" });
    expect(describe(reader().imageOf(saved)))
      .toBe("D:\\repo\\out\\sphere.png|sphere.png|D:\\repo\\out\\sphere.png|data:image/png;base64,AAAA");
    expect(describe(reader().imageOf(generated(4, { itemType: "imageGeneration", savedPath: null, imageData: "BBBB", mediaType: "image/jpeg" }))))
      .toBe("4|Generated image|null|data:image/jpeg;base64,BBBB");
    expect(describe(reader().imageOf(generated(5, { itemType: "imageGeneration", savedPath: "/elsewhere/x.png", imageData: null, mediaType: null }))))
      .toBe("/elsewhere/x.png|x.png|/elsewhere/x.png|null");
    expect(reader().imageOf(generated(6, { itemType: "imageGeneration", savedPath: null, imageData: null, mediaType: null }))).toBeNull();
    expect(reader().imageOf(generated(7, { itemType: "plugin" }))).toBeNull();
    const stored = generated(8, {
      itemType: "imageGeneration", savedPath: "/codex/out.png", storedPath: "D:\\data\\images\\m-8.png", imageData: null, mediaType: null
    });
    expect(describe(reader().imageOf(stored)))
      .toBe("D:\\data\\images\\m-8.png|out.png|D:\\data\\images\\m-8.png|null");
    expect(describe(reader().imageOf(generated(9, { itemType: "imageGeneration", savedPath: null, storedPath: "D:\\data\\images\\m-9.png" }))))
      .toBe("D:\\data\\images\\m-9.png|m-9.png|D:\\data\\images\\m-9.png|null");
    expect(reader().imageOf(detail(8, DetailKind.Text, "plain", null))).toBeNull();
  });
});
