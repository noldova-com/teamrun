/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { type McpEndpoint, Resources, TeammateCommand, TurnDetail, TurnOutcome, TurnResult, TurnWake, type TurnTools } from "@noldova/teamrun.core";
import {
  ChatMemberModeParams,
  ChatPlanFirstParams,
  ConversationRenameParams,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMemberParams,
  ConversationResponder,
  ConversationResponderParams,
  DetailKind,
  ErrorCode,
  EventName,
  Harness,
  McpToolCallParams,
  McpToolListParams,
  Message,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  MessageStatus,
  ObservedSettings,
  ProviderEnabledParams,
  ReplyPlan,
  RequestedSettings,
  SenderEnvironment,
  type Teammate,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeTurnToolSessions } from "../../fixtures/fake-turn-tool-sessions.fixture.js";

@TestClass
export class McpToolCallsTests {
  private static readonly url: string = "http://127.0.0.1:4711/mcp";
  private static readonly denied: string = JSON.stringify({ content: [{ type: "text", text: `Denied: ${Resources.mcpTokenRefused}` }], isError: true });
  private static readonly stopped: string = JSON.stringify({
    content: [{ type: "text", text: `Unavailable (teamrun.turnStopped): ${Resources.mcpTurnStopped}` }], isError: true
  });
  private static readonly unavailable: string = JSON.stringify({
    content: [{ type: "text", text: `Unavailable (teamrun.noRunningTurn): ${Resources.mcpNoRunningTurn}` }], isError: true
  });

  @TestMethod
  public async givesEachTurnItsOwnToolSessionAndTheApprovedToolsWithNoEndpointWhileNoneServes(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    const alice = await McpToolCallsTests.teammateAsync(host, "Alice");

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice again", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const turns = host.adapter.requests.map(t => t.tools);
    Assert.areEqual(JSON.stringify([`${conversation.id}/${alice.id}`, `${conversation.id}/${alice.id}`]), JSON.stringify(tools.opened.map(t => t.scope)));
    Assert.areEqual(JSON.stringify(["Alice", "Alice"]), JSON.stringify(tools.openings.map(t => t.agentName)));
    Assert.isTrue(tools.opened.every(t => t.ends === 1));
    Assert.areEqual(JSON.stringify([[["teamrun_delete_chat"], null], [["teamrun_delete_chat"], null]]),
      JSON.stringify(turns.map(t => [t?.approvedTools, t?.endpoint ?? null])));
  }

  @TestMethod
  public async marksTheTurnsToolsFailedWithTheErrorWhenListingThemToTheEndpointFails(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const turnTools = host.adapter.requests[0]?.tools;
    const session = tools.opened[0];
    const reply = sent.replies[0];
    if (Object.isNullOrUndefined(turnTools) || Object.isUndefined(session) || Object.isUndefined(reply))
      throw new Error("The turn didn't open its tools.");
    const refused = new Error("The session refused the list.");
    session.listFailure = refused;

    const rejection = await host.engine.listMcpToolsAsync(new McpToolListParams(McpToolCallsTests.tokenOf(turnTools))).then(() => null, (error: unknown) => error);
    const failed = await turnTools.failed;
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();

    Assert.areEqual(refused, rejection);
    Assert.areEqual(refused, failed);
    Assert.isFalse(turnTools.isListed);
  }

  @TestMethod
  public async listsAndCallsTheToolsOfTheMembersRunningTurnUntilItEndsAndMarksTheTurnListedWhenTheEndpointFirstLists(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const token = McpToolCallsTests.tokenOf(host.adapter.requests[0]!.tools!);
    const signal = new AbortController().signal;

    const turnHost = host.adapter.requests[0]!.tools!.host;
    let endpointListed = false;
    void host.adapter.requests[0]!.tools!.listed.then(() => { endpointListed = true; });
    await turnHost.listToolsAsync(signal);
    await Promise.resolve();
    const listedInProcessOnly = endpointListed;
    const listed = await host.engine.listMcpToolsAsync(new McpToolListParams(token));
    await Promise.resolve();
    const caller = new AbortController();
    const called = await host.engine.callMcpToolAsync(new McpToolCallParams(token, "teamrun_list_chats", { project_id: "p1" }), caller.signal);
    const inProcess = await turnHost.callToolAsync("teamrun_list_projects", {}, signal);
    const inProcessListed = await turnHost.listToolsAsync(signal);
    const passed = tools.opened[0]?.calls[0]?.signal;
    const beforeAbort = passed?.aborted;
    caller.abort();
    const followed = [beforeAbort, passed?.aborted];
    await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([{ name: "teamrun_list_chats", description: `${conversation.id}/default` }]), JSON.stringify(listed));
    Assert.isFalse(listedInProcessOnly);
    Assert.isTrue(endpointListed);
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: `${conversation.id}/default teamrun_list_chats` }], isError: false }), JSON.stringify(called));
    Assert.areEqual(JSON.stringify({ project_id: "p1" }), JSON.stringify(tools.opened[0]!.calls[0]!.input));
    Assert.areEqual(JSON.stringify([false, true]), JSON.stringify(followed));
    Assert.areEqual(`${conversation.id}/default teamrun_list_projects`, (inProcess["content"] as Record<string, unknown>[])[0]!["text"]);
    Assert.areEqual(JSON.stringify(listed), JSON.stringify(inProcessListed));
    Assert.areEqual(1, tools.opened[0]!.ends);
    Assert.areEqual(McpToolCallsTests.unavailable, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(token, "teamrun_list_chats", {}))));
    Assert.areEqual(McpToolCallsTests.unavailable, JSON.stringify(await turnHost.callToolAsync("teamrun_list_chats", {}, signal)));
    Assert.areEqual(ErrorCode.Unavailable, (await McpToolCallsTests.rejection(host.engine.listMcpToolsAsync(new McpToolListParams(token)))).info.name);
    Assert.areEqual(ErrorCode.Unavailable, (await McpToolCallsTests.rejection(turnHost.listToolsAsync(signal))).info.name);
    Assert.areEqual(2, tools.opened[0]!.calls.length);
  }

  @TestMethod
  public async givesEachTurnTheEndpointWhoseTokensReachOnlyTheirOwnTurnUntilRevokedOrTheTurnEnds(): Promise<void> {
    const tools = new FakeTurnToolSessions("http://127.0.0.1:4711/mcp");
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const alice = await McpToolCallsTests.teammateAsync(host, "Alice");
    host.adapter.holdUntilAbort = true;
    const toAlice = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.adapter.requested(1);
    const toOther = await host.engine.sendAsync(new MessageSendParams(other.id, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(2);
    const alicesEndpoint = McpToolCallsTests.endpointOf(host, 0);
    const alices = alicesEndpoint.issue();
    const others = McpToolCallsTests.endpointOf(host, 1).issue();

    const accepted = await host.engine.acceptsSessionTokenAsync(alices);
    const called = await host.engine.callMcpToolAsync(new McpToolCallParams(alices, "teamrun_list_chats", {}));
    const listed = await host.engine.listMcpToolsAsync(new McpToolListParams(others));
    alicesEndpoint.revoke(alices);
    const revokedCall = await host.engine.callMcpToolAsync(new McpToolCallParams(alices, "teamrun_list_chats", {}));
    const revokedList = await McpToolCallsTests.rejection(host.engine.listMcpToolsAsync(new McpToolListParams(alices)));
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(toAlice));
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(toOther));
    await host.engine.waitForIdle();

    Assert.areEqual("http://127.0.0.1:4711/mcp", alicesEndpoint.url);
    Assert.areNotEqual(alices, others);
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: `${conversation.id}/${alice.id} teamrun_list_chats` }], isError: false }), JSON.stringify(called));
    Assert.areEqual(JSON.stringify([{ name: "teamrun_list_chats", description: `${other.id}/default` }]), JSON.stringify(listed));
    Assert.isTrue(accepted);
    Assert.isFalse(await host.engine.acceptsSessionTokenAsync(alices));
    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(revokedCall));
    Assert.areEqual(ErrorCode.Unauthorized, revokedList.info.name);
    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(others, "teamrun_list_chats", {}))));
    Assert.isFalse(host.log.lines.some(t => t.includes(alices) || t.includes(others)));
    Assert.isFalse(JSON.stringify(host.adapter.requests.map(t => [t.environment, t.prompt, t.instructions])).includes(others));
  }

  @TestMethod
  public async refusesAKeptOpenProcesssTokenInItsMembersNextTurnAndReachesThatTurnOnlyWithItsOwnToken(): Promise<void> {
    const tools = new FakeTurnToolSessions("http://127.0.0.1:4711/mcp");
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const first = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const kept = McpToolCallsTests.endpointOf(host, 0).issue();
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(first));
    await host.engine.waitForIdle();
    const next = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Again", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(2);
    const own = McpToolCallsTests.endpointOf(host, 1).issue();

    const keptAccepted = await host.engine.acceptsSessionTokenAsync(kept);
    const keptCall = await host.engine.callMcpToolAsync(new McpToolCallParams(kept, "teamrun_list_chats", {}));
    const keptList = await McpToolCallsTests.rejection(host.engine.listMcpToolsAsync(new McpToolListParams(kept)));
    const ownCall = await host.engine.callMcpToolAsync(new McpToolCallParams(own, "teamrun_list_chats", {}));
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(next));
    await host.engine.waitForIdle();

    Assert.isFalse(keptAccepted);
    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(keptCall));
    Assert.areEqual(ErrorCode.Unauthorized, keptList.info.name);
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: `${conversation.id}/default teamrun_list_chats` }], isError: false }), JSON.stringify(ownCall));
    Assert.areEqual("0,1", McpToolCallsTests.callsOf(tools).join(","));
  }

  @TestMethod
  public async refusesAMembersSessionTokenOnceTheMemberIsRemovedAndAddedAgainWhileItsNewTurnRuns(): Promise<void> {
    const tools = new FakeTurnToolSessions("http://127.0.0.1:4711/mcp");
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    const alice = await McpToolCallsTests.teammateAsync(host, "Alice");
    host.adapter.holdUntilAbort = true;
    const first = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.adapter.requested(1);
    const old = McpToolCallsTests.endpointOf(host, 0).issue();
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(first));
    await host.engine.waitForIdle();
    await host.conversations.removeMemberAsync(new ConversationMemberParams(conversation.id, alice.id));
    const back = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice back", null, null, [], [alice.id]));
    await host.adapter.requested(2);

    const oldAccepted = await host.engine.acceptsSessionTokenAsync(old);
    const oldCall = await host.engine.callMcpToolAsync(new McpToolCallParams(old, "teamrun_list_chats", {}));
    const oldList = await McpToolCallsTests.rejection(host.engine.listMcpToolsAsync(new McpToolListParams(old)));
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(back));
    await host.engine.waitForIdle();

    Assert.isFalse(oldAccepted);
    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(oldCall));
    Assert.areEqual(ErrorCode.Unauthorized, oldList.info.name);
    Assert.areEqual("0,0", McpToolCallsTests.callsOf(tools).join(","));
  }

  @TestMethod
  public async refusesAToolThatChangesSomethingOnceTheChatSwitchesItsTeammateToAReadOnlyModeMidTurn(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada tidy", null, null, [], [ada.id]));
    await host.adapter.requested(1);
    const token = McpToolCallsTests.tokenOf(host.adapter.requests[0]!.tools!);
    tools.opened.at(-1)!.listed = [{ name: "teamrun_delete_chat", annotations: { readOnlyHint: false } }];
    const call = async (): Promise<string> => JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(token, "teamrun_delete_chat", {})));

    const before = await call();
    await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, ada.id, "plan"));
    const after = await call();
    await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    await host.engine.waitForIdle();

    Assert.isFalse(before.includes("readOnlyMode"));
    Assert.areEqual(JSON.stringify({
      content: [{ type: "text", text: `Denied (teamrun.readOnlyMode): ${Resources.formatReadOnlyModeRefused("teamrun_delete_chat", "plan")}` }], isError: true
    }), after);
    Assert.areEqual("teamrun_delete_chat", tools.opened[0]!.calls.map(t => t.name).join(","));
  }

  @TestMethod
  public async refusesAToolThatChangesSomethingOnceTheChatsOwnSettingsSwitchToAReadOnlyModeMidTurn(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const provider = (await host.providerOfAsync()).id;
    const choose = async (mode: string): Promise<void> => {
      await host.engine.setResponderAsync(new ConversationResponderParams(conversation.id, new ConversationResponder(null, new RequestedSettings("fake", null, null, null, mode),
        provider), true));
    };
    await choose("ask");
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), provider));
    await host.adapter.requested(1);
    const session = tools.opened.at(-1);
    const reply = sent.replies[0];
    Assert.isDefined(session);
    Assert.isDefined(reply);
    const token = McpToolCallsTests.tokenOf(host.adapter.requests[0]?.tools ?? null);
    session.listed = [{ name: "teamrun_delete_chat", annotations: { readOnlyHint: false } }];
    const call = async (): Promise<string> => JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(token, "teamrun_delete_chat", {})));

    const before = await call();
    await choose("plan");
    const after = await call();
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();

    Assert.isFalse(before.includes("readOnlyMode"));
    Assert.areEqual(JSON.stringify({
      content: [{ type: "text", text: `Denied (teamrun.readOnlyMode): ${Resources.formatReadOnlyModeRefused("teamrun_delete_chat", "plan")}` }], isError: true
    }), after);
    Assert.areEqual("teamrun_delete_chat", session.calls.map(t => t.name).join(","));
  }

  @TestMethod
  public async refusesAToolThatChangesSomethingWhileAReplyPlansFirstAndCallsItInTheUsualModeOnceItsPlanIsApproved(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const requested = host.adapter.requests[0]!.requested;
    const token = McpToolCallsTests.tokenOf(host.adapter.requests[0]!.tools!);
    tools.opened.at(-1)!.listed = [{ name: "teamrun_delete_chat", annotations: { readOnlyHint: false } }];
    const call = async (): Promise<string> => JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(token, "teamrun_delete_chat", {})));

    const planning = await call();
    await host.adapter.lastListener!.onDetailAsync(new TurnDetail(DetailKind.Plan, "Tidy", new ReplyPlan([], null, "# Tidy", false, true).toJson(), "plan-text"));
    const approved = await call();
    const planFirst = (await host.conversations.findAsync(conversation.id))!.plansFirst(null);
    await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify(["ask", true]), JSON.stringify([requested.mode, requested.planFirst]));
    Assert.areEqual(JSON.stringify({
      content: [{ type: "text", text: `Denied (teamrun.readOnlyMode): ${Resources.formatReadOnlyModeRefused("teamrun_delete_chat", "plan")}` }], isError: true
    }), planning);
    Assert.isFalse(approved.includes("readOnlyMode"));
    Assert.isFalse(planFirst);
    Assert.areEqual("teamrun_delete_chat", tools.opened[0]!.calls.map(t => t.name).join(","));
  }

  @TestMethod
  public async stopsPlanningFirstOnlyWhenAPlanFirstReplysPlanIsApprovedAndNeverPlansFirstOnAProviderWithoutAPlanMode(): Promise<void> {
    await using host = await McpToolCallsTests.hostAsync(new FakeTurnToolSessions(McpToolCallsTests.url));
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    await host.conversations.renameAsync(new ConversationRenameParams(conversation.id, "Named"));
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const send = async (plan: JsonValue | null): Promise<string> => {
      host.adapter.extraDetails = Object.isNull(plan) ? [] : [new TurnDetail(DetailKind.Plan, "Tidy", plan, "plan-text")];
      const invalidated = host.listener.count(EventName.StateInvalidated);
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
      return JSON.stringify([host.adapter.requests.at(-1)!.requested.planFirst, (await host.conversations.findAsync(conversation.id))!.plansFirst(null),
        host.listener.count(EventName.StateInvalidated) - invalidated]);
    };

    const refused = await send(new ReplyPlan([], null, "# Tidy", true).toJson());
    const revised = await send(new ReplyPlan([], null, "# Tidy").toJson());
    const malformed = await send({ steps: "none", approved: true });
    const approved = await send(new ReplyPlan([], null, "# Tidy", false, true).toJson());
    const after = await send(null);
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    host.adapter.planMode = null;
    const without = await send(new ReplyPlan([], null, "# Tidy", false, true).toJson());

    Assert.areEqual(JSON.stringify([true, true, 0]), refused);
    Assert.areEqual(JSON.stringify([true, true, 0]), revised);
    Assert.areEqual(JSON.stringify([true, true, 0]), malformed);
    Assert.areEqual(JSON.stringify([true, false, 1]), approved);
    Assert.areEqual(JSON.stringify([false, false, 0]), after);
    Assert.areEqual(JSON.stringify([false, true, 0]), without);
  }

  @TestMethod
  public async takesACompletedPlanFirstReplysFinalAnswerAsItsPlanOnlyWhenItsProviderGaveNoPlanText(): Promise<void> {
    await using host = await McpToolCallsTests.hostAsync(new FakeTurnToolSessions(McpToolCallsTests.url));
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    const send = async (texts: readonly string[], outcome: TurnOutcome = TurnOutcome.Completed, plan: string | null = null): Promise<string> => {
      await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
      host.adapter.detailTexts = texts;
      host.adapter.outcome = outcome;
      host.adapter.error = outcome === TurnOutcome.Failed ? "Stopped short" : null;
      host.adapter.extraDetails = Object.isNull(plan) ? [] : [new TurnDetail(DetailKind.Plan, "Given", new ReplyPlan([], null, plan).toJson(), "plan-text")];
      const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
      const [first] = sent.replies;
      Assert.isDefined(first);
      const reply = await host.messages.findAsync(first.id);
      Assert.isNotNull(reply);
      const plans = reply.details.filter(t => t.kind === DetailKind.Plan);
      return JSON.stringify([plans.length, ReplyPlan.ofDetails(reply.details)?.text ?? null, plans[0]?.text ?? null,
        reply.awaitsPlanApproval(await host.conversations.findAsync(conversation.id))]);
    };

    const answered = await send(["Reading the cache", "# Tidy the cache\n\n1. Drop stale entries."]);
    const given = await send(["Here it is."], TurnOutcome.Completed, "# Given");
    const silent = await send([]);
    const failed = await send(["# Half a plan"], TurnOutcome.Failed);
    const stopped = await send(["# Half a plan"], TurnOutcome.Interrupted);
    host.adapter.planMode = null;
    const usual = await send(["# Tidy the cache"]);

    Assert.areEqual(JSON.stringify([1, "# Tidy the cache\n\n1. Drop stale entries.", "Tidy the cache", true]), answered);
    Assert.areEqual(JSON.stringify([1, "# Given", "Given", true]), given);
    Assert.areEqual(JSON.stringify([0, null, null, false]), silent);
    Assert.areEqual(JSON.stringify([0, null, null, false]), failed);
    Assert.areEqual(JSON.stringify([0, null, null, false]), stopped);
    Assert.areEqual(JSON.stringify([0, null, null, false]), usual);
  }

  @TestMethod
  public async approvesAPlanFirstReplysOpenPlanOnceForItsOwnMemberAndAsksTheSameResponderToGoAheadInItsUsualMode(): Promise<void> {
    await using host = await McpToolCallsTests.hostAsync(new FakeTurnToolSessions(McpToolCallsTests.url));
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    const plan = (): TurnDetail => new TurnDetail(DetailKind.Plan, "Tidy", new ReplyPlan([], null, "# Tidy").toJson(), "plan-text");
    const planned = async (params: MessageSendParams): Promise<string> => {
      await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
      host.adapter.extraDetails = [plan()];
      const sent = await host.engine.sendAsync(params);
      await host.engine.waitForIdle();
      host.adapter.extraDetails = [];
      const [reply] = sent.replies;
      Assert.isDefined(reply);
      return reply.id;
    };
    const approve = async (reply: string): Promise<string> => {
      const invalidated = host.listener.count(EventName.StateInvalidated);
      const followed = await host.engine.approvePlanAsync(new MessageIdParams(reply));
      await host.engine.waitForIdle();
      const stored = await host.messages.findAsync(reply);
      Assert.isNotNull(stored);
      const shown = ReplyPlan.ofDetails(stored.details);
      Assert.isNotNull(shown);
      const [planned, request] = host.adapter.requests.slice(-2);
      Assert.isDefined(planned);
      Assert.isDefined(request);
      const chat = await host.conversations.findAsync(conversation.id);
      Assert.isNotNull(chat);
      return JSON.stringify([shown.text, shown.approved, chat.planFirst, chat.plansFirst(stored.teammateId),
        host.listener.count(EventName.StateInvalidated) - invalidated,
        followed.sent.details[0]?.text, followed.replies.map(t => t.teammateId), request.prompt.includes(Resources.planApprovedPrompt), request.requested.planFirst,
        request.requested.mode === planned.requested.mode]);
    };

    const asked = async (): Promise<MessageSendParams> => new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"),
      (await host.providerOfAsync()).id);
    const first = await planned(await asked());
    const own = await approve(first);
    const teammates = await approve(await planned(new MessageSendParams(conversation.id, "Tidy", null, null, [], [], ada.id)));
    const twice = await McpToolCallsTests.rejection(host.engine.approvePlanAsync(new MessageIdParams(first)));
    const open = await planned(await asked());
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, false));
    const off = await McpToolCallsTests.rejection(host.engine.approvePlanAsync(new MessageIdParams(open)));
    await planned(await asked());
    const superseded = await McpToolCallsTests.rejection(host.engine.approvePlanAsync(new MessageIdParams(open)));
    const missing = await McpToolCallsTests.rejection(host.engine.approvePlanAsync(new MessageIdParams("none")));

    Assert.areEqual(JSON.stringify(["# Tidy", true, true, false, 1, Resources.planApprovedPrompt, [null], true, false, true]), own);
    Assert.areEqual(JSON.stringify(["# Tidy", true, true, false, 1, Resources.planApprovedPrompt, [ada.id], true, false, true]), teammates);
    Assert.areEqual(JSON.stringify([ErrorCode.Conflict, ErrorCode.Conflict, ErrorCode.Conflict, ErrorCode.NotFound]),
      JSON.stringify([twice.info.name, off.info.name, superseded.info.name, missing.info.name]));
    Assert.areEqual(Resources.formatPlanNotAwaitingApproval(open), superseded.message);
  }

  @TestMethod
  public async leavesAPlanWaitingForApprovalWhenItsGoAheadIsRefusedAndApprovesItOnceTheGoAheadCanBeSent(): Promise<void> {
    await using host = await McpToolCallsTests.hostAsync(new FakeTurnToolSessions(McpToolCallsTests.url));
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Plan, "Tidy", new ReplyPlan([], null, "# Tidy").toJson(), "plan-text")];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    host.adapter.extraDetails = [];
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    const state = async (): Promise<string> => {
      const stored = await host.messages.findAsync(reply.id);
      Assert.isNotNull(stored);
      const chat = await host.conversations.findAsync(conversation.id);
      Assert.isNotNull(chat);
      return JSON.stringify([ReplyPlan.ofDetails(stored.details)?.approved, stored.awaitsPlanApproval(chat), chat.plansFirst(null),
        await host.messages.nextSequenceAsync(conversation.id)]);
    };
    const waiting = await state();
    const updated = host.listener.count(EventName.MessageUpdated);
    await host.providers.setEnabledAsync(new ProviderEnabledParams((await host.providerOfAsync()).id, false));

    const refused = await McpToolCallsTests.rejection(host.engine.approvePlanAsync(new MessageIdParams(reply.id)));
    const kept = await state();
    const shown = host.listener.count(EventName.MessageUpdated) - updated;
    await host.providers.setEnabledAsync(new ProviderEnabledParams((await host.providerOfAsync()).id, true));
    const followed = await host.engine.approvePlanAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([false, true, true, reply.sequence + 1]), waiting);
    Assert.areEqual(ErrorCode.Unavailable, refused.info.name);
    Assert.areEqual(waiting, kept);
    Assert.areEqual(0, shown);
    Assert.areEqual(1, followed.replies.length);
    Assert.areEqual(JSON.stringify([true, false, false, reply.sequence + 3]), await state());
  }

  @TestMethod
  public async keepsAPlanApprovedWhenItsGoAheadFailsAfterItWasStored(): Promise<void> {
    await using host = await McpToolCallsTests.hostAsync(new FakeTurnToolSessions(McpToolCallsTests.url));
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Plan, "Tidy", new ReplyPlan([], null, "# Tidy").toJson(), "plan-text")];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    host.adapter.extraDetails = [];
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    const broken = host.events.subscribe({
      onEvent: event => {
        if (event.name === EventName.MessageCreated && Message.fromJson(event.payload).details[0]?.text === Resources.planApprovedPrompt)
          throw new RangeError("The window is gone.");
      }
    });

    const refused = await Assert.throwsAsync(() => host.engine.approvePlanAsync(new MessageIdParams(reply.id)), RangeError);
    broken[Symbol.dispose]();
    await host.engine.waitForIdle();

    const stored = await host.messages.findAsync(reply.id);
    Assert.isNotNull(stored);
    const chat = await host.conversations.findAsync(conversation.id);
    Assert.isNotNull(chat);
    Assert.areEqual("The window is gone.", refused.message);
    Assert.areEqual(JSON.stringify([true, false, false, reply.sequence + 3]), JSON.stringify([ReplyPlan.ofDetails(stored.details)?.approved,
      stored.awaitsPlanApproval(chat), chat.plansFirst(null), await host.messages.nextSequenceAsync(conversation.id)]));
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async plansFirstForEachTeammateUntilItsOwnPlanIsApprovedWhileTheOtherKeepsPlanningFirst(): Promise<void> {
    await using host = await McpToolCallsTests.hostAsync(new FakeTurnToolSessions(McpToolCallsTests.url));
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    const create = async (name: string): Promise<Teammate> =>
      host.teammates.createAsync(new TeammateCreateParams(name, null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    const ada = await create("Ada");
    const bob = await create("Bob");
    for (const teammate of [ada, bob])
      await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, teammate.id));
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const send = async (teammate: Teammate, plan: ReplyPlan | null): Promise<string> => {
      host.adapter.extraDetails = Object.isNull(plan) ? [] : [new TurnDetail(DetailKind.Plan, "Tidy", plan.toJson(), "plan-text")];
      await host.engine.sendAsync(new MessageSendParams(conversation.id, `@${teammate.name} tidy`, null, null, [], [teammate.id]));
      await host.engine.waitForIdle();
      const chat = (await host.conversations.findAsync(conversation.id))!;
      return JSON.stringify([host.adapter.requests.at(-1)!.requested.planFirst, chat.plansFirst(ada.id), chat.plansFirst(bob.id)]);
    };

    const adaApproved = await send(ada, new ReplyPlan([], null, "# Tidy", false, true));
    const bobRefused = await send(bob, new ReplyPlan([], null, "# Tidy", true));
    const adaAfter = await send(ada, null);
    const bobAfter = await send(bob, null);
    const bobApproved = await send(bob, new ReplyPlan([], null, "# Tidy", false, true));
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const rearmed = await send(ada, null);

    Assert.areEqual(JSON.stringify([true, false, true]), adaApproved);
    Assert.areEqual(JSON.stringify([true, false, true]), bobRefused);
    Assert.areEqual(JSON.stringify([false, false, true]), adaAfter);
    Assert.areEqual(JSON.stringify([true, false, true]), bobAfter);
    Assert.areEqual(JSON.stringify([true, false, false]), bobApproved);
    Assert.areEqual(JSON.stringify([true, true, true]), rearmed);
    Assert.isTrue((await host.conversations.findAsync(conversation.id))!.planFirst);
  }

  @TestMethod
  public async keepsPlanFirstAsThePersonLeftItWhenItTurnsOffOrOnMidTurnOrTheReplyStopsBeforeItsPlanIsApprovedAndCountsAPlanApprovedAfterOffAndOn(): Promise<void> {
    await using host = await McpToolCallsTests.hostAsync(new FakeTurnToolSessions(McpToolCallsTests.url));
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    await host.conversations.renameAsync(new ConversationRenameParams(conversation.id, "Named"));
    const approved = new TurnDetail(DetailKind.Plan, "Tidy", new ReplyPlan([], null, "# Tidy", false, true).toJson(), "plan-text");
    const run = async (switched: readonly boolean[], plan: TurnDetail | null): Promise<string> => {
      const count = host.adapter.requests.length;
      const invalidated = host.listener.count(EventName.StateInvalidated);
      const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
      await host.adapter.requested(count + 1);
      for (const planFirst of switched)
        await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, planFirst));
      if (!Object.isNull(plan))
        await host.adapter.lastListener!.onDetailAsync(plan);
      await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
      await host.engine.waitForIdle();
      return JSON.stringify([host.adapter.requests.at(-1)!.requested.planFirst, (await host.conversations.findAsync(conversation.id))!.plansFirst(null),
        host.listener.count(EventName.StateInvalidated) - invalidated]);
    };

    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const stopped = await run([], null);
    const turnedOff = await run([false], approved);
    const turnedOn = await run([true], approved);
    const planning = await run([], null);
    const offAndOn = await run([false, true], approved);

    Assert.areEqual(JSON.stringify([true, true, 0]), stopped);
    Assert.areEqual(JSON.stringify([true, false, 0]), turnedOff);
    Assert.areEqual(JSON.stringify([false, true, 0]), turnedOn);
    Assert.areEqual(JSON.stringify([true, true, 0]), planning);
    Assert.areEqual(JSON.stringify([true, false, 1]), offAndOn);
  }

  @TestMethod
  public async refusesAToolTheSessionDoesntListAsReadOnlyInAReadOnlyModeAndCallsEveryToolInAnotherMode(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const call = async (mode: string, names: readonly string[]): Promise<string[]> => {
      const before = host.adapter.requests.length;
      const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, mode), (await host.providerOfAsync()).id));
      await host.adapter.requested(before + 1);
      const token = McpToolCallsTests.tokenOf(host.adapter.requests.at(-1)!.tools!);
      tools.opened.at(-1)!.listed = [{ name: "teamrun_list_chats", annotations: { readOnlyHint: true } },
        { name: "teamrun_delete_chat", annotations: { readOnlyHint: false } }, { name: "teamrun_rename_chat" }];
      const results: string[] = [];
      for (const name of names)
        results.push(JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(token, name, {}))));
      await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
      await host.engine.waitForIdle();
      return results;
    };
    const refused = (name: string): string => JSON.stringify({
      content: [{ type: "text", text: `Denied (teamrun.readOnlyMode): ${Resources.formatReadOnlyModeRefused(name, "plan")}` }], isError: true
    });

    const planned = await call("plan", ["teamrun_list_chats", "teamrun_delete_chat", "teamrun_rename_chat"]);
    const asked = await call("ask", ["teamrun_delete_chat"]);

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: `${conversation.id}/default teamrun_list_chats` }], isError: false }), planned[0]);
    Assert.areEqual(refused("teamrun_delete_chat"), planned[1]);
    Assert.areEqual(refused("teamrun_rename_chat"), planned[2]);
    Assert.areEqual("teamrun_list_chats", tools.opened[0]!.calls.map(t => t.name).join(","));
    Assert.areEqual("teamrun_delete_chat", tools.opened[1]!.calls.map(t => t.name).join(","));
    Assert.isFalse(asked[0]!.includes("readOnlyMode"));
  }

  @TestMethod
  public async deniesATokenItDidNotIssueAndAMembersKeptTokenOnceItLeavesTheChatOrTheChatIsDeleted(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    const kept = McpToolCallsTests.keptTokens(host);
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const alice = await McpToolCallsTests.teammateAsync(host, "Alice");
    const bob = await McpToolCallsTests.teammateAsync(host, "Bob");
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(other.id, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob look", null, null, [], [bob.id]));
    await host.engine.waitForIdle();
    const [member, defaultMember, bobsMember] = kept;

    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams("not-issued", "teamrun_list_chats", {}))));
    Assert.areEqual(ErrorCode.Unauthorized, (await McpToolCallsTests.rejection(host.engine.listMcpToolsAsync(new McpToolListParams("not-issued")))).info.name);
    Assert.areEqual(McpToolCallsTests.unavailable, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(member!, "teamrun_list_chats", {}))));
    Assert.areEqual(McpToolCallsTests.unavailable, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(defaultMember!, "teamrun_list_chats", {}))));
    await host.conversations.removeMemberAsync(new ConversationMemberParams(conversation.id, alice.id));
    await host.conversations.removeMemberAsync(new ConversationMemberParams(conversation.id, bob.id));
    await host.conversations.deleteAsync(new ConversationIdParams(other.id));
    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(defaultMember!, "teamrun_list_chats", {}))));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice back", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(4, kept.length);
    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(bobsMember!, "teamrun_list_chats", {}))));
    Assert.areEqual(McpToolCallsTests.denied, JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(member!, "teamrun_list_chats", {}))));
    Assert.areEqual(ErrorCode.Unauthorized, (await McpToolCallsTests.rejection(host.engine.listMcpToolsAsync(new McpToolListParams(member!)))).info.name);
  }

  @TestMethod
  public async opensEachTurnsSessionForItsChatInTheChatsWorkFolderItsProjectsRootOrItsOwnFolderWithItsProjectAndItsAgentsName(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await McpToolCallsTests.hostAsync(tools);
    const project = await host.openProjectAsync();
    const inProject = await host.createConversationAsync(project);
    const scratch = await host.conversations.createAsync(new ConversationCreateParams(null, "Scratch"));

    for (const conversation of [inProject, scratch]) {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
    }

    const name = host.registry.get("fake").descriptor.displayName;
    Assert.areEqual(JSON.stringify([{ conversationId: inProject.id, workFolder: project.rootPath, projectId: project.id, agentName: name },
      { conversationId: scratch.id, workFolder: scratch.folder, projectId: null, agentName: name }]), JSON.stringify(tools.openings));
  }

  @TestMethod
  public async opensAWakeTurnsOwnSessionWhichTheEarlierTurnsHostReaches(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const earlier = host.adapter.requests[0]?.tools ?? null;
    Assert.isNotNull(earlier);

    const wake = (await host.adapter.lastListener?.onWakeAsync(new TurnWake("item-1", "npm run dev"))) ?? null;
    Assert.isNotNull(wake);
    await host.until("the wake tools", () => tools.opened.length === 2);
    const called = await earlier.host.callToolAsync("teamrun_list_messages", {}, new AbortController().signal);
    await earlier.host.callToolAsync("teamrun_list_chats", {}, new AbortController().signal);
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: `${conversation.id}/default teamrun_list_messages` }], isError: false }), JSON.stringify(called));
    Assert.areEqual("0,2", McpToolCallsTests.callsOf(tools).join(","));
    Assert.isTrue(tools.opened.every(t => t.ends === 1));
    Assert.areEqual(JSON.stringify([conversation.id, conversation.id]), JSON.stringify(tools.openings.map(t => t.conversationId)));
  }

  @TestMethod
  public async failsAWakesFollowAsNotFoundWhenItsChatIsGoneBeforeItsToolsOpenAndLeavesNoRun(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const findAsync = host.conversations.findAsync.bind(host.conversations);
    const insertAsync = host.messages.insertAsync.bind(host.messages);
    let gone = false;
    host.conversations.findAsync = async (id, transaction) => gone && id === conversation.id ? null : await findAsync(id, transaction);
    host.messages.insertAsync = async (message, transaction): Promise<void> => {
      await insertAsync(message, transaction);
      gone = true;
    };

    await host.adapter.lastListener?.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    await host.engine.waitForIdle();
    host.conversations.findAsync = findAsync;
    host.messages.insertAsync = insertAsync;
    const replies = await host.messages.listAsync(new MessageListParams(conversation.id, null));
    const wake = replies.at(-1);

    Assert.areEqual(3, replies.length);
    Assert.areEqual(MessageStatus.Failed, wake?.status);
    Assert.areEqual(Resources.formatConversationNotFound(conversation.id), wake?.details.at(-1)?.text);
    Assert.areEqual(1, tools.opened.length);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async reachesAFollowingAgentsWakeOverHttpOnceItAdoptsTheProcesssKeptTokenAnswersItAsAMemberWithNoRunningTurnBetweenTurnsAndRefusesAnotherChatsAdoption(): Promise<void> {
    const tools = new FakeTurnToolSessions("http://127.0.0.1:4711/mcp");
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const issued: string[] = [];
    host.adapter.holdTurn = request => {
      issued.push(request.tools?.endpoint?.issueKept() ?? String.empty);
      return Promise.resolve();
    };
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener;
    const [kept] = issued;
    Assert.isNotNull(listener);
    Assert.isDefined(kept);
    host.adapter.holdTurn = null;
    host.adapter.holdUntilAbort = true;
    const elsewhere = await host.engine.sendAsync(new MessageSendParams(other.id, "Look", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(2);
    const adoptedElsewhere = McpToolCallsTests.endpointOf(host, 1).adopt(kept);
    const between = await host.engine.acceptsSessionTokenAsync(kept);
    const betweenCall = JSON.stringify(await host.engine.callMcpToolAsync(new McpToolCallParams(kept, "teamrun_list_messages", {})));
    const betweenList = await McpToolCallsTests.rejection(host.engine.listMcpToolsAsync(new McpToolListParams(kept)));

    const adopted: boolean[] = [];
    const wake = await listener.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    Assert.isNotNull(wake);
    await wake.onToolsAsync(t => {
      adopted.push(t.endpoint?.adopt(kept) ?? false);
      return Promise.resolve();
    });
    await host.until("the wake tools", () => tools.opened.length === 3);
    const called = await host.engine.callMcpToolAsync(new McpToolCallParams(kept, "teamrun_list_messages", {}));
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(elsewhere));
    await host.engine.waitForIdle();

    Assert.isFalse(adoptedElsewhere);
    Assert.isTrue(between);
    Assert.areEqual(McpToolCallsTests.unavailable, betweenCall);
    Assert.areEqual(ErrorCode.Unavailable, betweenList.info.name);
    Assert.areEqual("true", adopted.join(","));
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: `${conversation.id}/default teamrun_list_messages` }], isError: false }), JSON.stringify(called));
    Assert.areEqual("0,0,1", McpToolCallsTests.callsOf(tools).join(","));
    Assert.isTrue(await host.engine.acceptsSessionTokenAsync(kept));
    McpToolCallsTests.endpointOf(host, 0).revoke(kept);
    Assert.isFalse(await host.engine.acceptsSessionTokenAsync(kept));
  }

  @TestMethod
  public async handsTheProcesssKeptTokenBackToItsRunningTurnOnceAWakeThatStartedAheadOfItEnds(): Promise<void> {
    const tools = new FakeTurnToolSessions("http://127.0.0.1:4711/mcp");
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const running = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const kept = McpToolCallsTests.endpointOf(host, 0).issueKept();
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);

    const adopted: boolean[] = [];
    const wake = await listener.onWakeAsync(new TurnWake("item-1", "npm test"));
    Assert.isNotNull(wake);
    await wake.onToolsAsync(t => {
      adopted.push(t.adopt(kept));
      return Promise.resolve();
    });
    await host.until("the wake tools", () => tools.opened.length === 2);
    await host.engine.callMcpToolAsync(new McpToolCallParams(kept, "teamrun_list_messages", {}));
    const duringWake = McpToolCallsTests.callsOf(tools).join(",");
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.until("the ended wake tools", () => tools.opened[1]?.ends === 1);
    const called = await host.engine.callMcpToolAsync(new McpToolCallParams(kept, "teamrun_list_chats", {}));
    const afterWake = McpToolCallsTests.callsOf(tools).join(",");
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(running));
    await host.engine.waitForIdle();

    Assert.areEqual("true", adopted.join(","));
    Assert.areEqual("0,1", duringWake);
    Assert.areEqual("1,1", afterWake);
    Assert.areEqual("teamrun_list_chats", tools.opened[0]?.calls[0]?.name);
    Assert.areEqual(JSON.stringify({ content: [{ type: "text", text: `${conversation.id}/default teamrun_list_chats` }], isError: false }), JSON.stringify(called));
  }

  @TestMethod
  public async bindsAWakeTurnsSessionToItsChatAndTheChatsWorkFolderWithOrWithoutAProject(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await McpToolCallsTests.hostAsync(tools);
    const project = await host.openProjectAsync();
    const inProject = await host.createConversationAsync(project);
    const scratch = await host.conversations.createAsync(new ConversationCreateParams(null, "Scratch"));

    for (const conversation of [inProject, scratch]) {
      await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
      const opened = tools.opened.length;
      const wake = (await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev")))!;
      await host.until("the wake tools", () => tools.opened.length === opened + 1);
      wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
      await host.engine.waitForIdle();
    }

    Assert.areEqual(JSON.stringify([
      { conversationId: inProject.id, workFolder: project.rootPath }, { conversationId: inProject.id, workFolder: project.rootPath },
      { conversationId: scratch.id, workFolder: scratch.folder }, { conversationId: scratch.id, workFolder: scratch.folder }
    ]), JSON.stringify(tools.openings.map(t => ({ conversationId: t.conversationId, workFolder: t.workFolder }))));
  }

  @TestMethod
  public async namesTheToolsInATeammatesInstructionsOnlyWhenTheEngineServesThemAndItsAdapterTakesThem(): Promise<void> {
    const command = (): Promise<TeammateCommand> => Promise.resolve(new TeammateCommand("acme teamrun", { PATH: "/command" }));
    await using withTools = await CoreHost.createAsync(false, false, undefined, undefined, command, new FakeTurnToolSessions());
    await using without = await CoreHost.createAsync(false, false, undefined, undefined, command);
    await using declining = await CoreHost.createAsync(false, false, undefined, undefined, command, new FakeTurnToolSessions());
    declining.adapter.takesTeamRunTools = false;
    for (const host of [withTools, without, declining]) {
      const alice = await McpToolCallsTests.teammateAsync(host, "Alice");
      await host.engine.sendAsync(new MessageSendParams((await host.createConversationAsync()).id, "@Alice look", null, null, [], [alice.id]));
      await host.engine.waitForIdle();
    }

    Assert.areEqual(Resources.formatTeammateInstructions("Alice's role", "acme teamrun", true), withTools.adapter.requests[0]!.instructions);
    Assert.areEqual(Resources.formatTeammateInstructions("Alice's role", "acme teamrun"), without.adapter.requests[0]!.instructions);
    Assert.isNull(without.adapter.requests[0]!.tools);
    Assert.areEqual(Resources.formatTeammateInstructions("Alice's role", "acme teamrun"), declining.adapter.requests[0]!.instructions);
    Assert.areEqual(Resources.formatTeammateInstructions("Alice's role", "acme teamrun"), withTools.adapter.requests[0]!.instructionsWithoutTools);
    Assert.isNull(without.adapter.requests[0]!.instructionsWithoutTools);
    Assert.isNull(declining.adapter.requests[0]!.instructionsWithoutTools);
  }

  @TestMethod
  public async stopsTheTurnOfAStoppedSessionWithItsReasonAndTakesTheNextMessageInANewTurn(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const alice = await McpToolCallsTests.teammateAsync(host, "Alice");

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice wait", null, null, [], [alice.id]));
    const reply = McpToolCallsTests.replyOf(sent);
    await host.until("the running reply", async () => (await host.messages.findAsync(reply.messageId))?.status === MessageStatus.Running, host.runs());
    await host.engine.stopSessionAsync("session-1", "Agent control stopped it.");
    await host.engine.waitForIdle();
    const stopped = await host.messages.findAsync(reply.messageId);
    host.adapter.holdUntilAbort = false;
    const next = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice again", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Cancelled, stopped?.status);
    Assert.areEqual(JSON.stringify([DetailKind.Note, Resources.formatTurnStopped("Agent control stopped it.")]),
      JSON.stringify([stopped?.details.at(-1)?.kind, stopped?.details.at(-1)?.text]));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(McpToolCallsTests.replyOf(next).messageId))?.status);
    Assert.areEqual(JSON.stringify([1, 1]), JSON.stringify(tools.opened.map(t => t.ends)));
  }

  @TestMethod
  public async refusesAStoppedSessionsToolCallsThatArriveBeforeItsTurnEnds(): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const turn = McpToolCallsTests.toolsOf(host, 0);
    const token = McpToolCallsTests.tokenOf(turn);
    const signal = new AbortController().signal;

    const stopping = host.engine.stopSessionAsync("session-1", "The person took over.");
    const called = await host.engine.callMcpToolAsync(new McpToolCallParams(token, "teamrun_list_chats", {}), signal);
    const inProcess = await turn.host.callToolAsync("teamrun_list_projects", {}, signal);
    await stopping;
    await host.engine.waitForIdle();

    Assert.areEqual(McpToolCallsTests.stopped, JSON.stringify(called));
    Assert.areEqual(McpToolCallsTests.stopped, JSON.stringify(inProcess));
    Assert.areEqual(JSON.stringify([0]), JSON.stringify(McpToolCallsTests.callsOf(tools)));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async refusesAToolCallWhoseSessionIsStoppedOrEndsWhileTheCallChecksItsMode(stops: boolean): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null, null, "plan"),
      (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const [session] = tools.opened;
    Assert.isDefined(session);
    const reached = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    session.listed = [{ name: "teamrun_list_chats", annotations: { readOnlyHint: true } }];
    session.listHold = { reached: () => reached.resolve(), released: released.promise };

    const calling = host.engine.callMcpToolAsync(new McpToolCallParams(McpToolCallsTests.tokenOf(McpToolCallsTests.toolsOf(host, 0)), "teamrun_list_chats", {}));
    await reached.promise;
    const stopping = stops ? host.engine.stopSessionAsync(session.id, "The person took over.") : host.engine.cancelAsync(McpToolCallsTests.replyOf(sent));
    if (!stops)
      await host.engine.waitForIdle();
    released.resolve();
    const answer = await calling;
    const ends = session.ends;
    await stopping;
    await host.engine.waitForIdle();

    Assert.areEqual(McpToolCallsTests.stopped, JSON.stringify(answer));
    Assert.areEqual(JSON.stringify([0]), JSON.stringify(McpToolCallsTests.callsOf(tools)));
    Assert.areEqual(JSON.stringify([stops ? 0 : 1, 1]), JSON.stringify([ends, session.ends]));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async withdrawsAToolCallsSignalWhenItsSessionIsStoppedOrItsTurnEnds(stops: boolean): Promise<void> {
    const tools = new FakeTurnToolSessions(McpToolCallsTests.url);
    await using host = await McpToolCallsTests.hostAsync(tools);
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Wait", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);
    const [session] = tools.opened;
    Assert.isDefined(session);
    await host.engine.callMcpToolAsync(new McpToolCallParams(McpToolCallsTests.tokenOf(McpToolCallsTests.toolsOf(host, 0)), "teamrun_list_chats", {}));
    const [call] = session.calls;
    Assert.isDefined(call);
    const before = call.signal.aborted;

    if (stops)
      await host.engine.stopSessionAsync(session.id, "The person took over.");
    else
      await host.engine.cancelAsync(McpToolCallsTests.replyOf(sent));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([false, true]), JSON.stringify([before, call.signal.aborted]));
  }

  @TestMethod
  public async leavesRepliesAsTheyAreWhenTheStoppedSessionIsUnknownOrItsTurnHasEnded(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await McpToolCallsTests.hostAsync(tools);
    const conversation = await host.createConversationAsync();
    const alice = await McpToolCallsTests.teammateAsync(host, "Alice");
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const before = JSON.stringify(await host.messages.findAsync(McpToolCallsTests.replyOf(sent).messageId));

    await host.engine.stopSessionAsync("session-1", "Too late.");
    await host.engine.stopSessionAsync("session-9", "Unknown.");

    Assert.areEqual(before, JSON.stringify(await host.messages.findAsync(McpToolCallsTests.replyOf(sent).messageId)));
    Assert.areEqual(1, tools.opened.length);
  }

  @TestMethod
  public async givesTheSenderTokenOfTheTurnWhoseSessionThisIsOnlyWhileItRuns(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, new FakeTurnToolSessions());
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy the notes", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);

    const running = host.engine.senderTokenOf("session-1");
    const foreign = host.engine.senderTokenOf("session-9");
    await host.engine.cancelAsync(McpToolCallsTests.replyOf(sent));
    await host.engine.waitForIdle();

    Assert.areEqual(SenderEnvironment.read(host.adapter.requests[0]?.environment ?? {}), running);
    Assert.isNotNull(running);
    Assert.isNull(foreign);
    Assert.isNull(host.engine.senderTokenOf("session-1"));
  }

  private static hostAsync(tools: FakeTurnToolSessions): Promise<CoreHost> {
    return CoreHost.createAsync(false, false, undefined, undefined, undefined, tools);
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    return host.teammates.createAsync(new TeammateCreateParams(name, `${name}'s role`, (await host.createProviderAsync("fake", name)).id, Harness.Provider, null, null));
  }

  private static toolsOf(host: CoreHost, index: number): TurnTools {
    const tools = host.adapter.requests[index]?.tools;
    Assert.isDefined(tools);
    Assert.isNotNull(tools);
    return tools;
  }

  private static endpointOf(host: CoreHost, index: number): McpEndpoint {
    const endpoint = McpToolCallsTests.toolsOf(host, index).endpoint;
    Assert.isNotNull(endpoint);
    return endpoint;
  }

  private static replyOf(sent: { readonly replies: readonly { readonly id: string }[] }): MessageIdParams {
    const [reply] = sent.replies;
    Assert.isDefined(reply);
    return new MessageIdParams(reply.id);
  }

  private static callsOf(tools: FakeTurnToolSessions): number[] {
    return tools.opened.map(t => t.calls.length);
  }

  private static tokenOf(tools: TurnTools | null): string {
    const endpoint = tools?.endpoint ?? null;
    Assert.isNotNull(endpoint);
    return endpoint.issueKept();
  }

  private static keptTokens(host: CoreHost): readonly string[] {
    const kept: string[] = [];
    host.adapter.holdTurn = request => {
      kept.push(McpToolCallsTests.tokenOf(request.tools));
      return Promise.resolve();
    };
    return kept;
  }

  private static async rejection(promise: Promise<unknown>): Promise<ServiceException> {
    try {
      await promise;
    }
    catch (error) {
      if (error instanceof ServiceException)
        return error;
      throw error;
    }
    throw new Error("The promise did not reject.");
  }
}
