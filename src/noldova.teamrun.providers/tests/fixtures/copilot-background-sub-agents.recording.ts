/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

const update = (value: JsonObject): JsonObject => ({ method: "session/update", params: { update: value } });

const text = (value: string): JsonObject => update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: value } });

const spawn = (toolCallId: string, name: string, description: string, file: string): JsonObject => update({ sessionUpdate: "tool_call", toolCallId, title: description,
  kind: "other", status: "pending", rawInput: { name, prompt: `Read the file ${file} in the current working directory and reply with only its first line.`,
    agent_type: "explore", description, mode: "background" } });

const started = (toolCallId: string, agentId: string, name: string, description: string): JsonObject => ({ method: "github.com/copilot/sessionEvent",
  params: { type: "subagent.started", timestamp: "2026-10-26T12:00:00.000Z", data: { toolCallId, agentName: "explore", agentDisplayName: name,
    agentDescription: description, model: "sample-model", taskModelSource: "unset", modelSelectionSource: "agent_definition_default", resumable: false,
    agentType: "explore", executionMode: "background" }, agentId } });

const backgrounded = (toolCallId: string, agentId: string): JsonObject => {
  const output = `Agent started in background with agent_id: ${agentId}. You'll be notified when it completes.`;
  return update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed", content: [{ type: "content", content: { type: "text", text: output } }],
    rawOutput: { content: output, detailedContent: output } });
};

const view = (toolCallId: string, agentId: string, file: string): JsonObject => update({ sessionUpdate: "tool_call", toolCallId, title: `Viewing ${file}`, kind: "read",
  status: "pending", rawInput: { path: `/work/${file}`, view_range: [1, 1] }, locations: [{ path: `/work/${file}` }], _meta: { "github.com/copilot": { agentId } } });

const viewed = (toolCallId: string, agentId: string, line: string): JsonObject => update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed",
  rawOutput: { content: line, detailedContent: line }, _meta: { "github.com/copilot": { agentId } } });

const read = (toolCallId: string, agentId: string): JsonObject => update({ sessionUpdate: "tool_call", toolCallId, title: "read_agent", kind: "read", status: "pending",
  rawInput: { agent_id: agentId, since_turn: 0 } });

const replied = (toolCallId: string, agentId: string, description: string, reply: string): JsonObject => {
  const output = `Agent is idle (waiting for messages). agent_id: ${agentId}, agent_type: explore, status: idle, description: ${description}, elapsed: 2s, `
    + `total_turns: 1\n\n[Turn 0]\n${reply}`;
  return update({ sessionUpdate: "tool_call_update", toolCallId, status: "completed", content: [{ type: "content", content: { type: "text", text: output } }],
    rawOutput: { content: output, detailedContent: `<agent ${agentId} idle>` } });
};

export const CopilotBackgroundSubAgentsRecording: { readonly source: string; readonly turn: readonly JsonObject[] } = {
  "source": "GitHub Copilot CLI 1.0.102 over ACP, asked in initialize's clientCapabilities._meta for its subagent.started session events: one turn that started two "
    + "explore sub-agents in the background, which replied on the parent's session before the parent read them with read_agent, in the order, shapes and text "
    + "chunks of a live capture, with sample ids, a sample model and folder, and the spawn's long notice cut to its first two sentences",
  "turn": [
    spawn("toolu-notes", "read-notes", "Read first line of notes", "notes.txt"),
    spawn("toolu-todo", "read-todo", "Read first line of todo", "todo.txt"),
    started("toolu-todo", "agent-todo", "read-todo", "Read first line of todo"),
    started("toolu-notes", "agent-notes", "read-notes", "Read first line of notes"),
    backgrounded("toolu-notes", "agent-notes"),
    backgrounded("toolu-todo", "agent-todo"),
    ...["Both sub-agents are", " running. I'm waiting", " for them", " to finish."].map(text),
    view("call-notes", "agent-notes", "notes.txt"),
    viewed("call-notes", "agent-notes", "The notes' first line."),
    view("call-todo", "agent-todo", "todo.txt"),
    viewed("call-todo", "agent-todo", "The todo's first line."),
    ...["The", " todo", "'s", " first", " line", "."].map(text),
    ...["The", " notes", "'", " first", " line", "."].map(text),
    read("read-todo", "agent-todo"),
    replied("read-todo", "agent-todo", "Read first line of todo", "The todo's first line."),
    read("read-notes", "agent-notes"),
    replied("read-notes", "agent-notes", "Read first line of notes", "The notes' first line."),
    ...["- The not", "es ag", "ent answered: \"", "The notes' first line.\"", "\n- The todo agent answered", ": \"The todo's first line", ".\"\n\nNe",
      "ither retur", "ned file", " contents.", " Each reply re", "ads like", " a plac", "eholder,", " so the", " agents may not have read the files",
      ". I haven't checked."].map(text)
  ]
};
