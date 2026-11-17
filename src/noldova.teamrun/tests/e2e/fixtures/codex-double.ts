/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync } from "node:fs";
import { request } from "node:http";
import { join } from "node:path";
import { createInterface } from "node:readline";

import { JsonReader } from "@noldova/context.json";

type Json = { [key: string]: unknown };

interface IMcpClient {
  readonly transport: string;
  startAsync(): Promise<void>;
  requestAsync(method: string, params: Json): Promise<JsonReader>;
  stop(): void;
}

class HttpMcpClient implements IMcpClient {
  public readonly transport: string = "http";
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private nextId: number = 1;

  public constructor(server: JsonReader) {
    this.url = server.readString("url");
    const headers = server.hasField("http_headers") ? server.readObject("http_headers") : JsonReader.fromValue({});
    this.headers = Object.fromEntries(Object.keys(headers.toJson()).map(t => [t, headers.readString(t)]));
  }

  public async startAsync(): Promise<void> {
    await this.requestAsync("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "codex-double", version: "1.0.0" } });
    await this.postAsync({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  public async requestAsync(method: string, params: Json): Promise<JsonReader> {
    const { status, text } = await this.postAsync({ jsonrpc: "2.0", id: this.nextId++, method, params });
    try {
      return JsonReader.parse(text);
    }
    catch (error) {
      throw new Error(`The endpoint answered ${status}: ${text}`, { cause: error });
    }
  }

  public stop(): void { }

  private postAsync(message: Json): Promise<{ status: number; text: string }> {
    return new Promise<{ status: number; text: string }>((resolve, reject) => {
      const sent = request(this.url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...this.headers } },
        response => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
        });
      sent.on("error", reject);
      sent.end(JSON.stringify(message));
    });
  }

}

export class CodexDouble {
  public static readonly LOG_VARIABLE: string = "TEAMRUN_E2E_CODEX_LOG";
  public static readonly RUN_PREFIX: string = "run: ";
  public static readonly CODE_PREFIX: string = "code: ";
  public static readonly REPLY_PREFIX: string = "reply: ";
  public static readonly TOOLS_PROMPT: string = "tools";
  public static readonly TOOLS_PREFIX: string = "tools: ";
  public static readonly BROWSER_PREFIX: string = "browser: ";
  public static readonly FORM_PREFIX: string = "form: ";
  public static readonly NAVIGATE_PREFIX: string = "navigate: ";
  public static readonly NAVIGATE_OPENED: string = "opened";
  public static readonly COMMIT_PREFIX: string = "commit: ";
  public static readonly PAGE_PREFIX: string = "page: ";
  public static readonly EDIT_PAGE_PREFIX: string = "edit page: ";
  public static readonly RESHOW_PAGE_PREFIX: string = "show page again: ";
  public static readonly TEAMMATE_PREFIX: string = "teammate: ";
  public static readonly PAGE_TITLE: string = "Onboarding options";
  public static readonly FORM_NAME: string = "Ada";
  public static readonly FORM_SENT: string = "form: sent";
  public static readonly FORM_THANKS: string = "Thanks, Ada";
  public static readonly FORM_WAIT: number = 30_000;
  public static readonly SIGN_IN_PREFIX: string = "sign in: ";
  public static readonly SIGN_IN_QUERY: string = "shoes";
  public static readonly SIGN_IN_SECRET: string = "hunter2";
  public static readonly SIGN_IN_THANKS: string = "Signed in";
  public static readonly SIGN_IN_SENT: string = "sign in: sent";
  public static readonly SIGN_IN_DENIED: string = "denied";
  public static readonly SIGN_IN_AWAY: string = "http://new-site.invalid/";
  public static readonly BROWSER_DENIED: string = "The person didn't allow it.";
  private static readonly VERSION: string = "0.140.0";
  private readonly threads: Map<string, JsonReader> = new Map();
  private threadCounter: number = 0;
  private turnCounter: number = 0;

  public static log(text: string): void {
    const file = process.env[CodexDouble.LOG_VARIABLE];
    if (file !== undefined)
      appendFileSync(file, `${new Date().toISOString()} ${text}\n`);
  }

  public run(): void {
    CodexDouble.log(`started with ${process.argv.slice(2).join(" ")}`);
    if (process.argv.includes("--version")) {
      process.stdout.write(`codex-cli ${CodexDouble.VERSION}\n`);
      return;
    }
    if (!process.argv.includes("app-server")) {
      process.stderr.write("The Codex double only knows --version and app-server.\n");
      process.exitCode = 2;
      return;
    }
    const lines = createInterface({ input: process.stdin });
    lines.on("line", line => this.handleLine(line));
    lines.on("close", () => process.exit(0));
  }

  private handleLine(line: string): void {
    let message: JsonReader;
    try {
      message = JsonReader.parse(line);
    }
    catch {
      return;
    }
    const id = message.hasField("id") ? message.readValue("id") : null;
    const method = message.hasField("method") ? message.readValue("method") : null;
    const params = message.hasField("params") ? message.readNullableObject("params") : null;
    if (typeof method === "string" && (typeof id === "number" || typeof id === "string"))
      this.handleRequest(id, method, params ?? JsonReader.fromValue({}));
  }

  private handleRequest(id: number | string, method: string, params: JsonReader): void {
    CodexDouble.log(`request ${method}`);
    switch (method) {
      case "initialize":
        this.respond(id, { userAgent: `codex-cli/${CodexDouble.VERSION} (double)`, codexHome: process.env["CODEX_HOME"] ?? null });
        break;
      case "account/read":
        this.respond(id, { account: { type: "chatgpt", email: "double@example.com", planType: "plus" } });
        break;
      case "account/rateLimits/read":
        this.respond(id, { rateLimits: { limitId: "codex", primary: null, secondary: null }, rateLimitsByLimitId: null });
        break;
      case "model/list":
        this.respond(id, { data: [{ model: "double-model", hidden: false, displayName: "Double", description: "The end-to-end double", isDefault: true,
          supportedReasoningEfforts: [{ reasoningEffort: "medium" }], inputModalities: ["text", "image"] }], nextCursor: null });
        break;
      case "config/read":
        this.respond(id, { config: { model: null }, origins: {} });
        break;
      case "thread/start":
        this.handleThreadStart(id, params);
        break;
      case "thread/resume":
        this.handleThreadResume(id, params);
        break;
      case "thread/backgroundTerminals/list":
        this.respond(id, { data: [] });
        break;
      case "thread/unsubscribe":
      case "thread/archive":
      case "thread/unarchive":
      case "turn/interrupt":
        this.respond(id, {});
        break;
      case "turn/start":
        this.handleTurnStart(id, params);
        break;
      default:
        this.fail(id, -32601, `The Codex double has no ${method}.`);
        break;
    }
  }

  private handleThreadStart(id: number | string, params: JsonReader): void {
    this.threadCounter += 1;
    const threadId = `thread-${this.threadCounter}`;
    this.threads.set(threadId, params);
    const model = params.hasField("model") ? params.readValue("model") : null;
    this.respond(id, { thread: { id: threadId }, model: model ?? "double-model", reasoningEffort: null, serviceTier: null });
  }

  private handleThreadResume(id: number | string, params: JsonReader): void {
    const threadId = params.readString("threadId");
    this.threads.set(threadId, params);
    const model = params.hasField("model") ? params.readValue("model") : null;
    this.respond(id, { thread: { id: threadId }, model: model ?? "double-model", reasoningEffort: null, serviceTier: null });
  }

  private handleTurnStart(id: number | string, params: JsonReader): void {
    this.turnCounter += 1;
    const threadId = params.readString("threadId");
    const turnId = `turn-${this.turnCounter}`;
    const input = params.hasField("input") ? params.readObjectArray("input") : [];
    const prompt = input[0]?.readOptionalString("text") ?? "";
    this.respond(id, { turn: { id: turnId } });
    this.runTurnAsync(threadId, turnId, prompt).catch((error: unknown) => {
      CodexDouble.log(`turn failed: ${error instanceof Error ? error.stack : String(error)}`);
      this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: String(error) } } });
    });
  }

  private async runTurnAsync(threadId: string, turnId: string, prompt: string): Promise<void> {
    const turn = { threadId, turnId };
    const command = prompt.startsWith(CodexDouble.RUN_PREFIX) ? prompt.slice(CodexDouble.RUN_PREFIX.length).trim() : null;
    if (prompt.trim() === CodexDouble.TOOLS_PROMPT) {
      await this.listToolsAsync(turn);
      return;
    }
    if (prompt.startsWith(CodexDouble.BROWSER_PREFIX)) {
      await this.callBrowserAsync(turn, prompt.slice(CodexDouble.BROWSER_PREFIX.length).trim());
      return;
    }
    if (prompt.startsWith(CodexDouble.SIGN_IN_PREFIX)) {
      await this.signInAsync(turn, prompt.slice(CodexDouble.SIGN_IN_PREFIX.length).trim());
      return;
    }
    if (prompt.startsWith(CodexDouble.NAVIGATE_PREFIX)) {
      await this.navigateAsync(turn, prompt.slice(CodexDouble.NAVIGATE_PREFIX.length).trim());
      return;
    }
    if (prompt.startsWith(CodexDouble.FORM_PREFIX)) {
      await this.fillFormAsync(turn, prompt.slice(CodexDouble.FORM_PREFIX.length).trim());
      return;
    }
    if (prompt.startsWith(CodexDouble.RESHOW_PAGE_PREFIX)) {
      await this.reshowPageAsync(turn, prompt.slice(CodexDouble.RESHOW_PAGE_PREFIX.length).trim());
      return;
    }
    if (prompt.startsWith(CodexDouble.PAGE_PREFIX)) {
      await this.showPageAsync(turn, prompt.slice(CodexDouble.PAGE_PREFIX.length).trim());
      return;
    }
    const edit = prompt.lastIndexOf(CodexDouble.EDIT_PAGE_PREFIX);
    if (edit !== -1) {
      await this.editPageAsync(turn, prompt.slice(edit + CodexDouble.EDIT_PAGE_PREFIX.length).split("\n")[0] ?? "");
      return;
    }
    if (prompt.startsWith(CodexDouble.TEAMMATE_PREFIX)) {
      await this.addTeammateAsync(turn, prompt.slice(CodexDouble.TEAMMATE_PREFIX.length).trim().split(" "));
      return;
    }
    if (prompt.startsWith(CodexDouble.COMMIT_PREFIX)) {
      await this.commitAsync(turn, prompt.slice(CodexDouble.COMMIT_PREFIX.length).trim());
      return;
    }
    if (prompt.startsWith(CodexDouble.REPLY_PREFIX)) {
      this.answer(turn, prompt.slice(CodexDouble.REPLY_PREFIX.length));
      return;
    }
    if (prompt.startsWith(CodexDouble.CODE_PREFIX)) {
      this.answer(turn, `\`\`\`ts\n${prompt.slice(CodexDouble.CODE_PREFIX.length).trim()}\n\`\`\``);
      return;
    }
    if (command === null) {
      this.answer(turn, "The double runs only a prompt that starts with run: or is tools.");
      return;
    }
    const client = this.connect(threadId);
    try {
      await client.startAsync();
      const opened = await this.callAsync(client, turn, "open", "terminal_open", { explanation: "The end-to-end test opens a terminal." });
      const terminalId = String(opened.readObject("structuredContent").readValue("terminal_id"));
      await this.callAsync(client, turn, "run", "terminal_run", { terminal_id: terminalId, command, explanation: "The end-to-end test runs a command.",
        yield_ms: 2000 });
    }
    finally {
      client.stop();
    }
    this.answer(turn, "The command is running.");
  }

  private async callBrowserAsync(turn: { threadId: string; turnId: string }, tool: string): Promise<void> {
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      await this.callAsync(client, turn, "browser", tool, {}).catch(() => null);
    }
    finally {
      client.stop();
    }
    this.answer(turn, `${CodexDouble.BROWSER_PREFIX}${tool} ended.`);
  }

  private async commitAsync(turn: { threadId: string; turnId: string }, message: string): Promise<void> {
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      await this.callAsync(client, turn, "commit", "git_commit", { message });
    }
    finally {
      client.stop();
    }
    this.answer(turn, `${CodexDouble.COMMIT_PREFIX}done`);
  }

  private async showPageAsync(turn: { threadId: string; turnId: string }, path: string): Promise<void> {
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      const [shown, failure] = await this.callOrFailAsync(client, turn, "show", "teamrun_show_page", { path, title: CodexDouble.PAGE_TITLE });
      const page = shown === null ? null : JsonReader.parse(CodexDouble.textOf(shown));
      this.answer(turn, page === null ? `${CodexDouble.PAGE_PREFIX}${failure}`
        : `${CodexDouble.PAGE_PREFIX}v${page.readInteger("version")} made by ${page.readObject("madeBy").readString("name")}`);
    }
    finally {
      client.stop();
    }
  }

  private async reshowPageAsync(turn: { threadId: string; turnId: string }, path: string): Promise<void> {
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      const listed = JsonReader.parse(CodexDouble.textOf(await this.callAsync(client, turn, "list", "teamrun_list_pages", {})));
      const id = listed.readObjectArray("pages")[0]?.readString("id") ?? "";
      const read = JsonReader.parse(CodexDouble.textOf(await this.callAsync(client, turn, "read", "teamrun_read_page", { page_id: id })));
      const shown = JsonReader.parse(CodexDouble.textOf(await this.callAsync(client, turn, "show", "teamrun_show_page",
        { path, title: CodexDouble.PAGE_TITLE, page_id: id, base_version: read.readInteger("version") })));
      this.answer(turn, `${CodexDouble.RESHOW_PAGE_PREFIX}v${shown.readInteger("version")}`);
    }
    finally {
      client.stop();
    }
  }

  private async editPageAsync(turn: { threadId: string; turnId: string }, edit: string): Promise<void> {
    const [find = "", replace = ""] = edit.split(" => ");
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      const listed = JsonReader.parse(CodexDouble.textOf(await this.callAsync(client, turn, "list", "teamrun_list_pages", {})));
      const id = listed.readObjectArray("pages")[0]?.readString("id") ?? "";
      const read = JsonReader.parse(CodexDouble.textOf(await this.callAsync(client, turn, "read", "teamrun_read_page", { page_id: id })));
      const edited = JsonReader.parse(CodexDouble.textOf(await this.callAsync(client, turn, "edit", "teamrun_edit_page",
        { page_id: id, base_version: read.readInteger("version"), edits: [{ find, replace }] })));
      this.answer(turn, `${CodexDouble.EDIT_PAGE_PREFIX}v${edited.readInteger("version")} made by ${edited.readObject("madeBy").readString("name")}, `
        + `edited by ${edited.readObject("editedBy").readString("name")}`);
    }
    finally {
      client.stop();
    }
  }

  private async addTeammateAsync(turn: { threadId: string; turnId: string }, [name = "", providerId = "", chatId = ""]: readonly string[]): Promise<void> {
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      const created = CodexDouble.textOf(await this.callAsync(client, turn, "create", "teamrun_create_teammate", { name, provider_id: providerId }));
      const teammateId = /"id":"([^"]+)"/u.exec(created)?.[1] ?? "";
      await this.callAsync(client, turn, "add", "teamrun_add_teammate_to_chat", { chat_id: chatId, teammate_id: teammateId });
      this.answer(turn, `${CodexDouble.TEAMMATE_PREFIX}${name} added`);
    }
    finally {
      client.stop();
    }
  }

  private async navigateAsync(turn: { threadId: string; turnId: string }, url: string): Promise<void> {
    const client = this.connect(turn.threadId);
    let outcome = "";
    try {
      await client.startAsync();
      const [result, failure] = await this.callOrFailAsync(client, turn, "open", "browser_navigate", { url });
      outcome = result === null ? failure : CodexDouble.NAVIGATE_OPENED;
    }
    finally {
      client.stop();
    }
    CodexDouble.log(`${CodexDouble.NAVIGATE_PREFIX}${url} ${outcome}`);
    this.answer(turn, `${CodexDouble.NAVIGATE_PREFIX}${outcome}`);
  }

  private async fillFormAsync(turn: { threadId: string; turnId: string }, url: string): Promise<void> {
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      await this.callAsync(client, turn, "open", "browser_navigate", { url });
      const page = CodexDouble.textOf(await this.callAsync(client, turn, "read", "browser_snapshot", {}));
      await this.callAsync(client, turn, "type", "browser_type", { reference: CodexDouble.referenceOf(page, "textbox", "Name"), text: CodexDouble.FORM_NAME });
      await this.callAsync(client, turn, "send", "browser_click", { reference: CodexDouble.referenceOf(page, "button", "Send") });
      await this.callAsync(client, turn, "wait", "browser_wait_for", { text: CodexDouble.FORM_THANKS, timeoutMilliseconds: CodexDouble.FORM_WAIT });
      await this.callAsync(client, turn, "check", "browser_snapshot", {});
    }
    finally {
      client.stop();
    }
    this.answer(turn, CodexDouble.FORM_SENT);
  }

  private async signInAsync(turn: { threadId: string; turnId: string }, url: string): Promise<void> {
    const client = this.connect(turn.threadId);
    try {
      await client.startAsync();
      await this.callAsync(client, turn, "open", "browser_navigate", { url });
      const page = CodexDouble.textOf(await this.callAsync(client, turn, "read", "browser_snapshot", {}));
      await this.callAfterDenialAsync(client, turn, "find", "browser_type", { reference: CodexDouble.referenceOf(page, "textbox", "Query"), text: CodexDouble.SIGN_IN_QUERY });
      await this.callAfterDenialAsync(client, turn, "search", "browser_press_key", { key: "Enter" });
      await this.callAfterDenialAsync(client, turn, "note", "browser_click", { reference: CodexDouble.referenceOf(page, "button", "Note") });
      await this.callAfterDenialAsync(client, turn, "secret", "browser_type", { reference: CodexDouble.referenceOf(page, "textbox", "Password"), text: CodexDouble.SIGN_IN_SECRET });
      await this.callAfterDenialAsync(client, turn, "signin", "browser_click", { reference: CodexDouble.referenceOf(page, "button", "Sign in") });
      await this.callAsync(client, turn, "wait", "browser_wait_for", { text: CodexDouble.SIGN_IN_THANKS, timeoutMilliseconds: CodexDouble.FORM_WAIT });
      const signedIn = CodexDouble.textOf(await this.callAsync(client, turn, "read-again", "browser_snapshot", {}));
      await this.callAfterDenialAsync(client, turn, "continue", "browser_click", { reference: CodexDouble.referenceOf(signedIn, "button", "Continue") });
      await this.callDeniedAsync(client, turn, "away", "browser_navigate", { url: CodexDouble.SIGN_IN_AWAY });
    }
    finally {
      client.stop();
    }
    this.answer(turn, CodexDouble.SIGN_IN_SENT);
  }

  private static textOf(result: JsonReader): string {
    return result.readObjectArray("content").map(t => t.hasField("text") ? t.readString("text") : "").join("\n");
  }

  private static referenceOf(snapshot: string, role: string, name: string): string {
    const line = snapshot.split("\n").find(t => t.trimStart().startsWith(`- ${role} ${JSON.stringify(name)}`));
    const reference = line?.match(/\[([^\]]+)\]$/u)?.[1];
    if (reference === undefined)
      throw new Error(`The page shows no ${role} named ${name}: ${snapshot}`);
    return reference;
  }

  private async listToolsAsync(turn: { threadId: string; turnId: string }): Promise<void> {
    const client = this.connect(turn.threadId);
    let names: string[];
    try {
      await client.startAsync();
      const answer = await client.requestAsync("tools/list", {});
      names = answer.readObject("result").readObjectArray("tools").map(t => t.readString("name")).sort();
    }
    finally {
      client.stop();
    }
    CodexDouble.log(`${CodexDouble.TOOLS_PREFIX}${names.join(" ")}`);
    this.answer(turn, `${CodexDouble.TOOLS_PREFIX}${names.join(" ")}`);
  }

  private connect(threadId: string): IMcpClient {
    const thread = this.threads.get(threadId);
    const config = thread?.hasField("config") === true ? thread.readNullableObject("config") : null;
    const servers = config?.hasField("mcp_servers") === true ? config.readNullableObject("mcp_servers") : null;
    const server = servers?.hasField("teamrun") === true ? servers.readObject("teamrun") : null;
    if (server === null || !server.hasField("url"))
      throw new Error("The thread has no TeamRun MCP endpoint.");
    const client: IMcpClient = new HttpMcpClient(server);
    CodexDouble.log(`transport: ${client.transport}`);

    return client;
  }

  private answer(turn: { threadId: string; turnId: string }, text: string): void {
    this.notify("item/completed", { ...turn, item: { id: "answer", type: "agentMessage", text, phase: "final_answer" } });
    this.notify("turn/completed", { threadId: turn.threadId, turn: { id: turn.turnId, status: "completed" } });
  }

  private async callAsync(client: IMcpClient, turn: Json, itemId: string, tool: string, args: Json): Promise<JsonReader> {
    const [result, failure] = await this.callOrFailAsync(client, turn, itemId, tool, args);
    if (result === null)
      throw new Error(`${tool} failed: ${failure}`);
    return result;
  }

  private async callAfterDenialAsync(client: IMcpClient, turn: Json, itemId: string, tool: string, args: Json): Promise<void> {
    await this.callDeniedAsync(client, turn, itemId, tool, args);
    await this.callAsync(client, turn, `${itemId}-again`, tool, args);
  }

  private async callDeniedAsync(client: IMcpClient, turn: Json, itemId: string, tool: string, args: Json): Promise<void> {
    const [result, failure] = await this.callOrFailAsync(client, turn, itemId, tool, args);
    if (result !== null || !failure.includes(CodexDouble.BROWSER_DENIED))
      throw new Error(`${tool} wasn't denied by the person: ${failure}`);
    CodexDouble.log(`${CodexDouble.SIGN_IN_PREFIX}${itemId} ${CodexDouble.SIGN_IN_DENIED}`);
  }

  private async callOrFailAsync(client: IMcpClient, turn: Json, itemId: string, tool: string, args: Json): Promise<[JsonReader | null, string]> {
    const item = { id: itemId, type: "mcpToolCall", server: "teamrun", tool, arguments: args };
    this.notify("item/started", { ...turn, item: { ...item, status: "inProgress" } });
    const answer = await client.requestAsync("tools/call", { name: tool, arguments: args });
    const result = answer.hasField("result") ? answer.readNullableObject("result") : null;
    const failed = result === null || result.hasField("isError") && result.readValue("isError") === true;
    CodexDouble.log(`${tool}: ${JSON.stringify(answer.toJson())}`);
    this.notify("item/completed", { ...turn, item: { ...item, status: failed ? "failed" : "completed", result: result?.toJson() ?? null,
      ...answer.hasField("error") ? { error: answer.readValue("error") } : {} } });
    if (result === null)
      return [null, JSON.stringify(answer.toJson())];
    return failed ? [null, CodexDouble.textOf(result)] : [result, ""];
  }

  private respond(id: number | string, result: unknown): void {
    this.write({ id, result });
  }

  private fail(id: number | string, code: number, message: string): void {
    this.write({ id, error: { code, message } });
  }

  private notify(method: string, params: Json): void {
    this.write({ method, params });
  }

  private write(message: Json): void {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  }
}

if (process.argv[1] !== undefined && join(process.argv[1]) === join(import.meta.filename))
  new CodexDouble().run();
