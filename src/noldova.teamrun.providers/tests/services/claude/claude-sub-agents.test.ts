/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnOutcome } from "@noldova/teamrun.core";
import { DetailKind, SubAgent } from "@noldova/teamrun.protocol";
import { ClaudeSubAgents, ClaudeTurn, DeltaStream, Resources } from "@noldova/teamrun.providers";

import { ClaudeSubAgentRecording } from "../../fixtures/claude-sub-agent.recording.js";
import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { FakeClaudeQuery, type FakeQueryStep } from "../../fixtures/fake-claude-query.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { SdkMessages } from "../../fixtures/sdk-messages.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class ClaudeSubAgentsTests {
  @TestMethod
  public knowsTheToolsThatStartASubAgent(): void {
    Assert.areEqual("true|true|false", ["Agent", "Task", "Bash"].map(t => ClaudeSubAgents.isAgentTool(t)).join("|"));
  }

  @TestMethod
  public async startsASubAgentFromItsToolCallAndReportsEachChangeUnderItsItem(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agents = new ClaudeSubAgents();
    const query = new FakeClaudeQuery([]);

    await agents.startAsync("toolu_a", "item-a", { description: "Explore the parser", subagent_type: "Explore", model: "haiku", prompt: "Find it" }, turn, null);
    const matched = await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-a", "toolu_a", false, "Explore the parser", "local_agent"), query);
    await agents.noteModelAsync("toolu_a", "haiku");
    await agents.noteModelAsync("toolu_a", "claude-haiku-5");
    await agents.noteModelAsync("toolu_x", "claude-haiku-5");
    await agents.handleProgressAsync(SdkMessages.taskProgress("s", "task-a", 3, 1200, 4000, "Reading src/parser.ts"));
    await agents.handleProgressAsync(SdkMessages.taskProgress("s", "task-a", 4, 1500, 5000));
    const running = agents.hasRunning;
    const ended = await agents.handleNotificationAsync({ ...SdkMessages.taskNotification("s", "task-a", "completed", "out"),
      usage: { total_tokens: 2000, tool_uses: 5, duration_ms: 6000 } });
    await agents.handleProgressAsync(SdkMessages.taskProgress("s", "task-a", 9, 9, 9));
    const forgotten = [agents.of("toolu_a"), agents.ofTask("task-a")];
    const reported = listener.details.map(t => SubAgent.fromJson(t.payload));

    Assert.isTrue(matched);
    Assert.isTrue(running);
    Assert.isFalse(agents.hasRunning);
    Assert.areEqual("Explore the parser", ended);
    Assert.areEqual("[null,null]", JSON.stringify(forgotten.map(t => t ?? null)));
    Assert.areEqual("SubAgent:item-a:null", [...new Set(listener.details.map(t => `${t.kind}:${t.providerItemId}:${t.parentItemId}`))].join());
    Assert.areEqual(JSON.stringify([
      ["Running", "haiku", null, null, null, null], ["Running", "claude-haiku-5", null, null, null, null],
      ["Running", "claude-haiku-5", 3, 1200, 4000, "Reading src/parser.ts"], ["Running", "claude-haiku-5", 4, 1500, 5000, "Reading src/parser.ts"],
      ["Completed", "claude-haiku-5", 5, 2000, 6000, "Task completed"]]),
    JSON.stringify(reported.map(t => [t.status, t.model, t.toolUses, t.tokens, t.durationMs, t.summary])));
    Assert.areEqual("toolu_a|Explore|Explore the parser|false", `${reported[0]?.toolUseId}|${reported[0]?.type}|${reported[0]?.description}|${reported[0]?.isBackground}`);
  }

  @TestMethod
  public async endsASubAgentByItsToolsResultOrMovesItToTheBackgroundAndStopsTheRestWhenAsked(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agents = new ClaudeSubAgents();
    const query = new FakeClaudeQuery([]);
    await agents.startAsync("toolu_a", "item-a", { description: "One" }, turn, null);
    await agents.startAsync("toolu_b", "item-b", { description: " " }, turn, "item-a");
    await agents.startAsync("toolu_c", "item-c", null, turn, null);
    await agents.startAsync("toolu_d", "item-d", { description: "Four", run_in_background: true }, turn, null);
    await agents.startAsync("toolu_e", "item-e", { description: "Five" }, turn, null);
    await agents.startAsync("toolu_f", "item-f", { description: "Six" }, turn, null);
    await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-a", "toolu_a", false, "One", "local_agent"), query);

    await agents.noteResultAsync("toolu_a", false, { status: "completed", totalToolUseCount: 2, totalTokens: -1, totalDurationMs: 1.5 }, false, "Found it");
    await agents.handleProgressAsync(SdkMessages.taskProgress("s", "task-a", 7, 7, 7));
    await agents.noteResultAsync("toolu_b", true, null, true, "User rejected tool use");
    await agents.noteResultAsync("toolu_c", true, null, false, "Agent type 'x' not found.");
    await agents.noteResultAsync("toolu_f", true, null, false, " ");
    await agents.noteResultAsync("toolu_d", false, { status: "async_launched", agentId: "agent-d" }, false, "Launched");
    await agents.noteResultAsync("toolu_e", false, { status: "async_launched" }, false, " ");
    await agents.noteResultAsync("toolu_e", false, { status: "remote_launched" }, false, String.empty);
    await agents.noteResultAsync("toolu_x", false, { status: "completed" }, false, String.empty);
    const found = [agents.ofTask("agent-d")?.itemId, agents.ofTask(undefined), agents.ofTask("none")];
    const before = listener.details.length;
    await agents.stopAllAsync();
    const stopped = listener.details.length - before;
    const ended = [await agents.handleNotificationAsync(SdkMessages.taskNotification("s", "agent-d", "completed", "out")),
      await agents.handleNotificationAsync(SdkMessages.taskNotification("s", "shell", "completed", "out")),
      await agents.handleNotificationAsync(SdkMessages.taskNotification("s", "agent-d", "completed", "out"))];
    const last = new Map(listener.details.map(t => [t.providerItemId, [t.parentItemId, SubAgent.fromJson(t.payload)] as const]));

    Assert.areEqual(JSON.stringify(["item-d", null, null]), JSON.stringify(found.map(t => t ?? null)));
    Assert.areEqual(2, stopped);
    Assert.areEqual(JSON.stringify(["Four", null, null]), JSON.stringify(ended));
    Assert.areEqual("[null,null,null,null,null,null]", JSON.stringify(["toolu_a", "toolu_b", "toolu_c", "toolu_d", "toolu_e", "toolu_f"].map(t => agents.of(t) ?? null)));
    Assert.areEqual(JSON.stringify([
      ["item-a", null, "One", "Completed", false, 2, null, null], ["item-b", "item-a", "Sub-agent", "Stopped", false, null, null, null],
      ["item-c", null, "Sub-agent", "Failed", false, null, null, null], ["item-d", null, "Four", "Stopped", true, null, null, null],
      ["item-e", null, "Five", "Stopped", true, null, null, null], ["item-f", null, "Six", "Failed", false, null, null, null]]),
    JSON.stringify([...last].map(([id, [parent, t]]) => [id, parent, t.description, t.status, t.isBackground, t.toolUses, t.tokens, t.durationMs])));
    Assert.areEqual(JSON.stringify([null, "Agent type 'x' not found.", null]), JSON.stringify(["item-b", "item-c", "item-f"].map(t => last.get(t)?.[1].summary ?? null)));
  }

  @TestMethod
  public async stopsNoSubAgentWhoseNotificationEndedItWhileItsTaskEndWasBeingTaken(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agents = new ClaudeSubAgents();
    await agents.startAsync("toolu_a", "item-a", { description: "One" }, turn, null);
    await agents.startAsync("toolu_b", "item-b", { description: "Two", run_in_background: true }, turn, null);
    await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-b", "toolu_b", true, "Two", "local_agent"), new FakeClaudeQuery([]));
    const taken = Promise.withResolvers<void>();
    listener.onTaskEndedAsync = end => {
      listener.taskEnds.push(end);
      return taken.promise;
    };

    const notified = agents.handleNotificationAsync(SdkMessages.taskNotification("s", "task-b", "completed", "out"));
    await agents.stopAllAsync();
    taken.resolve();
    await notified;

    Assert.areEqual(JSON.stringify([["item-a", "Stopped"], ["item-b", "Stopped"]]), JSON.stringify(ClaudeSubAgentsTests.endsOf(listener)));
    Assert.areEqual(JSON.stringify([["task-b", "Completed"]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
  }

  @TestMethod
  public async stopsNoSubAgentThatItsNotificationEndedWhileAnEarlierStopWasBeingTaken(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agents = new ClaudeSubAgents();
    await agents.startAsync("toolu_a", "item-a", { description: "One" }, turn, null);
    await agents.startAsync("toolu_b", "item-b", { description: "Two", run_in_background: true }, turn, null);
    await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-b", "toolu_b", true, "Two", "local_agent"), new FakeClaudeQuery([]));
    const taken = Promise.withResolvers<void>();
    listener.heldDetail = taken.promise;

    const stopping = agents.stopAllAsync();
    await agents.handleNotificationAsync(SdkMessages.taskNotification("s", "task-b", "completed", "out"));
    taken.resolve();
    await stopping;

    Assert.areEqual(JSON.stringify([["item-a", "Stopped"], ["item-b", "Completed"]]), JSON.stringify(ClaudeSubAgentsTests.endsOf(listener)));
    Assert.areEqual(JSON.stringify([["task-b", "Completed"]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
  }

  @TestMethod
  public async startsEachSubAgentsTaskForItsReplyWithItsStopAndEndsItOnceWithTheSubAgent(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agents = new ClaudeSubAgents();
    const query = new FakeClaudeQuery([]);
    await agents.startAsync("toolu_a", "item-a", { description: "One" }, turn, null);
    await agents.startAsync("toolu_b", "item-b", { description: "Two", run_in_background: true }, turn, null);
    await agents.startAsync("toolu_c", "item-c", { description: "Three" }, turn, null);
    await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-a", "toolu_a", false, "One", "local_agent"), query);
    await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-a", "toolu_a", false, "One", "local_agent"), query);
    await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-b", "toolu_b", true, "Two", "local_agent"), query);
    await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-c", "toolu_c", false, "Three", "local_agent"), query);

    await listener.taskStarts[1]!.stop();
    await agents.noteResultAsync("toolu_a", false, { status: "completed" }, false, String.empty);
    await agents.handleNotificationAsync(SdkMessages.taskNotification("s", "task-a", "completed", "out"));
    await agents.handleNotificationAsync(SdkMessages.taskNotification("s", "task-b", "stopped", "out"));
    await agents.stopAllAsync();

    Assert.areEqual(JSON.stringify([["task-a", "One", "toolu_a"], ["task-b", "Two", "toolu_b"], ["task-c", "Three", "toolu_c"]]),
      JSON.stringify(listener.taskStarts.map(t => [t.taskId, t.command, t.subAgentId])));
    Assert.areEqual(JSON.stringify(["task-b"]), JSON.stringify(query.stoppedTasks));
    Assert.areEqual(JSON.stringify([["task-a", "Completed"], ["task-b", "Stopped"], ["task-c", "Stopped"]]),
      JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
  }

  @TestMethod
  public async notesADeniedAskUnderTheSubAgentApartForEachToolUse(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agents = new ClaudeSubAgents();
    await agents.startAsync("toolu_a", "item-a", { description: "One", run_in_background: true }, turn, null);
    const entry = agents.of("toolu_a")!;
    const before = listener.details.length;

    await agents.noteUnaskedAsync(entry, "Bash", "toolu_1");
    await agents.noteUnaskedAsync(entry, "Write", "toolu_2");

    Assert.areEqual(JSON.stringify([
      ["Note", Resources.formatClaudeSubAgentUnasked("Bash"), "item-a:toolu_1", "item-a"],
      ["Note", Resources.formatClaudeSubAgentUnasked("Write"), "item-a:toolu_2", "item-a"]]),
    JSON.stringify(listener.details.slice(before).map(t => [t.kind, t.text, t.providerItemId, t.parentItemId])));
  }

  @TestMethod
  public async matchesOnlyASubAgentsTaskAndMovesItToTheBackgroundOnce(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1));
    const agents = new ClaudeSubAgents();
    const query = new FakeClaudeQuery([]);
    await agents.startAsync("toolu_a", "item-a", { description: "One" }, turn, null);
    await agents.startAsync("toolu_b", "item-b", { description: "Two" }, turn, null);

    const matched = [
      await agents.handleStartedAsync(SdkMessages.taskStarted("s", "shell", "toolu_x", true, "npm start"), query),
      await agents.handleStartedAsync(SdkMessages.taskStarted("s", "shell-2", undefined, true, "npm start"), query),
      await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-a", "toolu_a", true, "One", "local_agent"), query),
      await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-a-2", "toolu_a", true, "One", "local_agent"), query),
      await agents.handleStartedAsync(SdkMessages.taskStarted("s", "task-b", "toolu_b", false, "Two", "local_agent"), query),
      await agents.handleUpdatedAsync(SdkMessages.taskUpdated("s", "task-b", false)),
      await agents.handleUpdatedAsync(SdkMessages.taskUpdated("s", "task-b", true)),
      await agents.handleUpdatedAsync(SdkMessages.taskUpdated("s", "task-b", true)),
      await agents.handleUpdatedAsync(SdkMessages.taskUpdated("s", "shell", true))];

    Assert.areEqual("false,false,true,true,true,true,true,true,false", matched.join());
    Assert.areEqual("item-a:false,item-b:false,item-a:true,item-b:true",
      listener.details.map(t => `${t.providerItemId}:${SubAgent.fromJson(t.payload).isBackground}`).join());
  }

  @TestMethod
  public async keepsATaskASubAgentOwnsFromTheChatUntilItEnds(): Promise<void> {
    const agents = new ClaudeSubAgents();
    const query = new FakeClaudeQuery([]);
    const owned = { ...SdkMessages.taskStarted("s", "shell", "toolu_x", true, "sleep 20"), owned_by_subagent: true };
    const notOwned = { ...SdkMessages.taskStarted("s", "shell-2", "toolu_y", true, "npm start"), owned_by_subagent: false };

    const matched = [
      await agents.handleStartedAsync(owned, query),
      await agents.handleStartedAsync(notOwned, query),
      await agents.handleUpdatedAsync(SdkMessages.taskUpdated("s", "shell", true)),
      agents.endOwnedTask("shell-2"),
      agents.endOwnedTask("shell"),
      agents.endOwnedTask("shell"),
      await agents.handleUpdatedAsync(SdkMessages.taskUpdated("s", "shell", true))];

    Assert.areEqual("true,false,true,false,true,false,false", matched.join());
    Assert.isFalse(agents.hasRunning);
  }

  @TestMethod
  public async showsAClaudeSubAgentFromTheLiveCaptureWithItsTypeModelCountsAndReport(): Promise<void> {
    const [result, rows] = await ClaudeSubAgentsTests.replay(ClaudeSubAgentRecording.completed);
    const last = rows.at(-1);

    Assert.areEqual(TurnOutcome.Completed, result);
    Assert.areEqual(JSON.stringify(["Running", "Completed"]), JSON.stringify([...new Set(rows.map(t => t.status))]));
    Assert.areEqual(JSON.stringify(["toolu_01JqTjMAPBNEqPYKBVWxGYBa", "general-purpose", "Count files in folder", "claude-opus-5-5", false, 1, 12480, 4509]),
      JSON.stringify([last?.toolUseId, last?.type, last?.description, last?.model, last?.isBackground, last?.toolUses, last?.tokens, last?.durationMs]));
    Assert.isTrue(last?.summary?.startsWith("There are **3** regular files directly in `/work`.") ?? false);
  }

  @TestMethod
  public async failsAClaudeSubAgentOfAnUnknownTypeWithClaudeCodesReasonFromTheLiveCapture(): Promise<void> {
    const [result, rows] = await ClaudeSubAgentsTests.replay(ClaudeSubAgentRecording.failed);

    Assert.areEqual(TurnOutcome.Completed, result);
    Assert.areEqual(JSON.stringify([["Running", null], ["Failed",
      "Agent type 'no-such-agent-type-889' not found. Available agents: claude, Explore, general-purpose, Plan, statusline-setup"]]),
    JSON.stringify(rows.map(t => [t.status, t.summary])));
    Assert.areEqual("no-such-agent-type-889|Say hi|null", `${rows.at(-1)?.type}|${rows.at(-1)?.description}|${rows.at(-1)?.toolUses}`);
  }

  @TestMethod
  public async stopsAClaudeSubAgentByItsTaskAndKeepsItsLastCountsFromTheLiveCapture(): Promise<void> {
    const [result, rows, query, listener] = await ClaudeSubAgentsTests.replay(ClaudeSubAgentRecording.stopped,
      async listener => {
        await Wait.until(() => listener.taskStarts.some(t => t.taskId === "addca31bb0eff8f7c"), "The sub-agent's task addca31bb0eff8f7c did not start.");
        await listener.taskStarts.find(t => t.taskId === "addca31bb0eff8f7c")?.stop();
      });
    const last = rows.at(-1);

    Assert.areEqual(TurnOutcome.Completed, result);
    Assert.areEqual(JSON.stringify(["addca31bb0eff8f7c"]), JSON.stringify(query.stoppedTasks));
    Assert.areEqual(JSON.stringify(["addca31bb0eff8f7c"]), JSON.stringify(listener.taskStarts.map(t => t.taskId)));
    Assert.areEqual(1, rows.filter(t => !t.isRunning).length);
    Assert.areEqual(JSON.stringify(["Stopped", 6, 17068, 12591, "Sleep 300 then report done"]),
      JSON.stringify([last?.status, last?.toolUses, last?.tokens, last?.durationMs, last?.summary]));
  }

  @TestMethod
  public async stopsAClaudeSubAgentWithItsTurnWhenTheTurnIsInterruptedFromTheLiveCapture(): Promise<void> {
    const controller = new AbortController();
    const [result, rows, query, listener] = await ClaudeSubAgentsTests.replay(ClaudeSubAgentRecording.interrupted,
      async listener => {
        await Wait.until(() => ClaudeSubAgentsTests.rowsOf(listener).some(t => t.toolUses === 5), "The sub-agent's row did not reach 5 tool uses.");
        controller.abort();
      }, controller);
    const last = rows.at(-1);

    Assert.areEqual(TurnOutcome.Interrupted, result);
    Assert.areEqual(1, query.interruptCount);
    Assert.areEqual(JSON.stringify(["a2dba825497ba7490"]), JSON.stringify(listener.taskStarts.map(t => t.taskId)));
    Assert.areEqual(1, rows.filter(t => !t.isRunning).length);
    Assert.areEqual(JSON.stringify(["Stopped", 5, 16291, 14442, null]), JSON.stringify([last?.status, last?.toolUses, last?.tokens, last?.durationMs, last?.summary]));
  }

  @TestMethod
  public async followsABackgroundClaudeSubAgentPastItsReplyToItsEndAndWakeFromTheLiveCapture(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([...ClaudeSubAgentRecording.background]);
    const listener = new RecordingTurnListener();

    try {
      const result = await adapter.runTurn(host.createRequest("Run sleep 20 in the background"), listener, new AbortController().signal);
      await Wait.until(() => ClaudeSubAgentsTests.rowsOf(listener).some(t => !t.isRunning), "The background sub-agent's row did not end.");
      await Wait.until(() => listener.wakes.length === 1, "The background sub-agent's end did not wake the chat.");
      const rows = ClaudeSubAgentsTests.rowsOf(listener);
      const last = rows.at(-1);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.isTrue(rows.every(t => t.isBackground));
      Assert.areEqual(JSON.stringify(["Completed", "claude-opus-5-5", 1, 10787, 22675, "done"]),
        JSON.stringify([last?.status, last?.model, last?.toolUses, last?.tokens, last?.durationMs, last?.summary]));
      Assert.isTrue(listener.texts.includes("The background sub-agent has started and will run `sleep 20`, then say done."));
      Assert.areEqual(JSON.stringify(["a947d08ffc092c15f"]), JSON.stringify(listener.taskStarts.map(t => t.taskId)));
      Assert.areEqual("a947d08ffc092c15f|Run sleep 20", `${listener.wakes[0]?.taskId}|${listener.wakes[0]?.command}`);
    }
    finally { await adapter.shutdown(); }
  }

  private static async replay(steps: readonly FakeQueryStep[], act: (listener: RecordingTurnListener) => Promise<void> = () => Promise.resolve(),
    controller: AbortController = new AbortController()): Promise<readonly [TurnOutcome, readonly SubAgent[], FakeClaudeQuery, RecordingTurnListener]> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([...steps]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    try {
      const running = adapter.runTurn(host.createRequest("Start a sub-agent"), listener, controller.signal);
      await act(listener);
      const result = await running;
      await Wait.until(() => adapter.activeRunCount === 0, "The chat did not close once its recorded query ended.");
      return [result.outcome, ClaudeSubAgentsTests.rowsOf(listener), query, listener];
    }
    finally { await adapter.shutdown(); }
  }

  private static rowsOf(listener: RecordingTurnListener): readonly SubAgent[] {
    return listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
  }

  private static endsOf(listener: RecordingTurnListener): readonly (readonly [string | null, string])[] {
    return listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => [t.providerItemId, SubAgent.fromJson(t.payload)] as const)
      .filter(([, agent]) => !agent.isRunning).map(([itemId, agent]) => [itemId, agent.status] as const);
  }
}
