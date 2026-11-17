/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

const update = (value: JsonObject): JsonObject => ({ method: "session/update", params: { update: value } });

const spawn = (toolCallId: string, agentType: string, description: string): JsonObject => update({ sessionUpdate: "tool_call", toolCallId, title: description,
  kind: "other", status: "pending", rawInput: { name: "read-notes", agent_type: agentType, description, mode: "sync",
    prompt: "Read notes.txt in the current folder and reply with only its first line." } });

const meta = (agentId: string): JsonObject => ({ _meta: { "github.com/copilot": { agentId } } });

const text = (sessionUpdate: string, value: string): JsonObject => update({ sessionUpdate, content: { type: "text", text: value } });

export const CopilotSubAgentRecording: { readonly source: string; readonly completed: readonly JsonObject[]; readonly failed: readonly JsonObject[] } = {
  "source": "GitHub Copilot CLI 1.0.102 over ACP, one turn that ran an explore sub-agent and one whose sub-agent type didn't exist, in the shape of a live capture, with sample values only",
  "completed": [
    spawn("toolu-spawn", "explore", "Read first line of notes"),
    update({ sessionUpdate: "usage_update", used: 18_000, size: 200_000 }),
    update({ sessionUpdate: "tool_call", toolCallId: "call-view", title: "Viewing notes.txt", kind: "read", status: "pending",
      rawInput: { path: "/work/notes.txt", view_range: [1, 1] }, locations: [{ path: "/work/notes.txt" }], ...meta("agent-1") }),
    update({ sessionUpdate: "tool_call_update", toolCallId: "call-view", status: "completed",
      rawOutput: { content: "The capture's first line.", detailedContent: "The capture's first line." }, ...meta("agent-1") }),
    text("agent_thought_chunk", "The file's first line is short."),
    text("agent_message_chunk", "The"),
    text("agent_message_chunk", " capture's first line."),
    update({ sessionUpdate: "tool_call_update", toolCallId: "toolu-spawn", status: "completed",
      content: [{ type: "content", content: { type: "text", text: "The capture's first line." } }],
      rawOutput: { content: "The capture's first line.", detailedContent: "The capture's first line." } }),
    text("agent_message_chunk", "The sub-agent replied"),
    text("agent_message_chunk", " \"The capture's first line.\"")
  ],
  "failed": [
    spawn("toolu-unknown", "no-such-agent", "Read notes.txt"),
    update({ sessionUpdate: "tool_call_update", toolCallId: "toolu-unknown", status: "failed",
      rawOutput: { message: "Unknown agent_type: no-such-agent. Valid types are: explore, task, general-purpose", code: "failure" } }),
    text("agent_message_chunk", "That sub-agent type doesn't exist.")
  ]
};
