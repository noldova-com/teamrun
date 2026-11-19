/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

type Json = { [key: string]: unknown };

export class FakeCodexAppServer {
  private static readonly VERSION_LINE: string = "codex-cli 9.9.9\n";
  private static readonly USER_AGENT: string = "codex-cli/9.9.9 (fake)";
  private threadCounter: number = 0;
  private turnCounter: number = 0;
  private loginCounter: number = 0;
  private nextServerRequestId: number = 1000;
  private lastThreadParams: Json | null = null;
  private lastConfigReadParams: unknown = null;
  private readonly storedSettings: Map<string, Json> = new Map();
  private lastForkParams: unknown = null;
  private lastResumeParams: unknown = null;
  private lastCollaboration: unknown = null;
  private lastTurnPolicy: unknown = null;
  private lastTurnSettings: unknown = null;
  private readonly collaborations: Map<string, unknown> = new Map();
  private readonly holding: Map<string, string> = new Map();
  private readonly acceptedInterrupts: { threadId: string; turnId: string }[] = [];
  private subAgentResult: string | null = null;
  private afterSubAgentEnd: (() => void) | null = null;
  private interrupts: number = 0;
  private heldStart: (() => void) | null = null;
  private readonly heldAnswers: (() => void)[] = [];
  private holdsTurnStart: boolean = process.env["TEAMRUN_FAKE_CODEX_HOLD_TURN_START"] === "1";
  private readonly answers: Map<number, (message: Json) => void> = new Map();
  private readonly unarchived: Set<string> = new Set();
  private readonly loaded: Map<string, { params: Json; subscribed: boolean; failed: boolean; running: boolean }> = new Map();
  private readonly archivedThreads: Set<string> = new Set();
  private readonly stored: Set<string> = new Set((process.env["TEAMRUN_FAKE_CODEX_STORED"] ?? "").split(",").filter(t => t.length > 0));
  private readonly archives: string[] = [];
  private readonly names: string[][] = [];
  private readonly nameTries: string[] = [];
  private readonly unarchives: string[] = [];
  private readonly unsubscribes: string[] = [];
  private readonly terminates: unknown[] = [];
  private readonly terminals: Map<string, Json[]> = new Map();
  private endsTerminal: boolean = false;
  private pendingResume: (() => void) | null = null;
  private beforeInterrupted: (() => void) | null = null;
  private unarchiveRefused: boolean = false;
  private busyTries: number = 0;
  private signedIn: boolean = false;
  private signedOut: boolean = false;
  private readonly usageTurns: Map<string, number> = new Map();

  public run(): void {
    if (process.argv.includes("--version")) {
      const answer = (): void => {
        const version = FakeCodexAppServer.version();
        process.stdout.write(version === undefined ? FakeCodexAppServer.VERSION_LINE : `codex-cli ${version}\n`);
      };
      const release = process.env["TEAMRUN_FAKE_CODEX_VERSION_RELEASE"];
      if (release === undefined)
        answer();
      else
        FakeCodexAppServer.holdVersionRead(release, answer);
      return;
    }
    if (process.argv.slice(2).join(" ") === "login status") {
      const account = process.env["TEAMRUN_FAKE_CODEX_ACCOUNT"];
      process.stderr.write(account === "none" ? "Not logged in\n" : account === "error" ? "Error: unreadable auth.json\n" : "Logged in using ChatGPT\n");
      process.exitCode = account === "none" ? 1 : account === "error" ? 2 : 0;
      return;
    }
    if (!process.argv.includes("app-server")) {
      process.stderr.write("The fake only knows --version, login status and app-server.\n");
      process.exitCode = 2;
      return;
    }
    if (process.env["TEAMRUN_FAKE_CODEX_START"] === "mismatch") {
      process.stderr.write("Error: the CLI package version does not match its executable\n");
      process.exitCode = 1;
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
    if (method === "account/read" && this.heldStart !== null) {
      this.heldStart();
      this.heldStart = null;
    }
    if (method === "model/list")
      this.heldAnswers.splice(0).forEach(t => t());
    switch (method) {
      case "initialize":
        this.handleInitialize(id);
        break;
      case "account/read":
        this.handleAccountRead(id);
        break;
      case "account/rateLimits/read":
        if (process.env["TEAMRUN_FAKE_CODEX_RATE_LIMITS"] === "fail")
          this.fail(id, -32603, "rate limits unavailable");
        else if (process.env["TEAMRUN_FAKE_CODEX_RATE_LIMITS"] === "none")
          this.respond(id, { rateLimits: null, rateLimitsByLimitId: null });
        else
          this.respond(id, { rateLimits: { limitId: "codex", primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1_792_656_000 },
            secondary: { usedPercent: 60, windowDurationMins: 10080, resetsAt: null } }, rateLimitsByLimitId: null });
        break;
      case "model/list":
        if (process.env["TEAMRUN_FAKE_CODEX_MODEL_PAGES"]) {
          const pages = JSON.parse(process.env["TEAMRUN_FAKE_CODEX_MODEL_PAGES"]);
          this.respond(id, pages[Number(params["cursor"] ?? 0)]);
          break;
        }
        if (process.env["TEAMRUN_FAKE_CODEX_MODEL_LIST"] === "hold" && existsSync(join(String(process.env["CODEX_HOME"]), "model-list-armed"))
          && FakeCodexAppServer.claim(join(String(process.env["CODEX_HOME"]), "model-list-held"))) {
          FakeCodexAppServer.holdUntilReleased("model-list", id,
            () => this.respond(id, { data: [{ model: "gpt-5.6-sol", hidden: false, displayName: "Sol", description: "Fixture", isDefault: true }], nextCursor: null }));
          break;
        }
        this.respond(id, process.env["TEAMRUN_FAKE_CODEX_MODELS"]
          ? JSON.parse(process.env["TEAMRUN_FAKE_CODEX_MODELS"])
          : { data: [{ model: "gpt-5.6-sol", hidden: false, displayName: "Sol", description: "Fixture", isDefault: true,
            supportedReasoningEfforts: [{ reasoningEffort: "high" }, { reasoningEffort: "xhigh" }], inputModalities: ["text", "image"] }, { model: "gpt-hidden", hidden: true }], nextCursor: null });
        break;
      case "config/read":
        this.handleConfigRead(id, params);
        break;
      case "thread/start":
        this.handleThreadStart(id, params);
        break;
      case "thread/resume":
        this.lastThreadParams = params;
        this.lastResumeParams = params;
        if (FakeCodexAppServer.startsMcpServers(params))
          this.fail(id, -32000, "the person's MCP servers would start");
        else if (this.loaded.has(String(params["threadId"])))
          this.resumeLoaded(id, params);
        else if (this.stored.has(String(params["threadId"])))
          this.resumeStored(id, params);
        else if (this.archivedThreads.has(String(params["threadId"])))
          this.fail(id, -32600, `session ${String(params["threadId"])} is archived. Run \`codex unarchive\` to unarchive it first.`);
        else if (params["threadId"] === "resumable" || (params["threadId"] === "archived" && this.unarchived.has("archived")))
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
        if (process.env["TEAMRUN_FAKE_CODEX_FORK"] === "hold")
          FakeCodexAppServer.holdUntilReleased("fork", id, () => this.respond(id, { thread: { id: "fork-held" }, model: "gpt-5.6-sol", reasoningEffort: null }));
        else if (FakeCodexAppServer.startsMcpServers(params))
          this.fail(id, -32000, "the person's MCP servers would start");
        else if (params["threadId"] === "resumable" || (params["threadId"] === "archived" && this.unarchived.has("archived"))) {
          this.lastForkParams = params;
          this.respond(id, {
            thread: { id: params["lastTurnId"] === undefined ? `fork-${String(params["threadId"])}` : `fork-${String(params["threadId"])}-${String(params["lastTurnId"])}` },
            model: "gpt-5.6-sol", reasoningEffort: null
          });
        }
        else if (params["threadId"] === "archived")
          this.fail(id, -32600, "session archived is archived. Run `codex unarchive` to unarchive it first.");
        else
          this.fail(id, -32602, "thread not found");
        break;
      case "thread/unsubscribe":
        this.handleUnsubscribe(id, params);
        break;
      case "thread/backgroundTerminals/list":
        this.handleTerminalList(id, params);
        break;
      case "thread/backgroundTerminals/terminate":
        this.handleTerminate(id, params);
        break;
      case "thread/archive":
        this.handleArchive(id, params);
        break;
      case "thread/name/set":
        this.handleNameSet(id, params);
        break;
      case "review/start":
        this.handleReviewStart(id, params);
        break;
      case "thread/unarchive":
        if (this.archivedThreads.has(String(params["threadId"])))
          this.handleUnarchive(id, params);
        else if (params["threadId"] === "archived") {
          this.unarchived.add("archived");
          this.respond(id, {});
        }
        else
          this.fail(id, -32602, "cannot unarchive");
        break;
      case "turn/start":
        this.handleTurnStart(id, params);
        break;
      case "thread/compact/start":
        this.handleCompactStart(id, params);
        break;
      case "turn/interrupt":
        this.handleInterrupt(id, params);
        break;
      case "turn/steer":
        this.handleSteer(id, params);
        break;
      case "account/login/start":
        this.handleLoginStart(id, params);
        break;
      case "account/login/cancel":
        this.handleLoginCancel(id, params);
        break;
      case "account/logout":
        if (process.env["TEAMRUN_FAKE_CODEX_LOGOUT"] === "fail")
          this.fail(id, -32603, "logout failed");
        else {
          this.signedIn = false;
          this.signedOut = true;
          this.respond(id, {});
        }
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
    if (mode === "hang") {
      FakeCodexAppServer.mark("initialize-held", String(id));
      setTimeout(() => process.exit(4), 60_000);
      return;
    }

    const version = FakeCodexAppServer.version();
    const userAgent = process.env["TEAMRUN_FAKE_CODEX_USER_AGENT"] ?? (version === undefined ? FakeCodexAppServer.USER_AGENT : `codex-cli/${version} (fake)`);
    this.respond(id, { userAgent, codexHome: process.env["CODEX_HOME"] ?? null });
  }

  private handleLoginStart(id: number | string, params: Json): void {
    const pages = process.env["TEAMRUN_FAKE_CODEX_AUTH_URLS"] ? JSON.parse(process.env["TEAMRUN_FAKE_CODEX_AUTH_URLS"]) as string[] : [];
    const started = { type: "chatgpt", loginId: "login-1", authUrl: pages[this.loginCounter++] ?? "https://auth.openai.com/oauth/authorize?state=fake" };
    if (pages.length > 0)
      FakeCodexAppServer.mark("login-starts", String(this.loginCounter));
    const completed = (success: boolean, error: string | null): void => this.notify("account/login/completed", { loginId: "login-1", success, error });
    if (params["type"] !== "chatgpt") {
      this.fail(id, -32600, "only chatgpt sign-in is faked");
      return;
    }
    switch (process.env["TEAMRUN_FAKE_CODEX_LOGIN"]) {
      case "refuse":
        this.fail(id, -32600, "ChatGPT login is disabled. Use API key login instead.");
        break;
      case "early":
        this.signedIn = true;
        completed(true, null);
        this.respond(id, started);
        break;
      case "fail":
        this.respond(id, started);
        completed(false, "Login server error: access denied");
        break;
      case "failNoError":
        this.respond(id, started);
        completed(false, null);
        break;
      case "hold":
      case "holdRefusingCancel":
      case "holdIgnoringCancel":
        FakeCodexAppServer.mark("login-started", String(id));
        this.respond(id, started);
        break;
      case "holdStart":
        FakeCodexAppServer.mark("login-started", String(id));
        this.heldStart = () => this.respond(id, started);
        break;
      case "unreadable":
        this.respond(id, started);
        this.notify("account/login/completed", { loginId: "login-1", success: "yes", error: null });
        break;
      case "exit":
        this.respond(id, started);
        process.exit(3);
      default:
        this.respond(id, started);
        this.notify("account/updated", { authMode: null });
        this.notify("account/login/completed", { loginId: null, success: true, error: null });
        this.notify("account/login/completed", { loginId: "login-0", success: false, error: "an earlier login" });
        this.signedIn = true;
        completed(true, null);
        break;
    }
  }

  private handleLoginCancel(id: number | string, params: Json): void {
    if (process.env["TEAMRUN_FAKE_CODEX_LOGIN"] === "holdRefusingCancel") {
      this.fail(id, -32600, "no such login");
      return;
    }
    FakeCodexAppServer.mark("login-cancelled", String(params["loginId"]));
    if (process.env["TEAMRUN_FAKE_CODEX_LOGIN"] === "holdIgnoringCancel")
      return;
    this.respond(id, { status: "canceled" });
    this.notify("account/login/completed", { loginId: params["loginId"], success: false, error: "Login was not completed" });
  }

  private handleAccountRead(id: number | string): void {
    if (this.signedOut) {
      this.respond(id, { account: null, requiresOpenaiAuth: true });
      return;
    }
    if (this.signedIn) {
      this.respond(id, { account: { type: "chatgpt", email: "signed-in@example.com", planType: "pro" } });
      return;
    }
    switch (process.env["TEAMRUN_FAKE_CODEX_ACCOUNT"]) {
      case "none":
        this.respond(id, { account: null, requiresOpenaiAuth: true });
        break;
      case "noauth":
        this.respond(id, { account: null, requiresOpenaiAuth: false });
        break;
      case "hang":
        FakeCodexAppServer.mark("account-read", String(id));
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

  private static configured(cwd: unknown = null): Json {
    return JSON.parse((cwd === null ? null : process.env["TEAMRUN_FAKE_CODEX_PROJECT_CONFIG"]) ?? process.env["TEAMRUN_FAKE_CODEX_CONFIG"] ?? "{}") as Json;
  }

  private handleConfigRead(id: number | string, params: Json): void {
    this.lastConfigReadParams = params;
    const servers = process.env["TEAMRUN_FAKE_CODEX_MCP_SERVERS"];
    if (servers === "fail")
      this.fail(id, -32000, "config unreadable");
    else
      this.respond(id, { config: { ...servers === undefined ? { model: null } : { model: null, mcp_servers: JSON.parse(servers) }, ...FakeCodexAppServer.configured(params["cwd"] ?? null) }, origins: {} });
    const pending = this.pendingResume;
    this.pendingResume = null;
    pending?.();
  }

  private handleThreadStart(id: number | string, params: Json): void {
    if (params["model"] === "explode") {
      this.fail(id, -32000, "thread refused");
      return;
    }
    if (FakeCodexAppServer.startsMcpServers(params)) {
      this.fail(id, -32000, "the person's MCP servers would start");
      return;
    }

    this.threadCounter += 1;
    this.lastThreadParams = params;
    this.loaded.set(`thread-${this.threadCounter}`, { params, subscribed: true, failed: false, running: false });
    for (const status of JSON.parse(process.env["TEAMRUN_FAKE_CODEX_MCP_STARTUP"] ?? "[]") as Json[])
      this.notify("mcpServer/startupStatus/updated", { threadId: `thread-${this.threadCounter}`, ...status });
    const config = (params["config"] ?? {}) as Json;
    const configured = FakeCodexAppServer.configured(params["cwd"] ?? null);
    const stored = { model: params["model"] ?? configured["model"] ?? "gpt-5.6-sol", reasoningEffort: config["model_reasoning_effort"] ?? configured["model_reasoning_effort"] ?? null };
    this.storedSettings.set(`thread-${this.threadCounter}`, stored);
    this.respond(id, { thread: { id: `thread-${this.threadCounter}` }, ...stored,
      ...process.env["TEAMRUN_FAKE_CODEX_OMITS_TIER"] === "1" ? {} : { serviceTier: process.env["TEAMRUN_FAKE_CODEX_SERVED_TIER"] ?? params["serviceTier"] ?? null } });
  }

  private resumeLoaded(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    const mode = process.env["TEAMRUN_FAKE_CODEX_RESUME"];
    if (mode === "fails") {
      this.fail(id, -32000, "resume refused");
      return;
    }
    if (mode === "endsTasks" && (this.terminals.get(threadId)?.length ?? 0) > 0) {
      this.terminals.delete(threadId);
      this.notify("item/completed", { threadId, turnId: "turn-done", item: { id: "server", type: "commandExecution", command: "npm run dev", processId: "p-1",
        status: "completed", exitCode: 0, aggregatedOutput: "starting\n" } });
      this.pendingResume = () => this.resumeLoaded(id, params);
      return;
    }
    const thread = this.loaded.get(threadId);
    if (thread === undefined) {
      this.fail(id, -32600, "thread not loaded");
      return;
    }
    if (!thread.subscribed && !thread.failed && !thread.running)
      thread.params = params;
    thread.subscribed = true;
    this.lastThreadParams = thread.params;
    const named = (params["config"] ?? {}) as Json;
    const overrides = params["model"] !== null && params["model"] !== undefined || named["model_reasoning_effort"] !== undefined;
    const configured = FakeCodexAppServer.configured(params["cwd"] ?? null);
    const settings = overrides ? { model: params["model"] ?? configured["model"] ?? "gpt-5.6-sol", reasoningEffort: named["model_reasoning_effort"] ?? configured["model_reasoning_effort"] ?? null }
      : this.storedSettings.get(threadId) ?? { model: "gpt-5.6-sol", reasoningEffort: null };
    this.respond(id, { thread: { id: String(params["threadId"]) }, ...settings,
      ...this.collaborations.has(threadId) && process.env["TEAMRUN_FAKE_CODEX_PLAN"] !== "unreported" ? { collaborationMode: this.collaborations.get(threadId) } : {} });
  }

  private static whereOf(params: Json, archives: number): string {
    const config = (params["config"] ?? {}) as Json;
    return [params["cwd"], params["developerInstructions"], config["model_context_window"] ?? "none", archives].join(" ");
  }

  private resumeStored(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    this.stored.delete(threadId);
    this.loaded.set(threadId, { params, subscribed: true, failed: false, running: false });
    this.respond(id, { thread: { id: threadId }, model: "gpt-5.6-sol", reasoningEffort: null });
  }

  private handleArchive(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    this.archives.push(threadId);
    if (process.env["TEAMRUN_FAKE_CODEX_ARCHIVE"] === "fail" || !this.loaded.has(threadId)) {
      this.fail(id, -32000, "archive refused");
      return;
    }

    this.loaded.delete(threadId);
    this.holding.delete(threadId);
    this.archivedThreads.add(threadId);
    FakeCodexAppServer.mark("archived", this.archives.join(","));
    this.respond(id, {});
  }

  private handleNameSet(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    this.nameTries.push(threadId);
    if (process.env["TEAMRUN_FAKE_CODEX_NAME"] === "refuse") {
      this.fail(id, -32000, "rename refused");
      return;
    }
    if (process.env["TEAMRUN_FAKE_CODEX_NAME"] === "refuseAfterUnarchive" && this.unarchives.includes(threadId)) {
      this.fail(id, -32000, "rename refused after unarchive");
      return;
    }
    if (!this.loaded.has(threadId) && !this.stored.has(threadId)) {
      this.fail(id, -32600, `thread not found: ${threadId}`);
      return;
    }

    this.names.push([threadId, String(params["name"])]);
    this.respond(id, {});
  }

  private handleReviewStart(id: number | string, params: Json): void {
    if (process.env["TEAMRUN_FAKE_CODEX_REVIEW"] === "refuse") {
      this.fail(id, -32600, "review refused");
      return;
    }

    this.turnCounter += 1;
    const turn = { threadId: String(params["threadId"]), turnId: `turn-${this.turnCounter}` };
    const target = params["target"] as Json;
    const entered = { id: "review-entered", type: "enteredReviewMode", review: target["type"] === "custom" ? String(target["instructions"]) : "current changes" };
    this.respond(id, { turn: { id: turn.turnId }, reviewThreadId: turn.threadId });
    this.notify("item/started", { ...turn, item: entered });
    this.notify("item/completed", { ...turn, item: entered });
    this.notify("item/completed", { ...turn, item: { id: "review-exited", type: "exitedReviewMode", review: "No issues found." } });
    this.notify("item/completed", { ...turn, item: { id: "review-text", type: "agentMessage", text: JSON.stringify({ target, delivery: params["delivery"] ?? null }) } });
    this.notify("turn/completed", { threadId: turn.threadId, turn: { id: turn.turnId, status: "completed" } });
  }

  private handleUnarchive(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    if (process.env["TEAMRUN_FAKE_CODEX_UNARCHIVE"] === "failOnce" && !this.unarchiveRefused) {
      this.unarchiveRefused = true;
      this.fail(id, -32000, "unarchive refused");
      return;
    }

    this.unarchives.push(threadId);
    this.archivedThreads.delete(threadId);
    this.stored.add(threadId);
    FakeCodexAppServer.mark("unarchived", this.unarchives.join(","));
    this.respond(id, { thread: { id: threadId } });
  }

  private handleUnsubscribe(id: number | string, params: Json): void {
    if (process.env["TEAMRUN_FAKE_CODEX_UNSUBSCRIBE"] === "fail") {
      this.fail(id, -32000, "unsubscribe refused");
      return;
    }

    const thread = this.loaded.get(String(params["threadId"]));
    this.unsubscribes.push(String(params["threadId"]));
    if (thread !== undefined)
      thread.subscribed = false;
    FakeCodexAppServer.mark("unsubscribed", this.unsubscribes.join(","));
    const status = { status: thread === undefined ? "notLoaded" : "unsubscribed" };
    if (process.env["TEAMRUN_FAKE_CODEX_UNSUBSCRIBE"] === "slow")
      setTimeout(() => this.respond(id, status), 300);
    else
      this.respond(id, status);
  }

  private handleTerminalList(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    if (process.env["TEAMRUN_FAKE_CODEX_LIST"] === "fail") {
      this.fail(id, -32601, "method not found");
      return;
    }
    if (process.env["TEAMRUN_FAKE_CODEX_LIST"] === "slow" && params["slowed"] !== true) {
      setTimeout(() => this.handleTerminalList(id, { ...params, slowed: true }), 100);
      return;
    }
    if (params["cursor"] === undefined) {
      this.respond(id, { data: [], nextCursor: "page-2" });
      return;
    }
    const answer = (): Json => ({ id, result: { data: this.terminals.get(threadId) ?? [] } });
    if (!this.endsTerminal) {
      this.write(answer());
      return;
    }
    this.endsTerminal = false;
    const end = process.env["TEAMRUN_FAKE_CODEX_TERMINAL_END"];
    if (end === "withList" || end === "beforeList") {
      const messages = end === "withList" ? [answer(), ...this.endTerminal(threadId)] : [...this.endTerminal(threadId),
        { method: "thread/tokenUsage/updated", params: { threadId, turnId: "turn-done", tokenUsage: { total: { totalTokens: 12 } } } }, answer()];
      process.stdout.write(messages.map(t => JSON.stringify(t) + "\n").join(""));
      return;
    }
    this.write(answer());
    setTimeout(() => {
      if (this.loaded.get(threadId)?.subscribed !== true)
        return;
      for (const message of this.endTerminal(threadId))
        this.write(message);
    }, 20);
  }

  private endTerminal(threadId: string): Json[] {
    this.terminals.delete(threadId);
    const itemId = process.env["TEAMRUN_FAKE_CODEX_TERMINAL_DELTA"] === "broken" ? {} : { itemId: "server" };
    const exitCode = Number(process.env["TEAMRUN_FAKE_CODEX_TERMINAL_EXIT"] ?? 0);
    return [
      { method: "item/commandExecution/outputDelta", params: { threadId, turnId: "turn-done", ...itemId, delta: "done\n" } },
      { method: "item/completed", params: { threadId, turnId: "turn-done", item: { id: "server", type: "commandExecution", command: "npm run dev", processId: "p-1",
        status: exitCode === 0 ? "completed" : "failed", exitCode, aggregatedOutput: "starting\ndone\n" } } }
    ];
  }

  private handleTerminate(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    const mode = process.env["TEAMRUN_FAKE_CODEX_TERMINATE"];
    if (mode === "fail") {
      this.fail(id, -32000, "terminate refused");
      return;
    }
    if (mode === "no") {
      this.respond(id, { terminated: false });
      return;
    }
    this.terminates.push(params["processId"]);
    const left = (this.terminals.get(threadId) ?? []).filter(t => t["processId"] !== params["processId"]);
    this.terminals.set(threadId, left);
    if (mode === "lateOutput") {
      process.stdout.write([
        { method: "item/commandExecution/outputDelta", params: { threadId, turnId: "turn-stopped", itemId: "server", delta: "stopping\n" } },
        { method: "item/completed", params: { threadId, turnId: "turn-stopped", item: { id: "server", type: "commandExecution", command: "npm run dev", processId: "p-1",
          status: "failed", exitCode: 143, aggregatedOutput: "starting\nstopping\n" } } },
        { id, result: { terminated: true } }
      ].map(t => JSON.stringify(t) + "\n").join(""));
      return;
    }
    if (mode === "late")
      this.notify("item/completed", { threadId, turnId: "turn-stopped", item: { id: "server", type: "commandExecution", command: "npm run dev", processId: "p-1",
        status: "failed", exitCode: null, aggregatedOutput: "starting\n" } });
    this.respond(id, { terminated: true });
  }

  private handleCompactStart(id: number | string, params: Json): void {
    this.turnCounter += 1;
    const threadId = String(params["threadId"]);
    const turnId = `turn-${this.turnCounter}`;
    if (process.env["TEAMRUN_FAKE_CODEX_HOLD_COMPACT"] === "1") {
      this.heldAnswers.push(() => {
        this.respond(id, {});
        this.holding.set(threadId, turnId);
        this.notify("turn/started", { threadId, turn: { id: turnId, status: "inProgress" } });
      });
      return;
    }
    this.respond(id, {});
    this.notify("turn/started", { threadId, turn: { id: turnId, status: "inProgress" } });
    this.notify("item/started", { threadId, turnId, item: { id: "compaction", type: "contextCompaction" } });
    this.notify("item/completed", { threadId, turnId, item: { id: "compaction", type: "contextCompaction" } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private handleTurnStart(id: number | string, params: Json): void {
    this.turnCounter += 1;
    const threadId = String(params["threadId"]);
    const turnId = `turn-${this.turnCounter}`;
    const input = (params["input"] as Json[] | undefined) ?? [];
    const prompt = String(input[0]?.["text"] ?? "");
    const scenario = prompt.split(" ")[0] ?? "";
    if (process.env["TEAMRUN_FAKE_CODEX_WAKE"] === "hold" && this.holding.has(threadId)) {
      this.fail(id, -32600, `thread ${threadId} already runs a turn`);
      return;
    }
    this.lastCollaboration = params["collaborationMode"] ?? null;
    this.lastTurnPolicy = [params["approvalPolicy"] ?? null, params["sandboxPolicy"] ?? null];
    this.lastTurnSettings = Object.fromEntries(["model", "effort", "cwd"].filter(t => t in params).map(t => [t, params[t]]));
    const started = this.loaded.get(threadId);
    if (started !== undefined && typeof params["cwd"] === "string")
      started.params = { ...started.params, cwd: params["cwd"] };
    if (params["collaborationMode"] !== undefined && process.env["TEAMRUN_FAKE_CODEX_PLAN"] === "refuse") {
      this.fail(id, -32600, "turn/start.collaborationMode requires experimentalApi capability");
      return;
    }
    if (params["collaborationMode"] !== undefined)
      this.collaborations.set(threadId, params["collaborationMode"]);
    if (scenario === "attachments" || scenario === "role-payload") {
      this.respond(id, { turn: { id: turnId } });
      this.notify("item/completed", { threadId, turnId, item: { id: "input", type: "agentMessage",
        text: JSON.stringify(scenario === "attachments" ? input : { input, thread: this.lastThreadParams, archives: this.archives, names: this.names, nameTries: this.nameTries, unarchives: this.unarchives, unsubscribes: this.unsubscribes,
          terminates: this.terminates }) } });
      this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
      return;
    }
    if (scenario === "reject") {
      this.fail(id, -32000, "turn refused");
      return;
    }
    const thread = this.loaded.get(threadId);
    if (thread !== undefined) {
      thread.failed = false;
      thread.running = true;
    }

    if (prompt.startsWith("A sub-agent you started")) {
      this.respond(id, { turn: { id: turnId } });
      if (process.env["TEAMRUN_FAKE_CODEX_WAKE"] === "hold") {
        this.holding.set(threadId, turnId);
        this.notify("item/completed", { threadId, turnId, item: { id: "wake-held", type: "agentMessage", text: "Waking" } });
        return;
      }
      this.notify("item/completed", { threadId, turnId, item: { id: "wake-msg", type: "agentMessage", text: `Woken with: ${String(this.subAgentResult)}` } });
      this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
      return;
    }
    if (this.holdsTurnStart) {
      this.holdsTurnStart = false;
      this.heldAnswers.push(() => this.respond(id, { turn: { id: turnId } }));
    }
    else
      this.respond(id, { turn: { id: turnId } });
    void this.runScenario(scenario, threadId, turnId);
  }

  private handleSteer(id: number | string, params: Json): void {
    const threadId = String(params["threadId"]);
    const turnId = this.holding.get(threadId);
    if (turnId === undefined || turnId !== params["expectedTurnId"]) {
      this.fail(id, -32600, "expected active turn id does not match");
      return;
    }
    this.holding.delete(threadId);
    this.respond(id, { turnId });
    this.notify("item/completed", { threadId, turnId, item: { id: "steered", type: "agentMessage", text: JSON.stringify(params["input"]) } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private handleInterrupt(id: number | string, params: Json): void {
    this.interrupts += 1;
    if (process.env["TEAMRUN_FAKE_CODEX_INTERRUPT"] === "hang")
      return;
    if (process.env["TEAMRUN_FAKE_CODEX_INTERRUPT"] === "fail") {
      this.fail(id, -32000, "interrupt refused");
      return;
    }

    this.respond(id, {});
    const threadId = String(params["threadId"]);
    const turnId = this.holding.get(threadId);
    if (turnId !== String(params["turnId"]))
      return;
    this.holding.delete(threadId);
    this.acceptedInterrupts.push({ threadId, turnId });
    this.beforeInterrupted?.();
    this.beforeInterrupted = null;
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "interrupted" } });
  }

  private emitWindowScenario(threadId: string, turnId: string): void {
    const chosen = ((this.loaded.get(threadId)?.params["config"] ?? {}) as Json)["model_context_window"];
    const modelContextWindow = typeof chosen === "number" ? chosen * 0.95 : Number(process.env["TEAMRUN_FAKE_CODEX_WINDOW"] ?? "475000");
    this.notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage: { total: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 },
      last: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 }, modelContextWindow } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private emitUsageScenario(threadId: string, turnId: string): void {
    const turns = (this.usageTurns.get(threadId) ?? 0) + 1;
    this.usageTurns.set(threadId, turns);
    const tokenUsage = { total: { inputTokens: turns * 1000, outputTokens: turns * 100, totalTokens: turns * 1100 },
      last: { inputTokens: 4000, outputTokens: 100, totalTokens: 4100 + turns * 900 }, modelContextWindow: 200_000 };
    this.notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage });
    this.notify("account/rateLimits/updated", { rateLimits: { limitId: "codex", primary: { usedPercent: 30, windowDurationMins: 300, resetsAt: null } } });
    this.notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private async runScenario(scenario: string, threadId: string, turnId: string): Promise<void> {
    const turn = { threadId, turnId };
    switch (scenario) {
      case "complete":
      case "/tmp":
        this.emitCompleteScenario(threadId, turnId);
        break;
      case "usage":
        this.emitUsageScenario(threadId, turnId);
        break;
      case "plan":
        this.notify("turn/plan/updated", { ...turn, explanation: null, plan: [{ step: "Read the code", status: "completed" }] });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "window":
        this.emitWindowScenario(threadId, turnId);
        break;
      case "where":
        this.notify("item/completed", { ...turn, item: { id: "echo", type: "agentMessage", text: FakeCodexAppServer.whereOf(this.loaded.get(threadId)?.params ?? {}, this.archives.length) } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "echo":
        this.notify("item/completed", { ...turn, item: { id: "echo", type: "agentMessage", text: JSON.stringify({ thread: this.lastThreadParams, resume: this.lastResumeParams, fork: this.lastForkParams, configRead: this.lastConfigReadParams, argv: process.argv.slice(2), codexHome: process.env["CODEX_HOME"] ?? null, apiKey: process.env["OPENAI_API_KEY"] ?? null }) } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "collaboration":
        this.notify("item/completed", { ...turn, item: { id: "echo", type: "agentMessage", text: JSON.stringify({ collaboration: this.lastCollaboration,
          sandbox: this.lastThreadParams?.["sandbox"], approvalPolicy: this.lastThreadParams?.["approvalPolicy"], turnPolicy: this.lastTurnPolicy,
          turnSettings: this.lastTurnSettings }) } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "approve":
        await this.emitApprovalScenario(threadId, turnId);
        break;
      case "withdraw":
        await this.emitWithdrawScenario(threadId, turnId);
        break;
      case "declines":
        await this.emitDeclineScenario(threadId, turnId);
        break;
      case "fail":
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: "boom", codexErrorInfo: { httpConnectionFailed: { httpStatusCode: 502 } } } } });
        break;
      case "full":
        this.notify("error", { threadId, turnId, error: { message: "Codex ran out of room in the model's context window.", codexErrorInfo: "contextWindowExceeded" }, willRetry: false });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: "Codex ran out of room in the model's context window." } } });
        break;
      case "fullTurn":
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: "Codex ran out of room.", codexErrorInfo: "contextWindowExceeded" } } });
        break;
      case "limit":
        this.notify("error", { threadId, turnId, error: { message: "You've hit your usage limit.", codexErrorInfo: "usageLimitExceeded" }, willRetry: false });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: "You've hit your usage limit." } } });
        break;
      case "limitTurn":
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: "You've hit your usage limit.", codexErrorInfo: "usageLimitExceeded" } } });
        break;
      case "limitRetried":
        this.notify("error", { threadId, turnId, error: { message: "You've hit your usage limit.", codexErrorInfo: "usageLimitExceeded" }, willRetry: true });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed", error: { message: "boom" } } });
        break;
      case "failNoError":
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "failed" } });
        break;
      case "hold":
        this.holding.set(threadId, turnId);
        this.notify("item/completed", { ...turn, item: { id: "held", type: "agentMessage", text: "holding" } });
        break;
      case "answering":
        this.notify("item/started", { ...turn, item: { id: "think", type: "reasoning" } });
        this.notify("item/started", { ...turn, item: { id: "answer", type: "agentMessage", text: "" } });
        this.afterSubAgentEnd = () => {
          this.notify("item/completed", { ...turn, item: { id: "answer", type: "agentMessage", text: "Done.", phase: "final_answer" } });
          this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        };
        break;
      case "reasoningThenAnswer":
        this.notify("item/started", { ...turn, item: { id: "think", type: "reasoning" } });
        this.notify("item/completed", { ...turn, item: { id: "think", type: "reasoning", summary: ["Weighing it."], content: [] } });
        this.afterSubAgentEnd = () => {
          this.notify("item/started", { ...turn, item: { id: "answer", type: "agentMessage", text: "" } });
          this.notify("item/completed", { ...turn, item: { id: "answer", type: "agentMessage", text: "Done.", phase: "final_answer" } });
          this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        };
        break;
      case "toolThenAnswer":
        this.notify("item/started", { ...turn, item: { id: "look", type: "agentMessage", text: "" } });
        this.notify("item/completed", { ...turn, item: { id: "look", type: "agentMessage", text: "Looking." } });
        this.notify("item/started", { ...turn, item: { id: "ls", type: "commandExecution", command: "ls", status: "inProgress" } });
        this.afterSubAgentEnd = () => {
          this.notify("item/completed", { ...turn, item: { id: "ls", type: "commandExecution", command: "ls", status: "completed", exitCode: 0,
            aggregatedOutput: "a.ts\n" } });
          this.notify("item/started", { ...turn, item: { id: "done", type: "agentMessage", text: "" } });
          this.notify("item/completed", { ...turn, item: { id: "done", type: "agentMessage", text: "Done." } });
          this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        };
        break;
      case "exit":
        process.exit(1);
      case "garbage":
        this.emitGarbageScenario(threadId, turnId);
        break;
      case "sandboxRefresh":
        this.holding.set(threadId, turnId);
        this.notify("item/started", { ...turn, item: { id: "rg", type: "commandExecution", command: "pwsh.exe -Command rg x", status: "inProgress" } });
        this.notify("item/completed", { ...turn, item: { id: "rg", type: "commandExecution", command: "pwsh.exe -Command rg x", exitCode: -1, status: "failed",
          aggregatedOutput: "Failed to create unified exec process: helper_unknown_error: setup refresh had errors" } });
        break;
      case "sandboxPhrase":
        this.notify("item/completed", { ...turn, item: { id: "cat", type: "commandExecution", command: "cat README.md", exitCode: 0, status: "completed",
          aggregatedOutput: "Codex CLI before 0.163.0 can fail every command with \"setup refresh had errors\"." } });
        this.notify("item/completed", { ...turn, item: { id: "rg", type: "commandExecution", command: "rg setup", exitCode: -1, status: "failed",
          aggregatedOutput: "rg: setup refresh had errors" } });
        this.notify("item/completed", { ...turn, item: { id: "exec", type: "commandExecution", command: "rg setup", exitCode: 1, status: "failed",
          aggregatedOutput: "Failed to create unified exec process: setup refresh had errors" } });
        this.notify("item/completed", { ...turn, item: { id: "declined", type: "commandExecution", command: "rg setup", exitCode: -1, status: "declined",
          aggregatedOutput: "Failed to create unified exec process: setup refresh had errors" } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "interrupts":
        this.notify("item/completed", { ...turn, item: { id: "interrupts", type: "agentMessage", text: String(this.interrupts) } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "acceptedInterrupts":
        this.notify("item/completed", { ...turn, item: { id: "acceptedInterrupts", type: "agentMessage", text: JSON.stringify(this.acceptedInterrupts) } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "long":
        this.notify("item/completed", { ...turn, item: { id: "long", type: "agentMessage", text: "x".repeat(256 * 1024) } });
        this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
        break;
      case "background":
      case "backgroundEnds":
        this.emitBackgroundScenario(threadId, turnId, scenario === "backgroundEnds");
        break;
      case "backgroundRound":
      case "backgroundRoundEnds":
        this.emitRoundScenario(threadId, turnId, scenario === "backgroundRoundEnds");
        break;
      case "backgroundStoppedWait":
        this.emitStoppedWaitScenario(threadId, turnId);
        break;
      case "subAgent":
        this.emitSubAgentScenario(threadId, turnId);
        break;
      case "backgroundWithSubAgent":
        this.emitSubAgentScenario(threadId, turnId, ["child"], false);
        this.emitBackgroundScenario(threadId, turnId, false);
        break;
      case "subAgentWakes":
      case "subAgentWakesCounted":
        if (scenario === "subAgentWakesCounted")
          this.notify("thread/tokenUsage/updated", { threadId, turnId, tokenUsage: { total: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 },
            last: { inputTokens: 1000, outputTokens: 100, totalTokens: 1100 }, modelContextWindow: 200_000 } });
        this.emitSubAgentScenario(threadId, turnId);
        this.endSubAgentOnSignal(threadId, turnId);
        break;
      case "subAgentWakesLate":
      case "subAgentPairLate": {
        const children = scenario === "subAgentPairLate" ? ["child", "child-2"] : ["child"];
        this.emitSubAgentScenario(threadId, turnId, children, false);
        this.endSubAgentOnSignal(threadId, turnId, children);
        break;
      }
      case "subAgentFollowUp":
        this.emitSubAgentFollowUpScenario(threadId, turnId);
        break;
      case "subAgentAsks":
        await this.emitSubAgentAskScenario(threadId, turnId);
        break;
      case "backgroundPolled":
      case "backgroundPolledEnds":
        this.emitPolledScenario(threadId, turnId, scenario === "backgroundPolledEnds");
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
      changes: [{ path: "a.ts", kind: "update", diff: "@@ -1 +1 @@\n-a\n+b" }, { path: "b.ts", kind: { type: "update", move_path: "c.ts" } }, { path: "d.ts" }]
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

  private emitBackgroundScenario(threadId: string, turnId: string, ends: boolean): void {
    const turn = { threadId, turnId };
    this.endsTerminal = ends;
    this.notify("item/started", { ...turn, item: { id: "quick", type: "commandExecution", command: "ls", processId: "p-0", status: "inProgress" } });
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "quick", delta: "a.ts\n" });
    this.notify("item/completed", { ...turn, item: { id: "quick", type: "commandExecution", command: "ls", processId: "p-0", status: "completed", exitCode: 0,
      aggregatedOutput: "a.ts\n" } });
    this.notify("item/started", { ...turn, item: { id: "server", type: "commandExecution", command: "/bin/bash -lc 'npm run dev'", processId: "p-1",
      source: "agent", status: "inProgress" } });
    this.terminals.set(threadId, [{ itemId: "server", processId: "p-1", command: "/bin/bash -lc 'npm run dev'", cwd: "D:/work", osPid: 4242, cpuPercent: 0, rssKb: 1024 }]);
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "server", delta: "starting\n" });
    this.notify("item/commandExecution/outputDelta", { threadId: "other-thread", turnId, itemId: "server", delta: "elsewhere\n" });
    this.notify("item/started", { ...turn, item: { id: "said", type: "agentMessage", text: "" } });
    this.notify("item/completed", { ...turn, item: { id: "said", type: "agentMessage", text: "The server is starting." } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private emitSubAgentScenario(threadId: string, turnId: string, children: readonly string[] = ["child"], completes: boolean = true): void {
    for (const child of children) {
      const spawn = (method: string, status: string, receiverThreadIds: readonly string[]): void => this.notify(method, { threadId, turnId, item: {
        type: "collabAgentToolCall", id: child === "child" ? "call-spawn" : `call-spawn-${child}`, tool: "spawnAgent", status, senderThreadId: threadId,
        receiverThreadIds, prompt: "Read notes.txt.", model: "gpt-5.4-mini", reasoningEffort: "low", agentsStates: {} } });
      spawn("item/started", "inProgress", []);
      this.notify("thread/started", { thread: { id: child, parentThreadId: threadId, agentRole: "explorer", agentNickname: "Ada", model: "gpt-5.4-mini" } });
      spawn("item/completed", "completed", [child]);
      this.notify("turn/started", { threadId: child, turn: { id: `${child}-turn`, status: "inProgress" } });
    }
    this.holding.set("child", "child-turn");
    if (completes) {
      this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
      return;
    }
    this.notify("item/started", { threadId, turnId, item: { id: "spawned", type: "agentMessage", text: "" } });
    this.notify("item/completed", { threadId, turnId, item: { id: "spawned", type: "agentMessage", text: "Spawned.", phase: "final_answer" } });
    this.afterSubAgentEnd = () => this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private endSubAgentOnSignal(threadId: string, turnId: string, children: readonly string[] = ["child"]): void {
    const signal = String(process.env["TEAMRUN_FAKE_CODEX_SUB_AGENT_END"]);
    const polling = setInterval(() => {
      if (!existsSync(signal))
        return;
      const status = readFileSync(signal, "utf8").trim();
      if (status === "") {
        writeFileSync(`${signal}-seen`, "");
        return;
      }
      clearInterval(polling);
      this.holding.delete("child");
      this.subAgentResult = status === "completed" ? "notes.txt says hello." : null;
      for (const child of children) {
        if (status === "completed")
          this.notify("item/completed", { threadId: child, turnId: `${child}-turn`, item: { type: "agentMessage", id: `${child}-msg`, text: this.subAgentResult } });
        this.notify("turn/completed", { threadId: child, turn: { id: `${child}-turn`, status, error: status === "failed" ? { message: "The child failed." } : null,
          durationMs: 500 } });
        if (status === "completed")
          for (const method of ["item/started", "item/completed"])
            this.notify(method, { threadId, turnId, item: { type: "subAgentActivity", id: `subagent-completed-${child}-turn`, kind: "completed",
              agentThreadId: child, agentPath: `/root/${child}` } });
      }
      const after = this.afterSubAgentEnd;
      this.afterSubAgentEnd = null;
      after?.();
    }, 20);
  }

  private async emitSubAgentAskScenario(threadId: string, turnId: string): Promise<void> {
    const child = { threadId: "child", turnId: "child-turn" };
    this.notify("thread/started", { thread: { id: "child", parentThreadId: threadId, agentRole: "explorer", agentNickname: "Ada", model: "gpt-5.4-mini" } });
    this.notify("item/completed", { threadId, turnId, item: { type: "collabAgentToolCall", id: "call-spawn", tool: "spawnAgent", status: "completed",
      senderThreadId: threadId, receiverThreadIds: ["child"], prompt: "Read notes.txt.", model: "gpt-5.4-mini", reasoningEffort: "low", agentsStates: {} } });
    this.notify("turn/started", { threadId: "child", turn: { id: "child-turn", status: "inProgress" } });
    const answers = [await this.ask("item/commandExecution/requestApproval", { ...child, itemId: "child-cmd", command: "cat notes.txt", cwd: "D:/work", reason: null }),
      await this.ask("item/tool/requestUserInput", { ...child, itemId: "child-ask", questions: [{ id: "file", header: "File", question: "Which file?",
        options: [{ label: "notes.txt", description: "" }], isOther: false }] })];
    const waiting = this.nextServerRequestId;
    void this.ask("item/commandExecution/requestApproval", { ...child, itemId: "child-wait", command: "cat todo.txt", cwd: "D:/work", reason: null });
    this.notify("serverRequest/resolved", { threadId: "child", requestId: waiting });
    this.notify("turn/completed", { threadId: "child", turn: { id: "child-turn", status: "completed", durationMs: 300 } });
    this.notify("item/completed", { threadId, turnId, item: { id: "answers", type: "agentMessage", text: JSON.stringify(answers) } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private emitSubAgentFollowUpScenario(threadId: string, turnId: string): void {
    const send = (method: string, status: string): void => this.notify(method, { threadId, turnId, item: {
      type: "collabAgentToolCall", id: "call-send", tool: "sendInput", status, senderThreadId: threadId, receiverThreadIds: ["child"], prompt: "Read todo.txt too.",
      model: null, reasoningEffort: null, agentsStates: {} } });
    send("item/started", "inProgress");
    send("item/completed", "completed");
    this.notify("turn/started", { threadId: "child", turn: { id: "child-turn-2", status: "inProgress" } });
    this.notify("item/completed", { threadId: "child", turnId: "child-turn-2", item: { type: "agentMessage", id: "child-msg-2", text: "todo.txt is empty." } });
    this.notify("turn/completed", { threadId: "child", turn: { id: "child-turn-2", status: "completed", durationMs: 800 } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private emitRoundScenario(threadId: string, turnId: string, ends: boolean): void {
    const turn = { threadId, turnId };
    const terminal = (itemId: string, processId: string, command: string): Json => ({ itemId, processId, command, cwd: "D:/work", osPid: 4242, cpuPercent: 0,
      rssKb: 1024 });
    const started = (id: string, processId: string, command: string): void => this.notify("item/started", { ...turn, item: { id, type: "commandExecution",
      command: `/bin/bash -lc '${command}'`, processId, source: "agent", status: "inProgress" } });
    const completed = (id: string, processId: string, command: string, output: string): void => this.notify("item/completed", { ...turn, item: { id,
      type: "commandExecution", command, processId, status: "completed", exitCode: 0, aggregatedOutput: output } });
    started("server", "p-1", "npm run dev");
    started("build", "p-2", "npm run build");
    this.terminals.set(threadId, [terminal("server", "p-1", "npm run dev"), terminal("build", "p-2", "npm run build")]);
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "server", delta: "starting\n" });
    this.terminals.set(threadId, [terminal("server", "p-1", "npm run dev")]);
    completed("build", "p-2", "npm run build", "built\n");
    this.notify("thread/tokenUsage/updated", { ...turn, tokenUsage: { total: { totalTokens: 12 } } });
    started("test", "p-3", "npm test");
    this.terminals.set(threadId, [terminal("server", "p-1", "npm run dev"), terminal("test", "p-3", "npm test")]);
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "server", delta: "ready\n" });
    if (ends) {
      this.terminals.set(threadId, [terminal("test", "p-3", "npm test")]);
      completed("server", "p-1", "npm run dev", "starting\nready\n");
    }
    this.holding.set(threadId, turnId);
    this.beforeInterrupted = (): void => {
      this.terminals.set(threadId, [terminal("server", "p-1", "npm run dev")]);
      completed("test", "p-3", "npm test", "passed\n");
    };
  }

  private emitStoppedWaitScenario(threadId: string, turnId: string): void {
    const turn = { threadId, turnId };
    this.notify("item/started", { ...turn, item: { id: "server", type: "commandExecution", command: "/bin/bash -lc 'npm run dev'", processId: "p-1",
      source: "agent", status: "inProgress" } });
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "server", delta: "starting\n" });
    this.holding.set(threadId, turnId);
    this.beforeInterrupted = (): void => {
      this.notify("thread/tokenUsage/updated", { ...turn, tokenUsage: { total: { totalTokens: 12 } } });
      this.notify("item/completed", { ...turn, item: { id: "server", type: "commandExecution", command: "npm run dev", processId: "p-1", status: "failed",
        exitCode: null, aggregatedOutput: "starting\n" } });
    };
  }

  private emitPolledScenario(threadId: string, turnId: string, ends: boolean): void {
    const turn = { threadId, turnId };
    const terminal = (itemId: string, processId: string, command: string): Json => ({ itemId, processId, command, cwd: "D:/work", osPid: 4242, cpuPercent: 0,
      rssKb: 1024 });
    this.notify("item/started", { ...turn, item: { id: "server", type: "commandExecution", command: "/bin/bash -lc 'npm run dev'", processId: "p-1",
      source: "agent", status: "inProgress" } });
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "server", delta: "starting\n" });
    this.notify("item/started", { ...turn, item: { id: "build", type: "commandExecution", command: "/bin/bash -lc 'npm run build'", processId: "p-2",
      source: "agent", status: "inProgress" } });
    this.terminals.set(threadId, [terminal("server", "p-1", "npm run dev"), terminal("build", "p-2", "npm run build")]);
    this.notify("item/commandExecution/terminalInteraction", { ...turn, itemId: "server", processId: "p-1", stdin: "" });
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "server", delta: "ready\n" });
    this.notify("item/commandExecution/outputDelta", { ...turn, itemId: "build", delta: "built\n" });
    if (ends) {
      this.terminals.set(threadId, [terminal("build", "p-2", "npm run build")]);
      this.notify("item/completed", { ...turn, item: { id: "server", type: "commandExecution", command: "npm run dev", processId: "p-1", status: "completed",
        exitCode: 0, aggregatedOutput: "starting\nready\n" } });
    }
    this.holding.set(threadId, turnId);
    this.beforeInterrupted = (): void => {
      this.terminals.set(threadId, [terminal("server", "p-1", "npm run dev")]);
      this.notify("item/completed", { ...turn, item: { id: "build", type: "commandExecution", command: "npm run build", processId: "p-2", status: "completed",
        exitCode: 0, aggregatedOutput: "built\n" } });
    };
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
    this.notify("item/started", { ...turn, item: { id: "check-1", type: "mcpToolCall", server: "teamrun", tool: "teamrun_check_provider", status: "inProgress" } });
    answers.push(await this.ask("mcpServer/elicitation/request", { ...turn, serverName: "teamrun", mode: "form",
      message: "Allow the teamrun MCP server to run tool \"teamrun_check_provider\"?", _meta: { codex_approval_kind: "mcp_tool_call", persist: "session",
        tool_title: "Check a provider", tool_params: { provider_id: "a1" } }, requestedSchema: { type: "object", properties: {} } }));
    this.notify("item/completed", { ...turn, item: { id: "answers", type: "agentMessage", text: JSON.stringify(answers) } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private async emitDeclineScenario(threadId: string, turnId: string): Promise<void> {
    const turn = { threadId, turnId };
    await this.ask("item/commandExecution/requestApproval", { ...turn, itemId: "cmd-d", command: "rm -rf build" });
    await this.ask("item/fileChange/requestApproval", { ...turn, itemId: "fc-s" });
    this.notify("item/completed", { ...turn, item: { id: "cmd-d", type: "commandExecution", command: "rm -rf build", cwd: "/w", exitCode: null, status: "declined" } });
    this.notify("item/completed", { ...turn, item: { id: "fc-s", type: "fileChange", status: "declined", changes: [] } });
    this.notify("turn/completed", { threadId, turn: { id: turnId, status: "completed" } });
  }

  private async emitWithdrawScenario(threadId: string, turnId: string): Promise<void> {
    const turn = { threadId, turnId };
    const requestId = this.nextServerRequestId;
    let isAnswered = false;
    void this.ask("item/commandExecution/requestApproval", { ...turn, itemId: "cmd-w" }).then(() => {
      isAnswered = true;
    });
    this.notify("serverRequest/resolved", { threadId, requestId: requestId + 100 });
    this.notify("serverRequest/resolved", { threadId });
    this.notify("serverRequest/resolved", { threadId, requestId });
    const next = await this.ask("item/tool/requestUserInput", { ...turn, itemId: "q-w", questions: [] });
    this.notify("item/completed", { ...turn, item: { id: "withdrawn", type: "agentMessage", text: JSON.stringify({ isAnswered, next }) } });
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
    const thread = method === "turn/completed" ? this.loaded.get(String(params["threadId"])) : undefined;
    if (thread !== undefined) {
      thread.running = false;
      thread.failed = (params["turn"] as Json)["status"] === "failed";
    }
    this.write({ method, params });
  }

  private write(message: Json): void {
    process.stdout.write(JSON.stringify(message) + "\n");
  }

  private static startsMcpServers(params: Json): boolean {
    const servers = process.env["TEAMRUN_FAKE_CODEX_MCP_SERVERS"];
    if (servers === undefined || servers === "fail" || process.env["TEAMRUN_FAKE_CODEX_STARTS_OWN_SERVERS"] === "true")
      return false;
    const settings = (((params["config"] ?? {}) as Json)["mcp_servers"] ?? {}) as Json;
    return Object.keys(JSON.parse(servers) as Json).some(t => {
      const setting = (settings[t] ?? {}) as Json;
      return t !== "teamrun" && setting["enabled"] !== false && setting["command"] === undefined && setting["url"] === undefined;
    });
  }

  private static version(): string | undefined {
    const file = process.env["TEAMRUN_FAKE_CODEX_VERSION_FILE"];
    return file === undefined ? process.env["TEAMRUN_FAKE_CODEX_VERSION"] : readFileSync(file, "utf8").trim();
  }

  private static holdUntilReleased(name: string, id: number | string, answer: () => void): void {
    FakeCodexAppServer.mark(name, String(id));
    const release = join(String(process.env["CODEX_HOME"]), `${name}-release`);
    const polling = setInterval(() => {
      if (!existsSync(release))
        return;
      clearInterval(polling);
      answer();
    }, 20);
  }

  private static holdVersionRead(release: string, answer: () => void): void {
    let read = 1;
    while (!FakeCodexAppServer.claim(`${release}-${read}.started`))
      read += 1;
    const cap = setTimeout(() => process.exit(5), 60_000);
    const polling = setInterval(() => {
      if (!existsSync(`${release}-${read}`))
        return;
      clearInterval(polling);
      clearTimeout(cap);
      answer();
    }, 20);
  }

  private static claim(path: string, taken: readonly string[] = ["EEXIST"], text: string = ""): boolean {
    try {
      writeFileSync(path, text, { flag: "wx" });
      return true;
    }
    catch (error) {
      if (taken.includes(String((error as NodeJS.ErrnoException).code)))
        return false;
      throw error;
    }
  }

  private static mark(name: string, text: string): void {
    const home = process.env["CODEX_HOME"];
    if (home === undefined)
      return;
    const path = join(home, name);
    FakeCodexAppServer.lock(`${path}.lock`);
    try {
      writeFileSync(`${path}.writing`, text);
      renameSync(`${path}.writing`, path);
    }
    finally {
      unlinkSync(`${path}.lock`);
    }
  }

  private static lock(path: string): void {
    const wait = Number(process.env["TEAMRUN_FAKE_CODEX_LOCK_WAIT"] ?? 10_000);
    const deadline = Date.now() + wait;
    while (!FakeCodexAppServer.claim(path, ["EEXIST", "EPERM"], String(process.pid))) {
      FakeCodexAppServer.breakOrphaned(path);
      if (Date.now() > deadline) {
        process.stderr.write(`The fake Codex app server waited ${wait} ms for ${path}\n`);
        process.exit(6);
      }
    }
  }

  private static breakOrphaned(path: string): void {
    const owner = Number(FakeCodexAppServer.readOrEmpty(path));
    if (!Number.isInteger(owner) || owner <= 0 || FakeCodexAppServer.isRunning(owner))
      return;
    const orphaned = `${path}.${process.pid}.orphaned`;
    try {
      renameSync(path, orphaned);
      unlinkSync(orphaned);
    }
    catch (error) {
      if (!["ENOENT", "EPERM"].includes(String((error as NodeJS.ErrnoException).code)))
        throw error;
    }
  }

  private static readOrEmpty(path: string): string {
    try {
      return readFileSync(path, "utf8");
    }
    catch (error) {
      if (["ENOENT", "EPERM"].includes(String((error as NodeJS.ErrnoException).code)))
        return "";
      throw error;
    }
  }

  private static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch (error) {
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  new FakeCodexAppServer().run();
