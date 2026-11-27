/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Resources, TaskEnd, TaskStart, TurnDetail } from "@noldova/teamrun.core";
import { BackgroundTaskStatus, ConversationRewindParams, DetailKind, type Message, type MessageDetail, MessageSendParams, MessageStatus, RequestedSettings }
  from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { ToolCall } from "../../fixtures/tool-call.fixture.js";

type ProviderShape = "claude" | "codex" | "acp" | "pi";
type NoteToolShape = "acp-move" | "acp-delete" | "codex-mcp" | "claude-mcp" | "pi-mcp";

@TestClass
export class OutsideChangesTests {
  private static readonly MISSING: string = "ENOENT";

  @TestMethod
  @TestData("claude")
  @TestData("codex")
  @TestData("acp")
  @TestData("pi")
  public async listsNoChangesForAReplyThatOnlyReadWhileAFileChangedOnDisk(shape: ProviderShape): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "read.txt": "one\n", "pulled.txt": "before\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.steps = [...OutsideChangesTests.tool(shape, "read").steps, () => OutsideChangesTests.changeOutside(folder, { "pulled.txt": "after\n" })];

    const reply = await OutsideChangesTests.send(host, conversation.id);

    Assert.areEqual(MessageStatus.Completed, reply.status);
    Assert.isUndefined(OutsideChangesTests.ownChanges(reply));
    Assert.areEqual(join(folder, "pulled.txt"), OutsideChangesTests.outsideFiles(reply).join());
    Assert.isTrue(reply.details.some(t => t.text === Resources.formatOutsideChanges(["pulled.txt"])));
  }

  @TestMethod
  @TestData("claude")
  @TestData("codex")
  @TestData("acp")
  @TestData("pi")
  public async listsTheFileAReplysToolEditedButNotOneThatChangedOutsideMeanwhile(shape: ProviderShape): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "own.txt": "one\n", "other.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const { open, close } = OutsideChangesTests.tool(shape, "edit");
    host.adapter.steps = [open, () => writeFileSync(join(folder, "own.txt"), "two\n"), close,
      () => OutsideChangesTests.changeOutside(folder, { "other.txt": "two\n" })];

    const reply = await OutsideChangesTests.send(host, conversation.id);
    const own = OutsideChangesTests.ownChanges(reply);

    Assert.areEqual(Resources.formatWorkingTreeChanges("own.txt"), own?.text);
    Assert.areEqual(join(folder, "own.txt"), OutsideChangesTests.pathsOf(own, Resources.filesField).join());
    Assert.areEqual(join(folder, "other.txt"), OutsideChangesTests.outsideFiles(reply).join());
  }

  @TestMethod
  @TestData("claude")
  @TestData("codex")
  @TestData("acp")
  @TestData("pi")
  public async listsNoChangesWhenTheBranchMovesOutsideDuringAReply(shape: ProviderShape): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "kept.txt": "one\n", "gone.txt": "one\n" });
    OutsideChangesTests.git(folder, "init", "-q");
    OutsideChangesTests.git(folder, "add", "-A");
    OutsideChangesTests.git(folder, "commit", "-q", "-m", "one");
    OutsideChangesTests.git(folder, "checkout", "-q", "-b", "next");
    writeFileSync(join(folder, "kept.txt"), "two\n");
    writeFileSync(join(folder, "added.txt"), "new\n");
    OutsideChangesTests.git(folder, "rm", "-q", "gone.txt");
    OutsideChangesTests.git(folder, "add", "-A");
    OutsideChangesTests.git(folder, "commit", "-q", "-m", "two");
    OutsideChangesTests.git(folder, "checkout", "-q", "-");
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const readings: Record<string, JsonValue> = {};
    host.adapter.steps = [() => {
      readings["beforeTool"] = Date.now();
    }, ...OutsideChangesTests.tool(shape, "status").steps, () => {
      readings["afterTool"] = Date.now();
      OutsideChangesTests.git(folder, "checkout", "-q", "next");
      readings["folderBeforeLater"] = OutsideChangesTests.stampOf(folder);
      readings["goneBeforeLater"] = OutsideChangesTests.outcomeOf(join(folder, "gone.txt"));
      OutsideChangesTests.later([folder, join(folder, "kept.txt"), join(folder, "added.txt")]);
      readings["folderAfterLater"] = OutsideChangesTests.stampOf(folder);
      readings["goneAfterLater"] = OutsideChangesTests.outcomeOf(join(folder, "gone.txt"));
    }];

    const reply = await OutsideChangesTests.send(host, conversation.id);
    const own = OutsideChangesTests.ownChanges(reply);

    Assert.isUndefined(own, OutsideChangesTests.readingsOf(readings, folder, [...OutsideChangesTests.pathsOf(own, Resources.filesField),
      ...OutsideChangesTests.outsideFiles(reply)]));
    Assert.areEqual(["added.txt", "gone.txt", "kept.txt"].map(t => join(folder, t)).join(), [...OutsideChangesTests.outsideFiles(reply)].sort().join());
  }

  @TestMethod
  @TestData("acp-move")
  @TestData("acp-delete")
  @TestData("codex-mcp")
  @TestData("claude-mcp")
  @TestData("pi-mcp")
  public async listsTheFilesAToolStepReportedAsANoteChanged(shape: NoteToolShape): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "kept.txt": "one\n", "deleted.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const { open, close } = OutsideChangesTests.noteTool(shape);
    host.adapter.steps = [open, () => {
      writeFileSync(join(folder, "written.txt"), "new\n");
      rmSync(join(folder, "deleted.txt"));
    }, close];

    const reply = await OutsideChangesTests.send(host, conversation.id);

    Assert.areEqual(["deleted.txt", "written.txt"].map(t => join(folder, t)).join(),
      [...OutsideChangesTests.pathsOf(OutsideChangesTests.ownChanges(reply), Resources.filesField)].sort().join());
    Assert.areEqual(0, OutsideChangesTests.outsideFiles(reply).length);
  }

  @TestMethod
  @TestData("claude")
  @TestData("codex")
  @TestData("acp")
  @TestData("pi")
  public async listsBothNamesOfAFileAReplysToolMovedAndReportedThoughItKeepsItsOldModifiedTime(shape: ProviderShape): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "old.txt": "one\n" });
    const old = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    utimesSync(join(folder, "old.txt"), old, old);
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const { open, close } = OutsideChangesTests.tool(shape, "mv", { writes: ["old.txt", "new.txt"], unnamedWrites: [] });
    host.adapter.steps = [open, () => renameSync(join(folder, "old.txt"), join(folder, "new.txt")), close];

    const reply = await OutsideChangesTests.send(host, conversation.id);

    Assert.areEqual(["new.txt", "old.txt"].map(t => join(folder, t)).join(),
      [...OutsideChangesTests.pathsOf(OutsideChangesTests.ownChanges(reply), Resources.filesField)].sort().join());
    Assert.areEqual(0, OutsideChangesTests.outsideFiles(reply).length);
  }

  @TestMethod
  public async namesTheFirstFiveOutsideChangesAndCountsTheRest(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "keep.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const names = ["1.txt", "2.txt", "3.txt", "4.txt", "5.txt", "6.txt", "7.txt"];
    host.adapter.steps = [() => OutsideChangesTests.changeOutside(folder, Object.fromEntries(names.map(t => [t, "new\n"])))];

    const reply = await OutsideChangesTests.send(host, conversation.id);

    Assert.areEqual(names.length, OutsideChangesTests.outsideFiles(reply).length);
    Assert.isTrue(reply.details.some(t => t.text === "Changed while this reply ran, but not by its tools: 1.txt, 2.txt, 3.txt, 4.txt, 5.txt and 2 more"));
  }

  @TestMethod
  public async listsTheFilesAReplysBackgroundTaskWroteWhileItRan(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "built.txt": "one\n", "other.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.steps = [
      () => host.adapter.lastListener?.onTaskStartedAsync(new TaskStart("watch", "npm run watch", () => Promise.resolve(), null, false)),
      () => writeFileSync(join(folder, "built.txt"), "two\n"),
      () => host.adapter.lastListener?.onTaskEndedAsync(new TaskEnd("watch", BackgroundTaskStatus.Completed, 0)),
      () => OutsideChangesTests.changeOutside(folder, { "other.txt": "two\n" })
    ];

    const reply = await OutsideChangesTests.send(host, conversation.id);

    Assert.areEqual(join(folder, "built.txt"), OutsideChangesTests.pathsOf(OutsideChangesTests.ownChanges(reply), Resources.filesField).join());
    Assert.areEqual(join(folder, "other.txt"), OutsideChangesTests.outsideFiles(reply).join());
  }

  @TestMethod
  public async rewindsOnlyTheFileAReplysToolEditedLeavingFilesChangedOutsideItWhileItRanAndAfter(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = OutsideChangesTests.folder(join(host.directory.path, "repo"), { "own.txt": "one\n", "pulled.txt": "before\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const { open, close } = OutsideChangesTests.tool("codex", "edit");
    host.adapter.steps = [open, () => writeFileSync(join(folder, "own.txt"), "two\n"), close,
      () => OutsideChangesTests.changeOutside(folder, { "pulled.txt": "after\n" })];
    const reply = await OutsideChangesTests.send(host, conversation.id);
    writeFileSync(join(folder, "later.txt"), "later\n");

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, String(reply.inReplyTo), true));

    Assert.areEqual(join(folder, "pulled.txt"), OutsideChangesTests.outsideFiles(reply).join());
    Assert.areEqual(1, result.restoredFiles);
    Assert.areEqual("one\n", readFileSync(join(folder, "own.txt"), "utf8"));
    Assert.areEqual("after\n", readFileSync(join(folder, "pulled.txt"), "utf8"));
    Assert.isTrue(existsSync(join(folder, "later.txt")));
  }

  private static tool(shape: ProviderShape, id: string, reports: JsonObject = {}): ToolCall {
    switch (shape) {
      case "claude":
        return new ToolCall(new TurnDetail(DetailKind.Command, "Bash", { tool: "Bash", input: { command: "true" }, toolUseId: `use-${id}`, ...reports }, `claude-${id}`),
          new TurnDetail(DetailKind.Note, String.empty, { toolUseId: `use-${id}`, isError: false }, `claude-${id}-result`));
      case "codex":
        return new ToolCall(new TurnDetail(DetailKind.Command, "true", { command: "true", status: "inProgress", exitCode: null, ...reports }, `codex-${id}`),
          new TurnDetail(DetailKind.Command, "true", { command: "true", status: "completed", exitCode: 0 }, `codex-${id}`));
      case "acp":
        return new ToolCall(new TurnDetail(DetailKind.Command, "true", { tool: "execute", status: "in_progress", ...reports }, `acp-tool-${id}`),
          new TurnDetail(DetailKind.Command, "true", { tool: "execute", status: "completed" }, `acp-tool-${id}`));
      case "pi":
        return new ToolCall(new TurnDetail(DetailKind.Command, "bash", { tool: "bash", input: { command: "true" }, toolUseId: `pi-${id}`, ...reports }, `pi-${id}`),
          new TurnDetail(DetailKind.Command, "bash", { tool: "bash", input: { command: "true" }, toolUseId: `pi-${id}`, output: String.empty, isError: false },
            `pi-${id}`));
    }
  }

  private static noteTool(shape: NoteToolShape): ToolCall {
    switch (shape) {
      case "acp-move":
      case "acp-delete": {
        const tool = shape === "acp-move" ? "move" : "delete";
        return new ToolCall(new TurnDetail(DetailKind.Note, tool, { tool, status: "in_progress", files: [] }, "acp-tool-note"),
          new TurnDetail(DetailKind.Note, tool, { tool, status: "completed", files: [] }, "acp-tool-note"));
      }
      case "codex-mcp":
        return new ToolCall(new TurnDetail(DetailKind.Note, "fs/write_file", { server: "fs", tool: "write_file", status: "inProgress" }, "codex-mcp"),
          new TurnDetail(DetailKind.Note, "fs/write_file", { server: "fs", tool: "write_file", status: "completed" }, "codex-mcp"));
      case "claude-mcp":
        return new ToolCall(new TurnDetail(DetailKind.Note, "write_file", { tool: "mcp__fs__write_file", input: {}, toolUseId: "use-mcp" }, "claude-mcp"),
          new TurnDetail(DetailKind.Note, String.empty, { toolUseId: "use-mcp", isError: false }, "claude-mcp-result"));
      case "pi-mcp":
        return new ToolCall(new TurnDetail(DetailKind.Note, "write_file", { tool: "fs_write_file", input: {}, toolUseId: "pi-mcp" }, "pi-mcp"),
          new TurnDetail(DetailKind.Note, "write_file", { tool: "fs_write_file", input: {}, toolUseId: "pi-mcp", output: String.empty, isError: false }, "pi-mcp"));
    }
  }

  private static changeOutside(folder: string, files: Readonly<Record<string, string>>): void {
    const paths = Object.entries(files).map(([name, content]) => {
      const path = join(folder, name);
      writeFileSync(path, content);
      return path;
    });
    OutsideChangesTests.later(paths);
  }

  private static later(paths: readonly string[]): void {
    const time = new Date(Date.now() + 10 * Resources.toolWindowSlackMilliseconds);
    for (const path of paths)
      utimesSync(path, time, time);
  }

  private static readingsOf(readings: Readonly<Record<string, JsonValue>>, folder: string, paths: readonly string[]): string {
    return `The reply listed changes of its own; readings: ${JSON.stringify({ ...readings, folderAtCheck: OutsideChangesTests.stampOf(folder),
      slack: Resources.toolWindowSlackMilliseconds, paths: paths.map(t => [t, OutsideChangesTests.stampOf(t)]) })}`;
  }

  private static outcomeOf(path: string): JsonValue {
    try {
      const stats = statSync(path, { throwIfNoEntry: false });
      return Object.isUndefined(stats) ? OutsideChangesTests.MISSING : [stats.mtimeMs, stats.ctimeMs];
    }
    catch (error) {
      return Resources.formatFailureReason(error);
    }
  }

  private static stampOf(path: string): JsonValue {
    try {
      for (let current = path; ; current = dirname(current)) {
        const stats = statSync(current, { throwIfNoEntry: false });
        if (!Object.isUndefined(stats))
          return [current, stats.mtimeMs, stats.ctimeMs];
        if (dirname(current) === current)
          return null;
      }
    }
    catch (error) {
      return Resources.formatFailureReason(error);
    }
  }

  private static ownChanges(reply: Message): MessageDetail | undefined {
    return reply.details.find(t => t.kind === DetailKind.FileChange && t.text.startsWith(Resources.formatWorkingTreeChanges(String.empty)));
  }

  private static outsideFiles(reply: Message): readonly string[] {
    const note = reply.details.find(t => t.kind === DetailKind.Note && t.text.startsWith(Resources.formatOutsideChanges([])));
    return OutsideChangesTests.pathsOf(note, Resources.outsideFilesField);
  }

  private static pathsOf(detail: MessageDetail | undefined, field: string): readonly string[] {
    const payload = detail?.payload;
    const files = OutsideChangesTests.isJsonObject(payload) ? payload[field] : undefined;
    return Array.isArray(files) ? files.filter((t): t is string => Object.isString(t)) : [];
  }

  private static isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return Object.isObject(value) && !Array.isArray(value);
  }

  private static async send(host: CoreHost, conversationId: string): Promise<Message> {
    const sent = await host.engine.sendAsync(new MessageSendParams(conversationId, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(String(sent.replies[0]?.id));
    if (Object.isNullOrUndefined(reply))
      throw new Error("The reply wasn't stored.");
    return reply;
  }

  private static git(folder: string, ...args: readonly string[]): void {
    execFileSync("git", ["-c", "user.name=TeamRun", "-c", "user.email=teamrun@example.com", "-c", "commit.gpgsign=false", ...args],
      { cwd: folder, windowsHide: true, stdio: "ignore" });
  }

  private static folder(path: string, files: Readonly<Record<string, string>>): string {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(path, name)), { recursive: true });
      writeFileSync(join(path, name), content);
    }
    return path;
  }
}
