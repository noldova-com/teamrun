/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import type { TurnDetail } from "@noldova/teamrun-core";
import { DetailKind } from "@noldova/teamrun-protocol";
import { CodexItemReader } from "@noldova/teamrun-providers";

@TestClass
export class CodexItemReaderTests {
  private static readonly reader: CodexItemReader = new CodexItemReader();

  @TestMethod
  public readsStartedCommandsOnly(): void {
    const command = CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ id: "i1", type: "commandExecution", command: "npm test" }));
    const other = CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ id: "i2", type: "agentMessage", text: "x" }));

    Assert.areEqual(DetailKind.Note, command?.kind);
    Assert.areEqual("Running: npm test", command?.text);
    Assert.areEqual("i1:started", command?.providerItemId);
    Assert.isNull(other);
  }

  @TestMethod
  public readsTextualItems(): void {
    const read = (value: unknown): ReturnType<CodexItemReader["readCompleted"]> => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue(value));

    Assert.areEqual("hello", read({ id: "a", type: "agentMessage", text: "hello" })?.text);
    Assert.isNull(read({ id: "a", type: "agentMessage", text: " " }));
    Assert.areEqual(DetailKind.Reasoning, read({ id: "r", type: "reasoning", summary: ["one", "two"] })?.kind);
    Assert.areEqual("one\ntwo", read({ id: "r", type: "reasoning", summary: ["one", "two"] })?.text);
    Assert.isNull(read({ id: "r", type: "reasoning" }));
    Assert.areEqual("Plan:\nstep", read({ id: "p", type: "plan", text: "step" })?.text);
    Assert.areEqual("Web search: cats", read({ id: "w", type: "webSearch", query: "cats" })?.text);
    Assert.areEqual("Codex compacted its context.", read({ id: "c", type: "contextCompaction" })?.text);
    Assert.isNull(read({ id: "u", type: "userMessage" }));
  }

  @TestMethod
  public readsCommandsWithBoundedOutput(): void {
    const full = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "c1", type: "commandExecution", command: "npm test", exitCode: 1, status: "failed", cwd: "D:/w", aggregatedOutput: "y".repeat(4001)
    }));
    const minimal = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "c2", type: "commandExecution", command: "ls", status: "completed" }));
    const nullOutput = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "c3", type: "commandExecution", command: "ls", status: "x", aggregatedOutput: null }));

    Assert.areEqual(DetailKind.Command, full?.kind);
    Assert.isTrue(full?.text.startsWith("$ npm test\n…yyyy") ?? false);
    Assert.isTrue(full?.text.endsWith("\n(exit 1)") ?? false);
    Assert.areEqual("{\"command\":\"npm test\",\"cwd\":\"D:/w\",\"exitCode\":1,\"status\":\"failed\"}", JSON.stringify(full?.payload));
    Assert.areEqual("$ ls\n", minimal?.text);
    Assert.areEqual("{\"command\":\"ls\",\"cwd\":null,\"exitCode\":null,\"status\":\"completed\"}", JSON.stringify(minimal?.payload));
    Assert.areEqual("$ ls\n", nullOutput?.text);
  }

  @TestMethod
  public readsFileChangesAndToolCalls(): void {
    const changes = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "f", type: "fileChange", status: "completed",
      changes: [{ path: "a.ts", kind: "update", diff: "-a +b" }, { path: "b.ts", kind: { move: { from: "c" } } }, { path: "d.ts" }]
    }));
    const mcp = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "m", type: "mcpToolCall", server: "srv", tool: "t", status: "ok" }));
    const dynamic = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "d", type: "dynamicToolCall", tool: "dyn", status: "ok" }));
    const unknown = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "i", type: "plugin", path: "out.png" }));
    const large = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "l", type: "blob", data: "x".repeat(5000) }));

    Assert.areEqual(DetailKind.FileChange, changes?.kind);
    Assert.areEqual("File changes (completed): update a.ts, {\"move\":{\"from\":\"c\"}} b.ts, null d.ts", changes?.text);
    const expected = {
      files: ["a.ts", "b.ts", "d.ts"],
      status: "completed",
      changes: [
        { path: "a.ts", kind: "update", diff: "-a +b" },
        { path: "b.ts", kind: "{\"move\":{\"from\":\"c\"}}", diff: null },
        { path: "d.ts", kind: "null", diff: null }
      ]
    };
    Assert.areEqual(JSON.stringify(expected), JSON.stringify(changes?.payload));
    Assert.areEqual("MCP tool srv/t (ok)", mcp?.text);
    Assert.areEqual("{\"server\":\"srv\",\"tool\":\"t\",\"status\":\"ok\"}", JSON.stringify(mcp?.payload));
    Assert.areEqual("Tool dyn (ok)", dynamic?.text);
    Assert.areEqual(DetailKind.Note, dynamic?.kind);
    Assert.areEqual(DetailKind.Note, unknown?.kind);
    Assert.areEqual("Codex item plugin", unknown?.text);
    const unknownPayload = { itemType: "plugin", item: { id: "i", type: "plugin", path: "out.png" } };
    Assert.areEqual(JSON.stringify(unknownPayload), JSON.stringify(unknown?.payload));
    Assert.areEqual(JSON.stringify({ itemType: "blob" }), JSON.stringify(large?.payload));
  }

  @TestMethod
  public readsGeneratedImages(): void {
    const png = "iVBORw0KGgoAAAANSUhEUg==";
    const saved = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "g1", type: "imageGeneration", status: "completed", result: png, savedPath: "D:/work/out.png", revisedPrompt: "a sphere", failure: null
    }));
    const read = (value: Record<string, unknown>): TurnDetail | null => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue(value));
    const unsaved = read({ id: "g2", type: "imageGeneration", status: "completed", result: "/9j/AAAA" });
    const text = read({ id: "g3", type: "imageGeneration", status: "failed", result: "no image", savedPath: null });
    const unknownFormat = read({ id: "g4", type: "imageGeneration", status: "completed", result: "QUJD" });
    const nullResult = read({ id: "g6", type: "imageGeneration", status: "failed", result: null });
    const noResult = read({ id: "g7", type: "imageGeneration", status: "failed" });
    const tooLong = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "g5", type: "imageGeneration", status: "completed", result: "iVBORw0KGgo" + "A".repeat(12_000_000)
    }));

    Assert.areEqual(DetailKind.Note, saved?.kind);
    Assert.areEqual("Generated image (completed): D:/work/out.png", saved?.text);
    const expected = {
      itemType: "imageGeneration", status: "completed", savedPath: "D:/work/out.png", revisedPrompt: "a sphere", failure: null,
      imageData: png, mediaType: "image/png"
    };
    Assert.areEqual(JSON.stringify(expected), JSON.stringify(saved?.payload));
    Assert.areEqual("Generated image (completed): not saved", unsaved?.text);
    Assert.areEqual("image/jpeg", CodexItemReaderTests.payloadOf(unsaved)["mediaType"]);
    Assert.areEqual("/9j/AAAA", CodexItemReaderTests.payloadOf(unsaved)["imageData"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(text)["imageData"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(text)["mediaType"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(unknownFormat)["mediaType"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(tooLong)["imageData"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(nullResult)["imageData"]);
    Assert.areEqual("Generated image (failed): not saved", nullResult?.text);
    Assert.isNull(CodexItemReaderTests.payloadOf(noResult)["mediaType"]);
  }

  private static payloadOf(detail: TurnDetail | null): JsonObject {
    const payload = detail?.payload;
    if (typeof payload !== "object" || payload === null || Symbol.iterator in payload)
      throw new Error("payload");

    return payload;
  }
}
