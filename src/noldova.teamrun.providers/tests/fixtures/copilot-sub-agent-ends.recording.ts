/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

const update = (value: JsonObject): JsonObject => ({ method: "session/update", params: { update: value } });

const meta = (agentId: string): JsonObject => ({ _meta: { "github.com/copilot": { agentId } } });

const event = (type: string, agentId: string, data: JsonObject): JsonObject => ({ method: "github.com/copilot/sessionEvent",
  params: { type, timestamp: "2026-11-03T17:20:51.751Z", data, agentId } });

const spawn = (toolCallId: string, agentType: string, name: string, description: string, prompt: string): JsonObject => update({ sessionUpdate: "tool_call", toolCallId,
  title: description, kind: "other", status: "pending", rawInput: { agent_type: agentType, name, description, mode: "sync", prompt } });

export const CopilotSubAgentEndsRecording: { readonly source: string; readonly completed: readonly JsonObject[]; readonly cancelled: readonly JsonObject[] } = {
  "source": "GitHub Copilot CLI 1.0.105 over ACP, asked in initialize's clientCapabilities._meta for its subagent.started and subagent.completed session events, recorded 2026-11-03: one turn whose explore sub-agent read a file, and one cancelled while its general-purpose sub-agent ran a command, with sample ids and paths",
  "completed": [
    spawn("toolu-read", "explore", "read-notes", "Read notes.txt marker", "Read the file notes.txt in the current working directory and report its marker."),
    event("subagent.started", "agent-read", { toolCallId: "toolu-read", agentName: "explore", agentDisplayName: "read-notes", agentDescription: "Read notes.txt marker",
      model: "gpt-5.6-luna", taskModelSource: "unset", modelSelectionSource: "agent_definition_default", resumable: false, agentType: "explore", executionMode: "sync" }),
    update({ sessionUpdate: "tool_call", toolCallId: "call-view", title: "Viewing /work/notes.txt", kind: "read", status: "pending",
      rawInput: { path: "/work/notes.txt" }, locations: [{ path: "/work/notes.txt" }], ...meta("agent-read") }),
    update({ sessionUpdate: "tool_call_update", toolCallId: "call-view", status: "completed",
      rawOutput: { content: "The capture's marker is blue-heron-42.\n", detailedContent: "The capture's marker is blue-heron-42.\n" }, ...meta("agent-read") }),
    event("subagent.completed", "agent-read", { toolCallId: "toolu-read", agentName: "explore", agentDisplayName: "read-notes", model: "gpt-5.6-luna",
      firstDispatchedModel: "gpt-5.6-luna", modelSelectionSource: "agent_definition_default", totalToolCalls: 1, totalTokens: 8094, durationMs: 30_756 }),
    update({ sessionUpdate: "tool_call_update", toolCallId: "toolu-read", status: "completed",
      content: [{ type: "content", content: { type: "text", text: "blue-heron-42" } }], rawOutput: { content: "blue-heron-42", detailedContent: "blue-heron-42" } })
  ],
  "cancelled": [
    spawn("toolu-sleep", "general-purpose", "sleep-runner", "Run sleep 120", "Run the shell command `sleep 120` and then report done."),
    event("subagent.started", "agent-sleep", { toolCallId: "toolu-sleep", agentName: "general-purpose", agentDisplayName: "sleep-runner", agentDescription: "Run sleep 120",
      model: "claude-sonnet-5.5", taskModelSource: "unset", modelSelectionSource: "session_inheritance", resumable: false, agentType: "general-purpose", executionMode: "sync" }),
    update({ sessionUpdate: "tool_call", toolCallId: "call-sleep", title: "Sleep for 120 seconds", kind: "execute", status: "pending",
      rawInput: { command: "sleep 120", description: "Sleep for 120 seconds", initial_wait: 150, mode: "sync" }, ...meta("agent-sleep") }),
    event("subagent.completed", "agent-sleep", { toolCallId: "toolu-sleep", agentName: "general-purpose", agentDisplayName: "sleep-runner", cancelled: true,
      model: "claude-sonnet-5.5", firstDispatchedModel: "claude-sonnet-5.5", modelSelectionSource: "session_inheritance", totalToolCalls: 0, totalTokens: 21_796,
      durationMs: 15_007 })
  ]
};
