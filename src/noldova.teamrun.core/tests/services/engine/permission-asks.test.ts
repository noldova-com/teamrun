/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionAnswer, PermissionAsk, QuestionAsk, Resources, type SendAsk, SignInCheck, TurnOutcome, TurnResult, TurnWake } from "@noldova/teamrun.core";
import {
  type Approval,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalQuestion,
  ApprovalStatus,
  AuthStatus,
  ChatMemberModeParams,
  ConversationIdParams,
  ConversationMemberParams,
  ConversationResponder,
  ConversationResponderParams,
  ErrorCode,
  EventName,
  Harness,
  MessageAuthor,
  MessageIdParams,
  MessageListParams,
  MethodName,
  ObservedSettings,
  MessageSendParams,
  MessageStatus,
  ProviderEnabledParams,
  ProviderIdParams,
  QuestionAnswer,
  QuestionOption,
  Request,
  RequestedSettings,
  SenderEnvironment,
  type Teammate,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { ChangeSignal } from "../../fixtures/change-signal.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FailingDelivery } from "../../fixtures/failing-delivery.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";
import { FakeTurnToolSessions } from "../../fixtures/fake-turn-tool-sessions.fixture.js";

@TestClass
export class PermissionAsksTests {
  private static readonly ask: PermissionAsk = new PermissionAsk("notes.deleteItem", "Delete the note Groceries",
    { module: "notes", subject: "item-1", risk: "High", details: [] }, false);
  private static readonly chatAsk: PermissionAsk = new PermissionAsk("computer-use.controlApp", "Control Notepad",
    { module: "computer-use", subject: "notepad", risk: "Medium", details: [] }, true);
  private static readonly lowAsk: PermissionAsk = new PermissionAsk("notes.addItem", "Add the note Groceries",
    { module: "notes", subject: null, risk: "Low", details: [] }, false);
  private static readonly sendAsk: PermissionAsk = new PermissionAsk("teamrun.sendMessage", "Send a message to the chat \"Bugs\"",
    { module: "teamrun", subject: "c2", risk: "Medium", details: [] }, false);

  @TestMethod
  public async asksThePersonOnTheReplyWhoseTurnOpenedTheSessionAndAllowsOnlyOnAllowOnce(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);
    const signal = new AbortController().signal;

    const allowing = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.ask, signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    const awaiting = (await host.messages.findAsync(reply))?.status;
    await host.engine.decideAsync(new ApprovalDecideParams(asked.id, "allowOnce"));
    const allowed = await allowing;
    const denying = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.ask, signal);
    await host.engine.decideAsync(new ApprovalDecideParams((await PermissionAsksTests.pendingAsync(host, conversation.id)).id, "deny"));
    const denied = await denying;
    const running = (await host.messages.findAsync(reply))?.status;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(reply, asked.messageId);
    Assert.areEqual(ApprovalKind.Permission, asked.kind);
    Assert.areEqual("notes.deleteItem", asked.nativeKind);
    Assert.areEqual("Delete the note Groceries", asked.summary);
    Assert.areEqual(JSON.stringify({ module: "notes", subject: "item-1", risk: "High", details: [] }), JSON.stringify(asked.payload));
    Assert.areEqual("allowOnce,deny", asked.options.map(t => t.id).join(","));
    Assert.areEqual(MessageStatus.AwaitingApproval, awaiting);
    Assert.areEqual(PermissionAnswer.AllowedOnce, allowed);
    Assert.areEqual(PermissionAnswer.Denied, denied);
    Assert.areEqual(MessageStatus.Running, running);
  }

  @TestMethod
  public async offersAllowInThisChatForAnAskTheBaseRemembersForTheChatAndAllowsOnlyOnIt(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);
    const signal = new AbortController().signal;

    const allowing = host.engine.askPermissionAsync("session-1", "computer-use", PermissionAsksTests.chatAsk, signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    await host.engine.decideAsync(new ApprovalDecideParams(asked.id, "allowInChat"));
    const allowed = await allowing;
    const denying = host.engine.askPermissionAsync("session-1", "computer-use", PermissionAsksTests.chatAsk, signal);
    await host.engine.decideAsync(new ApprovalDecideParams((await PermissionAsksTests.pendingAsync(host, conversation.id)).id, "deny"));
    const denied = await denying;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual("allowInChat|Allow in this chat|Approved|Session,deny|Deny|Denied|Once",
      asked.options.map(t => `${t.id}|${t.label}|${t.outcome}|${t.scope}`).join(","));
    Assert.areEqual(PermissionAnswer.AllowedAlways, allowed);
    Assert.areEqual(PermissionAnswer.Denied, denied);
  }

  @TestMethod
  public async offersTheModulesAllowAlwaysLabelBetweenAllowOnceAndDenyAndAnswersItAllowedAlways(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);
    const ask = new PermissionAsk("browser.open", "Open docs.example.com", { module: "browser", subject: "docs.example.com", risk: "Medium", details: [] },
      false, "Allow this site for the project");

    const allowing = host.engine.askPermissionAsync("session-1", "browser", ask, new AbortController().signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    await host.engine.decideAsync(new ApprovalDecideParams(asked.id, "allowAlways"));
    const allowed = await allowing;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual("allowOnce|Allow once|Approved|Once,allowAlways|Allow this site for the project|Approved|Session,deny|Deny|Denied|Once",
      asked.options.map(t => `${t.id}|${t.label}|${t.outcome}|${t.scope}`).join(","));
    Assert.areEqual(PermissionAnswer.AllowedAlways, allowed);
  }

  @TestMethod
  public async offersOnlyTheModulesAllowAlwaysLabelAndDenyForAnAskWithoutAllowOnce(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);
    const ask = new PermissionAsk("browser.navigate", "Open status.example.net", { module: "browser", subject: "status.example.net", risk: "Medium", details: [] },
      false, "Allow this site for the project", null, undefined, false);

    const allowing = host.engine.askPermissionAsync("session-1", "browser", ask, new AbortController().signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    await host.engine.decideAsync(new ApprovalDecideParams(asked.id, "allowAlways"));
    const allowed = await allowing;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual("allowAlways|Allow this site for the project|Approved|Session,deny|Deny|Denied|Once",
      asked.options.map(t => `${t.id}|${t.label}|${t.outcome}|${t.scope}`).join(","));
    Assert.areEqual(PermissionAnswer.AllowedAlways, allowed);
  }

  @TestMethod
  public async offersTheModulesTakeOverLabelAfterDenyAndAnswersItTakenOverAsADenial(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);
    const ask = new PermissionAsk("browser.type", "Type into Password", { module: "browser", subject: "Password", risk: "High", details: [] },
      false, null, "I'll type it myself");

    const asking = host.engine.askPermissionAsync("session-1", "browser", ask, new AbortController().signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    await host.engine.decideAsync(new ApprovalDecideParams(asked.id, "takeOver"));
    const answer = await asking;
    const decided = await host.approvals.findAsync(asked.id);
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual("allowOnce|Allow once|Approved|Once,deny|Deny|Denied|Once,takeOver|I'll type it myself|Denied|Session",
      asked.options.map(t => `${t.id}|${t.label}|${t.outcome}|${t.scope}`).join(","));
    Assert.areEqual(PermissionAnswer.TakenOver, answer);
    Assert.areEqual(ApprovalStatus.Denied, decided?.status);
  }

  @TestMethod
  public async deniesARequestFromASessionNoRunningTurnOpenedAndLogsIt(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);

    const foreign = await host.engine.askPermissionAsync("session-9", "notes", PermissionAsksTests.ask, new AbortController().signal);
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();
    const ended = await host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.ask, new AbortController().signal);

    Assert.areEqual(PermissionAnswer.Denied, foreign);
    Assert.areEqual(PermissionAnswer.Denied, ended);
    Assert.areEqual(0, (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length);
    Assert.areEqual(2, host.log.lines.filter(t => t === "A permission request for notes.deleteItem from notes came from no running turn, so TeamRun denied it.").length);
  }

  @TestMethod
  public async withdrawsTheApprovalWhenTheRequestEndsAndALateAnswerCountsForNothing(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);
    const expiry = new AbortController();

    const asking = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.ask, expiry.signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    expiry.abort();
    const answer = await asking;
    const late = await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(asked.id, "allowOnce")), ServiceException);
    const running = (await host.messages.findAsync(reply))?.status;
    const aborted = await host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.ask, expiry.signal);
    const pending = (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(PermissionAnswer.Denied, answer);
    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.findAsync(asked.id))?.status);
    Assert.areEqual(ErrorCode.Conflict, late.info.name);
    Assert.areEqual(MessageStatus.Running, running);
    Assert.areEqual(PermissionAnswer.Denied, aborted);
    Assert.areEqual(0, pending);
  }

  @TestMethod
  public async deniesARequestWhoseReplyStopsBeforeThePersonAnswers(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);

    const asking = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.ask, new AbortController().signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    await host.engine.cancelAsync(new MessageIdParams(reply));
    const answer = await asking;
    await host.engine.waitForIdle();

    Assert.areEqual(PermissionAnswer.Denied, answer);
    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.findAsync(asked.id))?.status);
  }

  @TestMethod
  public async allowsARequestBelowHighRiskWithoutAskingInAModeThatAsksForNothingAndStillAsksAtHighRisk(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, "bypass");
    const signal = new AbortController().signal;

    const low = await host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.lowAsk, signal);
    const unasked = (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length;
    const asking = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.ask, signal);
    await host.engine.decideAsync(new ApprovalDecideParams((await PermissionAsksTests.pendingAsync(host, conversation.id)).id, "deny"));
    const high = await asking;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(PermissionAnswer.AllowedOnce, low);
    Assert.areEqual(0, unasked);
    Assert.areEqual(PermissionAnswer.Denied, high);
  }

  @TestMethod
  public async asksBeforeASendInAModeThatAsks(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.allowsSends = false;
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, "ask");

    const asking = host.engine.askPermissionAsync("session-1", "teamrun", PermissionAsksTests.sendAsk, new AbortController().signal);
    const card = await PermissionAsksTests.pendingAsync(host, conversation.id);
    await host.engine.decideAsync(new ApprovalDecideParams(card.id, "allowOnce"));
    const allowed = await asking;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual("teamrun.sendMessage Send a message to the chat \"Bugs\"", `${card.nativeKind} ${card.summary}`);
    Assert.areEqual(PermissionAnswer.AllowedOnce, allowed);
  }

  @TestMethod
  public async sendsWithoutAskingInAModeThatSkipsAsking(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, "bypass");

    const allowed = await host.engine.askPermissionAsync("session-1", "teamrun", PermissionAsksTests.sendAsk, new AbortController().signal);
    const cards = (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(PermissionAnswer.AllowedOnce, allowed);
    Assert.areEqual(0, cards);
  }

  @TestMethod
  public async asksThePersonForAnAskTheBaseRemembersForTheChatEvenInAModeThatAsksForNothing(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, "bypass");

    const asking = host.engine.askPermissionAsync("session-1", "computer-use", PermissionAsksTests.chatAsk, new AbortController().signal);
    const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
    await host.engine.decideAsync(new ApprovalDecideParams(asked.id, "deny"));
    const answer = await asking;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual("allowInChat,deny", asked.options.map(t => t.id).join(","));
    Assert.areEqual(PermissionAnswer.Denied, answer);
  }

  @TestMethod
  public async asksTheNextRequestOnceTheChatSwitchesItsTeammateToAModeThatAsksMidTurn(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, ada.id, "bypass"));
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada tidy the notes", null, null, [], [ada.id]));
    await host.adapter.requested(1);
    const signal = new AbortController().signal;

    const before = await host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.lowAsk, signal);
    await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, ada.id, "ask"));
    const asking = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.lowAsk, signal);
    await host.engine.decideAsync(new ApprovalDecideParams((await PermissionAsksTests.pendingAsync(host, conversation.id)).id, "deny"));
    const after = await asking;
    const reply = sent.replies[0];
    Assert.isDefined(reply);
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();

    Assert.areEqual("bypass", host.adapter.requests[0]?.requested.mode);
    Assert.areEqual(PermissionAnswer.AllowedOnce, before);
    Assert.areEqual(PermissionAnswer.Denied, after);
  }

  @TestMethod
  public async asksTheNextRequestOnceTheChatsOwnSettingsSwitchToAModeThatAsksMidTurnAndNotForAnotherProviderKind(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const other = new FakeProviderAdapter("other");
    other.modeIds = ["ask", "bypass"];
    other.unrestrictedModes = ["bypass"];
    host.registry.register(other);
    const conversation = await host.createConversationAsync();
    const choose = (kind: string, mode: string): Promise<void> =>
      PermissionAsksTests.chooseAsync(host, conversation.id, new ConversationResponder(null, new RequestedSettings(kind, null, null, null, mode)));
    await choose("fake", "bypass");
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, "bypass");
    const signal = new AbortController().signal;

    const before = await host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.lowAsk, signal);
    await choose("other", "ask");
    const otherKind = await PermissionAsksTests.askDenyingAsync(host, conversation.id, "session-1");
    await choose("fake", "ask");
    const asking = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.lowAsk, signal);
    await host.engine.decideAsync(new ApprovalDecideParams((await PermissionAsksTests.pendingAsync(host, conversation.id)).id, "deny"));
    const after = await asking;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual("bypass", host.adapter.requests[0]?.requested.mode);
    Assert.areEqual(PermissionAnswer.AllowedOnce, before);
    Assert.areEqual(PermissionAnswer.AllowedOnce, otherKind);
    Assert.areEqual(PermissionAnswer.Denied, after);
  }

  @TestMethod
  public async keepsAskingWhenATeammateIsChosenAfterTheChatsOwnSettingsSwitchToAModeThatAsksMidTurn(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    const choose = (mode: string): Promise<void> =>
      PermissionAsksTests.chooseAsync(host, conversation.id, new ConversationResponder(null, new RequestedSettings("fake", null, null, null, mode)));
    await choose("bypass");
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, "bypass");
    const signal = new AbortController().signal;

    await choose("ask");
    await PermissionAsksTests.chooseAsync(host, conversation.id, new ConversationResponder(ada.id));
    const asking = host.engine.askPermissionAsync("session-1", "notes", PermissionAsksTests.lowAsk, signal);
    const pending = await PermissionAsksTests.pendingAsync(host, conversation.id);
    if (!Object.isUndefined(pending))
      await host.engine.decideAsync(new ApprovalDecideParams(pending.id, "deny"));
    const answer = await asking;
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(ada.id, (await host.conversations.findAsync(conversation.id))?.responder?.teammateId);
    Assert.isNotNull(pending ?? null);
    Assert.areEqual(PermissionAnswer.Denied, answer);
  }

  @TestMethod
  public async asksInAWakeOfATurnWhoseChatsOwnSettingsSwitchedToAModeThatAsksBeforeATeammateWasChosen(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, tools);
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    const choose = (mode: string): Promise<void> =>
      PermissionAsksTests.chooseAsync(host, conversation.id, new ConversationResponder(null, new RequestedSettings("fake", null, null, null, mode)));
    const turn = Promise.withResolvers<void>();
    host.adapter.holdTurn = () => turn.promise;
    await choose("bypass");
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null, null, "bypass"), (await host.providerOfAsync()).id));
    await host.adapter.requested(1);

    await choose("ask");
    await PermissionAsksTests.chooseAsync(host, conversation.id, new ConversationResponder(ada.id));
    turn.resolve();
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    const wake = await listener.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    Assert.isNotNull(wake);
    await host.until("the wake tools", () => tools.opened.length === 2);
    const session = tools.opened[1];
    Assert.isDefined(session);
    const answer = await PermissionAsksTests.askDenyingAsync(host, conversation.id, session.id);
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    Assert.areEqual("session-2", session.id);
    Assert.areEqual(PermissionAnswer.Denied, answer);
  }

  @TestMethod
  public async letsATeammateRunInItsOwnModeWhileTheChatsOwnSettingsKeepAModeThatAsks(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const ada = await host.teammates.createAsync(new TeammateCreateParams("Ada", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, ada.id));
    await host.conversations.setMemberModeAsync(new ChatMemberModeParams(conversation.id, ada.id, "bypass"));
    await PermissionAsksTests.chooseAsync(host, conversation.id, new ConversationResponder(null, new RequestedSettings("fake", null, null, null, "ask")));
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ada tidy the notes", null, null, [], [ada.id]));
    await host.adapter.requested(1);
    const reply = sent.replies[0];
    Assert.isDefined(reply);

    const answer = await PermissionAsksTests.askDenyingAsync(host, conversation.id, "session-1");
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();

    Assert.areEqual(ada.id, reply.teammateId);
    Assert.areEqual("bypass", host.adapter.requests[0]?.requested.mode);
    Assert.areEqual(PermissionAnswer.AllowedOnce, answer);
  }

  @TestMethod
  public async followsTheModeATurnStartedInOnceTheModesKeptForItsChatAreForgotten(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const choose = (mode: string): Promise<void> =>
      PermissionAsksTests.chooseAsync(host, conversation.id, new ConversationResponder(null, new RequestedSettings("fake", null, null, null, mode)));
    await choose("bypass");
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, "bypass");

    await choose("ask");
    await host.engine.forgetAsync([conversation.id]);
    const answer = await PermissionAsksTests.askDenyingAsync(host, conversation.id, "session-1");
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(PermissionAnswer.AllowedOnce, answer);
  }

  @TestMethod
  public async asksBelowHighRiskInTheModeChosenOrTheDefaultWhenTheyAskForSomething(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const conversation = await host.createConversationAsync();
    const answers: PermissionAnswer[] = [];
    const asked = new Set<string>();
    for (const mode of ["ask", null, "unlisted"]) {
      const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id, mode);
      const session = `session-${host.adapter.requests.length}`;
      const asking = host.engine.askPermissionAsync(session, "notes", PermissionAsksTests.lowAsk, new AbortController().signal);
      const approval = (await PermissionAsksTests.pendingAsync(host, conversation.id)).id;
      asked.add(approval);
      await host.engine.decideAsync(new ApprovalDecideParams(approval, "allowOnce"));
      answers.push(await asking);
      await host.engine.cancelAsync(new MessageIdParams(reply));
      await host.engine.waitForIdle();
    }

    Assert.areEqual("AllowedOnce,AllowedOnce,AllowedOnce", answers.join(","));
    Assert.areEqual(3, asked.size);
  }

  @TestMethod
  public async keepsTheServedCallThatAskedOnItsPendingApprovalAndNoneOnAnAskThatNamesNone(): Promise<void> {
    await using host = await PermissionAsksTests.hostAsync();
    const conversation = await host.createConversationAsync();
    const reply = await PermissionAsksTests.startTurnAsync(host, conversation.id);
    const payloads = [
      { module: "browser", subject: conversation.id, risk: "Medium", details: [], servedTool: "browser_click", servedInput: { ref: "e5", element: "Choose Team" } },
      { module: "browser", subject: conversation.id, risk: "Medium", details: [], servedTool: "browser_click", servedInput: { ref: "e7", element: "Cancel" } },
      { module: "browser", subject: conversation.id, risk: "Medium", details: [] }
    ];

    const pending: unknown[] = [];
    for (const payload of payloads) {
      const asking = host.engine.askPermissionAsync("session-1", "browser", new PermissionAsk("browser.click", "Click", payload, false), new AbortController().signal);
      const asked = await PermissionAsksTests.pendingAsync(host, conversation.id);
      pending.push(asked.payload);
      await host.engine.decideAsync(new ApprovalDecideParams(asked.id, "allowOnce"));
      await asking;
    }
    await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify(payloads), JSON.stringify(pending));
  }

  @TestMethod
  public async asksThroughTheSendingTurnBeforeATokenSendInAModeThatAsksNamingTheChatWhoItStartsAndTheTextThenSendsOnceAllowed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.allowsSends = false;
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project, "Release plan");
    const second = await host.createConversationAsync(project, "Bugs");
    const [bob] = await PermissionAsksTests.teamAsync(host, "Bob");
    Assert.isDefined(bob);
    const turn = await PermissionAsksTests.startTurnAsync(host, first.id);

    const sending = host.engine.sendAsync(PermissionAsksTests.from(host, second.id, "@Bob what changed?", [bob]));
    const card = await PermissionAsksTests.pendingAsync(host, first.id);
    const before = await PermissionAsksTests.chatAsync(host, second.id);
    await host.engine.decideAsync(new ApprovalDecideParams(card.id, Resources.allowOnceOptionId));
    const sent = await sending;
    await PermissionAsksTests.endAsync(host, turn, ...sent.replies.map(t => t.id));

    Assert.areEqual(JSON.stringify(["teamrun.sendMessage", "Send a message to the chat \"Bugs\"", { module: "teamrun", subject: second.id, risk: "Medium",
      details: [{ label: "Chat", kind: "Text", value: "Bugs" }, { label: "Starts", kind: "Text", value: "Bob" },
        { label: "Message", kind: "AgentText", value: "@Bob what changed?" }] }, ["allowOnce", "deny"]]),
    JSON.stringify([card.nativeKind, card.summary, card.payload, card.options.map(t => t.id)]));
    Assert.areEqual(0, before.length);
    Assert.areEqual(bob.id, sent.replies.map(t => t.teammateId).join(","));
  }

  @TestMethod
  public async sendsNothingWhenThePersonDeniesTheSendOrItsWaitEndsByTheRequestOrTheSendingTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.allowsSends = false;
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Bugs");
    const [bob] = await PermissionAsksTests.teamAsync(host, "Bob");
    Assert.isDefined(bob);
    const turn = await PermissionAsksTests.startTurnAsync(host, first.id);
    const params = PermissionAsksTests.from(host, second.id, "@Bob what changed?", [bob]);
    const request = new AbortController();

    const denying = host.engine.sendAsync(params);
    await host.engine.decideAsync(new ApprovalDecideParams((await PermissionAsksTests.pendingAsync(host, first.id)).id, Resources.denyOptionId));
    const denied = await Assert.throwsAsync(() => denying, ServiceException);
    const withdrawing = host.engine.sendAsync(params, request.signal);
    const withdrawnCard = await PermissionAsksTests.pendingAsync(host, first.id);
    request.abort();
    const withdrawn = await Assert.throwsAsync(() => withdrawing, ServiceException);
    const ending = host.engine.sendAsync(params);
    const endedCard = await PermissionAsksTests.pendingAsync(host, first.id);
    await PermissionAsksTests.endAsync(host, turn);
    const ended = await Assert.throwsAsync(() => ending, ServiceException);

    Assert.areEqual(JSON.stringify(Array(3).fill([ErrorCode.Unauthorized, Resources.sendNotAllowed])),
      JSON.stringify([denied, withdrawn, ended].map(t => [t.info.name, t.info.message])));
    const statuses = await Promise.all([withdrawnCard, endedCard].map(async t => (await host.approvals.findAsync(t.id))?.status === ApprovalStatus.Pending));
    Assert.areEqual(JSON.stringify([false, false]), JSON.stringify(statuses));
    Assert.areEqual(0, (await PermissionAsksTests.chatAsync(host, second.id)).length);
  }

  @TestMethod
  public async sendsWithoutAnAskWhenTheSendingTurnsModeIsUnrestricted(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, new FakeTurnToolSessions());
    host.allowsSends = false;
    host.adapter.modeIds = ["ask", "bypass"];
    host.adapter.unrestrictedModes = ["bypass"];
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Bugs");
    const [bob] = await PermissionAsksTests.teamAsync(host, "Bob");
    Assert.isDefined(bob);
    const turn = await PermissionAsksTests.startTurnAsync(host, first.id, "bypass");

    const sent = await host.engine.sendAsync(PermissionAsksTests.from(host, second.id, "@Bob what changed?", [bob]));
    const cards = (await host.approvals.listAsync(new ConversationIdParams(first.id))).length;
    await PermissionAsksTests.endAsync(host, turn, ...sent.replies.map(t => t.id));

    Assert.areEqual(0, cards);
    Assert.areEqual(bob.id, sent.replies.map(t => t.teammateId).join(","));
  }

  @TestMethod
  public async describesWhoATokenSendStartsAsTheSendPicksItWithoutSendingOrAsking(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Bugs");
    const third = await host.createConversationAsync(project, "Docs");
    const fourth = await host.createConversationAsync(project, "Notes");
    const [bob, carol] = await PermissionAsksTests.teamAsync(host, "Bob", "Carol");
    Assert.isDefined(bob);
    Assert.isDefined(carol);
    const [off] = await PermissionAsksTests.teamAsync(host, "Off");
    Assert.isDefined(off);
    const [gone] = await PermissionAsksTests.teamAsync(host, "Gone");
    Assert.isDefined(gone);
    const [out] = await PermissionAsksTests.teamAsync(host, "Out");
    Assert.isDefined(out);
    await host.providers.setEnabledAsync(new ProviderEnabledParams(off.providerId, false));
    await host.providers.deleteAsync(new ProviderIdParams(gone.providerId));
    const usual = host.adapter.signInCheck;
    host.adapter.signInCheck = new SignInCheck(AuthStatus.LoggedOut, null, null, null);
    await host.providers.checkAsync(new ProviderIdParams(out.providerId));
    host.adapter.signInCheck = usual;
    const chosen = new ConversationResponder(null, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
    await host.conversations.setResponderAsync(new ConversationResponderParams(third.id, chosen));
    await host.conversations.setResponderAsync(new ConversationResponderParams(first.id, chosen));
    await host.conversations.addMemberAsync(new ConversationMemberParams(fourth.id, carol.id));
    await host.conversations.setResponderAsync(new ConversationResponderParams(fourth.id, new ConversationResponder(carol.id, null, null)));
    const turn = await PermissionAsksTests.startTurnAsync(host, first.id);
    const cases: readonly [string, string, readonly Teammate[]][] = [[second.id, "@Bob look", [bob]], [second.id, "@Bob and @Carol look", [bob, carol]],
      [second.id, "@Bob, @Off, @Gone and @Out look", [bob, off, gone, out]], [second.id, "@Off look", [off]], [second.id, "Look", []],
      [third.id, "Look", []], [first.id, "Look", []], [fourth.id, "Look", []], ["missing", "Look", []]];

    const described: (SendAsk | null)[] = [];
    for (const [chat, text, mentioned] of cases)
      described.push(await host.engine.describeSendAsync(PermissionAsksTests.from(host, chat, text, mentioned)));
    const messages = await Promise.all([first.id, second.id, third.id, fourth.id].map(async t => (await PermissionAsksTests.chatAsync(host, t)).length));
    const cards = (await host.approvals.listAsync(new ConversationIdParams(first.id))).length;
    await PermissionAsksTests.endAsync(host, turn);

    const none = "No reply: the message only joins the chat";
    Assert.areEqual(JSON.stringify(["Bob", "Bob, Carol", "Bob", none, none, "The chat's default teammate", none, "Carol", null]),
      JSON.stringify(described.map(t => t?.starts ?? null)));
    Assert.areEqual(JSON.stringify([second.id, "Bugs", "Send a message to the chat \"Bugs\""]),
      JSON.stringify([described[0]?.chatId, described[0]?.chatTitle, described[0]?.title]));
    Assert.areEqual(JSON.stringify([2, 0, 0, 0, 0]), JSON.stringify([...messages, cards]));
  }

  @TestMethod
  public async describesATokenSendPastTheHandOffLimitAsStartingNoOne(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => 0);
    host.allowsSends = false;
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Bugs");
    const [bob] = await PermissionAsksTests.teamAsync(host, "Bob");
    Assert.isDefined(bob);
    const turn = await PermissionAsksTests.startTurnAsync(host, first.id);

    const described = await host.engine.describeSendAsync(PermissionAsksTests.from(host, second.id, "@Bob look", [bob]));
    const sending = host.engine.sendAsync(PermissionAsksTests.from(host, second.id, "@Bob look", [bob]));
    const card = await PermissionAsksTests.pendingAsync(host, first.id);
    await host.engine.decideAsync(new ApprovalDecideParams(card.id, Resources.allowOnceOptionId));
    const sent = await sending;
    await PermissionAsksTests.endAsync(host, turn);

    Assert.areEqual("No reply: the chain has reached its hand-off limit", described?.starts);
    Assert.areEqual(described?.starts, (card.payload as { details: { value: string }[] }).details[1]?.value);
    Assert.areEqual(0, sent.replies.length);
  }

  @TestMethod
  public async refusesAsStaleASendWhoseStartsChangedBeforeTheAllowAndSendsAnAllowedOneOnlyWhileItsStartsHolds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.allowsSends = false;
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Bugs");
    const [carol] = await PermissionAsksTests.teamAsync(host, "Carol");
    Assert.isDefined(carol);
    const turn = await PermissionAsksTests.startTurnAsync(host, first.id);
    const params = PermissionAsksTests.from(host, second.id, "Look", []);

    const sending = host.engine.sendAsync(params);
    const card = await PermissionAsksTests.pendingAsync(host, first.id);
    await host.conversations.addMemberAsync(new ConversationMemberParams(second.id, carol.id));
    await host.conversations.setResponderAsync(new ConversationResponderParams(second.id, new ConversationResponder(carol.id, null, null)));
    await host.engine.decideAsync(new ApprovalDecideParams(card.id, Resources.allowOnceOptionId));
    const stale = await Assert.throwsAsync(() => sending, ServiceException);
    const shown = await Assert.throwsAsync(() => host.engine.sendAllowedAsync(params, "No reply: the message only joins the chat"), ServiceException);
    const unasked = await Assert.throwsAsync(() => host.engine.sendAllowedAsync(params, null), ServiceException);
    const messages = (await PermissionAsksTests.chatAsync(host, second.id)).length;
    const allowed = await host.engine.sendAllowedAsync(params, "Carol");
    const cards = PermissionAsksTests.cards(host);
    await PermissionAsksTests.endAsync(host, turn, ...allowed.replies.map(t => t.id));

    Assert.areEqual(JSON.stringify(Array(3).fill([ErrorCode.Conflict, Resources.sendChangedBeforeAllowed])),
      JSON.stringify([stale, shown, unasked].map(t => [t.info.name, t.info.message])));
    Assert.areEqual(0, messages);
    Assert.areEqual(carol.id, allowed.replies.map(t => t.teammateId).join(","));
    Assert.areEqual(1, cards);
  }

  @TestMethod
  public async asksForASendFromAProvidersOwnWakeOnceItsQueuedReplyStartsAndSendsNothingForOneWhoseRequestEndsFirst(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const [alice, bob, carol] = await PermissionAsksTests.teamAsync(host, "Alice", "Bob", "Carol");
    Assert.isDefined(alice);
    Assert.isDefined(bob);
    Assert.isDefined(carol);
    const held = Promise.withResolvers<void>();
    const bobs: { listener: typeof host.adapter.lastListener } = { listener: null };
    host.adapter.afterDetails = () => {
      if (host.adapter.requests.length === 2)
        bobs.listener = host.adapter.lastListener;
    };
    host.adapter.holdTurn = async request => {
      if (request === host.adapter.requests[0])
        await host.engine.sendAsync(new MessageSendParams(second.id, "@Bob @Carol start", null, null, [], [bob.id, carol.id], null,
          SenderEnvironment.read(request.environment)));
      else if (request === host.adapter.requests[2])
        await held.promise;
    };
    await host.engine.sendAsync(new MessageSendParams(first.id, "@Alice ask them", null, null, [], [alice.id]));
    await host.adapter.requested(3);
    const listener = bobs.listener;
    Assert.isNotNull(listener);
    const wake = await listener.onWakeAsync(new TurnWake("task-1", "npm run dev"));
    Assert.isNotNull(wake);
    const params = new MessageSendParams(first.id, "The server is up", null, null, [], [], null, SenderEnvironment.read(wake.environment));
    const stopping = new AbortController();

    const waiting = host.engine.sendAsync(params);
    const leaving = host.engine.sendAsync(params, stopping.signal);
    const late = await Assert.throwsAsync(() => host.engine.sendAsync(params, AbortSignal.abort()), ServiceException);
    stopping.abort();
    const left = await Assert.throwsAsync(() => leaving, ServiceException);
    const before = PermissionAsksTests.cards(host);
    held.resolve();
    const sent = await waiting;
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify(Array(2).fill([ErrorCode.Unauthorized, Resources.sendNotAllowed])),
      JSON.stringify([late, left].map(t => [t.info.name, t.info.message])));
    Assert.areEqual(JSON.stringify([1, 2]), JSON.stringify([before, PermissionAsksTests.cards(host)]));
    Assert.areEqual(bob.id, (await host.messages.findAsync(sent.sent.id))?.sender?.teammateId);
  }

  @TestMethod
  public async letsAFailureThatIsntTheServicesOwnThroughWhenItDescribesASend(): Promise<void> {
    await using host = await CoreHost.createAsync(false, false, undefined, () => {
      throw new Error("The settings can't be read.");
    });
    const project = await host.openProjectAsync();
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project, "Bugs");
    const turn = await PermissionAsksTests.startTurnAsync(host, first.id);

    const failure = await Assert.throwsAsync(() => host.engine.describeSendAsync(PermissionAsksTests.from(host, second.id, "Look", [])), Error);
    await PermissionAsksTests.endAsync(host, turn);

    Assert.areEqual("The settings can't be read.", failure.message);
  }

  @TestMethod
  public async sendsTheAnswersToTwoQuestionsDecidedAtOnceAfterTheirReplyEndedOneAfterTheOther(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const ask = (id: string): QuestionAsk => new QuestionAsk(id, "request_user_input_async",
      [new ApprovalQuestion("0", "", "Which platform?", [new QuestionOption("Web", "")], false, true, false)]);
    const gate = Promise.withResolvers<void>();
    host.adapter.questionPosts = [ask("msg-1"), ask("msg-2")];
    host.adapter.holdTurn = () => host.adapter.requests.length === 1 ? gate.promise : Promise.resolve();
    await host.engine.sendAsync(new MessageSendParams(chat.id, "Ask me", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.until("the posted questions", async () => (await host.approvals.listAsync(new ConversationIdParams(chat.id))).length === 2);
    host.adapter.questionPosts = [];
    gate.resolve();
    await host.engine.waitForIdle();
    const questions = await host.approvals.listAsync(new ConversationIdParams(chat.id));
    const notSent = Resources.formatQuestionReplyNotSent(chat.id, "ServiceException");

    await Promise.all(questions.map(t => host.engine.decideAsync(new ApprovalDecideParams(t.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]))));
    await host.until("both answers sent or one refused", () => host.adapter.requests.length === 3 || host.log.lines.includes(notSent));
    await host.engine.waitForIdle();
    const people = (await host.messages.listAsync(new MessageListParams(chat.id, null))).filter(t => t.author === MessageAuthor.User).map(t => t.details[0]?.text);

    Assert.areEqual(2, questions.length);
    Assert.areEqual(0, host.log.lines.filter(t => t === notSent).length, host.log.lines.join("\n"));
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.areEqual("Ask me|> Which platform?\n\nWeb|> Which platform?\n\nWeb", people.join("|"));
  }

  @TestMethod
  public async sendsAnAnswerHeldBehindASendThatFailsOnceThatSendsRepliesAreFailed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const chat = await host.createConversationAsync();
    const send = async (text: string): Promise<MessageSendParams> =>
      new MessageSendParams(chat.id, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
    host.adapter.questionPosts = [new QuestionAsk("msg-1", "request_user_input_async",
      [new ApprovalQuestion("0", "", "Which platform?", [new QuestionOption("Web", "")], false, true, false)])];
    await host.engine.sendAsync(await send("Ask me"));
    await host.until("the posted question", async () => (await host.approvals.listAsync(new ConversationIdParams(chat.id))).length === 1);
    await host.engine.waitForIdle();
    host.adapter.questionPosts = [];
    const questions = await host.approvals.listAsync(new ConversationIdParams(chat.id));
    const failure = new RangeError("The window is gone.");
    const answered: Approval[] = [];
    let breaking = true;
    let answering = false;
    using _breaker = FailingDelivery.on(host.events, {
      onEvent: event => {
        if (breaking && event.name === EventName.MessageCreated) {
          breaking = false;
          answering = true;
          throw failure;
        }
      }
    });
    const connection = host.context.database.connection;
    const runInTransactionAsync = connection.runInTransactionAsync.bind(connection);
    connection.runInTransactionAsync = async work => {
      if (answering) {
        answering = false;
        for (const question of questions)
          answered.push(await host.engine.decideAsync(new ApprovalDecideParams(question.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)])));
      }
      return await runInTransactionAsync(work);
    };

    const error = await host.engine.sendAsync(await send("Again")).then(() => null, (t: unknown) => t);
    await host.engine.waitForIdle();
    const people = (await host.messages.listAsync(new MessageListParams(chat.id, null))).filter(t => t.author === MessageAuthor.User).map(t => t.details[0]?.text);

    Assert.isTrue(error === failure);
    Assert.areEqual(JSON.stringify([{ replyTo: "msg-1", answerUnsent: true }]), JSON.stringify(answered.map(t => t.payload)));
    Assert.areEqual("Ask me|Again|> Which platform?\n\nWeb", people.join("|"));
    Assert.areEqual(0, (await host.approvals.listUnsentAnswersAsync()).length);
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const replies = (await host.messages.listAsync(new MessageListParams(chat.id, null))).filter(t => t.author !== MessageAuthor.User);
    Assert.areEqual(`${MessageStatus.Completed}|${MessageStatus.Failed}|${MessageStatus.Completed}`, replies.map(t => t.status).join("|"), host.log.lines.join("\n"));
  }

  private static hostAsync(): Promise<CoreHost> {
    return CoreHost.createAsync(false, false, undefined, undefined, undefined, new FakeTurnToolSessions());
  }

  private static async startTurnAsync(host: CoreHost, conversationId: string, mode: string | null = null): Promise<string> {
    host.adapter.holdUntilAbort = true;
    const before = host.adapter.requests.length;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversationId, "Tidy the notes", new RequestedSettings("fake", null, null, null, mode),
      (await host.providerOfAsync()).id));
    await host.adapter.requested(before + 1);
    const reply = sent.replies[0];
    Assert.isDefined(reply);
    return reply.id;
  }

  private static async chooseAsync(host: CoreHost, conversationId: string, responder: ConversationResponder): Promise<void> {
    const response = await host.dispatcher.dispatch(new Request("choose", MethodName.ConversationResponderSet,
      new ConversationResponderParams(conversationId, responder, true).toJson()));
    Assert.isFalse(response.hasErrors);
  }

  private static async askDenyingAsync(host: CoreHost, conversationId: string, session: string): Promise<PermissionAnswer> {
    const answered = { done: false };
    const asking = host.engine.askPermissionAsync(session, "notes", PermissionAsksTests.lowAsk, new AbortController().signal).finally(() => {
      answered.done = true;
      ChangeSignal.notify();
    });
    await host.until("the ask's card or answer", async () => !Object.isUndefined(await PermissionAsksTests.findPendingAsync(host, conversationId)) || answered.done);
    const pending = await PermissionAsksTests.findPendingAsync(host, conversationId);
    if (!Object.isUndefined(pending))
      await host.engine.decideAsync(new ApprovalDecideParams(pending.id, "deny"));
    return await asking;
  }

  private static async findPendingAsync(host: CoreHost, conversationId: string): Promise<Approval | undefined> {
    return (await host.approvals.listAsync(new ConversationIdParams(conversationId))).find(t => t.status === ApprovalStatus.Pending);
  }

  private static async pendingAsync(host: CoreHost, conversationId: string): Promise<Approval> {
    await host.until("the pending approval", async () => !Object.isUndefined(await PermissionAsksTests.findPendingAsync(host, conversationId)));
    const pending = await PermissionAsksTests.findPendingAsync(host, conversationId);
    Assert.isDefined(pending);
    return pending;
  }

  private static cards(host: CoreHost): number {
    return host.listener.events.filter(t => t.name === EventName.ApprovalCreated).length;
  }

  private static async teamAsync(host: CoreHost, ...names: string[]): Promise<Teammate[]> {
    const provider = await host.createProviderAsync("fake", names.join(" "));
    const team: Teammate[] = [];
    for (const name of names)
      team.push(await host.teammates.createAsync(new TeammateCreateParams(name, `${name}'s role`, provider.id, Harness.Provider, null, null)));
    return team;
  }

  private static from(host: CoreHost, targetId: string, text: string, mentioned: readonly Teammate[]): MessageSendParams {
    const token = SenderEnvironment.read(host.adapter.requests.at(-1)?.environment ?? {});
    return new MessageSendParams(targetId, text, null, null, [], mentioned.map(t => t.id), null, token);
  }

  private static async chatAsync(host: CoreHost, conversationId: string): Promise<readonly unknown[]> {
    return await host.messages.listAsync(new MessageListParams(conversationId, null));
  }

  private static async endAsync(host: CoreHost, ...replies: string[]): Promise<void> {
    for (const reply of replies)
      await host.engine.cancelAsync(new MessageIdParams(reply));
    await host.engine.waitForIdle();
  }
}
