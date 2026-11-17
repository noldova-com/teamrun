/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

const update = (value: JsonObject): JsonObject => ({ method: "session/update", params: { update: value } });

const spawn = (toolCallId: string, description: string): JsonObject => update({ sessionUpdate: "tool_call", toolCallId, title: description, kind: "other",
  status: "pending", rawInput: { name: toolCallId, agent_type: "explore", description, mode: "sync",
    prompt: `${description} in the current folder and reply with only its first line.` } });

const started = (toolCallId: string, agentId: string, description: string): JsonObject => ({ method: "github.com/copilot/sessionEvent",
  params: { type: "subagent.started", timestamp: "2026-10-26T12:00:00.000Z", agentId, data: { toolCallId, agentName: "explore", agentDisplayName: "Explore Agent",
    agentDescription: description } } });

const call = (toolCallId: string, agentId: string, path: string): JsonObject => update({ sessionUpdate: "tool_call", toolCallId, title: `Viewing ${path}`,
  kind: "read", status: "pending", rawInput: { path: `/work/${path}` }, locations: [{ path: `/work/${path}` }], _meta: { "github.com/copilot": { agentId } } });

const done = (toolCallId: string, agentId: string, text: string): JsonObject => update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed",
  rawOutput: { content: text, detailedContent: text }, _meta: { "github.com/copilot": { agentId } } });

const finished = (toolCallId: string, text: string): JsonObject => update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed",
  content: [{ type: "content", content: { type: "text", text } }], rawOutput: { content: text, detailedContent: text } });

export const CopilotSubAgentsTogetherRecording: { readonly source: string; readonly turn: readonly JsonObject[] } = {
  "source": "GitHub Copilot CLI over ACP, asked in initialize's clientCapabilities._meta for its subagent.started session events: one turn that started two explore "
    + "sub-agents together, in the shape of Copilot SDK's session-events schema and the ACP updates of a live capture, with sample values only; not a live capture",
  "turn": [
    spawn("toolu-notes", "Read notes"),
    spawn("toolu-todo", "Read todo"),
    started("toolu-todo", "agent-todo", "Read todo"),
    started("toolu-notes", "agent-notes", "Read notes"),
    call("call-todo", "agent-todo", "todo.txt"),
    call("call-notes", "agent-notes", "notes.txt"),
    done("call-notes", "agent-notes", "The notes' first line."),
    done("call-todo", "agent-todo", "The todo's first line."),
    finished("toolu-todo", "The todo's first line."),
    finished("toolu-notes", "The notes' first line."),
    update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Both sub-agents replied." } })
  ]
};
