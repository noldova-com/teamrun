/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetailKind, ObservedSettings, SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";
import { AcpBackgroundReplies, AcpTurn, Resources } from "@noldova/teamrun.providers";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class AcpBackgroundRepliesTests {
  @TestMethod
  public async takesEachBackgroundReplyOutOfTheParentsTextOnlyWhenOneRunOfWholeChunksBetweenItsSpawnAndItsReadMatchesIt(): Promise<void> {
    const whole = new RecordingTurnListener();
    const interleaved = new RecordingTurnListener();
    const identical = new RecordingTurnListener();
    const split = new RecordingTurnListener();
    const unread = new RecordingTurnListener();
    const readA = [AcpBackgroundRepliesTests.read("read-a", "agent-a"), AcpBackgroundRepliesTests.replied("read-a", "idle", "Alpha says hi.")];
    const readB = [AcpBackgroundRepliesTests.read("read-b", "agent-b"), AcpBackgroundRepliesTests.replied("read-b", "idle", "Beta says hi.")];
    const reads = [...readA, ...readB];

    await AcpBackgroundRepliesTests.playAsync([...AcpBackgroundRepliesTests.started(), ...AcpBackgroundRepliesTests.texts("\n", "Alpha", " says hi.", "\n", "Beta", " says hi."),
      ...readA.slice(0, 1), AcpBackgroundRepliesTests.text("Alpha says hi."), ...readA.slice(1), ...readB, AcpBackgroundRepliesTests.text("Beta says hi.")], whole);
    await AcpBackgroundRepliesTests.playAsync([...AcpBackgroundRepliesTests.started(), ...AcpBackgroundRepliesTests.texts("Al", "Be", "pha says hi.", "ta says hi."), ...reads],
      interleaved);
    await AcpBackgroundRepliesTests.playAsync([...AcpBackgroundRepliesTests.started(), ...AcpBackgroundRepliesTests.texts("Done.", "Done."),
      AcpBackgroundRepliesTests.read("read-a", "agent-a"), AcpBackgroundRepliesTests.replied("read-a", "idle", "Done."), AcpBackgroundRepliesTests.read("read-b", "agent-b"),
      AcpBackgroundRepliesTests.replied("read-b", "completed", "Done.")], identical);
    await AcpBackgroundRepliesTests.playAsync([...AcpBackgroundRepliesTests.started(), ...AcpBackgroundRepliesTests.texts("Ok. Al", "pha says hi.", "Beta says", " hi. Bye."), ...reads],
      split);
    await AcpBackgroundRepliesTests.playAsync([...AcpBackgroundRepliesTests.started(), ...AcpBackgroundRepliesTests.texts("Alpha", " says hi.")], unread);

    Assert.areEqual(JSON.stringify([["Starting.", "\n\n", "Alpha says hi.", "Beta says hi."], ["Alpha says hi."], ["Beta says hi."]]),
      JSON.stringify(AcpBackgroundRepliesTests.shown(whole)));
    Assert.areEqual(JSON.stringify([["Starting.", "AlBepha says hi.ta says hi."], [], []]), JSON.stringify(AcpBackgroundRepliesTests.shown(interleaved)));
    Assert.areEqual(JSON.stringify([["Starting.", "Done.Done."], [], []]), JSON.stringify(AcpBackgroundRepliesTests.shown(identical)));
    Assert.areEqual(JSON.stringify([["Starting.", "Ok. Alpha says hi.Beta says hi. Bye."], [], []]), JSON.stringify(AcpBackgroundRepliesTests.shown(split)));
    Assert.areEqual(JSON.stringify([["Starting.", "Alpha says hi."], [], []]), JSON.stringify(AcpBackgroundRepliesTests.shown(unread)));
    for (const listener of [whole, interleaved, split])
      Assert.areEqual(JSON.stringify([[SubAgentStatus.Completed, "Alpha says hi."], [SubAgentStatus.Completed, "Beta says hi."]]),
        JSON.stringify(AcpBackgroundRepliesTests.endsOf(listener)));
    Assert.areEqual(JSON.stringify([[SubAgentStatus.Completed, "Done."], [SubAgentStatus.Completed, "Done."]]), JSON.stringify(AcpBackgroundRepliesTests.endsOf(identical)));
    Assert.areEqual(JSON.stringify([[SubAgentStatus.Stopped, null], [SubAgentStatus.Stopped, null]]), JSON.stringify(AcpBackgroundRepliesTests.endsOf(unread)));
  }

  @TestMethod
  public async endsABackgroundSubAgentOnlyForAFinishedReadOfItAndLeavesTheParentsTextForAnyOtherRead(): Promise<void> {
    const listener = new RecordingTurnListener();

    const turn = await AcpBackgroundRepliesTests.playAsync([AcpBackgroundRepliesTests.spawn("x", "background"), AcpBackgroundRepliesTests.event("x", "agent-x"),
      AcpBackgroundRepliesTests.text("Hello."), AcpBackgroundRepliesTests.spawn("f", "sync"), AcpBackgroundRepliesTests.event("f", "agent-f"),
      AcpBackgroundRepliesTests.update({ sessionUpdate: "tool_call", toolCallId: "look", title: "Look", kind: "read", status: "pending", rawInput: { path: "/work/a.txt" } }),
      AcpBackgroundRepliesTests.read("read-0", "agent-unknown"), AcpBackgroundRepliesTests.replied("read-0", "idle", "Hello."),
      AcpBackgroundRepliesTests.read("read-1", "agent-f"), AcpBackgroundRepliesTests.replied("read-1", "idle", "Hello."),
      AcpBackgroundRepliesTests.read("read-2", "agent-x"), AcpBackgroundRepliesTests.replied("read-2", "running", "Hello."),
      AcpBackgroundRepliesTests.read("read-3", "agent-x"), AcpBackgroundRepliesTests.update({ sessionUpdate: "tool_call_update", toolCallId: "read-3", status: "completed" })],
    listener, false);
    const running = AcpBackgroundRepliesTests.endsOf(listener, ["x"]);
    await AcpBackgroundRepliesTests.playAsync([AcpBackgroundRepliesTests.read("read-4", "agent-x"), AcpBackgroundRepliesTests.replied("read-4", "idle"),
      AcpBackgroundRepliesTests.read("read-5", "agent-x"), AcpBackgroundRepliesTests.replied("read-5", "idle", "Hello.")], listener, true, turn);

    Assert.areEqual(JSON.stringify([[SubAgentStatus.Running, null]]), JSON.stringify(running));
    Assert.areEqual(JSON.stringify([[SubAgentStatus.Completed, null], [SubAgentStatus.Stopped, null]]), JSON.stringify(AcpBackgroundRepliesTests.endsOf(listener, ["x", "f"])));
    Assert.areEqual(JSON.stringify([["Hello."], [], []]), JSON.stringify(AcpBackgroundRepliesTests.shown(listener, ["x", "f"])));
    const steps = new Set(listener.details.filter(t => t.providerItemId === "copilot-tool-look" || t.providerItemId?.startsWith("copilot-tool-read-") === true)
      .map(t => `${String(t.providerItemId).replace("copilot-tool-", "")}|${String(t.parentItemId)}`));
    Assert.areEqual("look|null,read-0|null,read-1|null,read-2|null,read-3|null,read-4|null,read-5|null", [...steps].join(","));
  }

  @TestMethod
  public async readsAReadAgentOutputsFinishedRepliesAndTakesNothingForASpanItNeverNoted(): Promise<void> {
    const listener = new RecordingTurnListener();
    const replies = new AcpBackgroundReplies(listener);
    replies.noteText("item", "Hi.");
    replies.mark("spawn");

    Assert.areEqual(JSON.stringify([["Hi.", "Bye."], ["Hi."], null, null]), JSON.stringify(["Agent is idle. agent_id: a, status: idle, description: Task, total_turns: 3"
      + "\n\n[Turn 0]\n Hi. \n\n[Turn 1]\n  \n\n[Turn 2]\nBye.", "status: completed\n\n[Turn 0]\nHi.", "Agent is running. status: running, total_turns: 0",
    "Agent is idle."].map(t => AcpBackgroundReplies.repliesOf(t))));
    Assert.areEqual("|", [await replies.takeAsync("spawn", "read", ["Hi."]), await replies.takeAsync("other", "spawn", ["Hi."])].map(t => t.join(",")).join("|"));
    Assert.areEqual(0, listener.details.length);
  }

  private static update(value: JsonObject): JsonObject {
    return { method: "session/update", params: { update: value } };
  }

  private static spawn(id: string, mode: string): JsonObject {
    return AcpBackgroundRepliesTests.update({ sessionUpdate: "tool_call", toolCallId: id, kind: "other", status: "pending",
      rawInput: { agent_type: "explore", description: `Task ${id}`, prompt: `Do ${id}.`, mode } });
  }

  private static event(toolCallId: string, agentId: string): JsonObject {
    return { method: "github.com/copilot/sessionEvent", params: { sessionId: "copilot-session", type: Resources.copilotSubAgentStarted, timestamp: "2026-10-26T12:00:00.000Z",
      agentId, data: { toolCallId, agentName: "explore" } } };
  }

  private static started(): JsonObject[] {
    return [AcpBackgroundRepliesTests.text("Starting."), AcpBackgroundRepliesTests.spawn("a", "background"), AcpBackgroundRepliesTests.spawn("b", "background"),
      AcpBackgroundRepliesTests.event("a", "agent-a"), AcpBackgroundRepliesTests.event("b", "agent-b"),
      ...["a", "b"].map(t => AcpBackgroundRepliesTests.update({ sessionUpdate: "tool_call_update", toolCallId: t, status: "completed", rawOutput: { content: `Started ${t}.` } }))];
  }

  private static text(value: string): JsonObject {
    return AcpBackgroundRepliesTests.update({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: value } });
  }

  private static texts(...values: readonly string[]): JsonObject[] {
    return values.map(t => AcpBackgroundRepliesTests.text(t));
  }

  private static read(id: string, agentId: string): JsonObject {
    return AcpBackgroundRepliesTests.update({ sessionUpdate: "tool_call", toolCallId: id, title: "read_agent", kind: "read", status: "pending",
      rawInput: { agent_id: agentId, since_turn: 0 } });
  }

  private static replied(id: string, status: string, ...replies: readonly string[]): JsonObject {
    const output = [`Agent is ${status}. agent_type: explore, status: ${status}, description: Task, total_turns: ${replies.length}`,
      ...replies.map((t, index) => `[Turn ${index}]\n${t}`)].join("\n\n");
    return AcpBackgroundRepliesTests.update({ sessionUpdate: "tool_call_update", toolCallId: id, status: "completed", rawOutput: { content: output } });
  }

  private static async playAsync(messages: readonly JsonObject[], listener: RecordingTurnListener, ends: boolean = true, going: AcpTurn | null = null): Promise<AcpTurn> {
    const turn = going ?? new AcpTurn("copilot", "Copilot", "Copilot tool", listener, new AbortController().signal, 1);
    if (Object.isNull(going))
      await turn.beginAsync("copilot-session", false, new ObservedSettings("copilot", null, null, null));
    for (const message of messages.map(t => JsonReader.fromValue(t)))
      await turn.onNotificationAsync(message.readString("method"), JsonReader.fromValue({ [Resources.sessionIdField]: "copilot-session", ...message.readObject("params").toJson() }));
    if (ends)
      await turn.onResponseAsync(Resources.acpSessionPrompt);
    return turn;
  }

  private static shown(listener: RecordingTurnListener, ids: readonly string[] = ["a", "b"]): string[][] {
    const texts = [...new Map(listener.details.filter(t => t.kind === DetailKind.Text).map(t => [t.providerItemId, t.text])).values()];
    return [texts, ...ids.map(id => listener.details.filter(t => t.kind === DetailKind.Note && t.parentItemId === `copilot-tool-${id}`
      && t.providerItemId?.startsWith(`copilot-tool-${id}${Resources.requestIdSeparator}`) === true).map(t => t.text))];
  }

  private static endsOf(listener: RecordingTurnListener, ids: readonly string[] = ["a", "b"]): (string | null)[][] {
    const rows = listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
    return ids.map(id => rows.filter(t => t.toolUseId === id).at(-1)).map(t => [t?.status ?? null, t?.summary ?? null]);
  }
}
