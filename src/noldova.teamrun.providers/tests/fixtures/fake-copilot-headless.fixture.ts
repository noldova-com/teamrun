/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

const MODELS: JsonValue = [
  { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", capabilities: { supports: { vision: true, reasoningEffort: false }, limits: { max_context_window_tokens: 200000 } },
    policy: { state: "enabled", terms: "" }, billing: { multiplier: 1 } },
  { id: "gpt-5", name: "GPT-5 ✦", capabilities: { supports: { vision: false, reasoningEffort: true } }, supportedReasoningEfforts: ["low", "medium", "ultra", "high"],
    defaultReasoningEffort: "medium" },
  { id: "o-preview", name: " ", capabilities: { supports: { reasoningEffort: true } }, defaultReasoningEffort: "high", policy: { state: "unconfigured", terms: "Preview terms" } },
  { id: "blocked", name: "Blocked", capabilities: { supports: {} }, policy: { state: "disabled", terms: "" } },
  { id: "--allow-all-tools", name: "Flag", capabilities: { supports: {} } },
  { id: "bare", policy: null, capabilities: { type: "chat", supports: { tool_calls: true, reasoning_effort: ["none", "low", "ultra", "max"] } } }
];
const EMPTY_MODES: readonly string[] = ["empty", "free", "failQuota"];

export class FakeCopilotHeadless {
  private readonly mode: string = FakeCopilotHeadless.readMode();
  private buffered: Buffer = Buffer.alloc(0);

  public run(): void {
    writeFileSync(join(process.cwd(), "headless-launch.json"), JSON.stringify({ args: process.argv.slice(2), home: process.env["COPILOT_HOME"] ?? null }));
    if (this.mode.length === 0) {
      process.stderr.write("error: unknown option '--headless'\n");
      process.exit(1);
    }
    process.stdin.on("data", (chunk: Buffer) => this.receive(chunk));
    process.stdin.on("end", () => {
      if (this.mode === "stay")
        setInterval(() => undefined, 1000);
      else
        process.exit(0);
    });
  }

  private static quotaAsks(): number {
    return readFileSync(join(process.cwd(), "headless-methods.txt"), "utf8").split("\n").filter(t => t.startsWith("session.quota.get ")).length;
  }

  private static models(): JsonValue {
    const models = process.env["TEAMRUN_FAKE_COPILOT_MODELS"];
    return models === undefined ? MODELS : JSON.parse(models) as JsonValue;
  }

  private static readMode(): string {
    const [first, later] = (process.env["TEAMRUN_FAKE_COPILOT_HEADLESS"] ?? "").split(">");
    if (later === undefined)
      return first!;
    const marker = join(process.cwd(), "headless-started.txt");
    const started = existsSync(marker);
    writeFileSync(marker, "");
    return started ? later : first!;
  }

  private receive(chunk: Buffer): void {
    this.buffered = Buffer.concat([this.buffered, chunk]);
    let end: number;
    while ((end = this.buffered.indexOf("\r\n\r\n")) >= 0) {
      const length = Number(/Content-Length: (\d+)/.exec(this.buffered.subarray(0, end).toString())![1]);
      if (this.buffered.length < end + 4 + length)
        return;
      const body = this.buffered.subarray(end + 4, end + 4 + length).toString("utf8");
      this.buffered = this.buffered.subarray(end + 4 + length);
      this.handle(JsonReader.parse(body));
    }
  }

  private handle(message: JsonReader): void {
    const id = message.readInteger("id");
    const method = message.readString("method");
    const params = message.readObject("params").toJson();
    appendFileSync(join(process.cwd(), "headless-methods.txt"), `${method} ${JSON.stringify(params)}\n`);
    if ((method === "connect" && this.mode === "holdConnect") || (method === "auth.getStatus" && this.mode === "holdStatus"))
      return;
    if (method === "connect" && this.mode === "releaseConnect") {
      const released = setInterval(() => {
        if (!existsSync(join(process.cwd(), "headless-released.txt")))
          return;
        clearInterval(released);
        this.respond(id, { protocolVersion: 3 });
      }, 10);
      return;
    }
    if (method === "connect" && this.mode === "noConnect")
      this.fail(id, -32601, "Method not found: connect");
    else if (method === "connect" && this.mode === "failConnect")
      this.fail(id, -32603, "connect failed");
    else if (method === "connect")
      this.respond(id, { protocolVersion: 3 });
    else if (method === "auth.getStatus" && this.mode === "failStatus")
      this.fail(id, -32603, "auth.getStatus failed");
    else if (method === "auth.getStatus")
      this.respond(id, this.mode === "signedOut" ? { isAuthenticated: false, statusMessage: "Not signed in" } : { isAuthenticated: true, authType: "user", login: "octo" });
    else if (method === "session.create" && this.mode === "failSession")
      this.fail(id, -32603, "session.create failed");
    else if (method === "session.create")
      this.respond(id, { sessionId: "fake-session", modelState: {} });
    else if (method === "session.model.list")
      this.listModels(id);
    else if (method === "session.quota.refresh" && this.mode === "failRefresh")
      this.fail(id, -32601, "Method not found: session.quota.refresh");
    else if (method === "session.quota.get" && this.mode === "failQuota")
      this.fail(id, -32603, "session.quota.get failed");
    else if (method === "session.quota.get" && this.mode === "empty")
      this.respond(id, { isFreeUser: false, isTbbUser: true, planTier: "pro", snapshots: {}, providerQuotas: [] });
    else if (method === "session.quota.get" && this.mode === "spent")
      this.respond(id, { isFreeUser: false, planTier: "pro", snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 0,
        resetDateEpochMs: 1_796_083_200_000 } } });
    else if (method === "session.quota.get")
      this.respond(id, this.mode === "free" ? { isFreeUser: true, planTier: "free", upgradeUrl: "https://github.com/settings/copilot" } : { isFreeUser: false, planTier: "pro",
        snapshots: { premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 72.5 - 10 * FakeCopilotHeadless.quotaAsks(),
          resetDateEpochMs: 1_796_083_200_000 }, chat: { isUnlimitedEntitlement: true } } });
    else if (method === "session.delete" && this.mode === "failDelete")
      this.fail(id, -32603, "session.delete failed");
    else if (method === "session.delete" && this.mode === "holdDelete")
      writeFileSync(join(process.cwd(), "headless-delete-held.txt"), "");
    else
      this.respond(id, params);
  }

  private listModels(id: number): void {
    if (this.mode === "hold") {
      writeFileSync(join(process.cwd(), "headless-held.txt"), "");
      return;
    }
    if (this.mode === "late") {
      writeFileSync(join(process.cwd(), "headless-held.txt"), "");
      const released = setInterval(() => {
        if (!existsSync(join(process.cwd(), "headless-released.txt")))
          return;
        clearInterval(released);
        this.respond(id, this.listing());
      }, 10);
      return;
    }
    if (this.mode === "garbled") {
      process.stdout.write("Content-Type: application/json\r\n\r\n{}");
      return;
    }
    if (this.mode === "badJson") {
      process.stdout.write("Content-Length: 6\r\n\r\n{nope}");
      return;
    }
    if (this.mode === "outOfShape")
      this.respond(id, { list: [{ id: 5 }, { id: "x", name: 5 }] });
    else
      this.respond(id, this.listing());
  }

  private listing(): JsonValue {
    return { list: EMPTY_MODES.includes(this.mode) ? [] : FakeCopilotHeadless.models(), providers: [{ id: "copilot", label: "GitHub Copilot" }], modelPriceCategories: [] };
  }

  private respond(id: number, result: JsonValue): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  private fail(id: number, code: number, message: string): void {
    this.write({ jsonrpc: "2.0", id, error: { code, message } });
  }

  private write(value: JsonObject): void {
    const body = Buffer.from(JSON.stringify(value), "utf8");
    const frame = Buffer.concat([Buffer.from(`Content-Type: application/vscode-jsonrpc; charset=utf-8\r\nContent-Length: ${body.length}\r\n\r\n`), body]);
    if (this.mode !== "split") {
      process.stdout.write(frame);
      return;
    }
    for (let start = 0; start < frame.length; start += 5)
      process.stdout.write(frame.subarray(start, start + 5));
  }
}
