/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcess } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { FakeCopilotHeadless } from "./fake-copilot-headless.fixture.js";
import { FakeTaskTree } from "./fake-task-tree.fixture.js";
import { AntigravitySubAgentRecording } from "./antigravity-sub-agent.recording.js";
import { CopilotBackgroundSubAgentsRecording } from "./copilot-background-sub-agents.recording.js";
import { CopilotSubAgentsTogetherRecording } from "./copilot-sub-agents-together.recording.js";
import { CursorModelOptionRecording } from "./cursor-model-option.recording.js";
import { GrokBackgroundTaskRecording } from "./grok-background-task.recording.js";
import { GrokQuestionRecording } from "./grok-question.recording.js";
import { GrokSubAgentRecording } from "./grok-sub-agent.recording.js";
import { OpencodeModelListRecording } from "./opencode-model-list.recording.js";

const COPILOT = process.env["TEAMRUN_FAKE_ACP_AGENT"] === "copilot";
const OPENCODE = process.env["TEAMRUN_FAKE_ACP_AGENT"] === "opencode";
const CURSOR = process.env["TEAMRUN_FAKE_ACP_AGENT"] === "cursor";
const FX = process.env["TEAMRUN_FAKE_ACP_AGENT"] === "fx";
const FX_STATUS = process.env["TEAMRUN_FAKE_FX_STATUS"] ?? "fx login";
const COPILOT_OPTIONS: JsonObject[] = [
  { type: "select", id: "mode", name: "Mode", category: "mode", currentValue: "https://agentclientprotocol.com/protocol/session-modes#agent", options: [
    { value: "https://agentclientprotocol.com/protocol/session-modes#agent", name: "Agent" },
    { value: "https://agentclientprotocol.com/protocol/session-modes#plan", name: "Plan" },
    { value: "https://agentclientprotocol.com/protocol/session-modes#autopilot", name: "Autopilot" }
  ] },
  { type: "select", id: "allow_all", name: "Allow All", category: "permissions", currentValue: "off", options: [{ value: "on", name: "On" }, { value: "off", name: "Off" }] }
];

const FX_OPTIONS: JsonObject[] = [
  { type: "select", id: "provider", name: "Provider", category: "model", currentValue: "gateway", options: [
    { value: "gateway", name: "Vercel AI Gateway" }, { value: "codex", name: "Codex subscription" }
  ] },
  { type: "select", id: "model", name: "Model", category: "model", currentValue: "anthropic/claude-sonnet-4.5", options: [
    { value: "anthropic/claude-sonnet-4.5", name: "anthropic/claude-sonnet-4.5" }, { value: "openai/gpt-5", name: "openai/gpt-5" }
  ] },
  { type: "select", id: "mode", name: "Session Mode", category: "mode", currentValue: "auto", options: [
    { value: "auto", name: "Auto" }, { value: "ask", name: "Ask" }, { value: "full-access", name: "Full access" }
  ] },
  { type: "select", id: "effort", name: "Reasoning Effort", category: "thought_level", currentValue: "auto", options: [
    { value: "auto", name: "Auto" }, { value: "low", name: "Low" }, { value: "high", name: "High" }
  ] },
  { type: "select", id: "fast", name: "Fast Mode", category: "model", currentValue: "false", options: [{ value: "false", name: "false" }, { value: "true", name: "true" }] }
];
const OPENCODE_OPTIONS: JsonObject[] = [
  { type: "select", id: "model", name: "Model", category: "model", currentValue: "anthropic/claude-sonnet-4-5", options: [
    { value: "anthropic/claude-sonnet-4-5", name: "Anthropic/Claude Sonnet 4.5" }, { value: "opencode/beam-free", name: "OpenCode Zen/Beam Free" },
    { value: "opencode/big-pickle", name: "OpenCode Zen/Big Pickle" }
  ] },
  { type: "select", id: "effort", name: "Effort", category: "thought_level", currentValue: "default", options: [
    { value: "high", name: "High" }, { value: "low", name: "Low" }, { value: "default", name: "Default" }
  ] },
  { type: "select", id: "mode", name: "Session Mode", category: "mode", currentValue: "build", options: [{ value: "build", name: "build" }, { value: "plan", name: "plan" }] }
];
const OPENCODE_VARIABLES: readonly string[] = ["HOME", "USERPROFILE", "XDG_DATA_HOME", "XDG_CONFIG_HOME", "XDG_CACHE_HOME", "XDG_STATE_HOME", "TMPDIR", "TEMP",
  "TMP", "OPENCODE_PERMISSION", "OPENCODE_CONFIG_CONTENT", "OPENCODE_DISABLE_PROJECT_CONFIG", "OPENCODE_DISABLE_CLAUDE_CODE",
  "OPENCODE_DISABLE_CLAUDE_CODE_PROMPT", "OPENCODE_PURE", "OPENCODE_CONFIG", "OPENCODE_CONFIG_DIR", "ANTHROPIC_API_KEY"];
const CURSOR_MODE_OPTION: JsonObject = { type: "select", id: "mode", name: "Mode", category: "mode", currentValue: "agent", options: [
  { value: "agent", name: "Agent" }, { value: "plan", name: "Plan" }, { value: "ask", name: "Ask" }
] };
const CURSOR_OPTIONS: JsonObject[] = [
  { type: "select", id: "model", name: "Model", category: "model", currentValue: "auto", options: [{ value: "auto", name: "Auto" }, { value: "gpt-5", name: "GPT-5" }] },
  CURSOR_MODE_OPTION
];
const CURSOR_LIVE_OPTIONS: JsonObject[] = [CursorModelOptionRecording.option, CURSOR_MODE_OPTION];
const CURSOR_VARIABLES: readonly string[] = ["HOME", "CURSOR_CONFIG_DIR", "CURSOR_DATA_DIR", "XDG_CONFIG_HOME", "APPDATA", "NO_OPEN_BROWSER", "CURSOR_API_KEY",
  "CURSOR_AUTH_TOKEN"];
const FX_VARIABLES: readonly string[] = ["FX_HOME", "NO_COLOR", "AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN", "FX_INSTALL_DIR"];
const QUOTA_REPLIES: Readonly<Record<string, readonly (readonly string[])[]>> = {
  quotaReply: [["Error: You have exceeded ", "your monthly quota (Request ID: 0000:1111:2222)"]],
  quotaAfterText: [["Let me check the build."], ["  Error: You have exceeded your monthly quota\n"]],
  quotaTalk: [["So you have exceeded ", "your monthly quota (Request ID: 0000:1111:2222)"]],
  errorOther: [["Error: The request failed (Request ID: 0000:1111:2222)"]],
  quotaLines: [["Error: npm ERR! 429 Too Many Requests\nThe registry says you have exceeded your monthly quota"]],
  quotaBeforeText: [["Error: You have exceeded your monthly quota"], ["Then I tried again, and it worked."]]
};

type TaskEnding = { exitCode?: number | null; killed?: boolean; willWake?: boolean; woken?: boolean; wakeReason?: string; exit?: boolean };

export class FakeAcpAgent {
  private sessionId: string = COPILOT ? "copilot-session" : "grok-session";
  private held: number | null = null;
  private subAgentRunning: boolean = false;
  private garbled: boolean = false;
  private approvalPrompt: number | null = null;
  private planPrompt: number | null = null;
  private planThenBackground: number | null = null;
  private planLeftPrompt: number | null = null;
  private planLeftAnswer: JsonValue = null;
  private planLeftEdit: JsonValue = null;
  private planLeftCancelled: boolean = false;
  private gatedPrompt: number | null = null;
  private planLeftEndsFirst: boolean = false;
  private planAskPrompt: number | null = null;
  private readonly planAnswers: JsonValue[] = [];
  private readonly methods: string[] = [];
  private readonly sets: string[] = [];
  private authenticated: JsonValue = null;
  private compaction: boolean = false;
  private terminals: boolean = false;
  private sessionCwd: string = process.cwd();
  private terminalPrompt: number | null = null;
  private terminalSteps: string[] = [];
  private terminalId: string | null = null;
  private terminalReady: boolean = false;
  private readonly terminalAnswers: JsonValue[] = [];
  private subAgentEvents: boolean = false;
  private metaSent: boolean = false;
  private prompts: number = 0;
  private trees: number = 0;
  private wakeHeld: string | null = null;
  private lateModeRefusal: number | null = null;
  private options: JsonObject[] | null = (FakeAcpAgent.parse("TEAMRUN_FAKE_ACP_OPTIONS") as JsonObject[] | null) ?? (COPILOT ? COPILOT_OPTIONS : OPENCODE ? OPENCODE_OPTIONS : FX ? FX_OPTIONS : CURSOR
    ? FakeAcpAgent.launchedWith(process.env["TEAMRUN_FAKE_CURSOR_MODELS"] === "live" ? CURSOR_LIVE_OPTIONS : CURSOR_OPTIONS) : null);

  public run(): void {
    const input = createInterface({ input: process.stdin });
    input.on("line", line => this.receive(JsonReader.parse(line)));
    input.on("close", () => {
      if (this.garbled) writeFileSync(join(process.cwd(), "load-closed.txt"), "");
      if (process.env["TEAMRUN_FAKE_ACP_CLOSE_CHILD"] === "1")
        writeFileSync(join(process.cwd(), "close-child.txt"), String(FakeTaskTree.start(join(process.cwd(), "close-child-tree.txt"), 1, "stay", true).pid));
      if (this.garbled || process.env["TEAMRUN_FAKE_ACP_STAY_OPEN"] === "1") setInterval(() => undefined, 1000);
      else process.exit(0);
    });
  }

  private signIn(id: number, params: JsonReader): void {
    const home = process.env["GROK_HOME"]!;
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, `browser-${process.pid}.txt`), JSON.stringify(params.toJson()));
    if (process.env["TEAMRUN_FAKE_ACP_SIGNIN_HOLD"] === "1") return;
    writeFileSync(join(home, "auth.json"), "{}");
    this.respond(id, {});
  }

  private sendPlan(id: string): void {
    this.write({ jsonrpc: "2.0", id, method: "cursor/create_plan", params: { sessionId: this.sessionId, toolCallId: "p1", name: "Tidy",
      plan: "# Tidy the cache\n\n1. Drop stale entries.", todos: [{ id: "t1", content: "Drop stale entries", status: "pending" }] } });
  }

  private askPermission(id: string): void {
    this.write({ jsonrpc: "2.0", id, method: "session/request_permission", params: { sessionId: this.sessionId,
      toolCall: { toolCallId: id, kind: "execute", title: "npm test", rawInput: { command: "npm test" } }, options: [
        { optionId: "allow-once", name: "Allow once", kind: "allow_once" }, { optionId: "reject-once", name: "Reject", kind: "reject_once" }
      ] } });
  }

  private receive(message: JsonReader): void {
    const value = message.toJson();
    if (!message.hasField("method")) {
      if (value["id"] === "terminal" && this.terminalPrompt !== null) {
        const waited = this.terminalReady && !JSON.stringify(value["result"] ?? null).includes("ready");
        this.terminalReady = false;
        if (waited)
          this.terminalSteps.unshift("ready");
        else
          this.terminalAnswers.push(value["result"] ?? value["error"] ?? null);
        const created = message.hasField("result") && message.readNullableObject("result")?.readOptionalString("terminalId");
        if (typeof created === "string") {
          this.terminalId = created;
          this.update({ sessionUpdate: "tool_call", toolCallId: "term", kind: "execute", title: "Run fixture command", status: "in_progress",
            content: [{ type: "terminal", terminalId: created }] });
        }
        this.nextTerminalStep();
        return;
      }
      if (this.planAskPrompt !== null && ["before-plan", "plan", "after-plan"].includes(String(value["id"]))) {
        this.planAnswers.push(value["result"] ?? value["error"] ?? null);
        if (value["id"] === "before-plan")
          this.sendPlan("plan");
        else if (value["id"] === "plan")
          this.askPermission("after-plan");
        else {
          this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ answers: this.planAnswers, sets: this.sets }) } });
          this.respond(this.planAskPrompt, { stopReason: "end_turn" });
          this.planAskPrompt = null;
        }
      }
      else if (value["id"] === "grok-plan-left" && !Object.isNull(this.planLeftPrompt)) {
        this.planLeftAnswer = value["result"] ?? value["error"] ?? null;
        this.update({ sessionUpdate: "current_mode_update", currentModeId: "default" });
        if (this.planLeftEndsFirst) {
          this.endPlanLeft(this.planLeftPrompt, "end_turn");
          return;
        }
        this.write({ jsonrpc: "2.0", id: "grok-plan-left-edit", method: "session/request_permission", params: { sessionId: this.sessionId,
          toolCall: { toolCallId: "edit-1", kind: "edit", title: "Edit notes.md", rawInput: { path: "notes.md" } }, options: [
            { optionId: "allow-once", name: "Allow once", kind: "allow_once" }, { optionId: "reject-once", name: "Reject", kind: "reject_once" }
          ] } });
      }
      else if (value["id"] === "grok-plan-left-edit" && !Object.isNull(this.planLeftPrompt)) {
        this.planLeftEdit = value["result"] ?? value["error"] ?? null;
        const prompt = this.planLeftPrompt;
        if (this.planLeftCancelled && process.env["TEAMRUN_FAKE_ACP_PLAN_LEFT_HOLD"] === "1") {
          const released = setInterval(() => {
            if (!existsSync(join(process.cwd(), "plan-left-released.txt"))) return;
            clearInterval(released);
            this.endPlanLeft(prompt, "cancelled");
          }, 10);
        }
        else if (this.planLeftCancelled)
          this.endPlanLeft(prompt, "cancelled");
        else
          this.write({ jsonrpc: "2.0", id: "grok-plan-left-ping", method: "fake/ping", params: { sessionId: this.sessionId } });
      }
      else if (value["id"] === "grok-gate" && !Object.isNull(this.gatedPrompt)) {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ gate: value["result"] ?? value["error"] ?? null }) } });
        this.respond(this.gatedPrompt, { stopReason: "end_turn" });
        this.gatedPrompt = null;
      }
      else if (value["id"] === "grok-plan-left-ping" && !Object.isNull(this.planLeftPrompt))
        this.endPlanLeft(this.planLeftPrompt, "end_turn");
      else if (value["id"] === "grok-plan" && this.planThenBackground !== null) {
        this.update({ sessionUpdate: "current_mode_update", currentModeId: "default" });
        this.startBackground(this.planThenBackground, "background");
        this.planThenBackground = null;
      }
      else if (value["id"] === "permission" && this.approvalPrompt !== null) {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify(value["result"] ?? value["error"]) } });
        this.respond(this.approvalPrompt, { stopReason: "end_turn" });
        this.approvalPrompt = null;
      }
      else if (value["id"] === "plan" && this.planPrompt !== null) {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ result: value["result"] ?? value["error"], sets: this.sets }) } });
        this.respond(this.planPrompt, { stopReason: "end_turn" });
        this.planPrompt = null;
      }
      else if (value["id"] === "permission" && this.wakeHeld === "approve")
        this.endWake(JSON.stringify({ result: value["result"] ?? value["error"], sets: this.sets }), "end_turn");
      return;
    }
    const method = message.readString("method");
    this.methods.push(method);
    if (method === "session/cancel") {
      if (!Object.isNull(this.planLeftPrompt))
        this.planLeftCancelled = true;
      if (this.wakeHeld === "hold")
        this.endWake("wake cancelled", "cancelled");
      if (this.held !== null && process.env["TEAMRUN_FAKE_ACP_IGNORE_CANCEL"] !== "1") {
        this.respond(this.held, { stopReason: "cancelled" });
        this.held = null;
      }
      return;
    }
    const id = message.readInteger("id");
    const params = message.readObject("params");
    if (method === "fixture/null") { this.respond(id, null); return; }
    if (method === "fixture/fail-without-code") { this.write({ jsonrpc: "2.0", id, error: { message: "No code" } }); return; }
    if (method === "fixture/close-input") {
      process.stdin.once("close", () => this.respond(id, {}));
      process.stdin.destroy();
      return;
    }
    if (method === "fixture/emit") {
      process.stdout.write(" \n");
      for (const envelope of params.readObjectArray("messages")) this.write(envelope.toJson());
      this.respond(id, {});
      return;
    }
    if (method === "fixture/split") {
      const line = JSON.stringify({ jsonrpc: "2.0", method: "first", params: { text: "x".repeat(256 * 1024) } });
      const third = Math.floor(line.length / 3);
      process.stdout.write(line.slice(0, third));
      process.stdout.write(line.slice(third, 2 * third));
      process.stdout.write(`${line.slice(2 * third)}\n`);
      this.write({ jsonrpc: "2.0", method: "second", params: { text: "after" } });
      this.respond(id, {});
      return;
    }
    if (method === "fixture/reverse") {
      this.approvalPrompt = id;
      this.write({ jsonrpc: "2.0", id: "permission", method: "reverse" });
      return;
    }
    if (method === "fixture/wait") return;
    if (method === "initialize") {
      const client = params.hasField("clientCapabilities") ? params.readObject("clientCapabilities") : null;
      this.compaction = client?.hasField("session") === true && client.readObject("session").hasField("compaction");
      this.terminals = client?.toJson()["terminal"] === true;
      this.subAgentEvents = JSON.stringify(client?.toJson()["_meta"]) === JSON.stringify({ "github.com/copilot": { events: ["subagent.started", "subagent.completed"] } });
      this.metaSent = client?.hasField("_meta") === true;
      const mode = process.env["TEAMRUN_FAKE_ACP_INIT"];
      if (mode === "hang") return;
      if (mode === "invalid") { process.stdout.write("invalid json\n"); return; }
      if (mode === "oversize") { process.stdout.write("x".repeat(16 * 1024 * 1024 + 1)); return; }
      if (COPILOT) {
        this.respond(id, { protocolVersion: 1, agentCapabilities: { auth: { logout: {} }, loadSession: true, mcpCapabilities: { http: true, sse: true },
          promptCapabilities: { image: true, audio: false, embeddedContext: true },
          sessionCapabilities: FakeAcpAgent.parse("TEAMRUN_FAKE_ACP_SESSION_CAPABILITIES") ?? { close: {}, list: {} } },
        agentInfo: { name: "Copilot", title: "Copilot", version: "1.0.100" },
        authMethods: [{ id: "copilot-login", name: "Log in with Copilot CLI", description: "Run `copilot login` in the terminal",
          _meta: { "terminal-auth": { command: "copilot", args: ["login"], label: "Copilot Login" } } }] });
        return;
      }
      if (CURSOR) {
        this.respond(id, { protocolVersion: 1, agentCapabilities: { loadSession: true, mcpCapabilities: { http: true, sse: true },
          promptCapabilities: { audio: false, embeddedContext: false, image: true }, sessionCapabilities: { list: {} } },
        authMethods: [{ id: "cursor_login", name: "Cursor Login",
          description: "Authenticate using existing Cursor login credentials. Run 'agent login' first if not logged in." }] });
        return;
      }
      if (FX) {
        if (mode === "loggedOut" || existsSync(join(process.cwd(), "signed-out.txt"))) {
          this.fail(id, "fx needs access to Vercel AI Gateway. Run fx login to sign in, fx setup to use an API key, or set AI_GATEWAY_API_KEY.", -32600);
          return;
        }
        if (mode === "credentialRefresh") {
          this.fail(id, "Credential refresh is temporarily unavailable. Retry shortly.", -32600);
          return;
        }
        this.respond(id, { protocolVersion: 1, agentCapabilities: { loadSession: true, mcpCapabilities: { http: true, sse: false },
          promptCapabilities: { image: true, audio: false, embeddedContext: true }, sessionCapabilities: { close: {}, list: {}, resume: {} } },
        authMethods: [], agentInfo: { name: "fx", title: "fx", version: "0.0.16" } });
        return;
      }
      if (OPENCODE) {
        this.respond(id, { protocolVersion: 1, agentCapabilities: { loadSession: true, mcpCapabilities: { http: true, sse: true },
          promptCapabilities: { embeddedContext: true, image: true }, sessionCapabilities: { close: {}, fork: {}, list: {}, resume: {} } },
        authMethods: [{ description: "Run `opencode auth login` in the terminal", name: "Login with opencode", id: "opencode-login" }],
        agentInfo: { name: "OpenCode", version: process.env["TEAMRUN_FAKE_ACP_VERSION"] ?? "1.19.4" } });
        return;
      }
      const capabilities = process.env["TEAMRUN_FAKE_ACP_CAPABILITIES"] === undefined
        ? { agentCapabilities: { loadSession: true, promptCapabilities: { image: mode === "images" },
          _meta: { "x.ai/hooks": { blockingEvents: ["PreToolUse", "Stop", "SubagentStop"], decisions: ["deny", "block"] } } } }
        : FakeAcpAgent.parse("TEAMRUN_FAKE_ACP_CAPABILITIES") as JsonObject;
      this.respond(id, FakeAcpAgent.omitting({
        authMethods: ![undefined, "omit"].includes(process.env["TEAMRUN_FAKE_ACP_AUTH_METHODS"]) ? FakeAcpAgent.parse("TEAMRUN_FAKE_ACP_AUTH_METHODS")
          : mode !== "loggedOut" ? [{ id: "cached_token", name: "Grok" }]
          : existsSync(join(process.env["GROK_HOME"]!, "auth.json")) ? [{ id: "cached_token", name: "Grok" }, { id: "grok.com", name: "Grok" }]
            : process.env["TEAMRUN_FAKE_ACP_NO_BROWSER_METHOD"] === "1" ? [] : [{ id: "grok.com", name: "Grok" }],
        _meta: { agentVersion: "1.0.30-fixture", modelState: { currentModelId: "grok-test", availableModels: process.env["TEAMRUN_FAKE_ACP_MODELS"]?.split(",")
          .map(t => ({ modelId: t, name: t })) ?? [
          { modelId: "grok-test", name: "Test model", description: "Fixture", _meta: { supportsReasoningEffort: true, reasoningEfforts: [{ value: "high" }, { value: "low" }] } },
          { modelId: "grok-other", name: "Other model" }
        ] } },
        ...capabilities
      }, "authMethods", process.env["TEAMRUN_FAKE_ACP_AUTH_METHODS"] === "omit"));
    }
    else if (method === "authenticate") {
      if (process.env["TEAMRUN_FAKE_ACP_SIGNIN_HANG"] === "1") writeFileSync(join(process.cwd(), "auth-browser.txt"), process.env["BROWSER"] ?? "");
      else if (process.env["TEAMRUN_FAKE_ACP_SIGNIN_FAIL"] === "1" || existsSync(join(process.cwd(), "signin-refused.txt"))) this.fail(id, "Authentication refused");
      else if (params.readString("methodId") === "grok.com") this.signIn(id, params);
      else {
        if (process.env["TEAMRUN_FAKE_ACP_RECORD_BROWSER"] === "1") writeFileSync(join(process.cwd(), "auth-browser.txt"), process.env["BROWSER"] ?? "");
        this.authenticated = params.toJson();
        this.respond(id, {});
      }
    }
    else if (method === "session/new" || method === "session/load" || method === "session/resume") {
      this.sessionCwd = params.readOptionalString("cwd") ?? process.cwd();
      if (method === "session/new") appendFileSync(join(process.cwd(), "new-sessions.txt"), "new\n");
      appendFileSync(join(process.cwd(), "mcp-servers.txt"), `${JSON.stringify(params.toJson()["mcpServers"])}\n`);
      appendFileSync(join(process.cwd(), "session-meta.txt"), `${method} ${JSON.stringify(params.toJson()["_meta"] ?? null)}\n`);
      if (method !== "session/new") {
        this.sessionId = params.readString("sessionId");
        if (this.sessionId === "missing") { this.fail(id, "Session not found"); return; }
        if (this.sessionId === "unsaved") { this.fail(id, "Invalid params", -32602, { message: `Session "${this.sessionId}" not found` }); return; }
        if (this.sessionId === "crash") process.exit(9);
        if (this.sessionId === "crash-signin") { writeFileSync(join(process.cwd(), "signin-refused.txt"), ""); process.exit(9); }
        if (this.sessionId === "garble") { this.garbled = true; process.stdout.write("not json\n"); return; }
        if (this.sessionId === "hold") { writeFileSync(join(process.cwd(), "load-held.txt"), ""); return; }
        if (method === "session/load") this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "replayed history" } });
        if (process.env["TEAMRUN_FAKE_ACP_KEEP_OPTIONS"] === "1" && existsSync(join(process.cwd(), "kept-options.json")))
          this.options = JSON.parse(readFileSync(join(process.cwd(), "kept-options.json"), "utf8")) as JsonObject[];
      }
      else if ((COPILOT || OPENCODE) && process.env["TEAMRUN_FAKE_ACP_INIT"] === "loggedOut") { this.fail(id, "Authentication required", -32000); return; }
      else if (CURSOR && (process.env["TEAMRUN_FAKE_ACP_INIT"] === "loggedOut" || existsSync(join(process.env["CURSOR_CONFIG_DIR"]!, "signed-out.txt")))) {
        this.fail(id, "Authentication required", -32000);
        return;
      }
      else if (process.env["TEAMRUN_FAKE_ACP_REQUIRE_AUTH"] === "1" && this.authenticated === null) { this.fail(id, "Authentication required", -32000); return; }
      else if (process.env["TEAMRUN_FAKE_ACP_NEW"] === "museLoggedOut") { this.fail(id, "Please log in to Muse before opening a session."); return; }
      else if (process.env["TEAMRUN_FAKE_ACP_NEW"] === "fail") { this.fail(id, "Session refused"); return; }
      else if (process.env["TEAMRUN_FAKE_ACP_NEW"] === "crash") process.exit(9);
      else if (process.env["TEAMRUN_FAKE_ACP_NEW"] === "noId") { this.respond(id, {}); return; }
      else this.sessionId = COPILOT ? "copilot-session" : "grok-session";
      const commands = method === "session/new" || process.env["TEAMRUN_FAKE_ACP_LOAD_COMMANDS"] !== "none" ? process.env["TEAMRUN_FAKE_ACP_COMMANDS"] : undefined;
      const answer = (): void => {
        if (commands !== undefined)
          this.update({ sessionUpdate: "available_commands_update", availableCommands: commands.split(",").map(t => ({ name: t, description: `Runs ${t}` })) });
        if (this.options !== null) this.respond(id, { sessionId: this.sessionId, configOptions: this.options });
        else this.respond(id, process.env["TEAMRUN_FAKE_ACP_NO_METADATA"] === "1" ? { sessionId: this.sessionId }
          : { sessionId: this.sessionId, models: { currentModelId: "grok-test" }, _meta: { reasoningEffort: "low" }, modes: FakeAcpAgent.parse("TEAMRUN_FAKE_ACP_MODES") });
      };
      if (method === "session/new" || process.env["TEAMRUN_FAKE_ACP_LATE_COMMANDS"] === undefined) {
        answer();
        if (process.env["TEAMRUN_FAKE_ACP_NEW"] === "exitAfter") process.stdout.write("", () => process.exit(9));
        return;
      }
      writeFileSync(join(process.cwd(), "loading.txt"), "");
      const loaded = setInterval(() => {
        if (!existsSync(join(process.cwd(), "late-sent.txt"))) return;
        clearInterval(loaded);
        answer();
      }, 10);
    }
    else if (method === "session/close") {
      appendFileSync(join(process.cwd(), "closed-sessions.txt"), `${params.readString("sessionId")}\n`);
      if (process.env["TEAMRUN_FAKE_ACP_CLOSE"] === "fail") this.fail(id, "Close refused");
      else this.respond(id, {});
    }
    else if (method === "session/set_model") {
      if (process.env["TEAMRUN_FAKE_ACP_SET_MODEL"] === "fail") this.fail(id, "Model refused");
      else this.respond(id, {});
    }
    else if (method === "session/set_config_option") {
      if (process.env["TEAMRUN_FAKE_ACP_SET_ANSWER"] === "fail") { this.fail(id, "Option refused"); return; }
      const configId = params.readString("configId");
      const value = params.readString("value");
      this.sets.push(`${configId}=${value}`);
      this.options = this.options!.map(t => t["id"] === configId ? { ...t, currentValue: value } : t);
      if (process.env["TEAMRUN_FAKE_ACP_KEEP_OPTIONS"] === "1") writeFileSync(join(process.cwd(), "kept-options.json"), JSON.stringify(this.options));
      if (value === process.env["TEAMRUN_FAKE_ACP_EFFORTLESS_MODEL"])
        this.options = this.options.filter(t => t["category"] !== "thought_level");
      if (COPILOT && configId === "mode")
        this.options = this.options.map(t => t["id"] === "allow_all" ? { ...t, currentValue: value.endsWith("#autopilot") ? "on" : "off" } : t);
      this.respond(id, process.env["TEAMRUN_FAKE_ACP_SET_ANSWER"] === "null" ? { configOptions: null } : { configOptions: this.options });
    }
    else if (method === "session/set_mode") {
      if (process.env["TEAMRUN_FAKE_ACP_SET_MODE"] === "fail" || process.env["TEAMRUN_FAKE_ACP_SET_MODE"] === `fail-${params.readString("modeId")}`) {
        this.fail(id, "Mode refused");
        return;
      }
      if (process.env["TEAMRUN_FAKE_ACP_SET_MODE"] === "late" && this.wakeHeld !== null) { this.lateModeRefusal = id; return; }
      this.sets.push(`mode=${params.readString("modeId")}`);
      const setsFile = process.env["TEAMRUN_FAKE_ACP_SETS"];
      if (!Object.isUndefined(setsFile))
        appendFileSync(setsFile, `mode=${params.readString("modeId")}\n`);
      this.respond(id, {});
    }
    else if (method === "session/prompt" && this.held !== null && JSON.stringify(params.toJson()["_meta"] ?? null) === JSON.stringify({ fx: { steer: true } })) {
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify(params.toJson()["prompt"] ?? null) } });
      this.respond(this.held, { stopReason: "end_turn" });
      this.held = null;
      const released = setInterval(() => {
        if (!existsSync(join(process.cwd(), "steer-released.txt"))) return;
        clearInterval(released);
        this.respond(id, { stopReason: "end_turn", _meta: { fx: { steering: "absorbed" } } });
      }, 10);
    }
    else if (method === "session/prompt") {
      if (process.env["TEAMRUN_FAKE_ACP_PROMPT_AUTH"] === "1") { this.fail(id, "Please log in", -32000); return; }
      const parts = params.readObjectArray("prompt");
      const text = parts[0]?.readString("text") ?? "";
      const prompt = text.split("\n\nTask:\n\n").at(-1) ?? text;
      const recorded = process.env["TEAMRUN_FAKE_ACP_PROMPTS"];
      if (recorded !== undefined) appendFileSync(recorded, `${JSON.stringify({ text })}\n`);
      if (prompt === "exit") process.exit(9);
      if (process.env["TEAMRUN_FAKE_ACP_ECHO"] === "1")
        this.update({ sessionUpdate: "user_message_chunk", content: { type: "text", text: prompt }, _meta: { modelId: "grok-test", promptIndex: this.prompts++ } });
      if (prompt.startsWith("/")) {
        if (prompt === "/compact" && this.compaction)
          for (const status of (process.env["TEAMRUN_FAKE_ACP_COMPACT_REPORTS"] ?? "").split(",").filter(t => t.length > 0))
            this.update({ sessionUpdate: "compaction_update", compactionId: "c-compact", status });
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text",
          text: prompt === "/compact" ? process.env["TEAMRUN_FAKE_ACP_COMPACT_ANSWER"] ?? text : text } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "reject") { this.fail(id, "Prompt refused"); return; }
      if (prompt.startsWith("refuse:")) {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: `\n\n${prompt.slice("refuse:".length)}` } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "noticed") {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Info: Disabled tools: bash, view" } });
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "The title" } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "launch-arguments") {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify(process.argv.slice(2)) } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "echoed") {
        this.update({ sessionUpdate: "session_info_update", title: text });
        this.update({ sessionUpdate: "session_info_update", title: `${text.slice(0, 4)}...` });
        this.update({ sessionUpdate: "session_info_update", title: `${text.slice(0, 4)}\u2026` });
        this.update({ sessionUpdate: "session_info_update", title: "The agent's title" });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt.includes("titled")) {
        this.update({ sessionUpdate: "session_info_update", title: "The agent's title" });
        this.update({ sessionUpdate: "session_info_update", title: null });
        this.update({ sessionUpdate: "session_info_update", title: "  " });
        this.update({ sessionUpdate: "session_info_update", updatedAt: "2026-11-01T00:00:00Z" });
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "The answered title" } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "quota") { this.fail(id, "You have exceeded your monthly quota"); return; }
      if (prompt === "rateLimit") { this.fail(id, "Rate limit reached: request quota per minute exceeded, retry later"); return; }
      if (prompt === "quotaPath") { this.fail(id, "Cannot read D:/work/quota-tracker/notes.md", -32603, { details: "File not found", quotaSnapshots: { chat: {} } }); return; }
      if (prompt === "quotaInternal") { this.fail(id, "Internal error", -32603, { details: "quota_exceeded: You have exceeded your monthly quota" }); return; }
      const runs = QUOTA_REPLIES[prompt];
      if (runs !== undefined) {
        this.update({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "Error: You have exceeded your monthly quota" } });
        for (const [index, run] of runs.entries()) {
          if (index > 0)
            this.update({ sessionUpdate: "tool_call", toolCallId: `run-${index}`, kind: "read", title: "Read notes", status: "completed" });
          for (const text of run)
            this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text } });
        }
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "sub-agents" || prompt === "background-sub-agents") {
        this.replay((prompt === "sub-agents" ? CopilotSubAgentsTogetherRecording : CopilotBackgroundSubAgentsRecording).turn
          .filter(t => this.subAgentEvents || t["method"] !== "github.com/copilot/sessionEvent"));
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "background-sub-agents-held") {
        this.replay(CopilotBackgroundSubAgentsRecording.turn.slice(0, 10).filter(t => this.subAgentEvents || t["method"] !== "github.com/copilot/sessionEvent"));
        this.held = id;
        return;
      }
      if (prompt === "background-sub-agent" || prompt === "background-sub-agent-held") {
        if (process.env["TEAMRUN_FAKE_ACP_SUB_AGENT_TREE"] === "1") FakeTaskTree.start(join(process.cwd(), "sub-agent-tree.txt"), 1, "stay", true);
        this.replay(GrokSubAgentRecording.background.filter(t => t["method"] !== "session/request_permission"));
        if (prompt === "background-sub-agent") this.respond(id, { stopReason: "end_turn" });
        else this.held = id;
        this.subAgentRunning = true;
        this.endSubAgentOnSignal();
        return;
      }
      if (prompt === "background" || prompt === "background-held" || prompt === "background-and-sub-agent") {
        this.startBackground(id, prompt);
        return;
      }
      if (prompt === "Go ahead with the plan." && this.planLeftCancelled) {
        this.planLeftCancelled = false;
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ restarted: parts.map(t => t.toJson()["text"] ?? null), sets: this.sets }) } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt.startsWith("gated-")) {
        const [kind = "", name = kind] = prompt.slice("gated-".length).split(":");
        this.gatedPrompt = id;
        this.update({ sessionUpdate: "tool_call", toolCallId: "gate-1", title: `Gated ${kind}`, kind: kind === "read" ? "read" : "edit", status: "pending",
          ...kind === "unknown" ? {} : { _meta: { "x.ai/tool": { name, read_only: kind === "read" } } } });
        this.write({ jsonrpc: "2.0", id: "grok-gate", method: "x.ai/hooks/run", params: { hookCallbackId: "teamrun-read-only-chat", hookEventName: "pre_tool_use",
          sessionId: this.sessionId, cwd: process.cwd(), workspaceRoot: process.cwd(), timestamp: new Date().toISOString(), permissionMode: "default", toolName: name,
          toolUseId: "gate-1", toolInput: {}, toolInputTruncated: false } });
        return;
      }
      if (prompt === "plan-left-for-default" || prompt === "plan-left-ends-first") {
        this.planLeftPrompt = id;
        this.planLeftEndsFirst = prompt === "plan-left-ends-first";
        this.write({ jsonrpc: "2.0", id: "grok-plan-left", method: "x.ai/exit_plan_mode", params: { sessionId: this.sessionId, toolCallId: "tc-1", planContent: "# Tidy" } });
        return;
      }
      if (prompt === "plan-then-background") {
        this.planThenBackground = id;
        this.write({ jsonrpc: "2.0", id: "grok-plan", method: "x.ai/exit_plan_mode", params: { sessionId: this.sessionId, toolCallId: "tc-1", planContent: "# Tidy" } });
        return;
      }
      if (prompt === "usage" && FX) {
        this.respond(id, { stopReason: "end_turn", usage: { inputTokens: 1200, outputTokens: 300, cacheReadTokens: 800, cacheWriteTokens: 100, reasoningTokens: 50 } });
        return;
      }
      if (prompt === "usage") {
        this.update({ sessionUpdate: "usage_update", used: 30_000, size: 200_000 });
        const answered = { inputTokens: 1200, outputTokens: 300, totalTokens: 1500, thoughtTokens: 50, cachedReadTokens: 800, cachedWriteTokens: 100 };
        this.respond(id, { stopReason: "end_turn", ...(OPENCODE ? {} : { usage: answered }), _meta: { usage: { inputTokens: 1200, outputTokens: 300, costUsdTicks: 25_000_000 } } });
        return;
      }
      if (prompt === "cost") {
        const costs = join(process.cwd(), "cost-prompts.txt");
        appendFileSync(costs, "x");
        this.update({ sessionUpdate: "usage_update", used: 30_000, size: 200_000, cost: { amount: 0.25 * readFileSync(costs, "utf8").length, currency: "USD" } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "full") {
        this.xaiUpdate({ sessionUpdate: "retry_state", type: "failed", errorType: "context_length", message: "The prompt is too long" });
        this.fail(id, "Internal error");
        return;
      }
      if (prompt === "notFull") {
        this.xaiUpdate({ sessionUpdate: "retry_state", type: "retrying", attempt: 1, maxRetries: 3, reason: "busy", errorType: "context_length" });
        this.xaiUpdate({ sessionUpdate: "retry_state", type: "failed", errorType: "auth", message: "Not this one" });
        this.fail(id, "Internal error");
        return;
      }
      if (prompt === "compact") {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Before" } });
        if (this.compaction) {
          this.update({ sessionUpdate: "compaction_update", compactionId: "c-1", status: "in_progress" });
          this.update({ sessionUpdate: "compaction_update", compactionId: "c-1", status: "completed" });
        }
        this.xaiUpdate({ sessionUpdate: "auto_compact_started", tokensUsed: 180000, contextWindow: 200000, percentage: 90, reason: "threshold" });
        this.xaiUpdate({ sessionUpdate: "retry_state", type: "retrying", attempt: 1, maxRetries: 3, reason: "busy", errorType: "context_length" });
        this.xaiUpdate({ sessionUpdate: "retry_state", type: "failed", errorType: "auth", message: "Not this one" });
        this.xaiUpdate({ sessionUpdate: "auto_compact_completed", tokensBefore: 180000, tokensAfter: 20000 });
        this.write({ jsonrpc: "2.0", method: "x.ai/follow_ups", params: { sessionId: this.sessionId, update: { sessionUpdate: "auto_compact_completed" } } });
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "After" } });
        if (this.compaction)
          this.update({ sessionUpdate: "compaction_update", compactionId: "c-2", status: "completed" });
        this.xaiUpdate({ sessionUpdate: "auto_compact_completed", tokensBefore: 180000, tokensAfter: 20000 });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "compactTwice") {
        this.xaiUpdate({ sessionUpdate: "auto_compact_completed", tokensBefore: 180000, tokensAfter: 20000 });
        this.update({ sessionUpdate: "compaction_update", compactionId: "c-1", status: "completed" });
        this.update({ sessionUpdate: "compaction_update", compactionId: "c-2", status: "completed" });
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Between" } });
        this.update({ sessionUpdate: "compaction_update", compactionId: "c-1", status: "completed" });
        this.update({ sessionUpdate: "compaction_update", status: "completed" });
        this.update({ sessionUpdate: "plan", entries: [{ content: "Go on", priority: "medium", status: "pending" }] });
        this.update({ sessionUpdate: "compaction_update", status: "completed" });
        this.update({ sessionUpdate: "usage_update", used: 20000, size: 200000 });
        this.update({ sessionUpdate: "compaction_update", status: "completed" });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "released") {
        const released = setInterval(() => {
          if (!existsSync(join(process.cwd(), "prompt-released.txt"))) return;
          clearInterval(released);
          this.respond(id, { stopReason: "end_turn" });
        }, 10);
        return;
      }
      if (prompt.startsWith("terminal-")) {
        if (!this.terminals) { this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "no terminals" } }); this.respond(id, { stopReason: "end_turn" }); return; }
        this.terminalPrompt = id;
        this.terminalId = null;
        this.terminalAnswers.length = 0;
        const steps: Record<string, string[]> = { "terminal-background": ["create:long", "ready", "done", "end"],
          "terminal-wait": ["create:exit", "wait", "output", "done", "release", "end"], "terminal-kill": ["create:long", "output", "kill", "wait", "release", "end"],
          "terminal-outside": ["create:outside", "end"], "terminal-released": ["create:cut", "wait", "output", "release", "output", "end"],
          "terminal-other": ["create:other", "end"], "terminal-missing": ["create:missing", "wait", "output", "release", "end"],
          "terminal-follow-release": ["create:quiet", "bare", "done", "release", "end"], "terminal-finish": ["create:finish", "done", "end"],
          "terminal-agent-exit": ["create:quiet", "done", "exit"], "terminal-fork": ["create:fork", "ready", "done", "end"],
          "terminal-nulls": ["create:nulls", "kill", "wait", "release", "end"] };
        this.terminalSteps = [...steps[prompt] ?? ["end"]];
        this.nextTerminalStep();
        return;
      }
      if (prompt === "cancel") { this.held = id; this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "working" } }); return; }
      if (prompt === "approve") {
        this.approvalPrompt = id;
        this.write({ jsonrpc: "2.0", id: "permission", method: "session/request_permission", params: { sessionId: this.sessionId,
          toolCall: { toolCallId: "t1", kind: "execute", title: "Run fixture command" }, options: [
            { optionId: "yes", name: "Allow once", kind: "allow_once" }, { optionId: "always", name: "Always", kind: "allow_always" },
            { optionId: "no", name: "Deny", kind: "reject_once" }
          ] } });
        return;
      }
      if (prompt.startsWith("cursor-permission ")) {
        this.approvalPrompt = id;
        const call = prompt.slice("cursor-permission ".length) === "mcp"
          ? { toolCallId: "m1", kind: "other", title: "personal-lookup", rawInput: { query: "fixture" } }
          : { toolCallId: "c1", kind: "execute", title: "npm test", rawInput: { command: "npm test" } };
        this.write({ jsonrpc: "2.0", id: "permission", method: "session/request_permission", params: { sessionId: this.sessionId, toolCall: call, options: [
          { optionId: "allow-once", name: "Allow once", kind: "allow_once" }, { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
          { optionId: "reject-once", name: "Reject", kind: "reject_once" }
        ] } });
        return;
      }
      if (prompt === "cursor-plan") {
        this.planPrompt = id;
        this.sendPlan("plan");
        return;
      }
      if (prompt === "cursor-todos" || prompt === "cursor-task" || prompt === "cursor-image") {
        const params = prompt === "cursor-todos" ? { toolCallId: "u1", todos: [{ id: "1", content: "Drop stale entries", status: "in_progress" }], merge: false }
          : prompt === "cursor-task" ? { toolCallId: "k1", description: "Explore codebase", prompt: "Find the cache.", subagentType: "explore" }
          : { toolCallId: "g1", description: "A flat icon", filePath: join(process.cwd(), "icon.png") };
        if (prompt === "cursor-image")
          writeFileSync(join(process.cwd(), "icon.png"), Buffer.from("89504e470d0a1a0a", "hex"));
        this.write({ jsonrpc: "2.0", method: `cursor/${prompt === "cursor-todos" ? "update_todos" : prompt === "cursor-task" ? "task" : "generate_image"}`,
          params: { sessionId: this.sessionId, ...params } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "cursor-plan-permission") {
        this.planAskPrompt = id;
        this.askPermission("before-plan");
        return;
      }
      if (prompt === "cursor-question") {
        this.approvalPrompt = id;
        this.write({ jsonrpc: "2.0", id: "permission", method: "cursor/ask_question", params: { sessionId: this.sessionId, toolCallId: "q1", title: "Preferences",
          questions: [
            { id: "color", prompt: "Which color do you prefer?", options: [{ id: "red", label: "Red" }, { id: "blue", label: "Blue" }] },
            { id: "sizes", prompt: "Which sizes do you want?", options: [{ id: "s", label: "Small" }, { id: "l", label: "Large" }], allowMultiple: true }
          ] } });
        return;
      }
      if (prompt.startsWith("use tool ")) {
        this.approvalPrompt = id;
        this.write({ jsonrpc: "2.0", id: "permission", method: "session/request_permission", params: { sessionId: this.sessionId,
          toolCall: { toolCallId: "u1", kind: "other", ...JSON.parse(prompt.slice("use tool ".length)) as JsonObject }, options: [
            { optionId: "yes", name: "Allow once", kind: "allow_once" }, { optionId: "no", name: "Deny", kind: "reject_once" }
          ] } });
        return;
      }
      if (prompt === "image") {
        const images = join(process.env["GROK_HOME"]!, "sessions", "%2Fwork", this.sessionId, "images");
        mkdirSync(images, { recursive: true });
        writeFileSync(join(images, "1.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
        this.update({ sessionUpdate: "tool_call", toolCallId: "i1", kind: "other", title: "image_gen", status: "in_progress", _meta: { "x.ai/tool": { name: "image_gen" } } });
        this.update({ sessionUpdate: "tool_call_update", toolCallId: "i1", status: "completed",
          rawOutput: { type: "ImageGen", path: join(images, "1.jpg"), filename: "1.jpg" } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "failed image") {
        const tool = { "x.ai/tool": { version: 1, name: "image_gen", kind: "image_gen", namespace: "grok_build", label: "Generate Image", read_only: false } };
        this.update({ sessionUpdate: "tool_call", toolCallId: "i2", title: "image_gen", rawInput: { prompt: "a square", aspect_ratio: "7:1" }, _meta: tool });
        this.update({ sessionUpdate: "tool_call_update", toolCallId: "i2", kind: "other", title: "imagine: a square",
          rawInput: { variant: "ImageGen", prompt: "a square", aspect_ratio: "7:1" }, _meta: tool });
        this.update({ sessionUpdate: "tool_call_update", toolCallId: "i2", status: "failed",
          content: [{ type: "content", content: { type: "text", text: "Tool `image_gen` failed: Image generation failed with HTTP 422" } }],
          rawOutput: { error: "tool_execution_failed", message: "Image generation failed with HTTP 422" } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "plan") {
        this.update({ sessionUpdate: "plan", entries: [{ content: "Read the code", priority: "medium", status: "completed" },
          { content: "Fix the bug", priority: "medium", status: "pending" }] });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "elicitation") {
        this.approvalPrompt = id;
        this.write({ jsonrpc: "2.0", id: "permission", method: "elicitation/create", params: { sessionId: this.sessionId, mode: "form", message: "Pick a size.",
          requestedSchema: { type: "object", properties: { size: { type: "string", enum: ["small", "large"] } } } } });
        return;
      }
      if (prompt === "antigravity-question") {
        this.approvalPrompt = id;
        this.write({ jsonrpc: "2.0", id: "permission", method: "session/request_permission", params: { sessionId: this.sessionId,
          toolCall: { toolCallId: "interaction_1", status: "pending", title: "Which colour do you prefer?", rawInput: {} },
          options: [{ optionId: "1", name: "Red", kind: "allow_once" }, { optionId: "2", name: "Blue", kind: "allow_once" }] } });
        return;
      }
      if (prompt === "antigravity-sub-agent") {
        this.replay(AntigravitySubAgentRecording.ended.filter(t => t["method"] !== "session/request_permission"));
        this.respond(id, { stopReason: AntigravitySubAgentRecording.endedStopReason });
        return;
      }
      if (prompt === "grok-question") {
        this.approvalPrompt = id;
        const messages = GrokQuestionRecording.accepted.messages;
        const asked = messages.findIndex(t => t["method"] === "_x.ai/ask_user_question");
        this.replay([...messages.slice(0, asked), { ...messages[asked], id: "permission" }]);
        return;
      }
      if (prompt === "generated-image") {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      if (prompt === "todos") {
        this.update({ sessionUpdate: "tool_call", toolCallId: "q1", kind: "other", title: "Plan the fix", status: "in_progress",
          rawInput: { description: "Plan the fix", query: "INSERT INTO todos (id, title, status) VALUES ('a', 'Read the code', 'done')" } });
        this.update({ sessionUpdate: "tool_call_update", toolCallId: "q1", status: "completed",
          rawOutput: { content: "1 row(s) inserted.", detailedContent: "SQL: INSERT INTO todos (id, title, status) VALUES ('a', 'Read the code', 'done')" } });
        this.respond(id, { stopReason: "end_turn" });
        return;
      }
      this.update({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "Reasoning" } });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Hello " } });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "world" } });
      this.update({ sessionUpdate: "tool_call", toolCallId: "t1", kind: "execute", title: "Run command", status: "in_progress" });
      this.update({ sessionUpdate: "tool_call_update", toolCallId: "t1", status: "completed", content: [{ type: "content", content: { type: "text", text: "Output" } }] });
      this.update({ sessionUpdate: "tool_call", toolCallId: "t2", kind: "edit", title: "Edit fixture", locations: [{ path: "fixture.txt" }], status: "completed" });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text",
        text: prompt === "methods" ? JSON.stringify({ methods: this.methods, authenticated: this.authenticated, sets: this.sets, metaSent: this.metaSent })
          : prompt === "environment" ? JSON.stringify({ token: process.env["TEAMRUN_SENDER_TOKEN"] ?? null, other: process.env["TEAMRUN_TEST_VARIABLE"] ?? null })
          : prompt === "launch" ? JSON.stringify({ args: process.argv.slice(2), home: process.env["COPILOT_HOME"] ?? null, cwd: process.cwd() })
          : prompt === "opencode-environment" ? JSON.stringify(Object.fromEntries(OPENCODE_VARIABLES.map(t => [t, process.env[t] ?? null])))
          : prompt === "cursor-environment" ? JSON.stringify(Object.fromEntries(CURSOR_VARIABLES.map(t => [t, process.env[t] ?? null])))
          : prompt === "fx-environment" ? JSON.stringify({ ...Object.fromEntries(FX_VARIABLES.map(t => [t, process.env[t] ?? null])), cwd: process.cwd(), args: process.argv.slice(2) })
          : prompt.startsWith("images") || prompt === "role-payload" || prompt.startsWith("files") ? JSON.stringify(parts.map(t => t.toJson())) : "Done" } });
      this.respond(id, { stopReason: prompt === "limit" ? "max_tokens" : prompt === "quotaStop" ? "quota_exceeded" : prompt === "refuse" ? "refusal" : "end_turn" });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "late after response" } });
    }
    else if (method === "_x.ai/interject" || method === "x.ai/interject") {
      if (this.held === null) { this.fail(id, "No prompt is running"); return; }
      this.respond(id, { status: "queued" });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ text: params.toJson()["text"], content: params.toJson()["content"] }) } });
      this.respond(this.held, { stopReason: "end_turn" });
      this.held = null;
    }
    else if (method === "_x.ai/session/fork" || method === "x.ai/session/fork") {
      appendFileSync(join(process.cwd(), "fork-requests.txt"), `${method} ${JSON.stringify(params.toJson())}\n`);
      const mode = process.env["TEAMRUN_FAKE_ACP_FORK"];
      if (mode === "fail") this.fail(id, "Session not found");
      else if (mode === "unknown" || (mode === "plain" && method.startsWith("_"))) this.fail(id, "Unknown method", -32601);
      else this.respond(id, { newSessionId: `fork-of-${params.readString("sourceSessionId")}-at-${String(params.toJson()["targetPromptIndex"])}`, chatMessagesCopied: 2,
        updatesCopied: 4, planStateCopied: false, newCwd: params.readString("newCwd"), parentSessionId: params.readString("sourceSessionId") });
    }
    else if (method === "_x.ai/subagent/cancel" || method === "x.ai/subagent/cancel") {
      appendFileSync(join(process.cwd(), "sub-agent-cancels.txt"), `${method} ${JSON.stringify(params.toJson())}\n`);
      const known = this.subAgentRunning && process.env["TEAMRUN_FAKE_ACP_SUB_AGENT_CANCEL"] !== "missing";
      this.respond(id, { result: { subagentId: params.readString("subagentId"), cancelled: known, outcome: { kind: known ? "cancelled" : "not_found" } } });
      if (known)
        this.endSubAgent(JsonReader.fromValue({ status: "cancelled", willWake: false }));
    }
    else if (method === "_x.ai/session/info" || method === "x.ai/session/info")
      this.answerUsage(id, method, process.env["TEAMRUN_FAKE_ACP_SESSION_INFO"],
        { result: { context: { used: 31_000, total: 200_000, usagePct: 15.5, autoCompactThresholdPercent: 85 } } });
    else if (method === "_x.ai/models/list" || method === "x.ai/models/list") {
      const mode = process.env["TEAMRUN_FAKE_ACP_MODEL_LIST"];
      const listed = (process.env["TEAMRUN_FAKE_ACP_LISTED_MODELS"] ?? process.env["TEAMRUN_FAKE_ACP_MODELS"] ?? "grok-test").split(",");
      this.answerUsage(id, method, mode, mode === "error" ? { error: "catalog unavailable" } : mode === "invalid" ? { result: "loading" }
        : { result: { currentModelId: listed[0] ?? "grok-test", availableModels: listed.map(t => ({ modelId: t, name: t })) } });
    }
    else if (method === "_x.ai/billing" || method === "x.ai/billing") {
      const answers = join(process.cwd(), "billing-answers.txt");
      const used = 37.5 + 10 * (existsSync(answers) ? readFileSync(answers, "utf8").length : 0);
      this.answerUsage(id, method, process.env["TEAMRUN_FAKE_ACP_BILLING"],
        { config: { creditUsagePercent: used, currentPeriod: { type: "USAGE_PERIOD_TYPE_WEEKLY", end: "2026-10-27T00:00:00Z" } },
          ...process.env["TEAMRUN_FAKE_ACP_BILLING"] === "noTier" ? {} : { subscription_tier: "SuperGrok Heavy" } }, () => appendFileSync(answers, "."));
    }
    else if (method === "_x.ai/mcp/list" || method === "x.ai/mcp/list")
      this.answerUsage(id, method, process.env["TEAMRUN_FAKE_ACP_MCP_LIST"], process.env["TEAMRUN_FAKE_ACP_MCP_LIST"] === "invalid" ? { servers: "docs" } : {
        servers: [
          { name: "docs", source: "local", config: { type: "stdio", command: "docs-server", args: [], env: {} } },
          { name: "teamrun", source: "local", config: { type: "stdio", command: "teamrun", args: [], env: {} } },
          { name: "docs", source: "project", config: { type: "stdio", command: "project-docs", args: [], env: {} } },
          { name: "linear", displayName: "Linear", source: "managed", config: { type: "managedGateway" } }
        ]
      });
    else if (method === "_x.ai/auth/logout" || method === "x.ai/auth/logout") {
      const mode = process.env["TEAMRUN_FAKE_ACP_LOGOUT"];
      if (mode === "fail") this.fail(id, "Logout refused");
      else if (mode === "unknown" || (mode === "plain" && method.startsWith("_"))) this.fail(id, "Unknown method", -32601);
      else {
        writeFileSync(join(process.cwd(), "logout.txt"), JSON.stringify({ params: params.toJson(), methods: this.methods }));
        this.respond(id, { ok: mode !== "refused", was_logged_in: true, email: null, api_key_still_set: mode === "apiKey" });
      }
    }
    else if (method === "logout") {
      const mode = process.env["TEAMRUN_FAKE_ACP_LOGOUT"];
      if (mode === "fail") this.fail(id, "Logout refused");
      else if (mode === "hang") writeFileSync(join(process.cwd(), "logout-held.txt"), "");
      else if (mode === "hold") {
        writeFileSync(join(process.cwd(), "logout-held.txt"), "");
        const released = setInterval(() => {
          if (!existsSync(join(process.cwd(), "logout-released.txt"))) return;
          clearInterval(released);
          this.respond(id, {});
        }, 10);
      }
      else {
        writeFileSync(join(process.cwd(), "logout.txt"), JSON.stringify({ params: params.toJson(), methods: this.methods }));
        this.respond(id, {});
      }
    }
    else if (method === "_x.ai/auth/info" || method === "x.ai/auth/info") {
      const mode = process.env["TEAMRUN_FAKE_ACP_ACCOUNT"];
      this.answerUsage(id, method, mode, mode === "none" ? { methodId: null, email: null, firstName: null, teamBlockedReasons: [], codingDataRetentionOptOut: true }
        : { methodId: "cached_token", email: "person@example.com", firstName: "Test", teamName: "Lab", organizationName: mode === "team" ? null : "Acme",
          teamBlockedReasons: [], codingDataRetentionOptOut: false });
    }
    else this.fail(id, "Unknown method", -32601);
  }

  private answerUsage(id: number, method: string, mode: string | undefined, answer: JsonObject, answered: () => void = (): void => undefined): void {
    appendFileSync(join(process.cwd(), "usage-requests.txt"), `${method}\n`);
    const probe = process.env["TEAMRUN_PROBE_FILE"];
    if (!Object.isUndefined(probe))
      appendFileSync(probe, `fake got ${id} ${method} at ${Date.now()}\n`);
    if (mode === "hang" || (mode === "hangNamespaced" && method.startsWith("_")))
      return;
    if (mode === "fail")
      this.fail(id, "Usage unavailable");
    else if (mode === "plain" && method.startsWith("_"))
      this.fail(id, "Unknown method", -32601);
    else if (mode === "unknown")
      this.fail(id, "Unknown method", -32601);
    else {
      answered();
      this.respond(id, answer);
    }
  }

  private startBackground(id: number, prompt: string): void {
    const tree = join(process.cwd(), `task-tree-${process.pid}-${++this.trees}.txt`);
    const task = FakeTaskTree.start(tree, 2, "follow", process.env["TEAMRUN_FAKE_ACP_TASK_OUTLIVES"] === "1");
    const exited = (): void => {
      clearInterval(started);
      this.fail(id, "The task exited before it started");
    };
    task.once("exit", exited);
    const started = setInterval(() => {
      if (FakeTaskTree.read(tree).length !== 2) return;
      clearInterval(started);
      task.off("exit", exited);
      this.replay(GrokBackgroundTaskRecording.turn.map(t => FakeAcpAgent.withProcess(t, task.pid!)));
      if (prompt === "background-and-sub-agent") {
        this.replay(GrokSubAgentRecording.background.filter(t => t["method"] !== "session/request_permission"));
        this.subAgentRunning = true;
        this.endSubAgentOnSignal();
      }
      if (prompt !== "background-held") this.respond(id, { stopReason: "end_turn" });
      else this.held = id;
      this.endTaskOnSignal(task);
      this.sendLateCommands();
    }, 10);
  }

  private endTaskOnSignal(task: ChildProcess): void {
    const signal = join(process.cwd(), "task-end.txt");
    let ended = false;
    const finish = (end: TaskEnding): void => {
      clearInterval(timer);
      if (ended) return;
      ended = true;
      this.endTask(end);
    };
    task.once("exit", () => finish({ exitCode: null }));
    const timer = setInterval(() => {
      if (!existsSync(signal))
        return;
      const end = JSON.parse(readFileSync(signal, "utf8")) as TaskEnding;
      if (end.exit === true) process.exit(9);
      finish(end);
      task.kill();
    }, 20);
  }

  private endTask(end: TaskEnding): void {
    const willWake = end.willWake !== false;
    const woken = end.woken ?? willWake;
    const reason = end.wakeReason ?? "end_turn";
    this.wakeHeld = reason === "hold" || reason === "approve" ? reason : null;
    const waking = (message: JsonObject): boolean => JSON.stringify(message).includes("\"task-completed-TASK\"");
    const update = (message: JsonObject): JsonObject => (message["params"] as JsonObject)["update"] as JsonObject;
    const changed = (message: JsonObject, changes: JsonObject): JsonObject =>
      ({ ...message, params: { ...message["params"] as JsonObject, update: { ...update(message), ...changes } } });
    const messages = GrokBackgroundTaskRecording.afterTurn.filter(t => woken || !waking(t)).map(t => t["method"] !== "_x.ai/task_completed" ? t
      : changed(t, { will_wake: willWake, task_snapshot: { ...update(t)["task_snapshot"] as JsonObject, exit_code: end.exitCode === undefined ? 0 : end.exitCode,
        explicitly_killed: end.killed === true } }));
    const completed = messages.at(-1)!;
    this.replay(woken ? messages.slice(0, -1) : messages);
    if (this.wakeHeld === "approve")
      this.write({ jsonrpc: "2.0", id: "permission", method: "session/request_permission", params: { sessionId: this.sessionId,
        toolCall: { toolCallId: "t2", kind: "execute", title: "Run wake command" }, options: [{ optionId: "yes", name: "Allow once", kind: "allow_once" }] } });
    else if (woken && this.wakeHeld === null)
      this.replay([changed(completed, { stop_reason: reason })]);
  }

  private endSubAgentOnSignal(): void {
    const signal = join(process.cwd(), "sub-agent-end.txt");
    const timer = setInterval(() => {
      if (!existsSync(signal))
        return;
      const text = readFileSync(signal, "utf8").trim();
      if (text === "") {
        try {
          unlinkSync(signal);
        }
        catch {
          return;
        }
        writeFileSync(`${signal}-seen`, "");
        return;
      }
      clearInterval(timer);
      const end = JsonReader.parse(text);
      if (end.hasField("exit")) process.exit(9);
      this.endSubAgent(end);
    }, 20);
  }

  private endSubAgent(end: JsonReader): void {
    if (!this.subAgentRunning) return;
    this.subAgentRunning = false;
    const status = end.readOptionalString("status") ?? "completed";
    const willWake = !end.hasField("willWake") || end.readBoolean("willWake");
    if (status === "completed")
      this.write({ jsonrpc: "2.0", method: "session/update", params: { sessionId: "grok-child",
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "The capture's first line." } } } });
    this.xaiUpdate({ sessionUpdate: "subagent_finished", subagent_id: "grok-child", attempt_id: "attempt", child_session_id: "grok-child", status, tool_calls: 1,
      turns: 1, duration_ms: 3067, ...status === "completed" ? { output: "The capture's first line." } : {}, will_wake: willWake });
    if (!willWake) return;
    this.write({ jsonrpc: "2.0", method: "session/update", params: { sessionId: this.sessionId,
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "The sub-agent answered: The capture's first line." } },
      _meta: { promptId: "subagent-completed-grok-child" } } });
    this.xaiUpdate({ sessionUpdate: "turn_completed", prompt_id: "subagent-completed-grok-child", stop_reason: "end_turn" });
  }

  private static withProcess(message: JsonObject, processId: number): JsonObject {
    const update = (message["params"] as JsonObject)["update"] as JsonObject | undefined;
    const output = update?.["rawOutput"] as JsonObject | undefined;
    return output?.["type"] !== "BackgroundTaskStarted" ? message
      : { ...message, params: { ...message["params"] as JsonObject, update: { ...update, rawOutput: { ...output, pid: processId } } } };
  }

  private endWake(text: string, reason: string): void {
    this.wakeHeld = null;
    this.write({ jsonrpc: "2.0", method: "session/update", params: { sessionId: this.sessionId,
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } }, _meta: { promptId: "task-completed-TASK" } } });
    this.xaiUpdate({ sessionUpdate: "turn_completed", prompt_id: "task-completed-TASK", stop_reason: reason });
    if (this.lateModeRefusal !== null) {
      this.fail(this.lateModeRefusal, "Mode refused late");
      this.lateModeRefusal = null;
    }
  }

  private replay(messages: readonly JsonObject[]): void {
    for (const message of messages)
      this.write({ jsonrpc: "2.0", ...message, params: { sessionId: this.sessionId, ...message["params"] as JsonObject } });
  }

  public static fxStatus(): void {
    writeFileSync(join(process.env["HOME"]!, "status-call.json"), JSON.stringify({ args: process.argv.slice(2), key: process.env["AI_GATEWAY_API_KEY"] ?? null }));
    if (FX_STATUS === "unreadable") {
      process.stdout.write("not an answer");
      return;
    }
    process.stdout.write(`${JSON.stringify({ kind: "status", auth: FX_STATUS })}
`);
  }

  public static fxLogOut(): void {
    const failing = process.env["TEAMRUN_FAKE_FX_LOGOUT_ACCOUNTS"]?.split(",") ?? null;
    const mode = Object.isNull(failing) || failing.includes(String(process.argv[3])) ? process.env["TEAMRUN_FAKE_FX_LOGOUT"] : undefined;
    if (mode === "hang") { setInterval(() => undefined, 1000); return; }
    if (mode === "fail") { process.stderr.write("fx logout: failed to durably remove saved fx login\n"); process.exit(1); }
    if (mode === "quiet") process.exit(1);
    appendFileSync(join(String(process.env["HOME"]), "logout-calls.txt"), `${process.argv.slice(3).join(" ")}\n`);
    process.exit(0);
  }

  public static about(): void {
    if (process.env["TEAMRUN_FAKE_CURSOR_ABOUT"] === "fail") { process.stderr.write("About refused\n"); process.exit(1); }
    process.stdout.write(["About Cursor CLI", "", "CLI Version         2026.10.22-27dcf5f", "Latest              disabled", "Model               Auto",
      "Subscription Tier   Free", "OS                  linux (x64)", "User Email          person@example.com", ""].join("\n"));
    process.exit(0);
  }

  public static opencodeModels(): void {
    if (process.env["TEAMRUN_FAKE_OPENCODE_MODELS"] === "fail") {
      process.stdout.write(`anthropic/claude-sonnet-4-5\n${JSON.stringify({ variants: {} })}\n`);
      process.stderr.write("Models refused\n");
      process.exit(1);
    }
    const padding = process.env["TEAMRUN_FAKE_OPENCODE_MODELS"] === "long" ? Array.from({ length: 450 }, (_, index) =>
      `padding/model-${index}\n${JSON.stringify({ id: `model-${index}`, providerID: "padding", notes: "x".repeat(1300), variants: {} }, null, 2)}\n`) : [];
    process.stdout.write([...padding, OpencodeModelListRecording.output].join(""), () => process.exit(0));
  }

  private static launchedWith(options: JsonObject[]): JsonObject[] {
    const at = process.argv.indexOf("--model");
    return at < 0 ? options : options.map(t => t["category"] === "model" ? { ...t, currentValue: process.argv[at + 1]! } : t);
  }

  public static logOut(): void {
    const profile = process.env["CURSOR_CONFIG_DIR"]!;
    const mode = process.env["TEAMRUN_FAKE_CURSOR_LOGOUT"];
    if (mode === "hang") { setInterval(() => undefined, 1000); return; }
    if (mode === "fail") { process.stderr.write("Logout refused\n"); process.exit(1); }
    if (mode === "quiet") process.exit(1);
    writeFileSync(join(profile, "signed-out.txt"), JSON.stringify(Object.fromEntries(CURSOR_VARIABLES.map(t => [t, process.env[t] ?? null]))));
    process.exit(0);
  }

  private static omitting(answer: JsonObject, field: string, omitted: boolean): JsonObject {
    return omitted ? Object.fromEntries(Object.entries(answer).filter(([t]) => t !== field)) : answer;
  }

  private static parse(name: string): JsonValue {
    const text = process.env[name];
    return text === undefined ? null : JSON.parse(text) as JsonValue;
  }

  private xaiUpdate(update: JsonObject): void {
    if (!COPILOT)
      this.write({ jsonrpc: "2.0", method: "_x.ai/session_notification", params: { sessionId: this.sessionId, update } });
  }

  private sendLateCommands(): void {
    const late = process.env["TEAMRUN_FAKE_ACP_LATE_COMMANDS"];
    if (late === undefined) return;
    const loading = setInterval(() => {
      if (!existsSync(join(process.cwd(), "loading.txt"))) return;
      clearInterval(loading);
      this.update({ sessionUpdate: "available_commands_update", availableCommands: late.split(",").map(t => ({ name: t, description: `Runs ${t}` })) });
      writeFileSync(join(process.cwd(), "late-sent.txt"), "");
    }, 10);
  }

  private nextTerminalStep(): void {
    const step = this.terminalSteps.shift() ?? "end";
    const asked = { sessionId: this.sessionId, terminalId: this.terminalId };
    if (step.startsWith("create:")) {
      const kind = step.slice("create:".length);
      const scripts: Record<string, string> = { exit: "console.log(process.env.FIXTURE_VALUE + \" done\"); process.exit(3);",
        cut: "console.log(\"\\u00e9\\u00e9\\u00e9\"); process.exit(3);", quiet: "setInterval(() => undefined, 1000);",
        finish: "const timer = setInterval(() => { try { const code = Number(require(\"node:fs\").readFileSync(\"finish.txt\", \"utf8\")); clearInterval(timer); "
          + "process.stdout.write(\"x\".repeat(65536) + \"finished\\n\", () => process.exit(code)); } catch {} }, 20);",
        fork: "const child = require(\"node:child_process\").spawn(process.execPath, [\"-e\", \"setInterval(() => undefined, 1000)\"], "
          + "{ stdio: \"inherit\", detached: process.platform === \"win32\", windowsHide: true }); "
          + "process.stdout.write(\"ready child \" + child.pid + \" root \" + process.pid + \"\\n\", () => process.exit(0));" };
      const script = scripts[kind] ?? "console.log(\"ready\"); setInterval(() => undefined, 1000);";
      const params: JsonObject = kind === "missing" ? { sessionId: this.sessionId, command: "teamrun-missing-command" }
        : kind === "nulls" ? { sessionId: this.sessionId, command: process.execPath, args: null, env: null, cwd: null, outputByteLimit: null }
        : { sessionId: kind === "other" ? "other-session" : this.sessionId, command: process.execPath, args: ["-e", script],
          env: [{ name: "FIXTURE_VALUE", value: "fixture" }], outputByteLimit: kind === "cut" ? 4 : 1024, ...(kind === "outside" ? { cwd: dirname(this.sessionCwd) } : {}) };
      this.write({ jsonrpc: "2.0", id: "terminal", method: "terminal/create", params });
    }
    else if (step === "ready") {
      this.terminalReady = true;
      this.write({ jsonrpc: "2.0", id: "terminal", method: "terminal/output", params: asked });
    }
    else if (step === "exit")
      process.stdout.write("", () => process.exit(9));
    else if (step === "bare") {
      this.update({ sessionUpdate: "tool_call_update", toolCallId: "term" });
      this.update({ sessionUpdate: "tool_call_update", toolCallId: "term", status: "completed" });
      this.nextTerminalStep();
    }
    else if (step === "done") {
      this.update({ sessionUpdate: "tool_call_update", toolCallId: "term", status: "completed", content: [{ type: "terminal", terminalId: this.terminalId }] });
      this.nextTerminalStep();
    }
    else if (step === "end") {
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ answers: this.terminalAnswers }) } });
      const prompt = this.terminalPrompt;
      this.terminalPrompt = null;
      if (prompt !== null)
        this.respond(prompt, { stopReason: "end_turn" });
    }
    else
      this.write({ jsonrpc: "2.0", id: "terminal", method: `terminal/${step === "wait" ? "wait_for_exit" : step}`, params: asked });
  }

  private update(update: JsonObject): void {
    this.write({ jsonrpc: "2.0", method: "session/update", params: { sessionId: this.sessionId, update } });
  }

  private endPlanLeft(prompt: number, stopReason: string): void {
    this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify({ result: this.planLeftAnswer, edit: this.planLeftEdit, sets: this.sets,
      cancelled: this.planLeftCancelled }) } });
    this.respond(prompt, { stopReason });
    this.planLeftPrompt = null;
  }

  private respond(id: number, result: JsonValue): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  private fail(id: number, message: string, code: number = -32603, data?: JsonObject): void {
    this.write({ jsonrpc: "2.0", id, error: { code, message, ...data === undefined ? {} : { data } } });
  }

  private write(value: JsonObject): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
  }
}

if (process.argv.includes("--headless"))
  new FakeCopilotHeadless().run();
else if (CURSOR && process.argv[2] === "logout")
  FakeAcpAgent.logOut();
else if (CURSOR && process.argv[2] === "about")
  FakeAcpAgent.about();
else if (OPENCODE && process.argv.slice(2).join(" ") === "models --verbose")
  FakeAcpAgent.opencodeModels();
else if (FX && process.argv[2] === "status")
  FakeAcpAgent.fxStatus();
else if (FX && process.argv[2] === "logout")
  FakeAcpAgent.fxLogOut();
else
  new FakeAcpAgent().run();
