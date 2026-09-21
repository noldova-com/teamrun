/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createInterface } from "node:readline";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/teamrun-foundation-json";

export class FakeGrokAgent {
  private sessionId: string = "grok-session";
  private held: number | null = null;
  private approvalPrompt: number | null = null;

  public run(): void {
    const input = createInterface({ input: process.stdin });
    input.on("line", line => this.receive(JsonReader.parse(line)));
    input.on("close", () => {
      if (process.env["TEAMRUN_FAKE_GROK_STAY_OPEN"] === "1") setInterval(() => undefined, 1000);
      else process.exit(0);
    });
  }

  private receive(message: JsonReader): void {
    const value = message.toJson();
    if (!message.hasField("method")) {
      if (value["id"] === "permission" && this.approvalPrompt !== null) {
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: JSON.stringify(value["result"] ?? value["error"]) } });
        this.respond(this.approvalPrompt, { stopReason: "end_turn" });
        this.approvalPrompt = null;
      }
      return;
    }
    const method = message.readString("method");
    if (method === "session/cancel") {
      if (this.held !== null && process.env["TEAMRUN_FAKE_GROK_IGNORE_CANCEL"] !== "1") {
        this.respond(this.held, { stopReason: "cancelled" });
        this.held = null;
      }
      return;
    }
    const id = message.readInteger("id");
    const params = message.readObject("params");
    if (method === "fixture/null") { this.respond(id, null); return; }
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
    if (method === "fixture/reverse") {
      this.approvalPrompt = id;
      this.write({ jsonrpc: "2.0", id: "permission", method: "reverse" });
      return;
    }
    if (method === "fixture/wait") return;
    if (method === "initialize") {
      const mode = process.env["TEAMRUN_FAKE_GROK_INIT"];
      if (mode === "hang") return;
      if (mode === "invalid") { process.stdout.write("invalid json\n"); return; }
      if (mode === "oversize") { process.stdout.write("x".repeat(16 * 1024 * 1024 + 1)); return; }
      this.respond(id, {
        agentCapabilities: { loadSession: true, promptCapabilities: { image: mode === "images" } },
        authMethods: [{ id: mode === "loggedOut" ? "grok.com" : "cached_token", name: "Grok" }],
        _meta: { agentVersion: "1.0.30-fixture", modelState: { currentModelId: "grok-test", availableModels: [
          { modelId: "grok-test", name: "Test model", description: "Fixture", _meta: { reasoningEfforts: [{ value: "high" }, { value: "low" }] } },
          { modelId: "grok-other", name: "Other model" }
        ] } }
      });
    }
    else if (method === "authenticate") {
      if (process.env["TEAMRUN_FAKE_GROK_SIGNIN_FAIL"] === "1") this.fail(id, "Authentication refused");
      else this.respond(id, {});
    }
    else if (method === "session/new" || method === "session/load") {
      if (method === "session/load") {
        this.sessionId = params.readString("sessionId");
        if (this.sessionId === "missing") { this.fail(id, "Session not found"); return; }
        this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "replayed history" } });
      }
      this.respond(id, process.env["TEAMRUN_FAKE_GROK_NO_METADATA"] === "1" ? { sessionId: this.sessionId }
        : { sessionId: this.sessionId, models: { currentModelId: "grok-test" }, _meta: { reasoningEffort: "low" } });
    }
    else if (method === "session/set_model") this.respond(id, {});
    else if (method === "session/prompt") {
      const parts = params.readObjectArray("prompt");
      const prompt = parts[0]!.readString("text").split("\n\nTask:\n\n").at(-1)!;
      if (prompt === "exit") process.exit(9);
      if (prompt === "reject") { this.fail(id, "Prompt refused"); return; }
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
      this.update({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "Reasoning" } });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Hello " } });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "world" } });
      this.update({ sessionUpdate: "tool_call", toolCallId: "t1", kind: "execute", title: "Run command", status: "in_progress" });
      this.update({ sessionUpdate: "tool_call_update", toolCallId: "t1", status: "completed", content: [{ type: "content", content: { type: "text", text: "Output" } }] });
      this.update({ sessionUpdate: "tool_call", toolCallId: "t2", kind: "edit", title: "Edit fixture", locations: [{ path: "fixture.txt" }], status: "completed" });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text",
        text: prompt === "images" || prompt === "role-payload" ? JSON.stringify(parts.map(t => t.toJson())) : "Done" } });
      this.respond(id, { stopReason: prompt === "limit" ? "max_tokens" : "end_turn" });
      this.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "late after response" } });
    }
    else this.fail(id, "Unknown method");
  }

  private update(update: JsonObject): void {
    this.write({ jsonrpc: "2.0", method: "session/update", params: { sessionId: this.sessionId, update } });
  }

  private respond(id: number, result: JsonValue): void {
    this.write({ jsonrpc: "2.0", id, result });
  }

  private fail(id: number, message: string): void {
    this.write({ jsonrpc: "2.0", id, error: { code: -32000, message } });
  }

  private write(value: JsonObject): void {
    process.stdout.write(`${JSON.stringify(value)}\n`);
  }
}

new FakeGrokAgent().run();
