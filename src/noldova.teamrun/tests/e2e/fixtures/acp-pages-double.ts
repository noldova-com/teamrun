/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createInterface } from "node:readline";
import { JsonReader } from "@noldova/context.json";

const SESSION: string = "pages-session";
const EDIT_PREFIX: string = "edit page: ";
let server: JsonReader | null = null;
let nextCall = 1;

const write = (message: object): void => {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
};

const update = (value: object): void => write({ method: "session/update", params: { sessionId: SESSION, update: value } });

const answer = (id: number, text: string): void => {
  update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text } });
  write({ id, result: { stopReason: "end_turn" } });
};

const postAsync = async (message: object): Promise<JsonReader | null> => {
  if (server === null)
    throw new Error("The session has no TeamRun server.");
  const headers = Object.fromEntries(server.readObjectArray("headers").map(t => [t.readString("name"), t.readString("value")]));
  const response = await fetch(server.readString("url"), { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", ...message }),
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } });
  const text = await response.text();
  const data = text.split("\n").filter(t => t.startsWith("data:")).at(-1)?.slice("data:".length) ?? text;
  return data.trim().length === 0 ? null : JsonReader.parse(data);
};

const callAsync = async (tool: string, args: object): Promise<JsonReader> => {
  const toolCallId = `pages-${nextCall}`;
  update({ sessionUpdate: "tool_call", toolCallId, title: `teamrun-${tool}`, kind: "execute", status: "pending", rawInput: args });
  const answered = await postAsync({ id: ++nextCall, method: "tools/call", params: { name: tool, arguments: args } });
  const result = answered?.hasField("result") === true ? answered.readObject("result") : null;
  const text = result === null ? "" : result.readObjectArray("content").map(t => t.hasField("text") ? t.readString("text") : "").join("\n");
  const failed = result === null || result.hasField("isError") && result.readValue("isError") === true;
  update({ sessionUpdate: "tool_call_update", toolCallId, status: failed ? "failed" : "completed", content: [{ type: "content", content: { type: "text", text } }] });
  if (failed)
    throw new Error(`${tool} failed: ${text}`);
  return JsonReader.parse(text);
};

const editAsync = async (id: number, edit: string): Promise<void> => {
  const [find = "", replace = ""] = edit.split(" => ");
  await postAsync({ id: ++nextCall, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "acp-pages-double", version: "1.0.0" } } });
  await postAsync({ method: "notifications/initialized" });
  const listed = await callAsync("teamrun_list_pages", {});
  const pageId = listed.readObjectArray("pages")[0]?.readString("id") ?? "";
  const read = await callAsync("teamrun_read_page", { page_id: pageId });
  const edited = await callAsync("teamrun_edit_page", { page_id: pageId, base_version: read.readInteger("version"), edits: [{ find, replace }] });
  answer(id, `${EDIT_PREFIX}v${edited.readInteger("version")} made by ${edited.readObject("madeBy").readString("name")}, edited by ${edited.readObject("editedBy").readString("name")}`);
};

const prompt = async (id: number, params: JsonReader): Promise<void> => {
  const text = params.readObjectArray("prompt").map(t => t.hasField("text") ? t.readString("text") : "").join("\n");
  const at = text.lastIndexOf(EDIT_PREFIX);
  if (at < 0) {
    answer(id, "no pages");
    return;
  }
  try {
    await editAsync(id, text.slice(at + EDIT_PREFIX.length).split("\n")[0] ?? "");
  }
  catch (error) {
    answer(id, `${EDIT_PREFIX}${error instanceof Error ? error.message : String(error)}`);
  }
};

createInterface({ input: process.stdin }).on("line", line => {
  const message = JsonReader.parse(line);
  if (!message.hasField("method") || !message.hasField("id"))
    return;
  const id = message.readInteger("id");
  const method = message.readString("method");
  if (method === "initialize")
    write({ id, result: { protocolVersion: 1, agentCapabilities: { loadSession: false, promptCapabilities: {}, mcpCapabilities: { http: true, sse: false } },
      authMethods: [], agentInfo: { name: "Pages double", version: "1.0.0" } } });
  else if (method === "session/new") {
    const params = message.readObject("params");
    server = (params.hasField("mcpServers") ? params.readObjectArray("mcpServers") : []).find(t => t.readOptionalString("type") === "http") ?? null;
    write({ id, result: { sessionId: SESSION } });
  }
  else if (method === "session/prompt")
    void prompt(id, message.readObject("params"));
  else
    write({ id, error: { code: -32601, message: "Method not found" } });
});
