/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

const thread = (id: string, agentRole: string | null, agentNickname: string | null, model: string | null): JsonObject => ({
  method: "thread/started",
  params: { thread: { id, sessionId: "session-1", forkedFromId: null, parentThreadId: "parent", preview: "", ephemeral: false, modelProvider: "openai", model,
    reasoningEffort: "medium", createdAt: 1_793_000_000, updatedAt: 1_793_000_000, status: { type: "active", activeFlags: [] }, cwd: "/work", cliVersion: "0.164.0",
    source: { subAgent: { thread_spawn: { parent_thread_id: "parent", depth: 1, agent_path: null, agent_nickname: agentNickname, agent_role: agentRole } } },
    agentNickname, agentRole, name: null, turns: [] } }
});

const spawn = (method: string, id: string, status: string, receiverThreadIds: readonly string[], agentsStates: JsonObject): JsonObject => ({
  method,
  params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall", id, tool: "spawnAgent", status, senderThreadId: "parent",
    receiverThreadIds: [...receiverThreadIds], prompt: "Read notes.txt and reply with its first line.", model: "gpt-5.4-mini", reasoningEffort: "low", agentsStates } }
});

const wait = (id: string, agentsStates: JsonObject): JsonObject => ({
  method: "item/completed",
  params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall", id, tool: "wait", status: "completed", senderThreadId: "parent",
    receiverThreadIds: Object.keys(agentsStates), prompt: null, model: null, reasoningEffort: null, agentsStates } }
});

const turn = (method: string, threadId: string, id: string, status: string, durationMs: number | null, error: JsonObject | null = null): JsonObject => ({
  method,
  params: { threadId, turn: { id, items: [], itemsView: "notLoaded", status, error, startedAt: 1_793_000_001, completedAt: null, durationMs } }
});

const item = (method: string, threadId: string, turnId: string, value: JsonObject): JsonObject => ({ method, params: { threadId, turnId, item: value } });

const command = (status: string): JsonObject => ({ type: "commandExecution", id: "call-cat", command: "cat notes.txt", cwd: "/work", processId: null,
  source: "agent", status, commandActions: [], aggregatedOutput: status === "inProgress" ? null : "hello\n", exitCode: status === "inProgress" ? null : 0,
  durationMs: status === "inProgress" ? null : 40 });

export const CodexSubAgentRecording: { readonly source: string; readonly completed: readonly JsonObject[]; readonly errored: readonly JsonObject[];
  readonly failedTurn: readonly JsonObject[]; readonly failedSpawn: readonly JsonObject[]; readonly interrupted: readonly JsonObject[] } = {
  "source": "Codex app-server protocol v2 at rust-v0.164.0 (ThreadItem::CollabAgentToolCall, Thread, Turn, thread/tokenUsage/updated), built from its source and not yet a live capture",
  "completed": [
    spawn("item/started", "call-spawn", "inProgress", [], {}),
    thread("child", "explorer", "Ada", "gpt-5.4-mini"),
    spawn("item/completed", "call-spawn", "completed", ["child"], { child: { status: "pendingInit", message: null } }),
    turn("turn/started", "child", "child-turn", "inProgress", null),
    item("item/started", "child", "child-turn", command("inProgress")),
    item("item/completed", "child", "child-turn", command("completed")),
    { method: "thread/tokenUsage/updated", params: { threadId: "child", turnId: "child-turn", tokenUsage: {
      total: { totalTokens: 1840, inputTokens: 1700, cachedInputTokens: 0, outputTokens: 140, reasoningOutputTokens: 20 },
      last: { totalTokens: 1840, inputTokens: 1700, cachedInputTokens: 0, outputTokens: 140, reasoningOutputTokens: 20 }, modelContextWindow: 272_000 } } },
    item("item/completed", "child", "child-turn", { type: "agentMessage", id: "msg-1", text: "notes.txt starts with: hello", phase: "final_answer", memoryCitation: null }),
    turn("turn/completed", "child", "child-turn", "completed", 4200),
    wait("call-wait", { child: { status: "completed", message: "notes.txt starts with: hello" } })
  ],
  "errored": [
    spawn("item/started", "call-spawn", "inProgress", [], {}),
    spawn("item/completed", "call-spawn", "completed", ["child"], { child: { status: "pendingInit", message: null } }),
    thread("child", null, "Ada", null),
    wait("call-wait", { child: { status: "errored", message: "The model gpt-5.4-mini is unavailable." } })
  ],
  "failedTurn": [
    spawn("item/started", "call-spawn", "inProgress", [], {}),
    thread("child", "worker", null, "gpt-5.4-mini"),
    turn("turn/started", "child", "child-turn", "inProgress", null),
    turn("turn/completed", "child", "child-turn", "failed", 900, { message: "stream disconnected before completion", codexErrorInfo: null }),
    spawn("item/completed", "call-spawn", "completed", ["child"], { child: { status: "errored", message: "stream disconnected before completion" } })
  ],
  "failedSpawn": [
    spawn("item/started", "call-spawn", "inProgress", [], {}),
    spawn("item/completed", "call-spawn", "failed", [], {})
  ],
  "interrupted": [
    spawn("item/started", "call-spawn", "inProgress", [], {}),
    thread("child", "explorer", "Ada", "gpt-5.4-mini"),
    spawn("item/completed", "call-spawn", "completed", ["child"], { child: { status: "running", message: null } }),
    turn("turn/started", "child", "child-turn", "inProgress", null),
    item("item/started", "child", "child-turn", command("inProgress")),
    turn("turn/completed", "child", "child-turn", "interrupted", 1500)
  ]
};
