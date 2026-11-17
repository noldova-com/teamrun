/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type TurnDetail, TurnOutcome, TurnResult, WakeTurn } from "@noldova/teamrun.core";
import { DetailKind, ObservedSettings, SubAgent } from "@noldova/teamrun.protocol";
import { AcpChannel, AcpCommands, AcpTurn } from "@noldova/teamrun.providers";

import { HeldDelayTimer } from "../../fixtures/held-delay-timer.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class AcpChannelTests {
  @TestMethod
  public async routesTheTurnTheAgentStartsByItsPromptIdAndWhatHasNoneToTheTurnStillRunning(): Promise<void> {
    const person = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    reply.decisions.push("yes");
    person.wakeTurn = new WakeTurn({});
    const woken = person.wakeTurn.follow(reply, new AbortController().signal);
    const turn = new AcpTurn("agent", "Agent", "Agent tool", person, new AbortController().signal, 1);
    const cancelled: string[] = [];
    const channel = AcpChannelTests.channel(turn, person, cancelled);
    const observed = new ObservedSettings("agent", null, null, null);
    await turn.beginAsync("s", false, observed);
    channel.follow("s", observed);
    const idle = channel.whenIdle();

    await channel.onNotificationAsync("_x.ai/task_backgrounded", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "task_backgrounded", task_id: "t", command: "npm test" } }));
    await channel.onNotificationAsync("_x.ai/task_completed", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "task_completed", task_snapshot: { task_id: "t", exit_code: 0 },
      will_wake: true } }));
    await AcpChannelTests.chunkAsync(channel, "woken", { _meta: { promptId: "task-completed-t" } });
    await AcpChannelTests.chunkAsync(channel, "person", { _meta: { promptId: "p" } });
    await AcpChannelTests.chunkAsync(channel, "unmarked");
    await turn.finishAsync();
    await AcpChannelTests.chunkAsync(channel, "late", { _meta: { promptId: "p" } });
    await AcpChannelTests.chunkAsync(channel, "after");
    await channel.onNotificationAsync("_x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "retry_state" } }));
    await channel.onNotificationAsync("_x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "retry_state" }, _meta: { promptId: "task-completed-t" } }));
    const asked = await channel.onRequest("1", "session/request_permission", JsonReader.fromValue({ sessionId: "s", toolCall: { toolCallId: "c", title: "Run" },
      options: [{ optionId: "yes", name: "Allow", kind: "allow_once" }] }));
    const running = channel.isIdle;
    await channel.onNotificationAsync("_x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "turn_completed", prompt_id: "task-completed-t" } }));
    const result = await woken;
    await idle;

    Assert.areEqual(JSON.stringify(["personunmarked"]), JSON.stringify(person.texts));
    Assert.areEqual(JSON.stringify(["wokenafter"]), JSON.stringify(reply.texts));
    Assert.areEqual(JSON.stringify({ outcome: { outcome: "selected", optionId: "yes" } }), JSON.stringify(asked));
    Assert.areEqual(1, reply.asks.length);
    Assert.isFalse(running);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(0, cancelled.length);
    Assert.isTrue(channel.isIdle);
  }

  @TestMethod
  public async stopsTheTurnTheAgentStartsWhenThePersonStopsItWhileItIsStillBeingSetUp(): Promise<void> {
    const person = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const stop = new AbortController();
    person.wakeTurn = new WakeTurn({});
    const woken = person.wakeTurn.follow(reply, stop.signal);
    const turn = new AcpTurn("agent", "Agent", "Agent tool", person, new AbortController().signal, 1);
    const cancelled: string[] = [];
    const creating = Promise.withResolvers<void>();
    const created: { readonly target: WakeTurn; readonly signal: AbortSignal }[] = [];
    const channel = AcpChannelTests.channel(turn, person, cancelled, undefined, async (target, signal) => {
      created.push({ target, signal });
      await creating.promise;
      return new AcpTurn("agent", "Agent", "Agent tool", target, signal, 1);
    });
    const observed = new ObservedSettings("agent", null, null, null);
    await turn.beginAsync("s", false, observed);
    channel.follow("s", observed);
    await channel.onNotificationAsync("_x.ai/task_completed", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "task_completed", task_snapshot: { task_id: "t", exit_code: 0 },
      will_wake: true } }));

    const waking = AcpChannelTests.chunkAsync(channel, "woken", { _meta: { promptId: "task-completed-t" } });
    await Wait.until(() => created.length === 1, "The woken turn was not created.");
    stop.abort();
    creating.resolve();
    await waking;
    await turn.finishAsync();
    await channel.endAsync();
    await woken;

    Assert.areEqual(JSON.stringify(["s"]), JSON.stringify(cancelled));
    Assert.isTrue(created[0]?.signal.aborted === true);
  }

  @TestMethod
  public async followsNoTaskWhenNoListenerTakesThem(): Promise<void> {
    const person = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", person, new AbortController().signal, 1);
    const channel = new AcpChannel(turn, null, new HeldDelayTimer(1000), 1000, t => Promise.resolve(new AcpTurn("agent", "Agent", "Agent tool", t, new AbortController().signal, 1)),
      () => undefined, (_, sessionId, observed) => new TurnResult(TurnOutcome.Completed, sessionId, observed, null), "Agent", () => Promise.resolve(),
      () => Promise.resolve(true), new AcpCommands());
    const observed = new ObservedSettings("agent", null, null, null);
    await turn.beginAsync("s", false, observed);
    channel.follow("s", observed);

    await channel.onNotificationAsync("_x.ai/task_backgrounded", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "task_backgrounded", task_id: "t", command: "npm test" } }));
    await turn.finishAsync();

    Assert.isTrue(channel.isIdle);
    Assert.areEqual(0, person.taskStarts.length);
  }

  @TestMethod
  public async cancelsTheTurnTheAgentStartsWhenNoReplyTakesItAndIgnoresTurnsItDidNotSay(): Promise<void> {
    const person = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", person, new AbortController().signal, 1);
    const cancelled: string[] = [];
    const channel = AcpChannelTests.channel(turn, person, cancelled);
    const observed = new ObservedSettings("agent", null, null, null);
    await turn.beginAsync("s", false, observed);
    channel.follow("s", observed);

    await AcpChannelTests.chunkAsync(channel, "unsaid", { _meta: { promptId: "task-completed-x" } });
    await channel.onNotificationAsync("_x.ai/task_completed", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "task_completed", task_snapshot: { task_id: "x" },
      will_wake: true } }));
    const expecting = channel.isIdle;
    await AcpChannelTests.chunkAsync(channel, "refused", { _meta: { promptId: "task-completed-x" } });
    await turn.finishAsync();

    Assert.areEqual(JSON.stringify(["unsaidrefused"]), JSON.stringify(person.texts));
    Assert.areEqual(JSON.stringify(["x"]), JSON.stringify(person.wakes.map(t => t.taskId)));
    Assert.areEqual(JSON.stringify(["s"]), JSON.stringify(cancelled));
    Assert.isFalse(expecting);
    Assert.isTrue(channel.isIdle);
  }

  @TestMethod
  public async keepsABackgroundSubAgentPastItsTurnAndWakesTheChatWithItsResult(): Promise<void> {
    const person = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    person.wakeTurn = new WakeTurn({});
    const woken = person.wakeTurn.follow(reply, new AbortController().signal);
    const turn = new AcpTurn("agent", "Agent", "Agent tool", person, new AbortController().signal, 1);
    const channel = AcpChannelTests.channel(turn, person, []);
    const observed = new ObservedSettings("agent", null, null, null);
    await turn.beginAsync("s", false, observed);
    channel.follow("s", observed);
    await AcpChannelTests.spawnAsync(channel, "a", "Read notes", true);
    await AcpChannelTests.spawnAsync(channel, "b", "Check links", true);
    await AcpChannelTests.spawnAsync(channel, "f", "Look around", false);
    await AcpChannelTests.updateAsync(channel, "subagent_spawned", { subagent_id: "a1", child_session_id: "ac", description: "Read notes" });
    await AcpChannelTests.updateAsync(channel, "subagent_spawned", { subagent_id: "f1", child_session_id: "fc", description: "Look around" });
    await AcpChannelTests.childAsync(channel, "ac", { sessionUpdate: "tool_call", toolCallId: "r", kind: "read", title: "Read notes.txt" });

    await turn.finishAsync();
    const idle = channel.whenIdle();
    await AcpChannelTests.updateAsync(channel, "subagent_spawned", { child_session_id: "bc", description: "Check links" });
    await AcpChannelTests.childAsync(channel, "ac", { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Reading" } });
    await AcpChannelTests.childAsync(channel, "ac", { sessionUpdate: "tool_call_update", toolCallId: "r", status: "completed" });
    await AcpChannelTests.childAsync(channel, "other", { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "stray" } });
    await AcpChannelTests.updateAsync(channel, "subagent_progress", { child_session_id: "ac", tool_call_count: 1 });
    await AcpChannelTests.updateAsync(channel, "subagent_progress", { child_session_id: "fc", tool_call_count: 1 });
    await AcpChannelTests.updateAsync(channel, "retry_state", {});
    await channel.onNotificationAsync("_x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: {} }));
    await channel.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s" }));
    person.decisions.push("yes");
    const asked = await Promise.all(["ac", "fc"].map(t => channel.onRequest(t, "session/request_permission", JsonReader.fromValue({ sessionId: "s",
      toolCall: { toolCallId: `${t}-w`, kind: "edit", title: "Write notes", _meta: { "x.ai/requestingSessionId": t } },
      options: [{ optionId: "yes", name: "Allow", kind: "allow_once" }] }))));
    await AcpChannelTests.updateAsync(channel, "subagent_finished", { child_session_id: "bc", status: "failed", error: "No links", will_wake: false });
    const running = channel.isIdle;
    await AcpChannelTests.updateAsync(channel, "subagent_finished", { child_session_id: "ac", status: "completed", output: "First line", will_wake: true });
    const expecting = channel.isIdle;
    await AcpChannelTests.chunkAsync(channel, "It said: First line", { _meta: { promptId: "subagent-completed-a1" } });
    await AcpChannelTests.updateAsync(channel, "turn_completed", { prompt_id: "subagent-completed-a1" });
    const result = await woken;
    await idle;

    const read = SubAgent.fromJson(AcpChannelTests.rowsOf(person, "agent-tool-a").at(-1)!.payload);
    const tool = person.details.filter(t => t.providerItemId === "agent-tool-ac:r").at(-1)!;
    Assert.areEqual(JSON.stringify([["a1", "Read notes", "a"]]), JSON.stringify(person.taskStarts.map(t => [t.taskId, t.command, t.subAgentId])));
    Assert.areEqual(JSON.stringify([["a1", "Completed"]]), JSON.stringify(person.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(JSON.stringify([["a1", "Read notes"]]), JSON.stringify(person.wakes.map(t => [t.taskId, t.command])));
    Assert.areEqual(JSON.stringify(["Completed", "Stopped", "Stopped"]), JSON.stringify(["a", "b", "f"].map(t => AcpChannelTests.statusOf(person, `agent-tool-${t}`))));
    Assert.areEqual(JSON.stringify(["First line", 1]), JSON.stringify([read.summary, read.toolUses]));
    Assert.areEqual(JSON.stringify(["Read notes.txt", "Reading", "Read notes.txt"]),
      JSON.stringify(person.details.filter(t => t.parentItemId === "agent-tool-a").map(t => t.text)));
    Assert.areEqual("completed", (tool.payload as JsonObject)["status"]);
    Assert.isFalse(person.texts.some(t => t.includes("stray") || t.includes("It said")));
    Assert.areEqual(JSON.stringify([{ outcome: { outcome: "selected", optionId: "yes" } }, { outcome: { outcome: "cancelled" } }]), JSON.stringify(asked));
    Assert.areEqual(1, person.asks.length);
    Assert.areEqual(JSON.stringify(["It said: First line"]), JSON.stringify(reply.texts));
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isFalse(running);
    Assert.isFalse(expecting);
    Assert.isTrue(channel.isIdle);
  }

  @TestMethod
  public async stopsAKeptSubAgentThroughTheAgentAndEndsItItselfWhenTheAgentHasNoneToStop(): Promise<void> {
    const person = new RecordingTurnListener();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", person, new AbortController().signal, 1);
    const answers = [true, false, false];
    const cancelled: string[] = [];
    const channel = AcpChannelTests.channel(turn, person, [], t => {
      cancelled.push(t);
      return t === "d" ? Promise.reject(new Error("Gone")) : Promise.resolve(answers.shift()!);
    });
    const observed = new ObservedSettings("agent", null, null, null);
    await turn.beginAsync("s", false, observed);
    channel.follow("s", observed);
    for (const id of ["a", "b", "c", "d", "e"])
      await AcpChannelTests.spawnAsync(channel, id, `Agent ${id}`, true);
    for (const id of ["a", "b", "c", "d"])
      await AcpChannelTests.updateAsync(channel, "subagent_spawned", { subagent_id: id, child_session_id: `${id}c`, description: `Agent ${id}` });
    await turn.finishAsync();
    const stopOf = (id: string): Promise<void> => person.taskStarts.find(t => t.taskId === id)!.stop();

    await stopOf("a");
    const stopping = AcpChannelTests.statusOf(person, "agent-tool-a");
    await AcpChannelTests.updateAsync(channel, "subagent_finished", { child_session_id: "ac", status: "cancelled", will_wake: false });
    await stopOf("b");
    await AcpChannelTests.updateAsync(channel, "subagent_finished", { child_session_id: "cc", status: "completed", output: "Done" });
    await stopOf("c");
    await channel.stopTasks();
    const running = channel.isIdle;
    await channel.endAsync();

    Assert.areEqual("Running", stopping);
    Assert.areEqual(JSON.stringify(["a", "b", "c", "d"]), JSON.stringify(cancelled));
    Assert.areEqual(JSON.stringify(["Stopped", "Stopped", "Completed", "Stopped", "Stopped"]),
      JSON.stringify(["a", "b", "c", "d", "e"].map(t => AcpChannelTests.statusOf(person, `agent-tool-${t}`))));
    Assert.areEqual(JSON.stringify([["a", "Stopped"], ["b", "Stopped"], ["c", "Completed"], ["d", "Stopped"]]),
      JSON.stringify(person.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(0, person.wakes.length);
    Assert.isFalse(running);
    Assert.isTrue(channel.isIdle);
  }

  @TestMethod
  public async cancelsEachKeptSubAgentWhenThePersonStopsTheTurnAndClosesOnceTheAgentHasAnsweredEachCancel(): Promise<void> {
    const person = new RecordingTurnListener();
    const stop = new AbortController();
    const turn = new AcpTurn("agent", "Agent", "Agent tool", person, stop.signal, 1);
    const answers = [Promise.withResolvers<boolean>(), Promise.withResolvers<boolean>()];
    const cancelled: string[] = [];
    const channel = AcpChannelTests.channel(turn, person, [], t => {
      cancelled.push(t);
      return answers[cancelled.length - 1]!.promise;
    });
    const observed = new ObservedSettings("agent", null, null, null);
    await turn.beginAsync("s", false, observed);
    channel.follow("s", observed);
    for (const id of ["a", "b"]) {
      await AcpChannelTests.spawnAsync(channel, id, `Agent ${id}`, true);
      await AcpChannelTests.updateAsync(channel, "subagent_spawned", { subagent_id: id, child_session_id: `${id}c`, description: `Agent ${id}` });
    }

    stop.abort();
    await turn.finishAsync();
    const idle = channel.whenIdle();
    const stopped = JSON.stringify(["a", "b"].map(t => AcpChannelTests.statusOf(person, `agent-tool-${t}`)));
    answers[0]!.resolve(true);
    await AcpChannelTests.updateAsync(channel, "subagent_finished", { child_session_id: "ac", status: "cancelled", will_wake: true });
    await Promise.resolve();
    const waiting = channel.isIdle;
    answers[1]!.reject(new Error("Gone"));
    await idle;

    Assert.areEqual(JSON.stringify(["a", "b"]), JSON.stringify(cancelled));
    Assert.areEqual(JSON.stringify(["Stopped", "Stopped"]), stopped);
    Assert.areEqual(JSON.stringify([["a", "Stopped"], ["b", "Stopped"]]), JSON.stringify(person.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(0, person.wakes.length);
    Assert.isFalse(waiting);
    Assert.isTrue(channel.isIdle);
  }

  private static channel(turn: AcpTurn, listener: RecordingTurnListener, cancelled: string[],
    cancelSubAgent: (subAgentId: string) => Promise<boolean> = () => Promise.resolve(true),
    createTurn: (wake: WakeTurn, signal: AbortSignal) => Promise<AcpTurn> = t => Promise.resolve(new AcpTurn("agent", "Agent", "Agent tool", t, new AbortController().signal, 1))): AcpChannel {
    return new AcpChannel(turn, listener, new HeldDelayTimer(1000), 1000, createTurn,
      t => cancelled.push(t), (_, sessionId, observed) => new TurnResult(TurnOutcome.Completed, sessionId, observed, null), "Agent",
      () => Promise.resolve(), cancelSubAgent, new AcpCommands());
  }

  private static async spawnAsync(channel: AcpChannel, id: string, description: string, background: boolean): Promise<void> {
    await channel.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call", toolCallId: id, title: "spawn_subagent",
      rawInput: { description, prompt: "Go", background }, _meta: { "x.ai/tool": { name: "spawn_subagent" } } } }));
    if (background)
      await channel.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: id, status: "completed" } }));
  }

  private static updateAsync(channel: AcpChannel, kind: string, update: JsonObject): Promise<void> {
    return channel.onNotificationAsync("_x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: kind, ...update } }));
  }

  private static childAsync(channel: AcpChannel, sessionId: string, update: JsonObject): Promise<void> {
    return channel.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId, update }));
  }

  private static rowsOf(listener: RecordingTurnListener, itemId: string): TurnDetail[] {
    return listener.details.filter(t => t.kind === DetailKind.SubAgent && t.providerItemId === itemId);
  }

  private static statusOf(listener: RecordingTurnListener, itemId: string): string {
    return SubAgent.fromJson(AcpChannelTests.rowsOf(listener, itemId).at(-1)!.payload).status;
  }

  private static chunkAsync(channel: AcpChannel, text: string, extra: JsonObject = {}): Promise<void> {
    return channel.onNotificationAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } }, ...extra }));
  }
}
