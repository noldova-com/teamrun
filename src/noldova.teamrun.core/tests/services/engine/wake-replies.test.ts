/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ServiceException } from "@noldova/teamrun.services";
import { ApprovalAsk, Resources, TaskStart, TurnDetail, TurnOutcome, type TurnRequest, TurnResult, TurnStart, TurnWake } from "@noldova/teamrun.core";
import {
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalScope,
  ChatPlanFirstParams,
  ConversationIdParams,
  ConversationMemberParams,
  ConversationMoveParams,
  DetailKind,
  EventName,
  Harness,
  Message,
  MessageAuthor,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  MessageStatus,
  ObservedSettings,
  ProviderEnabledParams,
  RequestedSettings,
  SenderEnvironment,
  SubAgentWaitParams,
  type Teammate,
  TeammateCreateParams
} from "@noldova/teamrun.protocol";

import { BoundingWork } from "../../fixtures/bounding-work.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";
import { FakeTurnToolSessions } from "../../fixtures/fake-turn-tool-sessions.fixture.js";

@TestClass
export class WakeRepliesTests {
  @TestMethod
  public async showsATurnTheProviderStartsItselfAsANewReplyFromTheSameTeammateMarkedByTheTaskThatEnded(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const alice = await WakeRepliesTests.teammateAsync(host, "Alice");
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start the server", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const reply = (await host.messages.findAsync(sent.replies[0]!.id))!;

    const wake = await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    Assert.isNotNull(wake);
    await wake!.onStartedAsync(new TurnStart("native-1", true, null));
    await wake!.onDetailAsync(new TurnDetail(DetailKind.Text, "The server stopped, so I restarted it.", null, "w-1"));
    wake!.end(new TurnResult(TurnOutcome.Completed, "native-1", new ObservedSettings("fake", "fake-small", null, null), null));
    await host.engine.waitForIdle();

    const woken = await WakeRepliesTests.afterAsync(host, conversation.id, reply.sequence);
    Assert.areEqual(1, woken.length);
    const shown = (await host.messages.findAsync(woken[0]!.id))!;
    Assert.areEqual(MessageAuthor.Provider, shown.author);
    Assert.areEqual(MessageStatus.Completed, shown.status);
    Assert.areEqual(alice.id, shown.teammateId);
    Assert.areEqual("Alice", shown.teammateName);
    Assert.areEqual(reply.id, shown.inReplyTo);
    Assert.areEqual(reply.provenance?.providerId, shown.provenance?.providerId);
    Assert.areEqual(JSON.stringify(reply.provenance?.requested.toJson()), JSON.stringify(shown.provenance?.requested.toJson()));
    Assert.areEqual("native-1", shown.provenance?.nativeSessionId);
    Assert.areEqual(JSON.stringify([
      [DetailKind.Note, "Started when the background task `npm run dev` ended.", { source: "wake", taskId: "item-1", command: "npm run dev" }],
      [DetailKind.Text, "The server stopped, so I restarted it.", null]
    ]), JSON.stringify(shown.details.map(t => [t.kind, t.text, t.payload])));
  }

  @TestMethod
  public async startsNoTurnForAWakeWhoseChatIsForgottenWhileTheWakeIsPrepared(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const alice = await WakeRepliesTests.teammateAsync(host, "Alice");
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start the server", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    const findAsync = host.conversations.findAsync.bind(host.conversations);
    const forgets: string[] = [];
    host.conversations.findAsync = async (id, transaction) => {
      if (forgets.length === 0) {
        forgets.push(id);
        await host.engine.forgetAsync([conversation.id]);
      }
      return findAsync(id, transaction);
    };

    const wake = await listener.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    host.conversations.findAsync = findAsync;
    await host.engine.waitForIdle();

    const [reply] = sent.replies;
    Assert.isDefined(reply);
    Assert.isNull(wake);
    Assert.areEqual(conversation.id, forgets.join());
    Assert.areEqual(0, (await WakeRepliesTests.afterAsync(host, conversation.id, reply.sequence)).length);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async startsNoTurnForAWakeWhoseChatMovesToAnotherProjectWhileTheWakeIsPrepared(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.openProjectAsync("beta");
    const alice = await WakeRepliesTests.teammateAsync(host, "Alice");
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start the server", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    const findAsync = host.providers.findAsync.bind(host.providers);
    const moves: string[] = [];
    host.providers.findAsync = async (id, transaction) => {
      if (moves.length === 0) {
        moves.push(id);
        await host.conversations.moveAsync(new ConversationMoveParams(conversation.id, other.id));
      }
      return findAsync(id, transaction);
    };

    const wake = await listener.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    host.providers.findAsync = findAsync;
    await host.engine.waitForIdle();

    const [reply] = sent.replies;
    Assert.isDefined(reply);
    Assert.isNull(wake);
    Assert.areEqual(1, moves.length);
    Assert.areEqual(other.id, (await host.conversations.findAsync(conversation.id))?.projectId);
    Assert.areEqual(0, (await WakeRepliesTests.afterAsync(host, conversation.id, reply.sequence)).length);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async notesThatTheFolderWasntComparedAfterAWakeReplyThatRanACommand(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    const wake = await host.adapter.lastListener?.onWakeAsync(new TurnWake(null, null)) ?? null;
    await wake?.onDetailAsync(new TurnDetail(DetailKind.Command, "> npm test", { command: "npm test" }, "w-1"));
    wake?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();
    const woken = await WakeRepliesTests.findAllAsync(host, await WakeRepliesTests.afterAsync(host, conversation.id, sent.replies[0]?.sequence ?? 0));

    Assert.areEqual(JSON.stringify([[
      [DetailKind.Note, "Started when a background task ended.", { source: "wake" }],
      [DetailKind.Command, "> npm test", { command: "npm test" }],
      [DetailKind.Note, Resources.uncomparedWorkingTree, { source: Resources.workingTreeSource, changesNote: true, partialEvidence: true }]
    ]]), JSON.stringify(woken.map(t => t?.details.map(u => [u.kind, u.text, u.payload]))));
  }

  @TestMethod
  public async marksAWokenReplyWithoutATaskWhenTheProviderNamesNone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    const wake = await host.adapter.lastListener!.onWakeAsync(new TurnWake(null, null));
    wake!.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    const shown = (await host.messages.findAsync((await WakeRepliesTests.afterAsync(host, conversation.id, sent.replies[0]!.sequence))[0]!.id))!;
    Assert.isNull(shown.teammateId);
    Assert.areEqual(MessageStatus.Completed, shown.status);
    Assert.areEqual(JSON.stringify([[DetailKind.Note, "Started when a background task ended.", { source: "wake" }]]),
      JSON.stringify(shown.details.map(t => [t.kind, t.text, t.payload])));
  }

  @TestMethod
  public async holdsAWakeUpWhileThePersonsReplyRunsAndShowsItAsTheNextReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const alice = await WakeRepliesTests.teammateAsync(host, "Alice");
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start the server", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener!;
    host.adapter.holdUntilAbort = true;
    const running = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice check the logs", null, null, [], [alice.id]));
    const own = running.replies[0]!;
    await host.until("the running reply", async () => (await host.messages.findAsync(own.id))?.status === MessageStatus.Running);

    const wake = await listener.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    await wake!.onDetailAsync(new TurnDetail(DetailKind.Text, "The server stopped.", null, "w-1"));
    wake!.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    const held = await WakeRepliesTests.afterAsync(host, conversation.id, own.sequence);

    Assert.areEqual(1, held.length);
    Assert.areEqual(MessageStatus.Pending, (await host.messages.findAsync(held[0]!.id))?.status);
    Assert.areEqual(1, (await host.messages.findAsync(held[0]!.id))?.details.length);
    Assert.isFalse((await host.messages.findAsync(own.id))!.details.some(t => t.text === "The server stopped."));

    await host.engine.cancelAsync(new MessageIdParams(own.id));
    await host.engine.waitForIdle();

    const shown = (await host.messages.findAsync(held[0]!.id))!;
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(own.id))?.status);
    Assert.areEqual(MessageStatus.Completed, shown.status);
    Assert.areEqual("Started when the background task `npm run dev` ended.|The server stopped.", shown.details.map(t => t.text).join("|"));
    Assert.isTrue(shown.sequence > own.sequence);
  }

  @TestMethod
  public async showsAWakeUpTheProviderRunsAheadOfTheRunningReplyAtOnceWithItsApprovals(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const alice = await WakeRepliesTests.teammateAsync(host, "Alice");
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice run the tests", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    host.adapter.holdUntilAbort = true;
    const running = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice check the logs", null, null, [], [alice.id]));
    const own = running.replies[0]!;
    await host.adapter.requested(2);

    const wake = (await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm test")))!;
    const shown = (await WakeRepliesTests.afterAsync(host, conversation.id, own.sequence))[0]!;
    const answer = wake.onApprovalRequested(new ApprovalAsk("req-1", ApprovalKind.Command, "Bash", "cat test.log", null,
      [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once)]));
    await host.until("the wake approval", async () => (await host.approvals.listPendingAsync(shown.id)).length === 1);

    Assert.areEqual(MessageStatus.AwaitingApproval, (await host.messages.findAsync(shown.id))?.status);
    Assert.areEqual(MessageStatus.Running, (await host.messages.findAsync(own.id))?.status);

    await host.engine.decideAsync(new ApprovalDecideParams((await host.approvals.listPendingAsync(shown.id))[0]!.id, "allow"));
    Assert.areEqual("allow", await answer);
    await wake.onDetailAsync(new TurnDetail(DetailKind.Text, "The log shows one failure.", null, "w-1"));
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.until("the completed wake reply", async () => (await host.messages.findAsync(shown.id))?.status === MessageStatus.Completed);

    Assert.areEqual(MessageStatus.Running, (await host.messages.findAsync(own.id))?.status);
    Assert.areEqual("Started when the background task `npm test` ended.|The log shows one failure.", (await host.messages.findAsync(shown.id))!.details.map(t => t.text).join("|"));

    await host.engine.cancelAsync(new MessageIdParams(own.id));
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(own.id))?.status);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(shown.id))?.status);
  }

  @TestMethod
  public async marksAWakeReplyAsPlanningFirstOnlyWhileItsMemberPlansFirstSoPlanFirstTurnedOnOrAnApprovedPlanThenPlanFirstOffAndOnPlansFirst(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Tidy", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener;
    const wake = async (): Promise<boolean | undefined> => {
      const turn = await listener?.onWakeAsync(new TurnWake(null, null));
      turn?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
      await host.engine.waitForIdle();
      return turn?.planFirst;
    };

    const never = await wake();
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const planning = await wake();
    await host.conversations.approvePlanAsync(conversation.id, null);
    const approved = await wake();
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, false));
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    const again = await wake();
    host.adapter.planMode = null;
    const withoutPlanMode = await wake();

    Assert.areEqual("false,true,false,true,false", [never, planning, approved, again, withoutPlanMode].join(","));
  }

  @TestMethod
  public async tellsTheAdapterTheSessionsOfAChatsRepliesStillRunningOnceTheChatPlansFirstAgainSoItsOpenQueriesPlanBeforeTheyWake(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.modeIds = ["ask", "plan"];
    host.adapter.readOnlyModes = ["plan"];
    host.adapter.planMode = "plan";
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync();
    const send = async (chatId: string, task: boolean): Promise<void> => {
      host.adapter.afterDetails = task ? () => host.adapter.lastListener?.onTaskStartedAsync(new TaskStart("server", "npm start", () => Promise.resolve())) : null;
      await host.engine.sendAsync(new MessageSendParams(chatId, "Start", new RequestedSettings("fake", null, null, null, "ask"), (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
    };
    await send(conversation.id, false);
    host.adapter.unresumable = ["session-1"];
    await send(conversation.id, true);
    await send(other.id, true);
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(other.id, true));

    await host.engine.planFirstAsync(conversation.id);
    await host.conversations.setPlanFirstAsync(new ChatPlanFirstParams(conversation.id, true));
    await host.engine.planFirstAsync(conversation.id);
    host.adapter.planMode = null;
    await host.engine.planFirstAsync(conversation.id);

    Assert.areEqual(JSON.stringify([["session-2"]]), JSON.stringify(host.adapter.plannedSessions));
  }

  @TestMethod
  public async failsAWakeReplyAndClosesItsToolsWhenHandingThemToTheProviderFails(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, tools);
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    const wake = await host.adapter.lastListener?.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    await wake?.onToolsAsync(() => Promise.reject(new RangeError("The provider refused its tools.")));
    await host.engine.waitForIdle();
    const woken = (await WakeRepliesTests.afterAsync(host, conversation.id, 0)).at(-1);

    Assert.areEqual(2, tools.opened.length);
    Assert.areEqual(1, tools.opened[1]?.ends);
    Assert.areEqual(MessageStatus.Failed, (await host.messages.findAsync(woken?.id ?? String.empty))?.status);
  }

  @TestMethod
  public async startsNoReplyForAWakeUpAfterShutdown(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    await host.engine.shutdown();

    Assert.isNull(await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev")));
  }

  @TestMethod
  public async cancelsAWakeReplyThePersonStops(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    let interrupts = 0;
    const wake = (await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev")))!;
    wake.onInterrupt(() => { interrupts += 1; });
    const shown = (await WakeRepliesTests.afterAsync(host, conversation.id, 0)).at(-1)!;
    await host.until("the running wake reply", async () => (await host.messages.findAsync(shown.id))?.status === MessageStatus.Running);

    const cancelled = host.engine.cancelAsync(new MessageIdParams(shown.id));
    await host.until("the interrupt", () => interrupts > 0, new BoundingWork("the cancel", cancelled));
    wake.end(new TurnResult(TurnOutcome.Interrupted, null, new ObservedSettings("fake", null, null, null), null));
    await cancelled;

    Assert.isTrue(interrupts > 0);
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(shown.id))?.status);
  }

  @TestMethod
  public async failsAWakeReplyWhoseStartFailsToWriteWithTheTurnsFailure(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const started: string[] = [];
    host.events.subscribe({
      onEvent: event => {
        const message = event.name === EventName.MessageUpdated ? Message.fromJson(event.payload) : null;
        if (message?.status === MessageStatus.Running && started.push(message.id) === 1)
          throw new RangeError("The window is gone.");
      }
    });

    await host.adapter.lastListener?.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    await host.engine.waitForIdle();
    const woken = await host.messages.findAsync(started[0] ?? String.empty);
    const last = woken?.details.at(-1);

    Assert.areEqual(1, started.length);
    Assert.areEqual(MessageStatus.Failed, woken?.status);
    Assert.areEqual(`${DetailKind.Error} ${Resources.formatTurnFailed("The window is gone.")}`, `${last?.kind} ${last?.text}`);
  }

  @TestMethod
  public async cancelsAStoppedWakeReplyWhoseStartFailsToWrite(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const stops: Promise<Message>[] = [];
    host.events.subscribe({
      onEvent: event => {
        const message = event.name === EventName.MessageUpdated ? Message.fromJson(event.payload) : null;
        if (message?.status === MessageStatus.Running && stops.length === 0) {
          stops.push(host.engine.cancelAsync(new MessageIdParams(message.id)));
          throw new RangeError("The window is gone.");
        }
      }
    });

    await host.adapter.lastListener?.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    await host.engine.waitForIdle();
    const stopped = await Promise.all(stops);

    Assert.areEqual(1, stopped.length);
    Assert.areEqual(MessageStatus.Cancelled, stopped[0]?.status);
    Assert.isFalse(stopped[0]?.details.some(t => t.kind === DetailKind.Error) ?? true);
  }

  @TestMethod
  public async cancelsAWakeReplyStoppedAfterItsCompletedWrite(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const stops: Promise<Message>[] = [];
    host.events.subscribe({
      onEvent: event => {
        const message = event.name === EventName.MessageUpdated ? Message.fromJson(event.payload) : null;
        if (message?.status === MessageStatus.Completed && stops.length === 0)
          stops.push(host.engine.cancelAsync(new MessageIdParams(message.id)));
      }
    });

    const wake = await host.adapter.lastListener?.onWakeAsync(new TurnWake("item-1", "npm run dev"));
    wake?.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();
    const stopped = await Promise.all(stops);

    Assert.areEqual(1, stopped.length);
    Assert.areEqual(MessageStatus.Cancelled, stopped[0]?.status);
  }

  @TestMethod
  public async startsNoReplyForAWakeUpWhoseProviderOrWhoseKindsUsualProviderIsDisabled(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const usual = new FakeProviderAdapter("usual", false, false, join(host.directory.path, "profiles", "Home"));
    host.registry.register(usual);
    const home = await host.createProviderAsync("usual", "Home");
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it too", new RequestedSettings("usual", null, null), home.id));
    await host.engine.waitForIdle();
    await host.providers.setEnabledAsync(new ProviderEnabledParams(provider.id, false));
    await host.providers.setEnabledAsync(new ProviderEnabledParams(home.id, false));

    Assert.isNull(await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev")));
    Assert.isNull(await usual.lastListener!.onWakeAsync(new TurnWake("item-2", "npm test")));
    Assert.areEqual(4, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length);
  }

  @TestMethod
  public async startsNoReplyForAWakeUpInAChatThatIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));

    Assert.isNull(await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev")));
  }

  @TestMethod
  public async startsNoReplyForAWakeUpOfATeammateRemovedFromTheChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const alice = await WakeRepliesTests.teammateAsync(host, "Alice");
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice start the server", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener!;
    const before = (await WakeRepliesTests.afterAsync(host, conversation.id, 0)).length;
    await host.conversations.removeMemberAsync(new ConversationMemberParams(conversation.id, alice.id));

    Assert.isNull(await listener.onWakeAsync(new TurnWake("item-1", "npm run dev")));
    Assert.areEqual(before, (await WakeRepliesTests.afterAsync(host, conversation.id, 0)).length);
  }

  @TestMethod
  public async startsANewReplyForAHandOffToATeammateWhoseWakeReplyWaitsRatherThanJoiningIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const bob = await WakeRepliesTests.teammateAsync(host, "Bob");
    const alice = await WakeRepliesTests.teammateAsync(host, "Alice");
    host.adapter.turnTexts = [["Started."], ["@Bob please look"], ["Looked."]];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Bob start the server", null, null, [], [bob.id]));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener!;
    host.adapter.afterDetails = async () => {
      if (host.adapter.requests.length === 2)
        (await listener.onWakeAsync(new TurnWake("item-1", "npm run dev")))!.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    };
    const asked = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice check it", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    const [woken, handed, ...rest] = (await WakeRepliesTests.findAllAsync(host, await WakeRepliesTests.afterAsync(host, conversation.id, asked.replies[0]!.sequence))).map(t => t!);
    Assert.areEqual(0, rest.length);
    Assert.areEqual("Started when the background task `npm run dev` ended.", woken!.details[0]!.text);
    Assert.areEqual(`${bob.id},${bob.id}`, [woken!.teammateId, handed!.teammateId].join(","));
    Assert.areEqual(asked.replies[0]!.id, handed!.inReplyTo);
    Assert.areEqual(MessageStatus.Completed, handed!.status);
    Assert.areEqual(3, host.adapter.requests.length);
    Assert.isTrue(host.adapter.requests[2]!.prompt.endsWith("\n\n@Alice hands off to you:\n\n@Bob please look"));
  }

  @TestMethod
  public async routesTheSenderTokenOfTheTurnWhoseProcessRunsTheWakeToTheWakeReplyOnlyWhileItRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const first = SenderEnvironment.read(host.adapter.requests[0]!.environment)!;
    const before = await WakeRepliesTests.refusalOf(host, first);

    const wake = (await host.adapter.lastListener!.onWakeAsync(new TurnWake("item-1", "npm run dev")))!;
    const adopted = [wake.adoptSender(SenderEnvironment.read(wake.environment)!), wake.adoptSender(first), wake.adoptSender(first)];
    const during = await host.engine.waitSubAgents(new SubAgentWaitParams(first, [], 1));
    wake.end(new TurnResult(TurnOutcome.Completed, null, new ObservedSettings("fake", null, null, null), null));
    await host.engine.waitForIdle();

    Assert.areEqual(Resources.senderTurnEnded, before);
    Assert.areEqual(JSON.stringify([false, true, false]), JSON.stringify(adopted));
    Assert.areEqual(0, during.ended.length + during.running.length);
    Assert.areEqual(Resources.senderTurnEnded, await WakeRepliesTests.refusalOf(host, first));
    Assert.isFalse(wake.adoptSender(first));
  }

  @TestMethod
  public async routesTheSenderTokenALaterTurnsProcessStillHoldsToThatTurnsReplyOnlyWhileItRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Watch it", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const first = WakeRepliesTests.senderOf(host.adapter.requests[0]);
    const adopted: boolean[] = [];
    const during: number[] = [];
    host.adapter.holdTurn = async request => {
      adopted.push(request.adoptSender(WakeRepliesTests.senderOf(request)), request.adoptSender(first), request.adoptSender(first));
      const waited = await host.engine.waitSubAgents(new SubAgentWaitParams(first, [], 1));
      during.push(waited.ended.length + waited.running.length);
    };

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Again", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify([false, true, false]), JSON.stringify(adopted));
    Assert.areEqual(JSON.stringify([0]), JSON.stringify(during));
    Assert.areEqual(Resources.senderTurnEnded, await WakeRepliesTests.refusalOf(host, first));
    Assert.isFalse(host.adapter.requests[1]?.adoptSender(first) ?? true);
  }

  private static senderOf(request: TurnRequest | undefined): string {
    const token = SenderEnvironment.read(request?.environment ?? {});
    Assert.isNotNull(token);
    return token;
  }

  private static async refusalOf(host: CoreHost, token: string): Promise<string> {
    return (await Assert.throwsAsync(() => host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 1)), ServiceException)).message;
  }

  private static async teammateAsync(host: CoreHost, name: string): Promise<Teammate> {
    const provider = await host.createProviderAsync("fake", name);
    return await host.teammates.createAsync(new TeammateCreateParams(name, `${name}'s role`, provider.id, Harness.Provider, null, null));
  }

  private static afterAsync(host: CoreHost, conversationId: string, sequence: number): Promise<readonly { readonly id: string }[]> {
    return host.messages.listOutlinesAsync(conversationId, sequence);
  }

  private static async findAllAsync(host: CoreHost, outlines: readonly { readonly id: string }[]): Promise<(Message | null)[]> {
    const found: (Message | null)[] = [];
    for (const outline of outlines)
      found.push(await host.messages.findAsync(outline.id));
    return found;
  }
}
