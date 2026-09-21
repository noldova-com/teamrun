/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

type Json = { [key: string]: unknown };

export class FakeCodexAppServer {
  private static readonly VERSION_LINE: string = "codex-cli 9.9.9-fake\n";
  private static readonly USER_AGENT: string = "codex-cli/9.9.9-fake (fake)";
  private threadCounter: number = 0;
  private turnCounter: number = 0;
  private nextServerRequestId: number = 1000;
  private lastThreadParams: unknown = null;
  private holding: { threadId: string; turnId: string } | null = null;
  private readonly answers: Map<number, (message: Json) => void> = new Map();
  private readonly unarchived: Set<string> = new Set();
  private busyTries: number = 0;

  public run(): void {
    if (process.argv.includes("--version")) {
      process.stdout.write(FakeCodexAppServer.VERSION_LINE);
      return;
    }
    if (!process.argv.includes("app-server")) {
      process.stderr.write("The fake only knows --version and app-server.\n");
      process.exitCode = 2;
      return;
    }
    if (process.env["TEAMRUN_FAKE_CODEX_STDERR"] === "1")
      process.stderr.write("fake stderr line\n");

    const lines = createInterface({ input: process.stdin });
    lines.on("line", line => this.handleLine(line));
    lines.on("close", () => {
      if (process.env["TEAMRUN_FAKE_CODEX_IGNORE_STDIN_END"] === "1")
        setTimeout(() => process.exit(0), 60_000);
      else
        process.exit(0);
    });
  }

  private handleLine(line: string): void {
    let message: Json;
    try {
      message = JSON.parse(line) as Json;
    }
    catch {
      return;
    }
    const id = message["id"];
    const method = message["method"];
    if (typeof method === "string" && (typeof id === "number" || typeof id === "string")) {
      this.handleRequest(id, method, (message["params"] ?? {}) as Json);
      return;
    }
    if (typeof id === "number" && this.answers.has(id)) {
      const answer = this.answers.get(id);
      this.answers.delete(id);
      answer?.(message);
    }
  }

  private handleRequest(id: number | string, method: string, params: Json): void {
    switch (method) {
      case "initialize":
        this.handleInitialize(id);
        break;
      case "account/read":
        this.handleAccountRead(id);
        break;
      case "model/list":
        if (process.env["TEAMRUN_FAKE_CODEX_MODEL_PAGES"]) {
          const pages = JSON.parse(process.env["TEAMRUN_FAKE_CODEX_MODEL_PAGES"]);
          this.respond(id, pages[Number(params["cursor"] ?? 0)]);
          break;
        }
        this.respond(id, process.env["TEAMRUN_FAKE_CODEX_MODELS"]
          ? JSON.parse(process.env["TEAMRUN_FAKE_CODEX_MODELS"])
          : { data: [{ model: "gpt-5.6-sol", hidden: false, displayName: "Sol", description: "Fixture", isDefault: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high" }, { reasoningEffort: "xhigh" }], inputModalities: ["text", "image"] }, { model: "gpt-hidden", hidden: true }], nextCursor: null });
        break;
      case "thread/start":
        this.handleThreadStart(id, params);
        break;
      case "thread/resume":
        this.lastThreadParams = params;
        if (params["threadId"] === "resumable" || (params["threadId"] === "archived" && this.unarchived.has("archived")))
          this.respond(id, { thread: { id: String(params["threadId"]) }, model: "gpt-5.6-sol", reasoningEffort: null });
        else if (params["threadId"] === "archived" || params["threadId"] === "stuck")
          this.fail(id, -32600, `session ${String(params["threadId"])} is archived. Run \`codex unarchive\` to unarchive it first.`);
        else if (params["threadId"] === "busy" && (this.busyTries += 1) < 3)
          this.fail(id, -32600, "thread busy already has an active writer");
        else if (params["threadId"] === "busy")
          this.respond(id, { thread: { id: "busy" }, model: "gpt-5.6-sol", reasoningEffort: null });
        else if (params["threadId"] === "jammed")
          this.fail(id, -32600, "thread jammed already has an active writer");
        else
          this.fail(id, -32602, "thread not found");
        break;
      case "thread/fork":
        if (params["threadId"] === "resumable" || (params["threadId"] === "archived" && this.unarchived.has("archived")))
          this.respond(id, {
            thread: { id: `fork-${String(params["threadId"])}-${String(params["lastTurnId"])}` }, model: "gpt-5.6-sol", reasoningEffort: null
          });
        else if (params["threadId"] === "archived")
          this.fail(id, -32600, "session archived is archived. Run `codex unarchive` to unarchive it first.");
        else
          this.fail(id, -32602, "thread not found");
        break;
      case "thread/unarchive":
        if (params["threadId"] === "archived") {
          this.unarchived.add("archived");
          this.respond(id, {});
        }
        else
          this.fail(id, -32602, "cannot unarchive");
        break;
      case "turn/start":
        this.handleTurnStart(id, params);
        break;
      case "turn/interrupt":
        this.handleInterrupt(id);
        break;
      case "test/never":
        break;
      case "test/empty":
        this.write({ id });
        break;
      default:
        this.fail(id, -32601, `unknown method ${method}`);
        break;
    }
  }

  private handleInitialize(id: number | string): void {
    const mode = process.env["TEAMRUN_FAKE_CODEX_INIT"];
    if (mode === "fail") {
      this.fail(id, -32000, "init failed", { detail: "x" });
      return;
    }
    if (mode === "exit") {
      process.exit(3);
    }

    this.respond(id, { userAgent: FakeCodexAppServer.USER_AGENT, codexHome: process.env["CODEX_HOME"] ?? null });
  }

  private handleAccountRead(id: number | string): void {
    switch (process.env["TEAMRUN_FAKE_CODEX_ACCOUNT"]) {
      case "none":
        this.respond(id, { account: null });
        break;
      case "apikey":
        this.respond(id, { account: { type: "apiKey" } });
        break;
      case "error":
        this.fail(id, -32000, "account unavailable");
        break;
      case "env":
        this.respond(id, { account: { type: "chatgpt", email: process.env["CODEX_HOME"] ?? "unset", planType: process.env["OPENAI_API_KEY"] ?? "no-key" } });
        break;
      default:
        this.respond(id, { account: { type: "chatgpt", email: "dev@example.com", planType: "plus" } });
        break;
    }
  }

  private handleThreadStart(id: number | string, params: Json): void {
    if (params["model"] === "explode") {
      this.fail(id, -32000, "thread refused");
      return;
    }

    this.threadCounter += 1;
    this.lastThreadParams = params;
    const config = (params["config"] ?? {}) as Json;
    this.respond(id, { thread: { id: `thread-${this.threadCounter}` }, model: params["model"] ?? "gpt-5.6-sol", reasoningEffort: config["model_reasoning_effort"] ?? null });
  }

  private handleTurnStart(id: number | string, params: Json): void {
    this.turnCounter += 1;
    const threadId = String(params["threadId"]);
    const turnId = `turn-${this.turnCounter}`;
    const input = (params["input"] as Json[] | undefined) ?? [];
    const prompt = String(input[0]?.["text"] ?? "");
    const scenario = prompt.split(" ")[0] ?? "";
    if (scenario === "attachments" || scenario === "role-payload") {
      this.respond(id, { turn: { id: turnId } });
      this.notify("item/completed", { threadId, turnId, item: { id: "input", type: "agentMessage",
        text: JSON.stringify(scenario === "attachments" ? input : { input, thread: this.lastThreadParams }) } });
      this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
      return;
    }
    if (scenario === "reject") {
      this.fail(id, -32000, "turn refused");
      return;
    }

    if (process.env["TEAMRUN_FAKE_CODEX_SLOW_TURN_START"] === "1")
      setTimeout(() => this.respond(id, { turn: { id: turnId } }), 150);
    else
      this.respond(id, { turn: { id: turnId } });
    void this.runScenario(scenario, threadId, turnId);
  }

  private handleInterrupt(id: number | string): void {
    if (process.env["TEAMRUN_FAKE_CODEX_INTERRUPT"] === "fail") {
      this.fail(id, -32000, "interrupt refused");
      return;
    }

    this.respond(id, {});
    const holding = this.holding;
    this.holding = null;
    if (holding !== null)
      this.notify("turn/completed", { threadId: holding.threadId, turn: { id: holding.turnId, status: "interrupted" } });
  }

  private async runScenario(scenario: string, threadId: string, turnId: string): Promise<void> {
    const turn = { threadId, turnId };
    switch (scenario) {
      case "complete":
        this.emitCompleteScenario(threadId, turnId);
        break;
      case "echo":
        this.notify("item/completed", { ...turn, item: { id: "echo", type: "agentMessage", text: JSON.stringify({ thread: this.lastThreadParams, codexHome: process.env["CODEX_HOME"] ?? null, apiKey: process.env["OPENAI_API_KEY"] ?? null }) } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "approve":
        await this.emitApprovalScenario(threadId, turnId);
        break;
      case "fail":
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: "boom" } } });
        break;
      case "failNoError":
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed" } });
        break;
      case "hold":
        this.holding = { threadId, turnId };
        break;
      case "exit":
        process.exit(1);
      case "garbage":
        this.emitGarbageScenario(threadId, turnId);
        break;
      case "stream":
        this.notify("item/started", { ...turn, item: { id: "s1", type: "agentMessage", text: "" } });
        this.notify("item/agentMessage/delta", { ...turn, itemId: "s1", delta: "Hello" });
        this.notify("item/agentMessage/delta", { ...turn, itemId: "s1", delta: " stream" });
        this.notify("item/agentMessage/delta", { ...turn, itemId: "s2", delta: "   " });
        this.notify("item/completed", { ...turn, item: { id: "s1", type: "agentMessage", text: "Hello stream" } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      default:
        break;
    }
  }

  private emitCompleteScenario(threadId: string, turnId: string): void {
    const turn = { threadId, turnId };
    const item = (value: Json): void => this.notify("item/completed", { ...turn, item: value });
    this.notify("item/started", { ...turn, item: { id: "item-1", type: "commandExecution", command: "npm test", status: "inProgress" } });
    this.notify("item/started", { ...turn, item: { id: "item-2", type: "agentMessage", text: "" } });
    item({ id: "item-2", type: "agentMessage", text: "Working on it", phase: "commentary" });
    item({ id: "item-2b", type: "agentMessage", text: "   " });
    item({ id: "item-3", type: "reasoning", summary: ["Think", "More"], content: [] });
    item({ id: "item-3b", type: "reasoning", content: [] });
    item({ id: "item-4", type: "plan", text: "Step 1" });
    item({ id: "item-1", type: "commandExecution", command: "npm test", exitCode: 0, status: "completed", cwd: "D:/work", aggregatedOutput: "x".repeat(4100) });
    item({ id: "item-5", type: "commandExecution", command: "ls", status: "failed", aggregatedOutput: null });
    item({
      id: "item-6", type: "fileChange", status: "completed",
      changes: [{ path: "a.ts", kind: "update", diff: "@@ -1 +1 @@\n-a\n+b" }, { path: "b.ts", kind: { move: { from: "c.ts" } } }, { path: "d.ts" }]
    });
    item({
      id: "item-6b", type: "imageGeneration", status: "completed", result: "iVBORw0KGgoAAAANSUhEUg==", savedPath: "D:/work/out.png", revisedPrompt: "a sphere"
    });
    item({ id: "item-6c", type: "plugin", name: "x" });
    item({ id: "item-7", type: "mcpToolCall", server: "srv", tool: "tool", status: "completed" });
    item({ id: "item-8", type: "dynamicToolCall", tool: "dyn", status: "completed" });
    item({ id: "item-9", type: "webSearch", query: "cats" });
    item({ id: "item-10", type: "contextCompaction" });
    item({ id: "item-11", type: "userMessage", content: [] });
    this.notify("thread/tokenUsage/updated", { ...turn, tokenUsage: { total: { totalTokens: 12 } } });
    this.notify("model/rerouted", { ...turn, fromModel: "gpt-5.6-sol", toModel: "gpt-5.6-mini", reason: "capacity" });
    this.notify("error", { ...turn, error: { message: "rate limited" }, willRetry: true });
    this.notify("error", { ...turn, error: { message: "fatal" }, willRetry: false });
    item({ id: "item-12", type: "agentMessage", text: "Done", phase: "final_answer" });
    this.notify("turn/completed", { threadId, turn: { id: "turn-other", status: "completed" } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private async emitApprovalScenario(threadId: string, turnId: string): Promise<void> {
    const turn = { threadId, turnId };
    const answers: Json[] = [];
    answers.push(await this.ask("item/commandExecution/requestApproval", { ...turn, itemId: "cmd-1", command: "rm -rf build", cwd: "D:/work", reason: "cleanup" }));
    answers.push(await this.ask("item/commandExecution/requestApproval", { ...turn, itemId: "cmd-2", command: null, reason: null }));
    answers.push(await this.ask("item/fileChange/requestApproval", { ...turn, itemId: "fc-1", reason: "apply", grantRoot: "D:/work" }));
    answers.push(await this.ask("item/fileChange/requestApproval", { ...turn, itemId: "fc-2" }));
    answers.push(await this.ask("item/tool/requestUserInput", { ...turn, itemId: "q-1", questions: [] }));
    answers.push(await this.ask("item/permissions/requestApproval", { ...turn, itemId: "p-1" }));
    answers.push(await this.ask("item/commandExecution/requestApproval", { threadId: "unknown-thread", turnId, itemId: "cmd-3" }));
    answers.push(await this.ask("item/commandExecution/requestApproval", { turnId, itemId: "cmd-4" }));
    this.notify("item/completed", { ...turn, item: { id: "answers", type: "agentMessage", text: JSON.stringify(answers) } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private emitGarbageScenario(threadId: string, turnId: string): void {
    process.stdout.write("this is not json\n");
    process.stdout.write("\n");
    process.stdout.write("[1, 2]\n");
    process.stdout.write(JSON.stringify({ id: 99999, result: {} }) + "\n");
    process.stdout.write(JSON.stringify({ foo: 1 }) + "\n");
    process.stdout.write(JSON.stringify({ method: "thread/started" }) + "\n");
    process.stdout.write(JSON.stringify({ method: "thread/started", params: null }) + "\n");
    this.notify("item/completed", { threadId: "other-thread", turnId, item: { id: "x", type: "agentMessage", text: "elsewhere" } });
    this.notify("item/completed", { threadId, turnId, item: { type: "agentMessage", text: "no id" } });
    this.notify("item/completed", { threadId, turnId, item: { id: "ok", type: "agentMessage", text: "after garbage" } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private ask(method: string, params: Json): Promise<Json> {
    const id = this.nextServerRequestId;
    this.nextServerRequestId += 1;
    return new Promise(resolveAnswer => {
      this.answers.set(id, message => resolveAnswer({ result: message["result"] ?? null, error: message["error"] ?? null }));
      this.write({ id, method, params });
    });
  }

  private respond(id: number | string, result: unknown): void {
    this.write({ id, result });
  }

  private fail(id: number | string, code: number, message: string, data?: unknown): void {
    this.write({ id, error: data === undefined ? { code, message } : { code, message, data } });
  }

  private notify(method: string, params: Json): void {
    this.write({ method, params });
  }

  private write(message: Json): void {
    process.stdout.write(JSON.stringify(message) + "\n");
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  new FakeCodexAppServer().run();
