/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import type { TurnDetail } from "@noldova/teamrun.core";
import { DetailKind, ReplyPlan } from "@noldova/teamrun.protocol";
import { CodexItemReader } from "@noldova/teamrun.providers";

@TestClass
export class CodexItemReaderTests {
  private static readonly reader: CodexItemReader = new CodexItemReader();

  @TestMethod
  public readsStartedCommandsOnlyAsTheCommandItsCompletionReplaces(): void {
    const command = CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ id: "i1", type: "commandExecution", command: "npm test", cwd: "/w",
      status: "inProgress" }));
    const completed = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "i1", type: "commandExecution", command: "npm test", cwd: "/w",
      status: "failed", exitCode: -1, aggregatedOutput: "no" }));
    const other = CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ id: "i2", type: "agentMessage", text: "x" }));

    Assert.areEqual(DetailKind.Command, command?.kind);
    Assert.areEqual("$ npm test\n", command?.text);
    Assert.areEqual(JSON.stringify({ command: "npm test", cwd: "/w", exitCode: null, status: "inProgress" }), JSON.stringify(command?.payload));
    Assert.areEqual("i1", command?.providerItemId);
    Assert.areEqual(command?.providerItemId, completed?.providerItemId);
    Assert.areEqual(JSON.stringify({ command: "npm test", cwd: "/w", exitCode: -1, status: "failed" }), JSON.stringify(completed?.payload));
    Assert.isNull(other);
  }

  @TestMethod
  public namesTheFilesAShellWrappersCommandWrites(): void {
    const read = (command: string): JsonValue | undefined => CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ id: "i1", type: "commandExecution",
      command, cwd: "/tmp/w", status: "inProgress" }))?.payload;

    Assert.areEqual(JSON.stringify({ command: "/bin/bash -lc 'printf hi > greet.sh && make'", cwd: "/tmp/w", exitCode: null, status: "inProgress",
      writes: ["greet.sh"], unnamedWrites: ["."] }), JSON.stringify(read("/bin/bash -lc 'printf hi > greet.sh && make'")));
    Assert.areEqual(JSON.stringify({ command: "pwsh -Command 'Remove-Item a.txt'", cwd: "/tmp/w", exitCode: null, status: "inProgress", writes: ["a.txt"],
      unnamedWrites: [] }), JSON.stringify(read("pwsh -Command 'Remove-Item a.txt'")));
    Assert.areEqual(JSON.stringify({ command: "/bin/bash -lc 'echo \"x'", cwd: "/tmp/w", exitCode: null, status: "inProgress" }),
      JSON.stringify(read("/bin/bash -lc 'echo \"x'")));
  }

  @TestMethod
  public marksACommandAndAFileChangeOnlyWhenTeamRunDeclinedThem(): void {
    const command = (denied: boolean): JsonValue | undefined => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "c", type: "commandExecution",
      command: "rm -rf build", cwd: "/w", status: "declined", exitCode: null }), denied)?.payload;
    const change = (denied: boolean): JsonValue | undefined => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "f", type: "fileChange",
      status: "declined", changes: [] }), denied)?.payload;

    Assert.areEqual(JSON.stringify({ command: "rm -rf build", cwd: "/w", exitCode: null, status: "declined", denied: true }), JSON.stringify(command(true)));
    Assert.areEqual(JSON.stringify({ files: [], status: "declined", denied: true, changes: [] }), JSON.stringify(change(true)));
    Assert.areEqual(JSON.stringify({ command: "rm -rf build", cwd: "/w", exitCode: null, status: "declined" }), JSON.stringify(command(false)));
    Assert.areEqual(JSON.stringify({ files: [], status: "declined", changes: [] }), JSON.stringify(change(false)));
  }

  @TestMethod
  public readsTextualItems(): void {
    const read = (value: unknown): ReturnType<CodexItemReader["readCompleted"]> => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue(value));

    Assert.areEqual("hello", read({ id: "a", type: "agentMessage", text: "hello" })?.text);
    Assert.isNull(read({ id: "a", type: "agentMessage", text: " " }));
    Assert.areEqual(DetailKind.Reasoning, read({ id: "r", type: "reasoning", summary: ["one", "two"] })?.kind);
    Assert.areEqual("one\ntwo", read({ id: "r", type: "reasoning", summary: ["one", "two"] })?.text);
    Assert.isNull(read({ id: "r", type: "reasoning" }));
    const plan = read({ id: "p", type: "plan", text: "# Ship it\n1. Step" });
    Assert.areEqual("Plan|Ship it|teamrun-plan-text|# Ship it\n1. Step", `${plan?.kind}|${plan?.text}|${plan?.providerItemId}|${ReplyPlan.fromJson(plan?.payload).text}`);
    Assert.isNull(read({ id: "p", type: "plan", text: " " }));
    Assert.areEqual("Web search: cats", read({ id: "w", type: "webSearch", query: "cats" })?.text);
    Assert.areEqual("{\"tool\":\"webSearch\",\"readOnly\":true}", JSON.stringify(read({ id: "w", type: "webSearch", query: "cats" })?.payload));
    Assert.areEqual("Codex compacted its context.", read({ id: "c", type: "contextCompaction" })?.text);
    Assert.areEqual("{\"compaction\":true}", JSON.stringify(read({ id: "c", type: "contextCompaction" })?.payload));
    Assert.isNull(read({ id: "u", type: "userMessage" }));
    Assert.isNull(read({ id: "s", type: "collabAgentToolCall", tool: "spawnAgent", status: "completed", receiverThreadIds: ["child"], agentsStates: {} }));
    Assert.isNull(read({ id: "v", type: "subAgentActivity", kind: "started", agentThreadId: "child", agentPath: "/root/a" }));
  }

  @TestMethod
  public saysWhatAReviewLooksAtAndLeavesItsTextToTheAgentMessage(): void {
    const read = (value: unknown): ReturnType<CodexItemReader["readCompleted"]> => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue(value));

    const entered = read({ id: "e", type: "enteredReviewMode", review: " current changes " });

    Assert.areEqual(JSON.stringify([DetailKind.Note, "Codex reviews current changes.", "e"]), JSON.stringify([entered?.kind, entered?.text, entered?.providerItemId]));
    Assert.isNull(read({ id: "e", type: "enteredReviewMode", review: " " }));
    Assert.isNull(read({ id: "x", type: "exitedReviewMode", review: "No issues found." }));
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
    const utf16 = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "c4", type: "commandExecution", command: "wsl.exe -l", status: "failed", exitCode: 1, aggregatedOutput: "\uFFFD\uFFFDA\0c\0c\0e\0s\0s\0 \0i\0s\0 \0d\0e\0n\0i\0e\0d\0"
    }));
    Assert.areEqual("$ wsl.exe -l\nAccess is denied\n(exit 1)", utf16?.text);
  }

  @TestMethod
  public titlesACommandByItsOnlyActionElseByTheRulesOnItsWrappedScript(): void {
    const title = (command: string, actions?: unknown): unknown => (CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "c", type: "commandExecution", command, status: "completed", exitCode: 0, ...(Object.isUndefined(actions) ? {} : { commandActions: actions })
    }))?.payload as { title?: string } | null)?.title ?? "-";

    Assert.areEqual("Read a.ts", title("x", [{ type: "read", command: "cat a.ts", name: "a.ts", path: "a.ts" }]));
    Assert.areEqual("Listed src", title("x", [{ type: "listFiles", command: "ls src", path: "src" }]));
    Assert.areEqual("Listed the folder", title("x", [{ type: "listFiles", command: "ls", path: null }]));
    Assert.areEqual("Searched for foo in src", title("x", [{ type: "search", command: "rg foo src", query: "foo", path: "src" }]));
    Assert.areEqual("Searched for foo", title("x", [{ type: "search", command: "rg foo", query: "foo", path: null }]));
    Assert.areEqual("-", title("x", [{ type: "search", command: "rg --files", query: null, path: null }]));
    Assert.areEqual("-", title("x", [{ type: "search", command: "rg --files" }]));
    Assert.areEqual("-", title("x", [{ type: "read", command: "cat", name: "a", path: null }]));
    Assert.areEqual("-", title("x", [{ type: "unknown", command: "npm test" }]));
    Assert.areEqual("-", title("x", [{ type: "read", command: "cat a", name: "a", path: "a" }, { type: "read", command: "cat b", name: "b", path: "b" }]));
    Assert.areEqual("Viewed the git diff", title("/bin/bash -lc 'git diff'", [{ type: "unknown", command: "git diff" }]));
    Assert.areEqual("-", title("find images -name '*.png' -delete", [{ type: "search", command: "find images -name '*.png' -delete", query: "*.png", path: "images" }]));
    Assert.areEqual("-", title("cat a | tee out", [{ type: "read", command: "cat a", name: "a", path: "a" }]));
    Assert.areEqual("Read a.ts", title("pwsh -Command 'Get-Content a.ts'"));
    Assert.areEqual("-", title("git diff"));
  }

  @TestMethod
  public marksAWebSearchAndACommandWhoseEveryActionReadsListsOrSearchesAsReadOnly(): void {
    const command = (actions: unknown): unknown => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "c", type: "commandExecution", command: "x", status: "completed", exitCode: 0, commandActions: actions
    }))?.payload;
    const read = { type: "read", command: "cat a.png", name: "a.png", path: "a.png" };
    const started = CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({
      id: "c", type: "commandExecution", command: "ls", status: "inProgress", commandActions: [{ type: "listFiles", command: "ls", path: null }]
    }));
    const marked = (value: unknown): boolean => JSON.stringify(value).includes("\"readOnly\":true");

    Assert.areEqual("true,true,false,false,false,true,true", [
      command([read, { type: "listFiles", command: "ls", path: null }, { type: "search", command: "rg png", query: "png", path: null }]),
      command([read]),
      command([read, { type: "unknown", command: "magick a.png b.png" }]),
      command([{ command: "x" }]),
      command([]),
      started?.payload,
      CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "w", type: "webSearch", query: "cats" }))?.payload
    ].map(t => marked(t)).join(","));
  }

  @TestMethod
  @TestData("find images -name '*.png' -exec cp {} out/logo.png \\;")
  @TestData("find images -name '*.png' -execdir cp {} logo.png +")
  @TestData("find images -name '*.png' -ok cp {} out/logo.png \\;")
  @TestData("find images -name '*.png' -okdir cp {} logo.png \\;")
  @TestData("find images -name '*.png' -delete")
  @TestData("find images -name '*.png' -fprint out/list.png")
  @TestData("find images -name '*.png' -fprintf out/list.png %p")
  @TestData("find images -name '*.png' -fls out/list.png")
  @TestData("cat base.png | tee images/out.png")
  @TestData("cat base.png | /usr/bin/tee images/out.png")
  @TestData("Get-Content base.png | Tee-Object images/out.png")
  @TestData("find images -name '*.png' | xargs cp -t out")
  @TestData("/bin/bash -lc 'ls images/*.png | xargs mv -t out'")
  public leavesACommandThatMayWriteUnmarkedThoughCodexParsedItsActionsAsReads(command: string): void {
    const actions = [{ type: "search", command, query: "*.png", path: "images" }, { type: "listFiles", command, path: "images" }];
    const read = (text: string): unknown => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "c", type: "commandExecution", command: text, status: "completed", exitCode: 0, commandActions: actions
    }))?.payload;

    Assert.areEqual("false,true", [read(command), read("find images -name '*.png' -print")].map(t => JSON.stringify(t).includes("\"readOnly\":true")).join(","));
  }

  @TestMethod
  public titlesAWrappedCommandByTheScriptItRunsAndKeepsTheFullCall(): void {
    const read = (command: string): TurnDetail | null => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "c", type: "commandExecution", command, status: "completed", exitCode: 0, aggregatedOutput: "out"
    }));
    const pwsh = "\"C:\\\\Program Files\\\\PowerShell\\\\7\\\\pwsh.exe\" -Command 'Get-ChildItem'";
    const script = "/bin/bash -lc 'cd src\nnpm test'";

    Assert.areEqual(`$ Get-ChildItem\n${pwsh}\nout\n(exit 0)`, read(pwsh)?.text);
    Assert.areEqual(pwsh, CodexItemReaderTests.payloadOf(read(pwsh))["command"]);
    Assert.areEqual(`$ cd src …\n${script}\nout\n(exit 0)`, read(script)?.text);
    Assert.areEqual("$ npm test\nout\n(exit 0)", read("npm test")?.text);
    Assert.areEqual("$ Get-ChildItem", CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ id: "c", type: "commandExecution", command: pwsh, status: "inProgress" }))?.text.split("\n")[0]);
  }

  @TestMethod
  public readsFileChangesAndToolCalls(): void {
    const changes = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "f", type: "fileChange", status: "completed",
      changes: [{ path: "a.ts", kind: "update", diff: "-a +b" }, { path: "b.ts", kind: { type: "update", move_path: "c.ts" } }, { path: "d.ts" }]
    }));
    const mcp = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "m", type: "mcpToolCall", server: "srv", tool: "t", status: "ok" }));
    const dynamic = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "d", type: "dynamicToolCall", tool: "dyn", status: "ok" }));
    const failedDynamic = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "e", type: "dynamicToolCall", tool: "dyn", status: "failed" }));
    const unknown = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "i", type: "plugin", path: "out.png" }));
    const large = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "l", type: "blob", data: "x".repeat(5000) }));
    const output = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "f", type: "functionCallOutput", name: "request_user_input",
      output: "user_note: s3cret" }));

    Assert.areEqual(DetailKind.FileChange, changes?.kind);
    Assert.areEqual("Edited a.ts, d.ts; Moved b.ts to c.ts", changes?.text);
    const expected = {
      files: ["a.ts", "b.ts", "d.ts"],
      status: "completed",
      changes: [
        { path: "a.ts", kind: "update", diff: "-a +b" },
        { path: "b.ts", kind: "move", diff: null },
        { path: "d.ts", kind: "update", diff: null }
      ]
    };
    Assert.areEqual(JSON.stringify(expected), JSON.stringify(changes?.payload));
    Assert.areEqual("MCP tool srv/t", mcp?.text);
    Assert.areEqual("{\"server\":\"srv\",\"tool\":\"t\",\"status\":\"ok\"}", JSON.stringify(mcp?.payload));
    Assert.areEqual("Tool dyn", dynamic?.text);
    Assert.areEqual(DetailKind.Note, dynamic?.kind);
    Assert.areEqual("Tool dyn", failedDynamic?.text);
    Assert.areEqual("{\"tool\":\"dyn\",\"status\":\"failed\"}", JSON.stringify(failedDynamic?.payload));
    Assert.areEqual(DetailKind.Note, unknown?.kind);
    Assert.areEqual("Codex item plugin", unknown?.text);
    const unknownPayload = { itemType: "plugin", item: { id: "i", type: "plugin", path: "out.png" } };
    Assert.areEqual(JSON.stringify(unknownPayload), JSON.stringify(unknown?.payload));
    Assert.areEqual(JSON.stringify({ itemType: "blob" }), JSON.stringify(large?.payload));
    Assert.areEqual(JSON.stringify({ itemType: "functionCallOutput" }), JSON.stringify(output?.payload));
  }

  @TestMethod
  public readsEachChangesKindAsAStringOrAnObjectAndTitlesTheChangesByVerb(): void {
    const read = (changes: unknown[]): TurnDetail | null => CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "f", type: "fileChange", status: "completed", changes }));
    const added = read([{ path: ".gitignore", kind: { type: "add" } }, { path: "heat_diffusion.py", kind: { type: "add" } }, { path: "requirements.txt", kind: "add" }]);
    const mixed = read([
      { path: "a.ts", kind: { type: "add" }, diff: "+a" },
      { path: "b.ts", kind: { type: "update", move_path: null }, diff: "-a +b" },
      { path: "c.ts", kind: { type: "update", move_path: "e.ts" } },
      { path: "d.ts", kind: { type: "delete" } },
      { path: "f.ts", kind: "delete" },
      { path: "g.ts", kind: { type: "add", move_path: "h.ts" } }
    ]);
    const unknown = read([{ path: "a.ts", kind: { type: "rename" } }, { path: "b.ts", kind: { other: "add" } }, { path: "c.ts", kind: ["add"] }, { path: "d.ts", kind: 1 }]);

    Assert.areEqual("Added .gitignore, heat_diffusion.py, requirements.txt", added?.text);
    Assert.areEqual("Added a.ts, g.ts; Edited b.ts; Moved c.ts to e.ts; Deleted d.ts, f.ts", mixed?.text);
    Assert.areEqual("add,update,move,delete,delete,add", CodexItemReaderTests.kindsOf(mixed));
    Assert.areEqual("Changed a.ts; Edited b.ts, c.ts, d.ts", unknown?.text);
    Assert.areEqual("Changed files", read([])?.text);
    Assert.areEqual("rename,update,update,update", CodexItemReaderTests.kindsOf(unknown));
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
    const limited = read({ id: "g8", type: "imageGeneration", status: "failed", failure: { type: "usageLimitExceeded", limitId: "images", resetsAt: 1761500000 } });
    const tooLong = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({
      id: "g5", type: "imageGeneration", status: "completed", result: "iVBORw0KGgo" + "A".repeat(12_000_000)
    }));

    Assert.areEqual(DetailKind.Note, saved?.kind);
    Assert.areEqual("Generated image: D:/work/out.png", saved?.text);
    const expected = {
      itemType: "imageGeneration", status: "completed", savedPath: "D:/work/out.png", revisedPrompt: "a sphere", failure: null,
      imageData: png, mediaType: "image/png"
    };
    Assert.areEqual(JSON.stringify(expected), JSON.stringify(saved?.payload));
    Assert.areEqual("Generated image: not saved", unsaved?.text);
    Assert.areEqual("image/jpeg", CodexItemReaderTests.payloadOf(unsaved)["mediaType"]);
    Assert.areEqual("/9j/AAAA", CodexItemReaderTests.payloadOf(unsaved)["imageData"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(text)["imageData"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(text)["mediaType"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(unknownFormat)["mediaType"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(tooLong)["imageData"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(nullResult)["imageData"]);
    Assert.areEqual("Generated image: not saved", nullResult?.text);
    Assert.areEqual("failed", CodexItemReaderTests.payloadOf(nullResult)["status"]);
    Assert.isNull(CodexItemReaderTests.payloadOf(noResult)["mediaType"]);
    Assert.areEqual(JSON.stringify({ type: "usageLimitExceeded", limitId: "images", resetsAt: 1761500000 }), JSON.stringify(CodexItemReaderTests.payloadOf(limited)["failure"]));
    Assert.areEqual(JSON.stringify(["completed", "completed"]), JSON.stringify([unknownFormat, tooLong].map(t => CodexItemReaderTests.payloadOf(t)["status"])));
  }

  private static payloadOf(detail: TurnDetail | null): JsonObject {
    const payload = detail?.payload;
    if (typeof payload !== "object" || payload === null || Symbol.iterator in payload)
      throw new Error("payload");

    return payload;
  }

  @TestMethod
  public readsTeamRunsTerminalCallsAsCommandStepsThatNameTheTerminal(): void {
    const call = { id: "m1", type: "mcpToolCall", server: "teamrun", tool: "terminal_run", arguments: { terminal_id: "t1", command: "npm test" } };
    const started = CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ ...call, status: "inProgress", result: null, error: null }));
    const completed = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ ...call, status: "completed", error: null, result: {
      content: [{ type: "text", text: "ok\n\n\n[Status: Exited. Exit code: 0.]" }],
      structuredContent: { terminal_id: "t1", title: "bash - project", status: "Exited", exit_code: 0, output: "ok\n" }, _meta: null
    } }));
    const failed = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ ...call, status: "failed", result: null,
      error: { message: "user rejected MCP tool call" } }), true);

    Assert.areEqual(JSON.stringify({ server: "teamrun", tool: "terminal_run", command: "npm test", terminalId: "t1", terminalTitle: null, exitCode: null,
      status: "inProgress", title: "Run in a terminal" }), JSON.stringify(started?.payload));
    Assert.areEqual(DetailKind.Command, completed?.kind);
    Assert.areEqual("$ npm test\nok\n\n(exit 0)", completed?.text);
    Assert.areEqual("Run in bash - project", CodexItemReaderTests.payloadOf(completed)["title"]);
    Assert.areEqual("completed", CodexItemReaderTests.payloadOf(completed)["status"]);
    Assert.areEqual("m1", completed?.providerItemId);
    Assert.areEqual("$ npm test\nuser rejected MCP tool call", failed?.text);
    Assert.areEqual(JSON.stringify({ server: "teamrun", denied: true, tool: "terminal_run", command: "npm test", terminalId: "t1", terminalTitle: null,
      exitCode: null, status: "failed", title: "Run in a terminal" }), JSON.stringify(failed?.payload));
  }

  @TestMethod
  public keepsAnotherMcpCallsArgumentsAndResultAndStartsNoStepForIt(): void {
    const other = { id: "m2", type: "mcpToolCall", server: "search", tool: "terminal_run", arguments: { query: "teamrun" } };
    const started = CodexItemReaderTests.reader.readStarted(JsonReader.fromValue({ ...other, status: "inProgress" }));
    const done = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ ...other, status: "completed", result: {
      content: [{ type: "text", text: "found 2" }, { type: "image", data: "AA==" }, { type: "text", text: 3 }, "x"], structuredContent: null } }));
    const failed = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ ...other, status: "failed", error: { message: "timed out" } }));
    const large = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ ...other, arguments: { text: "x".repeat(5000) }, status: "completed",
      result: { content: "not a list" } }));
    const bare = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ id: "m3", type: "mcpToolCall", server: "search", tool: "lookup",
      status: "completed", result: [], error: "no" }));

    Assert.isNull(started);
    Assert.areEqual(DetailKind.Note, done?.kind);
    Assert.areEqual("MCP tool search/terminal_run\nfound 2", done?.text);
    Assert.areEqual(JSON.stringify({ server: "search", tool: "terminal_run", status: "completed", arguments: { query: "teamrun" } }), JSON.stringify(done?.payload));
    Assert.areEqual("MCP tool search/terminal_run\ntimed out", failed?.text);
    Assert.areEqual(JSON.stringify({ server: "search", tool: "terminal_run", status: "failed", arguments: { query: "teamrun" } }), JSON.stringify(failed?.payload));
    Assert.areEqual("MCP tool search/terminal_run", large?.text);
    Assert.areEqual(JSON.stringify({ server: "search", tool: "terminal_run", status: "completed" }), JSON.stringify(large?.payload));
    Assert.areEqual("MCP tool search/lookup", bare?.text);
  }

  @TestMethod
  public namesTheToolAndInputTeamRunsServerServedOnItsCallsStepWhenItKeepsTheInput(): void {
    const click = { id: "m4", type: "mcpToolCall", server: "teamrun", tool: "browser_click", arguments: { ref: "e5", element: "Pay" } };
    const done = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ ...click, status: "completed", result: { content: [{ type: "text", text: "Clicked." }] } }));
    const large = CodexItemReaderTests.reader.readCompleted(JsonReader.fromValue({ ...click, tool: "browser_type", arguments: { ref: "e9", text: "x".repeat(5000) },
      status: "completed", result: { content: [] } }));

    Assert.areEqual(JSON.stringify({ server: "teamrun", tool: "browser_click", status: "completed", arguments: { ref: "e5", element: "Pay" },
      servedTool: "browser_click", servedInput: { ref: "e5", element: "Pay" } }), JSON.stringify(done?.payload));
    Assert.areEqual(JSON.stringify({ server: "teamrun", tool: "browser_type", status: "completed", servedTool: "browser_type" }), JSON.stringify(large?.payload));
  }

  private static kindsOf(detail: TurnDetail | null): string {
    const changes = CodexItemReaderTests.payloadOf(detail)["changes"];
    return (changes as JsonObject[]).map(t => t["kind"]).join(",");
  }
}
