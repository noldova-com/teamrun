/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Json = { [key: string]: unknown };

export class FakePi {
  private static readonly MODELS: readonly Json[] = [
    { id: "sonnet-9", name: "Sonnet 9", provider: "anthropic", reasoning: true, input: ["text", "image"], contextWindow: 200000 },
    { id: "gpt-9", provider: "openai", reasoning: false, contextWindow: 400000 },
    { id: "gpt-10", provider: "openai", reasoning: true, thinkingLevelMap: { minimal: null, xhigh: "xhigh", max: null } }];
  private static readonly COMMANDS: readonly Json[] = [
    { name: "skill:review", description: "Review the change", source: "skill", sourceInfo: { path: "/home/user/.pi/agent/skills/review/SKILL.md", source: "local",
      scope: "user", origin: "top-level" } },
    { name: "fix-tests", source: "prompt", sourceInfo: { path: "/home/user/project/.pi/prompts/fix-tests.md", source: "local", scope: "project", origin: "top-level" } },
    { name: "bookmark", source: "extension", sourceInfo: { path: "/home/user/.pi/agent/extensions/bookmark.ts", source: "local", scope: "user", origin: "top-level" } }];
  private readonly scenario: string = process.env["TEAMRUN_FAKE_PI_TURN"] ?? "text";
  private readonly log: string | undefined = process.env["TEAMRUN_FAKE_PI_LOG"];
  private readonly sessions: string = process.env["TEAMRUN_FAKE_PI_SESSIONS"] ?? process.cwd();
  private model: Json = FakePi.MODELS[0]!;
  private thinkingLevel: string = "medium";
  private sessionFile: string | null = null;
  private holding: boolean = false;
  private approval: ((confirmed: boolean) => void) | null = null;
  private dialogs: string[] = [];
  private compacting: ((error: string) => void) | null = null;
  private buffer: string = "";

  public run(): void {
    const args = process.argv.slice(2);
    if (args.includes("--version")) {
      if (process.env["TEAMRUN_FAKE_PI_VERSION"] === "hang") {
        setInterval(() => undefined, 60_000);
        return;
      }
      process.stdout.write(`${process.env["TEAMRUN_FAKE_PI_VERSION"] ?? "1.4.0"}\n`);
      return;
    }
    if (args[0] === "auth") {
      this.record({ argv: args, agentDir: process.env["PI_CODING_AGENT_DIR"] ?? null });
      const answer = process.env["TEAMRUN_FAKE_PI_AUTH"] ?? "ready";
      if (answer === "hang") {
        setInterval(() => undefined, 60_000);
        return;
      }
      process.stdout.write(`${JSON.stringify({ status: answer })}\n`);
      process.exitCode = answer === "ready" ? 0 : answer === "not_ready" ? 1 : 2;
      return;
    }
    this.record({ argv: args, cwd: process.cwd(), agentDir: process.env["PI_CODING_AGENT_DIR"] ?? null, mode: process.env["TEAMRUN_PI_MODE"] ?? null,
      extra: process.env["TEAMRUN_FAKE_PI_EXTRA"] ?? null, toolsUrl: process.env["TEAMRUN_PI_TOOLS_URL"] ?? null,
      toolsToken: process.env["TEAMRUN_PI_TOOLS_TOKEN"] ?? null, sharedServers: process.env["TEAMRUN_PI_SHARED_SERVERS"] ?? null });
    const session = args.indexOf("--session");
    this.sessionFile = args.includes("--no-session") ? null : session >= 0 ? args[session + 1]! : this.newSession([]);
    if (process.env["TEAMRUN_FAKE_PI_DEFAULT"] === "none")
      this.model = {};
    if (process.env["TEAMRUN_FAKE_PI_DEFAULT"] === "unknown")
      this.model = { id: "unknown", provider: "unknown", api: "unknown" };
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => this.receive(chunk));
    process.stdin.on("end", () => {
      if (process.env["TEAMRUN_FAKE_PI_STAY"] === "1")
        setInterval(() => undefined, 60_000);
      else
        process.exit(0);
    });
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      this.handle(JSON.parse(line) as Json);
      index = this.buffer.indexOf("\n");
    }
  }

  private handle(command: Json): void {
    this.record(command);
    const id = command["id"];
    const type = String(command["type"]);
    const answer = (data?: unknown): void => this.write({ id, type: "response", command: type, success: true, ...data === undefined ? {} : { data } });
    const refuse = (error: string): void => this.write({ id, type: "response", command: type, success: false, error });
    switch (type) {
      case "extension_ui_response":
        this.approval?.(command["confirmed"] === true);
        this.dialogs = this.dialogs.filter(t => t !== command["id"]);
        if (this.scenario === "dialogs" && this.dialogs.length === 0)
          this.write({ type: "agent_settled", aborted: false });
        return;
      case "get_available_models":
        answer({ models: process.env["TEAMRUN_FAKE_PI_MODELS"] === "none" ? [] : FakePi.MODELS });
        return;
      case "get_commands":
        answer({ commands: process.env["TEAMRUN_FAKE_PI_COMMANDS"] === "none" ? [] : FakePi.COMMANDS });
        return;
      case "get_state":
        if (this.scenario === "no-state") {
          refuse("Not ready");
          return;
        }
        answer({ ...Object.keys(this.model).length === 0 ? {} : { model: this.model, thinkingLevel: this.thinkingLevel },
          sessionId: `session-${String(process.pid)}`, ...this.sessionFile === null ? {} : { sessionFile: this.sessionFile } });
        return;
      case "set_model": {
        const model = FakePi.MODELS.find(t => t["provider"] === command["provider"] && t["id"] === command["modelId"]);
        if (model === undefined)
          refuse(`Model not found: ${String(command["provider"])}/${String(command["modelId"])}`);
        else {
          this.model = model;
          answer(model);
        }
        return;
      }
      case "set_thinking_level":
        this.thinkingLevel = String(command["level"]);
        answer();
        return;
      case "compact":
        this.write({ type: "compaction_start", reason: "manual" });
        if (this.scenario === "compact-fails") {
          this.write({ type: "compaction_end", reason: "manual", aborted: false, willRetry: false, errorMessage: "Nothing to compact" });
          refuse("Nothing to compact");
        }
        else if (this.scenario === "compact-held")
          this.compacting = refuse;
        else if (this.scenario !== "compact-silent") {
          this.write({ type: "compaction_end", reason: "manual", result: { summary: "Summary" }, aborted: false, willRetry: false });
          answer({ summary: "Summary", firstKeptEntryId: "entry-1", tokensBefore: 1000, estimatedTokensAfter: 100 });
        }
        return;
      case "get_session_stats":
        if (this.scenario === "no-stats")
          refuse("No stats");
        else
          answer(this.scenario === "no-context" ? { tokens: {} } : { tokens: {}, cost: 1, contextUsage: { tokens: 60000, contextWindow: 200000, percent: 30 } });
        return;
      case "get_fork_messages":
        if (this.scenario === "no-entries")
          refuse("No entries");
        else
          answer({ messages: this.entries().map(t => ({ entryId: t, text: `Prompt ${t}` })) });
        return;
      case "fork": {
        const entries = this.entries();
        if (this.scenario === "fork-cancelled") {
          answer({ cancelled: true });
          return;
        }
        this.sessionFile = this.newSession(entries.slice(0, entries.indexOf(String(command["entryId"]))));
        answer({ text: "Prompt", cancelled: false });
        return;
      }
      case "clone":
        this.sessionFile = this.newSession(this.entries());
        answer({ cancelled: false });
        return;
      case "abort":
        if (this.scenario !== "deaf")
          answer();
        if (this.compacting !== null) {
          this.write({ type: "compaction_end", reason: "manual", aborted: true, willRetry: false });
          this.compacting("Compaction cancelled");
          this.compacting = null;
        }
        if (this.holding) {
          this.holding = false;
          this.write({ type: "agent_settled", aborted: true });
        }
        return;
      case "prompt":
        this.prompt(command, answer, refuse);
        return;
      case "steer":
        if (!this.holding) {
          refuse("No turn is running");
          return;
        }
        answer();
        this.holding = false;
        this.reply(command);
        this.write({ type: "agent_settled", aborted: false });
        return;
      case "never":
        return;
      case "refuse-silently":
        this.write({ id, type: "response", command: type, success: false });
        return;
      default:
        refuse(`Unknown command: ${type}`);
    }
  }

  private prompt(command: Json, answer: (data?: unknown) => void, refuse: (error: string) => void): void {
    if (this.scenario === "silent-prompt")
      return;
    if (this.scenario === "refuse-prompt") {
      refuse("Agent is busy");
      return;
    }
    if (this.sessionFile !== null && this.scenario !== "handled")
      writeFileSync(this.sessionFile, JSON.stringify([...this.entries(), `entry-${String(this.entries().length + 1)}`]));
    answer({ disposition: this.scenario === "handled" ? "handled" : "started" });
    if (this.scenario === "handled")
      return;
    this.write({ type: "agent_start" });
    this.write({ type: "message_start", message: { role: "user", content: command["message"] } });
    this.write({ type: "message_end", message: { role: "user", content: command["message"] } });
    this.write({ type: "message_start", message: { role: "assistant", content: [] } });
    switch (this.scenario) {
      case "hold":
      case "deaf":
        this.holding = true;
        return;
      case "exit":
        process.stderr.write("Pi crashed");
        process.stdout.write("", () => process.exit(3));
        return;
      case "approval":
      case "approval-held":
      case "approved-tool":
        this.ask();
        return;
      case "extras":
        this.extras();
        break;
      case "dialogs":
        this.askDialogs();
        return;
      case "error":
        this.write({ type: "message_end", message: { role: "assistant", stopReason: "error", errorMessage: "The provider failed." } });
        break;
      default:
        this.reply(command);
    }
    this.write({ type: "agent_settled", aborted: false });
  }

  private reply(command: Json): void {
    const images = Array.isArray(command["images"]) ? command["images"].length : 0;
    this.write({ type: "message_update", usage: {}, assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "Thinking" } });
    this.write({ type: "message_update", usage: {}, assistantMessageEvent: { type: "text_delta", contentIndex: 1, delta: "Hello" } });
    this.write({ type: "message_update", usage: {}, assistantMessageEvent: { type: "text_delta", contentIndex: 1, delta: images > 0 ? ` with ${String(images)} image` : " there" } });
    this.write({ type: "message_end", message: { role: "assistant", stopReason: "stop", usage: { input: 100, output: 20, cacheRead: 30, cacheWrite: 5, totalTokens: 155,
      cost: { input: 0.1, output: 0.2, total: 0.3 } } } });
  }

  private ask(): void {
    const call = this.scenario === "approved-tool" ? { toolName: "mcp__teamrun__teamrun_list_chats", input: {} } : { toolName: "bash", input: { command: "rm -rf build" } };
    this.write({ type: "extension_ui_request", id: "ui-1", method: "confirm", title: "teamrun-approval", message: JSON.stringify(call) });
    if (this.scenario === "approval-held") {
      this.holding = true;
      return;
    }
    this.approval = confirmed => {
      this.approval = null;
      this.write({ type: "tool_execution_start", toolCallId: "call-1", toolName: call.toolName, args: call.input });
      this.write({ type: "tool_execution_end", toolCallId: "call-1", toolName: call.toolName, isError: !confirmed,
        result: { content: [{ type: "text", text: confirmed ? "removed" : "The person refused this tool in TeamRun." }] } });
      this.write({ type: "agent_settled", aborted: false });
    };
  }

  private askDialogs(): void {
    this.dialogs = ["d-1", "d-2", "d-3", "d-4"];
    this.write({ type: "extension_ui_request", id: "d-1", method: "select", title: "Which target?", options: ["staging", "production"], timeout: 60000 });
    this.write({ type: "extension_ui_request", id: "d-2", method: "confirm", title: "Deploy now?", message: "It restarts the server." });
    this.write({ type: "extension_ui_request", id: "d-3", method: "input", title: "Release name?", placeholder: "v1" });
    this.write({ type: "extension_ui_request", id: "d-4", method: "editor", title: "Release notes", prefill: "" });
  }

  private extras(): void {
    process.stdout.write("not json\n\n");
    this.write({ type: "response", command: "parse", success: false, error: "Failed to parse command" });
    process.stdout.write(`${JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "one two" } })}\r\n`);
    this.write({ type: "extension_ui_request", id: "ui-2", method: "select", title: "Pick", options: ["A", "B"] });
    this.write({ type: "extension_ui_request", id: "ui-3", method: "notify", message: "Heads up" });
    this.write({ type: "extension_ui_request", id: "ui-4", method: "setStatus", statusKey: "x", statusText: "y" });
    this.write({ type: "extension_ui_request", id: "ui-5", method: "confirm", title: "teamrun-approval", message: "{" });
    this.write({ type: "tool_execution_start", toolCallId: "call-2", toolName: "edit", args: { path: "a.ts" } });
    this.write({ type: "tool_execution_end", toolCallId: "call-2", toolName: "edit", result: { content: [{ type: "image" }, { type: "text", text: "edited" }] } });
    this.write({ type: "tool_execution_start", toolCallId: "call-3", toolName: "read", args: ["odd"] });
    this.write({ type: "tool_execution_end", toolCallId: "call-3", toolName: "read", result: "plain" });
    this.write({ type: "compaction_end", reason: "threshold", result: { summary: "S" }, aborted: false, willRetry: false });
    this.write({ type: "compaction_end", reason: "threshold", aborted: false, willRetry: false, errorMessage: "too large" });
    this.write({ type: "auto_retry_start", attempt: 1, maxAttempts: 3, delayMs: 10, errorMessage: "529 overloaded" });
    this.write({ type: "extension_error", extensionPath: "/x.ts", event: "tool_call", error: "boom" });
    this.write({ type: "message_end", message: { role: "assistant", stopReason: "stop", usage: { input: 1, output: 2, cost: null } } });
    this.write({ type: "message_end", message: { role: "assistant", stopReason: "stop" } });
    this.write({ type: "queue_update", steering: [], followUp: [] });
  }

  private entries(): string[] {
    return this.sessionFile !== null && existsSync(this.sessionFile) ? JSON.parse(readFileSync(this.sessionFile, "utf8")) as string[] : [];
  }

  private newSession(entries: readonly string[]): string {
    const file = join(this.sessions, `session-${String(Date.now())}-${String(Math.random()).slice(2)}.jsonl`);
    writeFileSync(file, JSON.stringify(entries));
    return file;
  }

  private write(record: Json): void {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }

  private record(entry: Json): void {
    if (this.log !== undefined)
      appendFileSync(this.log, `${JSON.stringify(entry)}\n`);
  }
}

if (resolve(process.argv[1]!) === fileURLToPath(import.meta.url))
  new FakePi().run();
