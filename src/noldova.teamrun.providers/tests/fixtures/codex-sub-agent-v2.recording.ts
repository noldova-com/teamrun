/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

const activity = (method: string, threadId: string, id: string, kind: string, agentPath: string, model: string | null): JsonObject => ({
  method,
  params: { threadId, turnId: `${threadId}-turn`, item: { type: "subAgentActivity", model, reasoningEffort: model === null ? null : "high", id, kind,
    agentThreadId: "child", agentPath } }
});

const wait = (method: string, id: string, status: string): JsonObject => ({
  method,
  params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall", id, tool: "wait", status, senderThreadId: "parent",
    receiverThreadIds: [], prompt: null, model: null, reasoningEffort: null, agentsStates: {} } }
});

const turn = (method: string, id: string, status: string, durationMs: number | null): JsonObject => ({
  method,
  params: { threadId: "child", turn: { id, items: [], itemsView: "notLoaded", status, error: null, startedAt: 1_793_000_001, completedAt: null, durationMs } }
});

const item = (method: string, turnId: string, value: JsonObject): JsonObject => ({ method, params: { threadId: "child", turnId, item: value } });

const command = (id: string, status: string): JsonObject => ({ type: "commandExecution", id, command: "cat notes.txt", cwd: "/work", processId: null,
  source: "agent", status, commandActions: [], aggregatedOutput: status === "inProgress" ? null : "hello\n", exitCode: status === "inProgress" ? null : 0,
  durationMs: status === "inProgress" ? null : 40 });

const started = [
  activity("item/started", "parent", "call-spawn", "started", "/root/read_notes", "gpt-5.4-mini"),
  activity("item/completed", "parent", "call-spawn", "started", "/root/read_notes", "gpt-5.4-mini"),
  turn("turn/started", "child-turn", "inProgress", null),
  wait("item/started", "call-wait", "inProgress")
];

export const CodexSubAgentV2Recording: { readonly source: string; readonly completed: readonly JsonObject[]; readonly stopped: readonly JsonObject[] } = {
  "source": "Codex app-server protocol with multi_agent_v2 on, in the shape of a live capture of Codex 0.163.0 (ThreadItem::SubAgentActivity), with sample values only",
  "completed": [
    ...started,
    item("item/started", "child-turn", command("call-cat", "inProgress")),
    item("item/completed", "child-turn", command("call-cat", "completed")),
    { method: "thread/tokenUsage/updated", params: { threadId: "child", turnId: "child-turn", tokenUsage: {
      total: { totalTokens: 1840, inputTokens: 1700, cachedInputTokens: 0, outputTokens: 140, reasoningOutputTokens: 20 },
      last: { totalTokens: 1840, inputTokens: 1700, cachedInputTokens: 0, outputTokens: 140, reasoningOutputTokens: 20 }, modelContextWindow: 272_000 } } },
    item("item/completed", "child-turn", { type: "agentMessage", id: "msg-1", text: "notes.txt starts with: hello", phase: "final_answer", memoryCitation: null }),
    activity("item/started", "parent", "subagent-completed-child-turn", "completed", "/root/read_notes", null),
    turn("turn/completed", "child-turn", "completed", 4200),
    activity("item/completed", "parent", "subagent-completed-child-turn", "completed", "/root/read_notes", null),
    wait("item/completed", "call-wait", "completed")
  ],
  "stopped": [
    ...started,
    turn("turn/completed", "child-turn", "interrupted", 5100),
    wait("item/completed", "call-wait", "completed"),
    activity("item/started", "parent", "call-more", "interacted", "/root/read_notes", null),
    activity("item/completed", "parent", "call-more", "interacted", "/root/read_notes", null),
    turn("turn/started", "child-turn-2", "inProgress", null),
    activity("item/started", "child", "call-report", "interacted", "/root", null),
    activity("item/completed", "child", "call-report", "interacted", "/root", null),
    item("item/started", "child-turn-2", command("call-cat-2", "inProgress")),
    item("item/completed", "child-turn-2", command("call-cat-2", "completed")),
    item("item/completed", "child-turn-2", { type: "agentMessage", id: "msg-2", text: "notes.txt starts with: hello", phase: "final_answer", memoryCitation: null }),
    activity("item/started", "parent", "subagent-completed-child-turn-2", "completed", "/root/read_notes", null),
    turn("turn/completed", "child-turn-2", "completed", 9800)
  ]
};
