/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BackgroundTasksService, TurnOutcome, TurnRequest, TurnTools, WakeTurn } from "@noldova/teamrun.core";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { Assert, Category, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ApprovalKind, AuthStatus, BackgroundTaskStatus, DetailKind, ObservedSettings, Provider, RequestedSettings, SenderEnvironment, SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";
import { AcpSubAgents, AcpTurn, Resources } from "@noldova/teamrun.providers";
import { AntigravitySubAgentRecording } from "../../fixtures/antigravity-sub-agent.recording.js";
import { CopilotSubAgentEndsRecording } from "../../fixtures/copilot-sub-agent-ends.recording.js";
import { CopilotSubAgentRecording } from "../../fixtures/copilot-sub-agent.recording.js";
import { FakeTaskTree } from "../../fixtures/fake-task-tree.fixture.js";
import { GrokSubAgentEndsRecording } from "../../fixtures/grok-sub-agent-ends.recording.js";
import { GrokSubAgentRecording } from "../../fixtures/grok-sub-agent.recording.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const description = "Read notes.txt first line";
const answer = "The capture's first line.";

@TestClass
export class AcpSubAgentsTests {
  @TestMethod
  public async showsGrokSubAgentThatReadAFileAsOneRowWithItsStepsInsideIt(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow-once");

    await AcpSubAgentsTests.play(GrokSubAgentRecording.completed, listener);

    Assert.areEqual(JSON.stringify(new SubAgent("tool", "general-purpose", "Read notes.txt first line", "grok-4.7", SubAgentStatus.Completed, false, 1, 11238, 3067,
      "The capture's first line.").toJson()), JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    Assert.areEqual("Running,Running,Running,Completed", AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
    Assert.areEqual(JSON.stringify([`${DetailKind.Note}|read_file|grok-tool-grok-child:tool-2`, `${DetailKind.Note}|Read \`/work\\notes.txt\`|grok-tool-grok-child:tool-2`,
      `${DetailKind.Note}|Read \`/work\\notes.txt\`|grok-tool-grok-child:tool-2`, `${DetailKind.Note}|The capture's first line.|grok-tool-tool:0`]),
      JSON.stringify(listener.details.filter(t => t.parentItemId === "grok-tool-tool").map(t => `${t.kind}|${t.text}|${t.providerItemId}`)));
    Assert.isFalse(listener.details.some(t => t.providerItemId === "grok-tool-tool" && t.kind !== DetailKind.SubAgent));
    Assert.areEqual("Read notes.txt first line|false", listener.asks.map(t => `${t.summary}|${Resources.subAgentField in (t.payload as JsonObject)}`).join(","));
  }

  @TestMethod
  public async labelsTheApprovalAGrokSubAgentAsksAndStopsItWhenThatApprovalIsRejected(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow-once", "reject-once");

    await AcpSubAgentsTests.play(GrokSubAgentRecording.rejected, listener);

    const child = listener.asks[1]!;
    Assert.areEqual(JSON.stringify([ApprovalKind.Command, "Create capture-folder only"]), JSON.stringify([child.kind, (child.payload as JsonObject)[Resources.subAgentField]]));
    Assert.isFalse(Resources.subAgentField in (listener.asks[0]!.payload as JsonObject));
    Assert.areEqual(JSON.stringify(new SubAgent("tool", "general-purpose", "Create capture-folder only", "grok-4.7", SubAgentStatus.Stopped, false, 0, 0, 3635,
      "Subagent turn was cancelled: user rejected permission — User rejected the execution for tool `run_terminal_command`").toJson()),
      JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    const text = GrokSubAgentRecording.rejected.filter(t => (t["params"] as JsonObject)[Resources.sessionIdField] === "grok-child"
      && AcpSubAgentsTests.kindOf(t) === Resources.acpMessageChunk).map(t => (AcpSubAgentsTests.updateOf(t)![Resources.contentField] as JsonObject)[Resources.textField]).join("");
    const nested = listener.details.filter(t => t.parentItemId === "grok-tool-tool");
    Assert.areEqual(JSON.stringify([`${DetailKind.Note}|${text}|grok-tool-tool:0`, `${DetailKind.Note}|grok-tool-grok-child:tool-2`, `${DetailKind.Command}|grok-tool-grok-child:tool-2`,
      `${DetailKind.Command}|grok-tool-grok-child:tool-2`, `${DetailKind.Command}|grok-tool-grok-child:tool-2`]),
      JSON.stringify(nested.map(t => t.kind === DetailKind.Note && t.providerItemId!.startsWith("grok-tool-tool:") ? `${t.kind}|${t.text}|${t.providerItemId}` : `${t.kind}|${t.providerItemId}`)));
    Assert.areEqual("false,false,true,true", nested.slice(1).map(t => (t.payload as JsonObject)[Resources.deniedField] === true).join(","));
  }

  @TestMethod
  public async showsADeniedSpawnAsStoppedAndNoSubAgentStepsAfterTheTurn(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("reject-once");
    const spawn = GrokSubAgentRecording.completed.findIndex(t => t["id"] === "spawn-permission");

    const turn = await AcpSubAgentsTests.play(GrokSubAgentRecording.completed.slice(0, spawn + 1), listener, false);
    await turn.onNotificationAsync(Resources.acpSessionUpdate, JsonReader.fromValue({ sessionId: "grok-session",
      update: { sessionUpdate: Resources.acpToolUpdate, toolCallId: "tool", status: Resources.acpFailedStatus } }));
    await turn.onResponseAsync(Resources.acpSessionPrompt);
    await turn.onNotificationAsync(Resources.acpSessionUpdate, JsonReader.fromValue({ sessionId: "grok-child",
      update: { sessionUpdate: Resources.acpToolCall, toolCallId: "late" } }));

    Assert.areEqual([SubAgentStatus.Running, SubAgentStatus.Stopped].join(","), AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
    Assert.isFalse(listener.details.some(t => t.providerItemId === "grok-tool-late"));
  }

  @TestMethod
  public async stopsASubAgentStillRunningWhenTheTurnEndsAndIgnoresItsChildsOtherUpdates(): Promise<void> {
    const listener = new RecordingTurnListener();
    const spawned = GrokSubAgentRecording.completed.findIndex(t => AcpSubAgentsTests.kindOf(t) === Resources.xaiSubAgentSpawned);

    const turn = await AcpSubAgentsTests.play(GrokSubAgentRecording.completed.slice(0, spawned + 1), listener, false);
    for (const content of [{ type: "image", data: "", mimeType: "image/png" }, { type: "text", text: " " }])
      await turn.onNotificationAsync(Resources.acpSessionUpdate, JsonReader.fromValue({ sessionId: "grok-child", update: { sessionUpdate: Resources.acpMessageChunk, content } }));
    await turn.onNotificationAsync(Resources.acpSessionUpdate, JsonReader.fromValue({ sessionId: "grok-child", update: { sessionUpdate: Resources.acpThoughtChunk,
      content: { type: "text", text: "thinking" } } }));
    await turn.onNotificationAsync(Resources.acpSessionUpdate, JsonReader.fromValue({ sessionId: "grok-child", update: { sessionUpdate: Resources.acpPlanUpdate, entries: [] } }));
    await turn.onResponseAsync(Resources.acpSessionPrompt);

    Assert.areEqual("Running,Running,Stopped", AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
    Assert.isFalse(listener.details.some(t => !Object.isNull(t.parentItemId)));
  }

  @TestMethod
  public async keepsAGrokSubAgentInTheBackgroundRunningPastItsSpawnAndShowsItStoppedWhenTheTurnEndsBeforeIt(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow-once");

    await AcpSubAgentsTests.play(GrokSubAgentRecording.background, listener);

    Assert.areEqual("Running,Running,Stopped", AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
    Assert.areEqual(JSON.stringify(new SubAgent("tool", "general-purpose", "Read notes.txt first line", "grok-4.7", SubAgentStatus.Stopped, true).toJson()),
      JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
  }

  @TestMethod
  public async keepsAChildsToolApartFromTheParentsToolWithTheSameId(): Promise<void> {
    const listener = new RecordingTurnListener();
    const spawned = GrokSubAgentRecording.completed.findIndex(t => AcpSubAgentsTests.kindOf(t) === Resources.xaiSubAgentSpawned);

    const turn = await AcpSubAgentsTests.play(GrokSubAgentRecording.completed.slice(0, spawned + 1), listener, false);
    await turn.onNotificationAsync(Resources.acpSessionUpdate, JsonReader.fromValue({ sessionId: "grok-child",
      update: { sessionUpdate: Resources.acpToolCall, toolCallId: "tool", title: "read_file", kind: "read" } }));
    await turn.onResponseAsync(Resources.acpSessionPrompt);

    Assert.areEqual("grok-tool-grok-child:tool|grok-tool-tool", listener.details.filter(t => t.kind === DetailKind.Note && !Object.isNull(t.parentItemId))
      .map(t => `${t.providerItemId}|${t.parentItemId}`).join(","));
    Assert.areEqual("Running,Running,Stopped", AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
  }

  @TestMethod
  public async endsASpawnFromItsToolCallWhenNoFinishCameUnlessItRunsInTheBackgroundAndKeepsAnEndedOneAsItEnded(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = new AcpSubAgents(listener, "grok");
    const spawn = (status: string | null, output: JsonObject | null = null, input: JsonValue = null): JsonObject => ({ status, rawOutput: output, rawInput: input });

    await agents.noteToolAsync("a", "item-a", spawn(null, null, { description: "Read" }), false);
    await agents.noteToolAsync("a", "item-a", spawn(Resources.acpCompletedStatus, { output: "Done", tool_calls: 2, duration_ms: 40 }), false);
    await agents.noteToolAsync("a", "item-a", spawn(Resources.acpFailedStatus), false);
    await agents.noteToolAsync("b", "item-b", spawn(Resources.acpFailedStatus, null, { description: " " }), false);
    await agents.noteToolAsync("c", "item-c", spawn(Resources.acpFailedStatus, null, []), true);
    await agents.noteToolAsync("d", "item-d", spawn(Resources.acpCompletedStatus, { tool_calls: -1, duration_ms: 1.5 }), false);
    await agents.noteToolAsync("e", "item-e", spawn(Resources.acpCompletedStatus, { output: "Started" }, { run_in_background: true }), false);
    await agents.noteToolAsync("f", "item-f", spawn(null, null, { background: true }), false);
    await agents.noteToolAsync("f", "item-f", spawn(Resources.acpFailedStatus), false);

    Assert.areEqual(JSON.stringify([new SubAgent("a", null, "Read", null, SubAgentStatus.Running, false),
      new SubAgent("a", null, "Read", null, SubAgentStatus.Completed, false, 2, null, 40, "Done"),
      new SubAgent("b", null, "Sub-agent", null, SubAgentStatus.Running, false), new SubAgent("b", null, "Sub-agent", null, SubAgentStatus.Failed, false),
      new SubAgent("c", null, "Sub-agent", null, SubAgentStatus.Running, false), new SubAgent("c", null, "Sub-agent", null, SubAgentStatus.Stopped, false),
      new SubAgent("d", null, "Sub-agent", null, SubAgentStatus.Running, false), new SubAgent("d", null, "Sub-agent", null, SubAgentStatus.Completed, false),
      new SubAgent("e", null, "Sub-agent", null, SubAgentStatus.Running, true), new SubAgent("f", null, "Sub-agent", null, SubAgentStatus.Running, true),
      new SubAgent("f", null, "Sub-agent", null, SubAgentStatus.Failed, true)]
      .map(t => t.toJson())), JSON.stringify(listener.details.map(t => t.payload)));
    Assert.areEqual("item-a,item-a,item-b,item-b,item-c,item-c,item-d,item-d,item-e,item-f,item-f", listener.details.map(t => t.providerItemId).join(","));
  }

  @TestMethod
  public async namesEachSpawnedChildByItsDescriptionOrTheFirstWaitingSpawnAndIgnoresUpdatesItCannotPlace(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = new AcpSubAgents(listener, "grok");
    for (const id of ["a", "b", "c"])
      await agents.noteToolAsync(id, `item-${id}`, { rawInput: { description: `Task ${id}` } }, false);
    const spawnedAsync = (child: string | null, description: string): Promise<void> =>
      agents.handleAsync(Resources.xaiSubAgentSpawned, { child_session_id: child, description, subagent_type: "explore", model: "grok" });

    await spawnedAsync("child-b", "Task b");
    await spawnedAsync("child-x", "Task x");
    await spawnedAsync(null, "Task c");
    await spawnedAsync("child-c", "Task c");
    await spawnedAsync("child-y", "Task y");
    await agents.handleAsync(Resources.xaiSubAgentProgress, { child_session_id: "unknown", tool_call_count: 1 });
    await agents.handleAsync(Resources.xaiSubAgentProgress, { tool_call_count: 1 });
    await agents.handleAsync(Resources.xaiSubAgentFinished, { child_session_id: "child-b", status: "lost" });
    await agents.handleAsync(Resources.xaiSubAgentFinished, { child_session_id: "child-x" });
    await agents.handleAsync(Resources.xaiSubAgentProgress, { child_session_id: "child-b", tool_call_count: 5 });
    await agents.handleAsync(Resources.xaiSubAgentFinished, { child_session_id: "child-c", status: "completed", tokens_used: 9, error: "none" });

    Assert.areEqual(JSON.stringify(["b|explore|grok|Running", "a|explore|grok|Running", "c|explore|grok|Running", "b|explore|grok|Failed", "a|explore|grok|Failed",
      "c|explore|grok|Completed"]), JSON.stringify(listener.details.slice(3).map(t => SubAgent.fromJson(t.payload))
      .map(t => `${t.toolUseId}|${t.type}|${t.model}|${t.status}`)));
    Assert.areEqual("null,null,none", listener.details.slice(6).map(t => String(SubAgent.fromJson(t.payload).summary)).join(","));
    Assert.areEqual("a,b,c,undefined,undefined", ["child-x", "child-b", "child-c", "child-y", null].map(t => String(agents.ofChild(t)?.toolCallId)).join(","));
  }

  @TestMethod
  public async showsEachRunOfAChildsTextAsItsOwnNoteAndStopsOnlyTheRunningAgents(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = new AcpSubAgents(listener, "grok");
    await agents.noteToolAsync("a", "item-a", {}, false);
    await agents.noteToolAsync("b", "item-b", {}, false);
    await agents.noteToolAsync("b", "item-b", { status: Resources.acpFailedStatus }, false);
    const entry = { toolCallId: "a", itemId: "item-a", childSessionId: null, subAgentId: null, agent: new SubAgent("a", null, "Sub-agent", null, SubAgentStatus.Running, false) };

    await agents.flushTextAsync(entry);
    agents.appendText(entry, "One ");
    agents.appendText(entry, "line.");
    await agents.flushTextAsync(entry);
    await agents.flushTextAsync(entry);
    agents.appendText(entry, "Two.");
    await agents.stopAllAsync();
    await agents.stopAllAsync();

    Assert.areEqual(JSON.stringify(["SubAgent|item-a|null", "SubAgent|item-b|null", "SubAgent|item-b|null", "Note|item-a:0|item-a", "Note|item-a:1|item-a",
      "SubAgent|item-a|null"]), JSON.stringify(listener.details.map(t => `${t.kind}|${t.providerItemId}|${t.parentItemId}`)));
    Assert.areEqual("One line.|Two.", listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
    Assert.areEqual(SubAgentStatus.Stopped, SubAgent.fromJson(listener.details.at(-1)!.payload).status);
  }

  @TestMethod
  public async showsACopilotSubAgentAsOneRowWithItsToolCallsAndItsOwnTextInsideIt(): Promise<void> {
    const listener = new RecordingTurnListener();

    await AcpSubAgentsTests.play(CopilotSubAgentRecording.completed, listener, true, "Copilot");

    Assert.areEqual(JSON.stringify(new SubAgent("toolu-spawn", "explore", "Read first line of notes", null, SubAgentStatus.Completed, false, 1, null, null,
      "The capture's first line.").toJson()), JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    Assert.areEqual("Running,Running,Completed", AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
    Assert.areEqual(JSON.stringify([`${DetailKind.Note}|Viewing notes.txt|copilot-tool-agent-1:call-view`, `${DetailKind.Note}|Viewing notes.txt|copilot-tool-agent-1:call-view`,
      `${DetailKind.Note}|The capture's first line.|copilot-tool-toolu-spawn:0`]),
      JSON.stringify(listener.details.filter(t => t.parentItemId === "copilot-tool-toolu-spawn").map(t => `${t.kind}|${t.text}|${t.providerItemId}`)));
    Assert.areEqual(JSON.stringify(["The sub-agent replied \"The capture's first line.\""]),
      JSON.stringify(listener.details.filter(t => t.kind === DetailKind.Text || t.kind === DetailKind.Reasoning).map(t => t.text)));
    Assert.isFalse(listener.details.some(t => t.providerItemId === "copilot-tool-toolu-spawn" && t.kind !== DetailKind.SubAgent));
  }

  @TestMethod
  public async failsACopilotSubAgentWithItsMessageAndStopsOneStillRunningWhenTheTurnEnds(): Promise<void> {
    const failedListener = new RecordingTurnListener();
    await AcpSubAgentsTests.play(CopilotSubAgentRecording.failed, failedListener, true, "Copilot");
    const stoppedListener = new RecordingTurnListener();
    await AcpSubAgentsTests.play(CopilotSubAgentRecording.completed.slice(0, 6), stoppedListener, true, "Copilot");

    Assert.areEqual(JSON.stringify(new SubAgent("toolu-unknown", "no-such-agent", "Read notes.txt", null, SubAgentStatus.Failed, false, null, null, null,
      "Unknown agent_type: no-such-agent. Valid types are: explore, task, general-purpose").toJson()), JSON.stringify(AcpSubAgentsTests.rows(failedListener).at(-1)));
    Assert.areEqual("That sub-agent type doesn't exist.", failedListener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join("|"));
    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, 1]), JSON.stringify([Resources.statusField, "toolUses"].map(t => AcpSubAgentsTests.rows(stoppedListener).at(-1)![t])));
    Assert.areEqual("The|copilot-tool-toolu-spawn:0", stoppedListener.details.filter(t => t.kind === DetailKind.Note && t.parentItemId === "copilot-tool-toolu-spawn"
      && t.providerItemId!.startsWith("copilot-tool-toolu-spawn:")).map(t => `${t.text}|${t.providerItemId}`).join(","));
    Assert.isFalse(stoppedListener.details.some(t => t.kind === DetailKind.Text));
  }

  @TestMethod
  public async keepsTheCallsAndApprovalsOfTwoCopilotSubAgentsStartedTogetherUnnamedAlsoOnceOneEnds(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("deny");
    const thought = AcpSubAgentsTests.copilotUpdate({ sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "Thinking." } });

    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("a"), AcpSubAgentsTests.copilotSpawn("b"), thought, AcpSubAgentsTests.copilotText("Both start. "),
      AcpSubAgentsTests.copilotCall("view-x", "agent-x"), AcpSubAgentsTests.copilotCall("view-y", "agent-y"), AcpSubAgentsTests.copilotAsk("view-y", "agent-y"),
      AcpSubAgentsTests.copilotDone("b"), AcpSubAgentsTests.copilotCall("view-x", "agent-x", "tool_call_update"), AcpSubAgentsTests.copilotCall("grep-x", "agent-x"),
      AcpSubAgentsTests.copilotText("A ends."), AcpSubAgentsTests.copilotCall("view-y", "agent-y", "tool_call_update"), AcpSubAgentsTests.copilotDone("a"),
      AcpSubAgentsTests.copilotText("Both are done.")], listener, true, "Copilot");

    Assert.areEqual(JSON.stringify(["a|null|a done", "b|null|b done"]), JSON.stringify(["a", "b"].map(id => AcpSubAgentsTests.rows(listener)
      .filter(t => t["toolUseId"] === id).at(-1)!).map(t => `${t["toolUseId"]}|${t["toolUses"]}|${t["summary"]}`)));
    Assert.areEqual(JSON.stringify(["copilot-tool-agent-x:view-x|null|false", "copilot-tool-agent-y:view-y|null|false", "copilot-tool-agent-y:view-y|null|true",
      "copilot-tool-agent-x:view-x|null|false", "copilot-tool-agent-x:grep-x|null|false", "copilot-tool-agent-y:view-y|null|true"]),
      JSON.stringify(listener.details.filter(t => t.providerItemId?.startsWith("copilot-tool-agent-") === true)
        .map(t => `${t.providerItemId}|${t.parentItemId}|${(t.payload as JsonObject)[Resources.deniedField] === true}`)));
    Assert.areEqual(JSON.stringify(["Both start. |null", "A ends.|copilot-tool-a"]), JSON.stringify(listener.details.filter(t => t.kind === DetailKind.Note
      && t.providerItemId?.startsWith("copilot-tool-agent-") !== true).map(t => `${t.text}|${t.parentItemId}`)));
    Assert.areEqual(Resources.acpUnnamedSubAgent, (listener.asks[0]!.payload as JsonObject)[Resources.subAgentField]);
    Assert.areEqual("Both are done.", listener.details.filter(t => t.kind === DetailKind.Text || t.kind === DetailKind.Reasoning).map(t => t.text).join("|"));
  }

  @TestMethod
  public async namesEachCopilotSubAgentByTheFirstNewAgentIdOnlyItCouldHaveMadeAndLeavesAnIdSeenWithNoneRunningUnnamed(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow");

    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("a"), AcpSubAgentsTests.copilotCall("view", "agent-1"), AcpSubAgentsTests.copilotAsk("run", "agent-1"),
      AcpSubAgentsTests.copilotSpawn("b"), AcpSubAgentsTests.copilotCall("view", "agent-2"), AcpSubAgentsTests.copilotDone("a"), AcpSubAgentsTests.copilotDone("b"),
      AcpSubAgentsTests.copilotCall("late", "agent-3"), AcpSubAgentsTests.copilotText("Both are done.")], listener, true, "Copilot");

    Assert.areEqual(JSON.stringify(["a|1|a done", "b|1|b done"]), JSON.stringify(["a", "b"].map(id => AcpSubAgentsTests.rows(listener)
      .filter(t => t["toolUseId"] === id).at(-1)!).map(t => `${t["toolUseId"]}|${t["toolUses"]}|${t["summary"]}`)));
    Assert.areEqual(JSON.stringify(["copilot-tool-agent-1:view|copilot-tool-a", "copilot-tool-agent-2:view|copilot-tool-b", "copilot-tool-agent-3:late|null"]),
      JSON.stringify(listener.details.filter(t => t.providerItemId?.startsWith("copilot-tool-agent-") === true).map(t => `${t.providerItemId}|${t.parentItemId}`)));
    Assert.areEqual("Task a", (listener.asks[0]!.payload as JsonObject)[Resources.subAgentField]);
    Assert.areEqual("Both are done.", listener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join("|"));
  }

  @TestMethod
  public async runsACopilotSubAgentInTheBackgroundUntilTheTurnEndsAndLeavesTheSessionsTextToTheReply(): Promise<void> {
    const listener = new RecordingTurnListener();

    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("bg", "background"), AcpSubAgentsTests.copilotDone("bg"), AcpSubAgentsTests.copilotText("Working meanwhile."),
      AcpSubAgentsTests.copilotCall("view", "agent-bg")], listener, true, "Copilot");

    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, true, 1]), JSON.stringify([Resources.statusField, "isBackground", "toolUses"]
      .map(t => AcpSubAgentsTests.rows(listener).at(-1)![t])));
    Assert.areEqual("Working meanwhile.", listener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join("|"));
    Assert.areEqual("copilot-tool-bg", listener.details.find(t => t.providerItemId === "copilot-tool-agent-bg:view")?.parentItemId);
  }

  @TestMethod
  public async endsACopilotSubAgentFromItsSpawnAfterMoreCallsOfItsOwnThanTheTurnKeeps(): Promise<void> {
    const listener = new RecordingTurnListener();
    const calls = Array.from({ length: Resources.acpMaximumPending + 1 }, (_, index) => AcpSubAgentsTests.copilotCall(`call-${index}`, "agent-1"));

    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("big"), ...calls, AcpSubAgentsTests.copilotDone("big")], listener, true, "Copilot");

    Assert.areEqual(`${SubAgentStatus.Completed}|${Resources.acpMaximumPending + 1}|big done`, [Resources.statusField, "toolUses", "summary"]
      .map(t => AcpSubAgentsTests.rows(listener).at(-1)![t]).join("|"));
    Assert.isFalse(listener.details.some(t => t.kind !== DetailKind.SubAgent && t.providerItemId === "copilot-tool-big"));
  }

  @TestMethod
  public async linksEachCopilotSubAgentToTheSpawnItsStartNamesAlsoBeforeThatSpawnShowsAndIgnoresStartsItCannotUse(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow");
    const event = (params: JsonObject): JsonObject => AcpSubAgentsTests.copilotEvent(params);
    const started = (toolCallId: string, agentId: string, sessionId: string = "copilot-session"): JsonObject =>
      AcpSubAgentsTests.copilotStarted(toolCallId, agentId, "github.com/copilot/sessionEvent", sessionId);

    await AcpSubAgentsTests.play([started("c", "agent-z"), AcpSubAgentsTests.copilotSpawn("a"), AcpSubAgentsTests.copilotSpawn("b"),
      AcpSubAgentsTests.copilotSpawn("c"), started("a", "agent-q", "other-session"), event({ type: "assistant.message", agentId: "agent-r", data: { toolCallId: "a" } }),
      event({ type: Resources.copilotSubAgentStarted, agentId: "agent-s", data: {} }), event({ type: Resources.copilotSubAgentStarted, data: { toolCallId: "a" } }),
      started("b", "agent-y"), started("a", "agent-x"), started("a", "agent-w"), started("c", "agent-y"),
      ...["y", "x", "z", "q", "r", "s", "w"].map(t => AcpSubAgentsTests.copilotCall(`view-${t}`, `agent-${t}`)), AcpSubAgentsTests.copilotAsk("run-y", "agent-y"),
      ...["a", "b", "c"].map(t => AcpSubAgentsTests.copilotDone(t))], listener, true, "Copilot");

    Assert.areEqual(JSON.stringify(["copilot-tool-agent-y:view-y|copilot-tool-b", "copilot-tool-agent-x:view-x|copilot-tool-a", "copilot-tool-agent-z:view-z|copilot-tool-c",
      "copilot-tool-agent-q:view-q|null", "copilot-tool-agent-r:view-r|null", "copilot-tool-agent-s:view-s|null", "copilot-tool-agent-w:view-w|null"]),
      JSON.stringify(listener.details.filter(t => t.providerItemId?.includes(":view-") === true).map(t => `${t.providerItemId}|${t.parentItemId}`)));
    Assert.areEqual("Task b", JsonReader.fromValue(listener.asks.at(0)?.payload).readString(Resources.subAgentField));
  }

  @TestMethod
  public async stopsGuessingAnIdAStartNamesOnceAStartLinkedAShownSpawnAndLetsAStartReplaceAGuess(): Promise<void> {
    const early = new RecordingTurnListener();
    const guessed = new RecordingTurnListener();
    const unmatched = new RecordingTurnListener();
    const parents = (listener: RecordingTurnListener): string[] => listener.details.filter(t => t.providerItemId?.includes(":view-") === true)
      .map(t => `${String(t.providerItemId)}|${String(t.parentItemId)}`);

    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("a"), AcpSubAgentsTests.copilotSpawn("c"), AcpSubAgentsTests.copilotStarted("c", "agent-z"),
      AcpSubAgentsTests.copilotStarted("b", "agent-y"), AcpSubAgentsTests.copilotStarted("e", "agent-y"),
      AcpSubAgentsTests.copilotCall("view-y1", "agent-y"), AcpSubAgentsTests.copilotSpawn("b"), AcpSubAgentsTests.copilotSpawn("e"),
      AcpSubAgentsTests.copilotStarted("a", "agent-x"), AcpSubAgentsTests.copilotCall("view-x", "agent-x"), AcpSubAgentsTests.copilotCall("view-y2", "agent-y")],
      early, true, "Copilot");
    const prefixed = "_github.com/copilot/sessionEvent";
    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("a"), AcpSubAgentsTests.copilotCall("view-y1", "agent-y"), AcpSubAgentsTests.copilotSpawn("b"),
      AcpSubAgentsTests.copilotCall("view-w1", "agent-w"), AcpSubAgentsTests.copilotStarted("b", "agent-y", prefixed), AcpSubAgentsTests.copilotStarted("a", "agent-x", prefixed),
      AcpSubAgentsTests.copilotCall("view-y2", "agent-y"), AcpSubAgentsTests.copilotCall("view-x", "agent-x"), AcpSubAgentsTests.copilotCall("view-w2", "agent-w")],
      guessed, true, "Copilot");
    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("a"), AcpSubAgentsTests.copilotStarted("toolu-a", "agent-y"), AcpSubAgentsTests.copilotCall("view-y1", "agent-y"),
      AcpSubAgentsTests.copilotCall("view-y2", "agent-y")], unmatched, true, "Copilot");

    Assert.areEqual(JSON.stringify(["copilot-tool-agent-y:view-y1|null", "copilot-tool-agent-x:view-x|copilot-tool-a", "copilot-tool-agent-y:view-y2|copilot-tool-b"]),
      JSON.stringify(parents(early)));
    Assert.areEqual(JSON.stringify(["copilot-tool-agent-y:view-y1|copilot-tool-a", "copilot-tool-agent-w:view-w1|copilot-tool-b", "copilot-tool-agent-y:view-y2|copilot-tool-b",
      "copilot-tool-agent-x:view-x|copilot-tool-a", "copilot-tool-agent-w:view-w2|null"]),
      JSON.stringify(parents(guessed)));
    Assert.areEqual(JSON.stringify(["copilot-tool-agent-y:view-y1|copilot-tool-a", "copilot-tool-agent-y:view-y2|copilot-tool-a"]), JSON.stringify(parents(unmatched)));
  }

  @TestMethod
  public async failsAGrokSpawnThatEndedBeforeAnySubAgentStartedWithGroksMessage(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow-once");

    await AcpSubAgentsTests.play(GrokSubAgentEndsRecording.failed, listener);

    Assert.areEqual(JSON.stringify(new SubAgent("tool-1", null, "Read notes.txt marker", null, SubAgentStatus.Failed, false, null, null, null,
      "Unknown Task.model slug 'no-such-agent-type'. Valid model slugs: grok-4.5, grok-4.6, grok-4.7, grok-4.7-build-fast. Omit `model` to inherit the parent model.").toJson()),
      JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    Assert.areEqual(1, AcpSubAgentsTests.rows(listener).filter(t => t[Resources.statusField] !== SubAgentStatus.Running).length);
  }

  @TestMethod
  public async stopsAGrokBackgroundSubAgentGrokCancelledWithItsLastCountsWhileTheTurnRuns(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow-once");

    await AcpSubAgentsTests.play(GrokSubAgentEndsRecording.cancelled, listener, false);

    Assert.areEqual(JSON.stringify(new SubAgent("tool-1", "general-purpose", "Sleep 120 then report", "grok-4.7", SubAgentStatus.Stopped, true, 0, 0, 15016,
      "Subagent was cancelled").toJson()), JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    Assert.areEqual(10150, AcpSubAgentsTests.rows(listener).findLast(t => t[Resources.statusField] === SubAgentStatus.Running)?.["durationMs"]);
  }

  @TestMethod
  public async showsTheModelCopilotStartedASubAgentWithAndTheCountsItsEndReports(): Promise<void> {
    const listener = new RecordingTurnListener();

    await AcpSubAgentsTests.play(CopilotSubAgentEndsRecording.completed, listener, true, "Copilot");

    Assert.areEqual(JSON.stringify(new SubAgent("toolu-read", "explore", "Read notes.txt marker", "gpt-5.6-luna", SubAgentStatus.Completed, false, 1, 8094, 30_756,
      "blue-heron-42").toJson()), JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    const running = AcpSubAgentsTests.rows(listener).filter(t => t[Resources.statusField] === SubAgentStatus.Running);
    Assert.areEqual("null,gpt-5.6-luna", running.slice(0, 2).map(t => String(t["model"] ?? null)).join(","));
  }

  @TestMethod
  public async ignoresACopilotEndEventForASpawnNotRunningEitherBeforeItShowsOrAfterItEnded(): Promise<void> {
    const plain = new RecordingTurnListener();
    const repeated = new RecordingTurnListener();
    const end = CopilotSubAgentEndsRecording.completed.filter(t => (t["params"] as JsonObject)[Resources.typeField] === Resources.copilotSubAgentCompleted);

    await AcpSubAgentsTests.play(CopilotSubAgentEndsRecording.completed, plain, true, "Copilot");
    await AcpSubAgentsTests.play([...end, ...CopilotSubAgentEndsRecording.completed, ...end], repeated, true, "Copilot");

    Assert.areEqual(1, end.length);
    Assert.areEqual(JSON.stringify(AcpSubAgentsTests.rows(plain)), JSON.stringify(AcpSubAgentsTests.rows(repeated)));
  }

  @TestMethod
  public async stopsACopilotSubAgentItsEndReportsCancelledBeforeTheTurnEndsKeepingTheStepsItCounted(): Promise<void> {
    const listener = new RecordingTurnListener();

    await AcpSubAgentsTests.play(CopilotSubAgentEndsRecording.cancelled, listener, false, "Copilot");

    Assert.areEqual(JSON.stringify(new SubAgent("toolu-sleep", "general-purpose", "Run sleep 120", "claude-sonnet-5.5", SubAgentStatus.Stopped, false, 1, 21_796, 15_007,
      null).toJson()), JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
  }

  @TestMethod
  public async takesCopilotsEndCountForASubAgentWithNoStepsShownAndKeepsNoCountWhereItsEndReportsNone(): Promise<void> {
    const listener = new RecordingTurnListener();
    const ended = (toolCallId: string, agentId: string, data: JsonObject): JsonObject =>
      AcpSubAgentsTests.copilotEvent({ sessionId: "copilot-session", type: Resources.copilotSubAgentCompleted, agentId, data: { toolCallId, ...data } });

    await AcpSubAgentsTests.play([AcpSubAgentsTests.copilotSpawn("a"), AcpSubAgentsTests.copilotStarted("a", "agent-a"), ended("a", "agent-a", { totalToolCalls: 2 }),
      AcpSubAgentsTests.copilotSpawn("b"), AcpSubAgentsTests.copilotStarted("b", "agent-b"), ended("b", "agent-b", { totalTokens: 5 })], listener, false, "Copilot");

    const last = (id: string): JsonObject | undefined => AcpSubAgentsTests.rows(listener).filter(t => t["toolUseId"] === id).at(-1);
    Assert.areEqual(JSON.stringify(new SubAgent("a", "explore", "Task a", null, SubAgentStatus.Running, false, 2, null, null, null).toJson()), JSON.stringify(last("a")));
    Assert.areEqual(JSON.stringify(new SubAgent("b", "explore", "Task b", null, SubAgentStatus.Running, false, null, 5, null, null).toJson()), JSON.stringify(last("b")));
  }

  @TestMethod
  public async showsAnAntigravitySubAgentRunningWithItsTypeAndRoleAndLeavesItsUnmarkedStepsAndTheSpawnsOwnEndToTheParent(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow", "allow", "allow");

    await AcpSubAgentsTests.play(AntigravitySubAgentRecording.ended, listener, false, "Antigravity");

    Assert.areEqual(JSON.stringify(new SubAgent("call-1", "research", "Codebase Researcher", null, SubAgentStatus.Running, false, null, null, null, null).toJson()),
      JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    Assert.isFalse(AcpSubAgentsTests.rows(listener).some(t => t[Resources.statusField] !== SubAgentStatus.Running));
    Assert.isFalse(listener.details.some(t => t.parentItemId === "antigravity-tool-call-1"));
    Assert.isFalse(listener.details.some(t => t.text.includes("never executed") || JSON.stringify(t.payload ?? null).includes("never executed")));
  }

  @TestMethod
  public async endsAnAntigravitySubAgentCompletedWithATurnThatEndedAndStoppedWithOneThatWasCancelled(): Promise<void> {
    const ended = new RecordingTurnListener();
    ended.decisions.push("allow", "allow", "allow");
    const cancelled = new RecordingTurnListener();
    cancelled.decisions.push("allow", "allow", "allow", "allow");

    await AcpSubAgentsTests.play(AntigravitySubAgentRecording.ended, ended, true, "Antigravity", AntigravitySubAgentRecording.endedStopReason);
    await AcpSubAgentsTests.play(AntigravitySubAgentRecording.cancelled, cancelled, true, "Antigravity", AntigravitySubAgentRecording.cancelledStopReason);

    Assert.areEqual(JSON.stringify(new SubAgent("call-1", "research", "Codebase Researcher", null, SubAgentStatus.Completed, false, null, null, null, null).toJson()),
      JSON.stringify(AcpSubAgentsTests.rows(ended).at(-1)));
    Assert.areEqual(JSON.stringify(new SubAgent("call-1", "research", "Folder File Researcher", null, SubAgentStatus.Stopped, false, null, null, null, null).toJson()),
      JSON.stringify(AcpSubAgentsTests.rows(cancelled).at(-1)));
  }

  @TestMethod
  public async stopsAnAntigravitySubAgentWhoseSpawnThePersonDeniedAtTheDenialThoughNothingElseComesBeforeTheTurnEnds(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("deny");
    const spawn = AntigravitySubAgentRecording.ended.findIndex(t => t["id"] === "permission-0");

    await AcpSubAgentsTests.play(AntigravitySubAgentRecording.ended.slice(0, spawn + 1), listener, true, "Antigravity", AntigravitySubAgentRecording.endedStopReason);

    Assert.areEqual([SubAgentStatus.Running, SubAgentStatus.Stopped].join(","), AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
  }

  @TestMethod
  public async endsAnAntigravitySubAgentFailedWhenItsStartCallFailsThoughItsTurnEndsWithEndTurn(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow");

    await AcpSubAgentsTests.play(AntigravitySubAgentRecording.failed, listener, true, "Antigravity", AntigravitySubAgentRecording.failedStopReason);

    Assert.areEqual([SubAgentStatus.Running, SubAgentStatus.Failed].join(","), AcpSubAgentsTests.rows(listener).map(t => t[Resources.statusField]).join(","));
    Assert.areEqual(JSON.stringify(new SubAgent("call-1", "no-such-agent-type-889", "Greeting Subagent", null, SubAgentStatus.Failed, false, null, null, null,
      "Tool execution failed").toJson()), JSON.stringify(AcpSubAgentsTests.rows(listener).at(-1)));
    Assert.isTrue(listener.details.some(t => t.providerItemId === "antigravity-tool-call-2" && t.text === "Running start_subagent"));
  }

  @TestMethod
  public async leavesAFailedAntigravityStartCallWithNoSubAgentRunningAsItsStepAlone(): Promise<void> {
    const listener = new RecordingTurnListener();
    const start = AntigravitySubAgentRecording.failed.findIndex(t => AcpSubAgentsTests.updateOf(t)?.["title"] === "Running start_subagent");

    await AcpSubAgentsTests.play(AntigravitySubAgentRecording.failed.slice(start), listener, true, "Antigravity", AntigravitySubAgentRecording.failedStopReason);

    Assert.areEqual(0, AcpSubAgentsTests.rows(listener).length);
    Assert.isTrue(listener.details.some(t => t.providerItemId === "antigravity-tool-call-2" && t.text === "Running start_subagent"));
  }

  @TestMethod
  public async endsTheSubAgentEachAntigravityStartCallWasPairedWithByOrderWhenTwoSpawnsInterleave(): Promise<void> {
    const listener = new RecordingTurnListener();
    const [firstStarted, firstFailed] = AcpSubAgentsTests.antigravityStart("s-1", "failed", "Tool execution failed");
    const [secondStarted, secondCompleted] = AcpSubAgentsTests.antigravityStart("s-2", "completed", "Read notes.txt");

    await AcpSubAgentsTests.play([AcpSubAgentsTests.antigravitySpawn("call-1", "missing-type"), AcpSubAgentsTests.antigravitySpawn("call-2", "research"),
      firstStarted, secondStarted, firstFailed, secondCompleted], listener, true, "Antigravity", "end_turn");

    Assert.areEqual(JSON.stringify([["call-1", SubAgentStatus.Failed, "Tool execution failed"], ["call-2", SubAgentStatus.Completed, null]]),
      JSON.stringify(["call-1", "call-2"].map(id => AcpSubAgentsTests.rows(listener).filter(t => t["toolUseId"] === id).at(-1))
        .map(t => [t?.["toolUseId"], t?.[Resources.statusField], t?.[Resources.summaryField]])));
  }

  @TestMethod
  public async leavesTheNextAntigravitySubAgentRunningWhenAFailedStartCallIsUpdatedAgain(): Promise<void> {
    const listener = new RecordingTurnListener();
    const [started, failed] = AcpSubAgentsTests.antigravityStart("s-1", "failed", "Tool execution failed");

    await AcpSubAgentsTests.play([AcpSubAgentsTests.antigravitySpawn("call-1", "missing-type"), AcpSubAgentsTests.antigravitySpawn("call-2", "research"),
      started, failed, failed], listener, false, "Antigravity");

    Assert.areEqual(JSON.stringify([SubAgentStatus.Failed, SubAgentStatus.Running]),
      JSON.stringify(["call-1", "call-2"].map(id => AcpSubAgentsTests.rows(listener).filter(t => t["toolUseId"] === id).at(-1)?.[Resources.statusField])));
  }

  @TestMethod
  public readsWhetherAToolCallIsGrokSpawnAndWhichSessionAskedForIt(): void {
    Assert.areEqual("true,false,false,false", [{ _meta: { "x.ai/tool": { name: "spawn_subagent" } } }, { _meta: { "x.ai/tool": { name: "read_file" } } },
      { _meta: { "x.ai/tool": [] } }, {}].map(t => AcpSubAgents.isSpawn(t, "grok")).join(","));
    Assert.areEqual("true,false,false,false,false", [{ kind: "other", rawInput: { agent_type: "explore", prompt: "Read." } },
      { kind: "read", rawInput: { agent_type: "explore", prompt: "Read." } }, { kind: "other", rawInput: { agent_type: " ", prompt: "Read." } },
      { kind: "other", rawInput: { agent_type: "explore" } }, { kind: "other" }].map(t => AcpSubAgents.isSpawn(t, "copilot")).join(","));
    Assert.isFalse(AcpSubAgents.isSpawn({ kind: "other", rawInput: { agent_type: "explore", prompt: "Read." } }, "grok"));
    Assert.areEqual("agent-1,null,null,null", [{ _meta: { "github.com/copilot": { agentId: "agent-1" } } }, { _meta: { "github.com/copilot": { agentId: 1 } } },
      { _meta: { "x.ai/tool": {} } }, {}].map(t => String(AcpSubAgents.agentIdOf(t))).join(","));
    Assert.areEqual("child,null,null", [{ _meta: { "x.ai/requestingSessionId": "child" } }, { _meta: { "x.ai/requestingSessionId": 1 } }, { _meta: null }]
      .map(t => String(AcpSubAgents.requestingSessionOf(t))).join(","));
  }

  @TestMethod
  public async keepsGrokFromAskingToWaitForItsBackgroundSubAgents(): Promise<void> {
    await using host = new GrokTestHost();

    Assert.isNull(host.createAdapter().backgroundSubAgentsNote);
  }

  @TestMethod
  public async keepsABackgroundSubAgentPastItsTurnWakesTheChatWithItsResultAndThenClosesGrok(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const adopted: string[] = [];
    listener.wakeTurn = new WakeTurn({}, false, t => adopted.push(t) > 0);
    const woken = listener.wakeTurn.follow(reply, new AbortController().signal);

    const result = await host.createAdapter().runTurn(new TurnRequest(null, host.directory.path, "background-sub-agent", new RequestedSettings("grok", null, null), null,
      [], null, null, SenderEnvironment.of("first-turn")), listener, new AbortController().signal);
    const during = JSON.stringify([AcpSubAgentsTests.agentOf(listener).status, host.programs.ended.length]);
    await listener.wakeTurn.useToolsAsync(new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, []));
    AcpSubAgentsTests.end(host, {});
    const wake = await woken;
    await host.programs.endedAt(1);

    const agent = AcpSubAgentsTests.agentOf(listener);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([SubAgentStatus.Running, 0]), during);
    Assert.areEqual(JSON.stringify([["grok-child", description, "tool"]]), JSON.stringify(listener.taskStarts.map(t => [t.taskId, t.command, t.subAgentId])));
    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(JSON.stringify([["grok-child", description]]), JSON.stringify(listener.wakes.map(t => [t.taskId, t.command])));
    Assert.areEqual(JSON.stringify([SubAgentStatus.Completed, answer]), JSON.stringify([agent.status, agent.summary]));
    Assert.isTrue(listener.details.some(t => t.parentItemId === "grok-tool-tool" && t.text === answer));
    Assert.areEqual(TurnOutcome.Completed, wake.outcome);
    Assert.isTrue(reply.texts.some(t => t.includes(`The sub-agent answered: ${answer}`)));
    Assert.isFalse(listener.texts.some(t => t.includes("The sub-agent answered")));
    Assert.areEqual(JSON.stringify(["first-turn"]), JSON.stringify(adopted));
  }

  @TestMethod
  @TestData("stop")
  @TestData("cancel")
  public async keepsAKeptSubAgentCompletedWhenAStopRunsWhileItsCompletionIsShown(stopper: string): Promise<void> {
    const listener = new RecordingTurnListener();
    const ended: unknown[] = [];
    const subAgents = new AcpSubAgents(listener, Resources.grokKindId);
    subAgents.keep(() => Promise.resolve(false), wake => ended.push(wake));
    await subAgents.noteToolAsync("tool", "grok-tool-tool", { toolCallId: "tool", kind: "other", status: "pending", rawInput: { description, background: true },
      _meta: { "x.ai/tool": { name: "spawn_subagent" } } }, false);
    await subAgents.handleAsync(Resources.xaiSubAgentSpawned, { child_session_id: "child", subagent_id: "grok-child", subagent_type: "general-purpose", description });
    const held = Promise.withResolvers<void>();
    listener.heldDetail = held.promise;
    const shown = listener.details.length;

    const finishing = subAgents.handleAsync(Resources.xaiSubAgentFinished, { child_session_id: "child", status: "completed", output: answer });
    await Wait.until(() => listener.details.length > shown, "The completion was not shown.");
    await (stopper === "stop" ? listener.taskStarts[0]?.stop() : subAgents.cancelKeptAsync());
    held.resolve();
    await finishing;

    Assert.areEqual(JSON.stringify([SubAgentStatus.Completed, answer]), JSON.stringify([AcpSubAgentsTests.agentOf(listener).status, AcpSubAgentsTests.agentOf(listener).summary]));
    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(1, ended.length);
    Assert.areEqual(1, listener.taskStarts.length);
  }

  @TestMethod
  public async leavesASubAgentThatCompletedWhileTheProcessEndsTheOnesBeforeItCompleted(): Promise<void> {
    const listener = new RecordingTurnListener();
    const subAgents = new AcpSubAgents(listener, Resources.grokKindId);
    const spawn = (id: string): JsonObject => ({ toolCallId: id, kind: "other", status: "pending", rawInput: { description: `Task ${id}` },
      _meta: { "x.ai/tool": { name: "spawn_subagent" } } });
    await subAgents.noteToolAsync("a", "item-a", spawn("a"), false);
    await subAgents.noteToolAsync("b", "item-b", spawn("b"), false);
    const held = Promise.withResolvers<void>();
    listener.heldDetail = held.promise;
    const shown = listener.details.length;

    const ending = subAgents.endAllAsync();
    await Wait.until(() => listener.details.length > shown, "The first sub-agent's end was not shown.");
    await subAgents.noteToolAsync("b", "item-b", { ...spawn("b"), status: "completed", rawOutput: { output: "b done" } }, false);
    held.resolve();
    await ending;

    const rows = (itemId: string): string[] => listener.details.filter(t => t.kind === DetailKind.SubAgent && t.providerItemId === itemId)
      .map(t => SubAgent.fromJson(t.payload)).map(t => `${t.status}:${t.summary}`);
    Assert.areEqual(JSON.stringify([`${SubAgentStatus.Running}:null`, `${SubAgentStatus.Stopped}:null`]), JSON.stringify(rows("item-a")));
    Assert.areEqual(JSON.stringify([`${SubAgentStatus.Running}:null`, `${SubAgentStatus.Completed}:b done`]), JSON.stringify(rows("item-b")));
  }

  @TestMethod
  public async cancelsAKeptSubAgentThroughGrokWhenThePersonStopsTheReplyDuringItsTurn(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const stop = new AbortController();

    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.slowAgentTimings);
    const running = adapter.runTurn(host.request("background-sub-agent-held"), listener, stop.signal);
    await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
    stop.abort();
    await running;
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(SubAgentStatus.Stopped, AcpSubAgentsTests.agentOf(listener).status);
    Assert.areEqual(`_x.ai/subagent/cancel {"subagentId":"grok-child"}\n`, readFileSync(AcpSubAgentsTests.pathOf(host, "sub-agent-cancels.txt"), "utf8"));
    Assert.areEqual(0, listener.wakes.length);
  }

  @TestMethod
  public async cancelsAKeptSubAgentThroughGrokWhenItsChatIsDeleted(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const tasks = new BackgroundTasksService({ publish: () => undefined });

    await host.createAdapter().runTurn(host.request("background-sub-agent"), listener, new AbortController().signal);
    const [start] = listener.taskStarts;
    if (start === undefined)
      throw new Error("Grok started no task.");
    await tasks.startAsync("chat", "reply", "grok", start);
    tasks.forget(["chat"]);
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(SubAgentStatus.Stopped, AcpSubAgentsTests.agentOf(listener).status);
    Assert.areEqual(`_x.ai/subagent/cancel {"subagentId":"grok-child"}\n`, readFileSync(AcpSubAgentsTests.pathOf(host, "sub-agent-cancels.txt"), "utf8"));
    Assert.areEqual(0, listener.wakes.length);
  }

  @TestMethod
  public async endsTheSubAgentAsItsSignalSaysWhenTheFakeSeesTheSignalBeforeItIsWritten(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    await host.createAdapter().runTurn(host.request("background-sub-agent"), listener, new AbortController().signal);
    writeFileSync(AcpSubAgentsTests.pathOf(host, "sub-agent-end.txt"), "");
    await Wait.until(() => existsSync(AcpSubAgentsTests.pathOf(host, "sub-agent-end.txt-seen")), "The fake did not see the sub-agent's end.");
    Assert.isFalse(existsSync(AcpSubAgentsTests.pathOf(host, "sub-agent-end.txt")));
    AcpSubAgentsTests.end(host, { willWake: false });
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(SubAgentStatus.Completed, AcpSubAgentsTests.agentOf(listener).status);
  }

  @TestMethod
  public async closesGrokWithoutAWakeWhenTheSubAgentEndsAndGrokSaysItWillNotWake(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    await host.createAdapter().runTurn(host.request("background-sub-agent"), listener, new AbortController().signal);
    AcpSubAgentsTests.end(host, { status: "failed", willWake: false });
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Failed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(SubAgentStatus.Failed, AcpSubAgentsTests.agentOf(listener).status);
    Assert.areEqual(0, listener.wakes.length);
  }

  @TestMethod
  @TestData("")
  @TestData("missing")
  public async stopsTheSubAgentThroughGrokShowsItStoppedAndThenClosesGrok(cancel: string): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_SUB_AGENT_CANCEL: cancel }).runTurn(host.request("background-sub-agent"), listener,
      new AbortController().signal);
    await listener.taskStarts[0]?.stop();
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(SubAgentStatus.Stopped, AcpSubAgentsTests.agentOf(listener).status);
    Assert.areEqual(`_x.ai/subagent/cancel {"subagentId":"grok-child"}\n`, readFileSync(AcpSubAgentsTests.pathOf(host, "sub-agent-cancels.txt"), "utf8"));
    Assert.areEqual(0, listener.wakes.length);
  }

  @TestMethod
  @TestData("shutdown")
  @TestData("signOut")
  @TestData("exit")
  public async endsTheRunningSubAgentStoppedWhenTheAdapterShutsDownTheProviderSignsOutOrGrokExits(how: string): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const provider = new Provider("a", "grok", "Work", host.directory.resolve("added"), AuthStatus.LoggedIn, null, null, null, null, "t");
    const adapter = host.createAdapter();

    await adapter.runTurn(new TurnRequest(provider, host.directory.path, "background-sub-agent", new RequestedSettings("grok", null, null), null), listener,
      new AbortController().signal);
    if (how === "shutdown")
      await adapter.shutdown();
    else if (how === "signOut")
      await adapter.signOut(provider);
    else
      AcpSubAgentsTests.end(host, { exit: true });
    await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
    await host.programs.endedAt(how === "signOut" ? 2 : 1);

    Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(SubAgentStatus.Stopped, AcpSubAgentsTests.agentOf(listener).status);
    Assert.areEqual(how === "shutdown", existsSync(AcpSubAgentsTests.pathOf(host, "sub-agent-cancels.txt")));
    Assert.areEqual(0, listener.wakes.length);
  }

  @TestMethod
  @Category("ProcessListing")
  @TestData("stopDuringTurn")
  @TestData("stop")
  @TestData("delete")
  @TestData("shutdown")
  @TestData("signOut")
  @TestData("exit")
  public async endsWhatAKeptSubAgentStartedWhenThePersonStopsItOrDeletesItsChatTheAdapterShutsDownTheProviderSignsOutOrGrokExits(how: string): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const provider = new Provider("a", "grok", "Work", host.directory.resolve("added"), AuthStatus.LoggedIn, null, null, null, null, "t");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_SUB_AGENT_TREE: "1" });
    const stop = new AbortController();
    const tree = AcpSubAgentsTests.pathOf(host, "sub-agent-tree.txt");

    const running = adapter.runTurn(new TurnRequest(provider, host.directory.path, how === "stopDuringTurn" ? "background-sub-agent-held" : "background-sub-agent",
      new RequestedSettings("grok", null, null), null), listener, stop.signal);
    try {
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await Wait.until(() => FakeTaskTree.read(tree).length === 1, "The task tree did not get its process.");
      const children = FakeTaskTree.read(tree);
      if (how === "stopDuringTurn")
        stop.abort();
      await running;
      if (how === "stop")
        await listener.taskStarts[0]?.stop();
      else if (how === "delete") {
        const tasks = new BackgroundTasksService({ publish: () => undefined });
        for (const task of listener.taskStarts)
          await tasks.startAsync("chat", "reply", "grok", task);
        tasks.forget(["chat"]);
      }
      else if (how === "shutdown")
        await adapter.shutdown();
      else if (how === "signOut")
        await adapter.signOut(provider);
      else if (how === "exit")
        AcpSubAgentsTests.end(host, { exit: true });
      await host.programs.endedAt(how === "signOut" ? 2 : 1);
      await Wait.until(() => listener.taskEnds.length === 1, `On ${how}, the sub-agent's task did not end.`, Resources.processListTimeout + host.timings.killWait);
      await Wait.until(() => !children.some(t => FakeTaskTree.runs(t)), `On ${how}, the sub-agent's child ${children.join(", ")} still ran.`, Resources.processListTimeout + host.timings.killWait);

      Assert.areEqual(JSON.stringify([["grok-child", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
      Assert.areEqual(SubAgentStatus.Stopped, AcpSubAgentsTests.agentOf(listener).status);
    }
    finally {
      FakeTaskTree.endAll(tree);
    }
  }

  private static copilotUpdate(value: JsonObject): JsonObject {
    return { method: "session/update", params: { update: value } };
  }

  private static copilotSpawn(id: string, mode: string = "sync"): JsonObject {
    return AcpSubAgentsTests.copilotUpdate({ sessionUpdate: "tool_call", toolCallId: id, kind: "other", status: "pending",
      rawInput: { agent_type: "explore", description: `Task ${id}`, prompt: `Do ${id}.`, mode } });
  }

  private static copilotCall(id: string, agentId: string, sessionUpdate: string = "tool_call"): JsonObject {
    return AcpSubAgentsTests.copilotUpdate({ sessionUpdate, toolCallId: id, title: id, kind: "read", status: sessionUpdate === "tool_call" ? "pending" : "completed",
      _meta: { "github.com/copilot": { agentId } } });
  }

  private static copilotEvent(params: JsonObject, method: string = "github.com/copilot/sessionEvent"): JsonObject {
    return { method, params: { timestamp: "2026-10-26T12:00:00.000Z", ...params } };
  }

  private static copilotStarted(toolCallId: string, agentId: string, method: string = "github.com/copilot/sessionEvent", sessionId: string = "copilot-session"): JsonObject {
    return AcpSubAgentsTests.copilotEvent({ sessionId, type: Resources.copilotSubAgentStarted, agentId, data: { toolCallId, agentName: "explore" } }, method);
  }

  private static copilotText(value: string): JsonObject {
    return AcpSubAgentsTests.copilotUpdate({ sessionUpdate: "agent_message_chunk", content: { type: "text", text: value } });
  }

  private static copilotDone(id: string): JsonObject {
    return AcpSubAgentsTests.copilotUpdate({ sessionUpdate: "tool_call_update", toolCallId: id, status: "completed", rawOutput: { content: `${id} done` } });
  }

  private static copilotAsk(toolCallId: string, agentId: string): JsonObject {
    return { id: `ask-${toolCallId}`, method: "session/request_permission", params: { toolCall: { toolCallId, kind: "execute", title: "Run",
      _meta: { "github.com/copilot": { agentId } } }, options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }, { optionId: "deny", name: "Deny", kind: "reject_once" }] } };
  }

  private static async play(messages: readonly JsonObject[], listener: RecordingTurnListener, ends: boolean = true, provider: string = "Grok",
    stopReason: string | null = null): Promise<AcpTurn> {
    const kind = provider.toLowerCase();
    const turn = new AcpTurn(kind, provider, `${provider} tool`, listener, new AbortController().signal, 1);
    await turn.beginAsync(`${kind}-session`, false, new ObservedSettings(kind, null, null, null));
    for (const message of messages) {
      const params = JsonReader.fromValue({ [Resources.sessionIdField]: `${kind}-session`, ...(message["params"] as JsonObject) });
      if (Object.isString(message["id"]))
        await turn.onRequest(message["id"], String(message["method"]), params);
      else
        await turn.onNotificationAsync(String(message["method"]), params);
    }
    if (ends)
      await turn.onResponseAsync(Resources.acpSessionPrompt, Object.isNull(stopReason) ? null : JsonReader.fromValue({ [Resources.acpStopReasonField]: stopReason }));
    return turn;
  }

  private static antigravitySpawn(toolCallId: string, type: string): JsonObject {
    return { method: "session/update", params: { update: { sessionUpdate: "tool_call", toolCallId, title: "Run invoke_subagent?", kind: "other", status: "pending",
      rawInput: { Subagents: [{ Prompt: "say hi", Role: `Role ${toolCallId}`, TypeName: type }] } } } };
  }

  private static antigravityStart(toolCallId: string, status: string, output: string): [JsonObject, JsonObject] {
    return [{ method: "session/update", params: { update: { sessionUpdate: "tool_call", toolCallId, title: "Running start_subagent", kind: "other", status: "in_progress",
      rawInput: {} } } }, { method: "session/update", params: { update: { sessionUpdate: "tool_call_update", toolCallId, status, rawOutput: output } } }];
  }

  private static updateOf(message: JsonObject): JsonObject | undefined {
    return (message["params"] as JsonObject)[Resources.acpUpdateField] as JsonObject | undefined;
  }

  private static kindOf(message: JsonObject): JsonValue | undefined {
    return AcpSubAgentsTests.updateOf(message)?.[Resources.acpSessionUpdateField];
  }

  private static rows(listener: RecordingTurnListener): JsonObject[] {
    return listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => t.payload as JsonObject);
  }

  private static agentOf(listener: RecordingTurnListener): SubAgent {
    const detail = listener.details.filter(t => t.kind === DetailKind.SubAgent && t.providerItemId === "grok-tool-tool").at(-1);
    if (detail === undefined)
      throw new Error("Grok reported no sub-agent.");
    return SubAgent.fromJson(detail.payload);
  }

  private static pathOf(host: GrokTestHost, name: string): string {
    return join(host.directory.resolve("person"), name);
  }

  private static end(host: GrokTestHost, end: object): void {
    writeFileSync(AcpSubAgentsTests.pathOf(host, "sub-agent-end.json"), JSON.stringify(end));
    renameSync(AcpSubAgentsTests.pathOf(host, "sub-agent-end.json"), AcpSubAgentsTests.pathOf(host, "sub-agent-end.txt"));
  }
}
