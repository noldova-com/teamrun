/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createInterface } from "node:readline";
import { JsonReader } from "@noldova/context.json";

const SESSION: string = "fork-session";
const FORK: string = [
  "const child = require(\"node:child_process\").spawn(process.execPath, [\"-e\", \"setInterval(() => undefined, 1000)\"], { stdio: \"inherit\" });",
  "require(\"node:fs\").writeFileSync(process.env.FORK_PIDS, child.pid + \" \" + process.pid);",
  "process.stdout.write(\"ready\\n\", () => process.exit(0));"
].join(" ");
const pending = new Map<number, (message: JsonReader) => void>();
const pidFile = process.argv[2] ?? "";
let next = 1;
let offersTerminals = false;

const write = (message: object): void => {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
};

const call = (method: string, params: object): Promise<JsonReader> => new Promise(resolve => {
  const id = next++;
  pending.set(id, resolve);
  write({ id, method, params });
});

const listTools = async (server: JsonReader): Promise<void> => {
  const headers = Object.fromEntries(server.readObjectArray("headers").map(t => [t.readString("name"), t.readString("value")]));
  const post = async (message: object): Promise<void> => {
    const response = await fetch(server.readString("url"), { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", ...message }),
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } });
    await response.text();
  };
  await post({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fork-double", version: "1.0.0" } } });
  await post({ method: "notifications/initialized" });
  await post({ id: 2, method: "tools/list", params: {} });
};

const startSession = async (id: number, params: JsonReader): Promise<void> => {
  const servers = params.hasField("mcpServers") ? params.readObjectArray("mcpServers") : [];
  await Promise.allSettled(servers.filter(t => t.readOptionalString("type") === "http").map(listTools));
  write({ id, result: { sessionId: SESSION } });
};

const update = (update: object): void => write({ method: "session/update", params: { sessionId: SESSION, update } });

const prompt = async (id: number): Promise<void> => {
  if (!offersTerminals) {
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "no terminals" } });
    write({ id, result: { stopReason: "end_turn" } });
    return;
  }
  const created = await call("terminal/create", { sessionId: SESSION, command: process.execPath, args: ["-e", FORK], env: [{ name: "FORK_PIDS", value: pidFile }] });
  const terminalId = created.readObject("result").readString("terminalId");
  const content = [{ type: "terminal", terminalId }];
  update({ sessionUpdate: "tool_call", toolCallId: "fork", kind: "execute", title: "Start the server", status: "in_progress", content });
  update({ sessionUpdate: "tool_call_update", toolCallId: "fork", status: "completed", content });
  update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "The server is running." } });
  write({ id, result: { stopReason: "end_turn" } });
};

createInterface({ input: process.stdin }).on("line", line => {
  const message = JsonReader.parse(line);
  if (!message.hasField("method")) {
    const id = message.readInteger("id");
    pending.get(id)?.(message);
    pending.delete(id);
    return;
  }
  if (!message.hasField("id"))
    return;
  const id = message.readInteger("id");
  const method = message.readString("method");
  if (method === "initialize") {
    offersTerminals = JSON.stringify(message.readObject("params").toJson()["clientCapabilities"] ?? null).includes("\"terminal\":true");
    write({ id, result: { protocolVersion: 1, agentCapabilities: { loadSession: false, promptCapabilities: {}, mcpCapabilities: { http: true, sse: false } },
      authMethods: [], agentInfo: { name: "Fork double", version: "1.0.0" } } });
  }
  else if (method === "session/new")
    void startSession(id, message.readObject("params"));
  else if (method === "session/prompt")
    void prompt(id);
  else
    write({ id, error: { code: -32601, message: "Method not found" } });
});
