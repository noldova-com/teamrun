/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ObservedSettings } from "@noldova/teamrun.protocol";
import { type AppServerClient, CodexItemReader, CodexRequestRouter, CodexSubAgents, CodexTurn, DeltaStream,
  UnsupportedServerRequestException } from "@noldova/teamrun.providers";

import { CodexSubAgentRecording } from "../../fixtures/codex-sub-agent.recording.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";

@TestClass
export class CodexRequestRouterTests {
  @TestMethod
  public async routesByThreadId(): Promise<void> {
    const router = new CodexRequestRouter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("decline");
    const turn = new CodexTurn("t-1", listener, new ObservedSettings("codex", null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));
    const replacement = new CodexTurn("t-1", listener, new ObservedSettings("codex", null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));

    const signal = new AbortController().signal;
    router.register(turn);
    const answer = await router.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-1", itemId: "q" }), signal);
    const decision = await router.handleServerRequest("item/commandExecution/requestApproval", JsonReader.fromValue({ threadId: "t-1", itemId: "c", command: "ls" }), signal);
    const unknownThread = await Assert.throwsAsync(() => router.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({ threadId: "t-9" }), signal), UnsupportedServerRequestException);
    const missingThread = await Assert.throwsAsync(() => router.handleServerRequest("item/tool/requestUserInput", JsonReader.fromValue({}), signal), UnsupportedServerRequestException);
    router.unregister(replacement);
    const stillRegistered = router.activeCount;
    router.unregister(turn);

    Assert.areEqual("{\"answers\":{}}", JSON.stringify(answer));
    Assert.areEqual("{\"decision\":\"decline\"}", JSON.stringify(decision));
    Assert.isTrue(listener.signals[0] === signal);
    Assert.areEqual("item/tool/requestUserInput", unknownThread.method);
    Assert.areEqual("item/tool/requestUserInput", missingThread.method);
    Assert.areEqual(1, stillRegistered);
    Assert.areEqual(0, router.activeCount);
    Assert.areEqual(0, router.all().length);
  }

  @TestMethod
  public async routesAChildThreadsRequestToTheLatestSubAgentsThatFollowItAndElseToOnesWaitingForItsName(): Promise<void> {
    const router = new CodexRequestRouter();
    const threads = new Map<string, JsonObject>();
    const [first, later, waiting] = [new RecordingTurnListener(), new RecordingTurnListener(), new RecordingTurnListener()];
    const earlier = CodexRequestRouterTests.subAgents(first, threads);
    const latest = CodexRequestRouterTests.subAgents(later, threads);
    const unnamed = CodexRequestRouterTests.subAgents(waiting, new Map());
    const signal = new AbortController().signal;
    await CodexRequestRouterTests.replayAsync(earlier, CodexSubAgentRecording.completed.slice(0, 4));
    await CodexRequestRouterTests.replayAsync(latest, [{ method: "item/completed", params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall",
      id: "call-send", tool: "sendInput", status: "completed", senderThreadId: "parent", receiverThreadIds: ["child"], prompt: "Read todo.txt too.", model: null,
      reasoningEffort: null, agentsStates: {} } } }]);
    await CodexRequestRouterTests.replayAsync(unnamed, [{ method: "turn/started", params: { threadId: "late", turn: { id: "late-turn", status: "inProgress" } } }]);
    for (const subAgents of [unnamed, earlier, latest])
      router.follow(subAgents);

    await router.handleServerRequest("item/commandExecution/requestApproval", CodexRequestRouterTests.command("child"), signal);
    const pending = router.handleServerRequest("item/commandExecution/requestApproval", CodexRequestRouterTests.command("late"), signal);
    await CodexRequestRouterTests.replayAsync(unnamed, [{ method: "item/completed", params: { threadId: "parent", turnId: "parent-turn", item: { type: "subAgentActivity",
      model: null, reasoningEffort: null, id: "call-late", kind: "started", agentThreadId: "late", agentPath: "/root/late" } } }]);
    await pending;
    router.unfollow(latest);
    await router.handleServerRequest("item/commandExecution/requestApproval", CodexRequestRouterTests.command("child"), signal);
    router.unfollow(earlier);
    const refused = await Assert.throwsAsync(() => router.handleServerRequest("item/commandExecution/requestApproval", CodexRequestRouterTests.command("child"),
      signal), UnsupportedServerRequestException);

    Assert.areEqual(JSON.stringify([1, 1, 1]), JSON.stringify([first, later, waiting].map(t => t.asks.length)));
    Assert.areEqual(JSON.stringify(["Read notes.txt and reply with its first line.", "Read todo.txt too.", "late"]),
      JSON.stringify([first, later, waiting].map(t => (t.asks[0]!.payload as JsonObject)["subAgent"])));
    Assert.areEqual("item/commandExecution/requestApproval", refused.method);
  }

  @TestMethod
  public async asksAnEarlyChildRequestInTheReplyThatNamesItWhileEveryReplyThatMayFollowItWaits(): Promise<void> {
    const router = new CodexRequestRouter();
    const [older, newer] = [new RecordingTurnListener(), new RecordingTurnListener()];
    older.decisions.push("accept");
    const naming = CodexRequestRouterTests.subAgents(older, new Map());
    const dropping = CodexRequestRouterTests.subAgents(newer, new Map());
    for (const subAgents of [naming, dropping]) {
      await CodexRequestRouterTests.replayAsync(subAgents, [CodexRequestRouterTests.started("child")]);
      router.follow(subAgents);
    }

    const pending = router.handleServerRequest("item/commandExecution/requestApproval", CodexRequestRouterTests.command("child"), new AbortController().signal);
    dropping.finishTurn();
    await CodexRequestRouterTests.replayAsync(naming, [{ method: "item/completed", params: { threadId: "parent", turnId: "parent-turn", item: { type: "subAgentActivity",
      model: null, reasoningEffort: null, id: "call-child", kind: "started", agentThreadId: "child", agentPath: "/root/child" } } }]);

    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(await pending));
    Assert.areEqual(JSON.stringify([1, 0]), JSON.stringify([older, newer].map(t => t.asks.length)));
    Assert.areEqual("child", (older.asks[0]!.payload as JsonObject)["subAgent"]);
  }

  @TestMethod
  public async answersCancelForAChildNoReplyNamedOnceOneOfThemWasStoppedAndElseRefusesIt(): Promise<void> {
    const router = new CodexRequestRouter();
    const listeners = [new RecordingTurnListener(), new RecordingTurnListener(), new RecordingTurnListener()];
    const [stopped, running, alone] = listeners.map(t => CodexRequestRouterTests.subAgents(t, new Map()));
    for (const subAgents of [stopped!, running!, alone!])
      router.follow(subAgents);
    await CodexRequestRouterTests.replayAsync(stopped!, [CodexRequestRouterTests.started("lost")]);
    await CodexRequestRouterTests.replayAsync(running!, [CodexRequestRouterTests.started("lost")]);
    await CodexRequestRouterTests.replayAsync(alone!, [CodexRequestRouterTests.started("unnamed")]);
    const signal = new AbortController().signal;

    await stopped!.stopAll(Promise.resolve());
    const cancelled = router.handleServerRequest("item/commandExecution/requestApproval", CodexRequestRouterTests.command("lost"), signal);
    const refused = Assert.throwsAsync(() => router.handleServerRequest("item/commandExecution/requestApproval", CodexRequestRouterTests.command("unnamed"), signal),
      UnsupportedServerRequestException);
    for (const subAgents of [stopped!, running!, alone!])
      subAgents.finishTurn();

    Assert.areEqual("{\"decision\":\"cancel\"}", JSON.stringify(await cancelled));
    Assert.areEqual("item/commandExecution/requestApproval", (await refused).method);
    Assert.isTrue(listeners.every(t => t.asks.length === 0));
  }

  private static started(threadId: string): JsonObject {
    return { method: "turn/started", params: { threadId, turn: { id: `${threadId}-turn`, status: "inProgress" } } };
  }

  private static subAgents(listener: RecordingTurnListener, threads: Map<string, JsonObject>): CodexSubAgents {
    const client = { request: (): Promise<object> => Promise.resolve({}) } as unknown as AppServerClient;
    const turn = new CodexTurn("parent", listener, new ObservedSettings("codex", null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));
    return new CodexSubAgents(client, turn, threads, listener, new CodexItemReader(), 1000, () => Promise.resolve());
  }

  private static async replayAsync(subAgents: CodexSubAgents, messages: readonly JsonObject[]): Promise<void> {
    for (const message of messages)
      await subAgents.handleNotificationAsync(message["method"] as string, JsonReader.fromValue(message["params"]!));
  }

  private static command(threadId: string): JsonReader {
    return JsonReader.fromValue({ threadId, turnId: `${threadId}-turn`, itemId: "call-cat", command: "cat notes.txt", cwd: "/work", reason: null });
  }
}
