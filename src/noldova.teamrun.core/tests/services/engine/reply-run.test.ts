/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CaptureOutcome } from "@noldova/checkpoints.protocol";
import { ServiceException } from "@noldova/teamrun.services";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ActiveRun, ApprovalAsk, ConversationEngine, HandoverNote, type ITurnListener, PermissionAsk, QuestionAsk, ReplyCheckpoints, ReplyRun, Resources,
  SharedMcpFailure, SharedMcpFailureKind, TaskEnd, TaskStart, ToolCallRecord, TurnDetail, TurnOutcome, TurnRequest, TurnStart, TurnSteer,
  TurnWake, WorkFolder } from "@noldova/teamrun.core";
import { Approval, ApprovalDecideParams, ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalQuestion, ApprovalScope, ApprovalStatus, BackgroundTaskStatus,
  ContextUsage, ConversationIdParams, DetailKind, ErrorCode, EventName, Harness, Message, MessageAuthor, MessageDetail, MessageIdParams, MessageSendParams,
  MessageStatus, ObservedSettings, PlanWindow, PlanWindowName, Provenance, type Provider, QuestionAnswer, QuestionOption, ReplyAction, ReplyUsage, RequestedSettings,
  SenderEnvironment, SharedMcpProviderSetParams, SharedMcpSecretSetParams, SharedMcpServerDefinition, SharedMcpTransport, SubAgent, SubAgentStartParams,
  SubAgentStatus, SubAgentWaitParams, type Teammate, TeammateCreateParams } from "@noldova/teamrun.protocol";

import { AfterStatusMessages } from "../../fixtures/after-status-messages.fixture.js";
import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FailingMessages } from "../../fixtures/failing-messages.fixture.js";
import { FakeTurnToolSessions } from "../../fixtures/fake-turn-tool-sessions.fixture.js";

@TestClass
export class ReplyRunTests {
  private static readonly requested: RequestedSettings = new RequestedSettings("fake", null, null);
  private static readonly provenance: Provenance = new Provenance(null, ReplyRunTests.requested, new ObservedSettings(null, null, null, null), null,
    false);
  private static readonly png: string = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
  private static readonly cart: { url: string; title: string } = { url: "https://shop.test/cart", title: "Cart" };
  private static readonly paid: { url: string; title: string } = { url: "https://shop.test/paid", title: "Paid" };

  @TestMethod
  public async ignoresAProvidersTitleWithNoChatTitlesToTakeIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const reply = new Message("titled-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null, null, []);
    await host.messages.insertAsync(reply);
    await new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path).onTitleAsync("The agent's title");
    Assert.areEqual(conversation.title, (await host.conversations.findAsync(conversation.id))?.title);
  }

  @TestMethod
  public async preservesNamedAuthorshipWhenReplacingStreamedDetails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const requested = new RequestedSettings("fake", null, null);
    const provenance = new Provenance(null, requested, new ObservedSettings(null, null, null, null), null, false);
    const reply = new Message("named-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending,
      [], provenance, "t", null, null, [], "alice", "Alice");
    await host.messages.insertAsync(reply);
    host.adapter.streamedTexts = ["part", "complete"];
    const run = new ReplyRun(reply, provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path);
    await run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", requested, null));
    const saved = await host.messages.findAsync(reply.id);
    Assert.areEqual(MessageStatus.Completed, saved?.status);
    Assert.areEqual("alice", saved?.teammateId);
    Assert.areEqual("Alice", saved?.teammateName);
    Assert.isTrue(saved?.details.some(t => t.text === "complete") ?? false);
    Assert.isFalse(saved?.details.some(t => t.text === "part") ?? true);
  }

  @TestMethod
  public async endsAStoppedReplyCancelledWhenTheNoteItsFailureWritesFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const reply = new Message("stopped-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null,
      null, []);
    await host.messages.insertAsync(reply);
    const active = new ActiveRun(reply.id);
    const full = new RangeError("The disk is full.");
    const messages = new FailingMessages(host.context, message => message.details.some(t => t.text === Resources.uncomparedWorkingTree), full);
    const run = new ReplyRun(reply, ReplyRunTests.provenance, active, messages, host.approvals, host.events, host.directory.path);
    host.adapter.steps = [new TurnDetail(DetailKind.Command, "> ls", null, "c1"), (): void => {
      active.cancel();
      throw new TypeError("The turn broke.");
    }];

    const thrown = await Assert.throwsAsync(() => run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null)),
      RangeError);

    Assert.areEqual(full, thrown);
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.findAsync(reply.id))?.status);
  }

  @TestMethod
  public async keepsTheHandoverAMovedTurnWasSentInItsSustainNoteAndNoneWithoutOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const payloads: string[] = [];
    for (const handover of [new HandoverNote("The chat so far", ["Messages 1 to 2 whole"], null), new HandoverNote("The chat so far", ["Left out: message 1"], "Codex reads it"),
      null]) {
      const reply = new Message(`moved-${payloads.length}`, conversation.id, payloads.length, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t",
        null, null, []);
      await host.messages.insertAsync(reply);
      const run = new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path);
      await run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null), [], "Moved", handover);
      payloads.push(JSON.stringify((await host.messages.findAsync(reply.id))?.details.find(t => t.text === "Moved")?.payload));
    }

    Assert.areEqual([
      JSON.stringify({ source: Resources.sustainSource, [Resources.sustainHandoverField]: "The chat so far", [Resources.sustainCarriedField]: ["Messages 1 to 2 whole"] }),
      JSON.stringify({ source: Resources.sustainSource, [Resources.sustainHandoverField]: "The chat so far", [Resources.sustainCarriedField]: ["Left out: message 1"],
        [Resources.sustainReadsField]: "Codex reads it" }),
      JSON.stringify({ source: Resources.sustainSource })].join("|"), payloads.join("|"));
  }

  @TestMethod
  public async notesEachSharedServerFailureOnceAndOnlyWhileTheReplyRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const reply = new Message("shared-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null,
      null, []);
    await host.messages.insertAsync(reply);
    const failure = new SharedMcpFailure("p-codex", "Work", "docs", SharedMcpFailureKind.Connection);
    const run = new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path);
    host.adapter.afterDetails = async () => {
      await run.onSharedServerFailedAsync(failure);
      await run.onSharedServerFailedAsync(failure);
    };

    await run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));
    await run.onSharedServerFailedAsync(new SharedMcpFailure("p-codex", "Work", "search", SharedMcpFailureKind.SignIn));

    Assert.areEqual(JSON.stringify([Resources.formatSharedMcpServerFailed(failure)]),
      JSON.stringify((await host.messages.findAsync(reply.id))?.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
  }

  @TestMethod
  public async announcesThinkingUntilThinkingTextOrAnotherDetailAndStoresNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.thinkingBeforeDetails = 3;
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Reasoning, "Planning", null, null)];
    host.adapter.thinkingAfterDetails = 2;
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const replyId = sent.replies[0]!.id;
    const names = host.listener.names().filter(t => t === EventName.ReplyThinking || t === EventName.DetailAppended);
    Assert.areEqual([EventName.ReplyThinking, EventName.DetailAppended, EventName.DetailAppended, EventName.ReplyThinking].join(","), names.join(","));
    const payloads = host.listener.events.filter(t => t.name === EventName.ReplyThinking).map(t => MessageIdParams.fromJson(t.payload).messageId);
    Assert.areEqual([replyId, replyId].join(","), payloads.join(","));
    const before = JSON.stringify((await host.messages.findAsync(replyId))?.toJson());
    host.adapter.lastListener?.onThinking();
    Assert.areEqual(2, host.listener.count(EventName.ReplyThinking));
    Assert.areEqual(before, JSON.stringify((await host.messages.findAsync(replyId))?.toJson()));
  }

  @TestMethod
  public async putsTheActionAFailedTurnOffersOnItsErrorDetail(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = "Grok doesn't offer the model grok-4.7.";
    const plain = await host.engine.sendAsync(new MessageSendParams(conversation.id, "plain", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    host.adapter.action = ReplyAction.ChooseModel;
    const offered = await host.engine.sendAsync(new MessageSendParams(conversation.id, "offered", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const errorAsync = async (id: string): Promise<string> => JSON.stringify((await host.messages.findAsync(id))?.details.find(t => t.kind === DetailKind.Error)?.payload);

    Assert.areEqual("null", await errorAsync(plain.replies[0]!.id));
    Assert.areEqual(JSON.stringify({ action: ReplyAction.ChooseModel }), await errorAsync(offered.replies[0]!.id));
    Assert.areEqual(MessageStatus.Failed, (await host.messages.findAsync(offered.replies[0]!.id))?.status);
  }

  @TestMethod
  public async marksAFailedTurnsErrorUsedUpWithItsResetOnlyWhileItsOwnProvidersPlanIsUsedUp(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = (await host.providerOfAsync()).id;
    const at = (offset: number): string => new Date(host.timer.now() + offset).toISOString();
    const reset = at(3_600_000);
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = "You've hit your limit.";
    host.planUsage.record("fake", "other", [new PlanWindow(PlanWindowName.FiveHour, 100, reset)], at(0));
    host.planUsage.record("fake", provider, [new PlanWindow(PlanWindowName.FiveHour, 42, reset)], at(0));
    const send = async (text: string): Promise<string> => {
      const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, text, ReplyRunTests.requested, provider));
      await host.engine.waitForIdle();
      return JSON.stringify((await host.messages.findAsync(sent.replies[0]?.id ?? String.empty))?.details.find(t => t.kind === DetailKind.Error)?.payload);
    };

    const open = await send("open");
    host.adapter.afterDetails = () => host.adapter.lastListener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.FiveHour, 100, reset)], at(1));
    const timed = await send("timed");
    host.adapter.action = ReplyAction.ChooseModel;
    host.adapter.afterDetails = () => host.adapter.lastListener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.Weekly, 100, null)], at(2));
    const untimed = await send("untimed");
    host.adapter.action = null;
    host.adapter.afterDetails = null;
    const project = await host.openProjectAsync();
    const reply = new Message("placeless-reply", (await host.createConversationAsync(project)).id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [],
      ReplyRunTests.provenance, "t", null, null, [], "alice", "Alice");
    await host.messages.insertAsync(reply);
    await new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path)
      .executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));

    Assert.areEqual("null", open);
    Assert.areEqual(JSON.stringify({ usedUp: true, usedUpUntil: reset }), timed);
    Assert.areEqual(JSON.stringify({ action: ReplyAction.ChooseModel, usedUp: true, usedUpUntil: null }), untimed);
    Assert.areEqual("null", JSON.stringify((await host.messages.findAsync(reply.id))?.details.find(t => t.kind === DetailKind.Error)?.payload));
  }

  @TestMethod
  public async putsAPlanReadingThatLandsAfterAFailedTurnOnItsErrorAndItsLaterResetButNoReadingThatIsntUsedUp(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const at = (offset: number): string => new Date(host.timer.now() + offset).toISOString();
    const reset = at(3_600_000);
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = "Quota exceeded.";
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]?.id ?? String.empty;
    const errorAsync = async (): Promise<string> => JSON.stringify((await host.messages.findAsync(id))?.details.find(t => t.kind === DetailKind.Error)?.payload);
    const updates = (): string[] => host.listener.events.filter(t => t.name === EventName.DetailUpdated).map(t => JSON.stringify(t.payload));
    const listener = host.adapter.lastListener;
    const before = [await errorAsync(), updates().length];

    await listener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.Quota, 100, null)], at(1));
    const assumed = [await errorAsync(), updates().length];
    await listener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.Quota, 100, reset)], at(2));
    const read = [await errorAsync(), updates().length];
    await listener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.Quota, 100, reset)], at(3));
    const again = updates().length;
    await listener?.onPlanUsageAsync([new PlanWindow(PlanWindowName.Quota, 40, reset)], at(4));

    Assert.areEqual(JSON.stringify(["null", 0]), JSON.stringify(before));
    Assert.areEqual(JSON.stringify([JSON.stringify({ usedUp: true, usedUpUntil: null }), 1]), JSON.stringify(assumed));
    Assert.areEqual(JSON.stringify([JSON.stringify({ usedUp: true, usedUpUntil: reset }), 2]), JSON.stringify(read));
    Assert.areEqual(2, again);
    Assert.areEqual(JSON.stringify({ usedUp: true, usedUpUntil: reset }), await errorAsync());
    Assert.isTrue(updates()[1]?.includes(reset) ?? false);
  }

  @TestMethod
  public async keepsAFailuresPlanReadingThatLandsWhileASubAgentsStepReadsTheReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = "Quota exceeded.";
    host.adapter.extraDetails = [new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("t1", "Explore", "Explore", null, SubAgentStatus.Running, true).toJson(), "a1")];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]?.id ?? String.empty;
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    const find = host.messages.findAsync.bind(host.messages);
    let landed = false;
    host.messages.findAsync = async (messageId, transaction) => {
      const found = await find(messageId, transaction);
      if (!landed && messageId === id) {
        landed = true;
        await listener.onPlanUsageAsync([new PlanWindow(PlanWindowName.Quota, 100, null)], new Date(host.timer.now()).toISOString());
      }
      return found;
    };

    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "> ls", null, "c1", "a1"));
    const reply = await find(id);

    Assert.isTrue(landed);
    Assert.areEqual(JSON.stringify({ usedUp: true, usedUpUntil: null }), JSON.stringify(reply?.details.find(t => t.kind === DetailKind.Error)?.payload));
    Assert.isTrue(reply?.details.some(t => t.text === "> ls") ?? false);
  }

  @TestMethod
  public async ignoresCallbacksAfterCompletion(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const before = JSON.stringify((await host.messages.findAsync(sent.replies[0]!.id))?.toJson());
    const listener = host.adapter.lastListener;
    Assert.isNotNull(listener);
    await listener.onStartedAsync(new TurnStart("late", false));
    await listener.onObservedAsync(new ObservedSettings("fake", "late", null, null));
    await listener.onDetailAsync(new TurnDetail(DetailKind.Text, "late", null, null));
    await listener.onUsageAsync(new ReplyUsage(1, 1, 1, null));
    const ask = new ApprovalAsk("late", ApprovalKind.Command, "command", "late", null, [new ApprovalOption("yes", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once)]);
    await Assert.throwsAsync(() => listener.onApprovalRequested(ask), ServiceException);
    Assert.areEqual(before, JSON.stringify((await host.messages.findAsync(sent.replies[0]!.id))?.toJson()));
  }

  @TestMethod
  public async keepsTheUsageAndPlanUseItsProviderReports(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const context = new ContextUsage(86000, 200000, 167000);
    host.adapter.afterDetails = async () => {
      const listener = host.adapter.lastListener!;
      await listener.onUsageAsync(new ReplyUsage(1200, null, null, context));
      await listener.onUsageAsync(new ReplyUsage(null, 340, 0.5, null));
      await listener.onPlanUsageAsync([new PlanWindow(PlanWindowName.FiveHour, 42, "2026-10-22T05:00:00.000Z")], "2026-10-22T04:00:00.000Z");
    };

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]!.id;
    const published = host.listener.events.filter(t => t.name === EventName.MessageUpdated).map(t => Message.fromJson(t.payload))
      .filter(t => t.id === id && !Object.isNullOrUndefined(t.provenance?.usage));

    Assert.areEqual(JSON.stringify({ inputTokens: 1200, outputTokens: 340, costUsd: 0.5, context: context.toJson(), cacheReadTokens: null, cacheWriteTokens: null, reasoningTokens: null }),
      JSON.stringify((await host.messages.findAsync(id))?.provenance?.usage?.toJson()));
    Assert.areEqual("1200/null,1200/340", published.slice(0, 2).map(t => `${t.provenance?.usage?.inputTokens}/${t.provenance?.usage?.outputTokens}`).join(","));
    Assert.areEqual(`fake/${(await host.providerOfAsync()).id}/FiveHour:42/2026-10-22T04:00:00.000Z`,
      host.planUsage.list().map(t => `${t.kind}/${t.providerId ?? "-"}/${t.windows.map(w => `${w.name}:${w.usedPercent}`).join()}/${t.readAt}`).join(";"));
  }

  @TestMethod
  public async keepsNoPlanUseWithoutAPlace(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { active, listener, executed } = await ReplyRunTests.hold(host);

    await listener.onPlanUsageAsync([new PlanWindow(PlanWindowName.Weekly, 1, null)], "2026-10-22T04:00:00.000Z");
    active.cancel();
    await executed;

    Assert.areEqual(0, host.planUsage.list().length);
  }

  @TestMethod
  public async takesACheckpointOnlyWithTheModuleAndAProject(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const conversation = await host.createConversationAsync(project);
    const checkpoints = new ReplyCheckpoints(host.checkpoints);
    const work = new WorkFolder(project.id, project.rootPath);
    const runs = [[null, work], [checkpoints, null], [checkpoints, work]] as const;
    const ids: string[] = [];

    for (const [index, [module, folder]] of runs.entries()) {
      const reply = new Message(`reply-${index}`, conversation.id, index, MessageAuthor.Provider, null, MessageStatus.Pending,
        [], ReplyRunTests.provenance, "t", null, null, [], "alice", "Alice");
      await host.messages.insertAsync(reply);
      ids.push(reply.id);
      const run = new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path,
        null, null, null, null, null, module, folder);
      await run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));
    }

    Assert.areEqual(1, host.checkpoints.captures.length);
    Assert.areEqual("null,null,set", (await Promise.all(ids.map(t => host.messages.findCheckpointAsync(t)))).map(t => Object.isNull(t) ? "null" : "set").join(","));
    Assert.areEqual(1, host.checkpoints.compares.length);
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(ids[2]!))?.status);
  }

  @TestMethod
  public async announcesItsCheckpointAndItsEndOnlyWhenItTakesOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const conversation = await host.createConversationAsync(project);
    const work = new WorkFolder(project.id, project.rootPath);
    const without = await ReplyRunTests.checkpointRunAsync(host, conversation.id, "without", 0, null, work);
    await without.run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));
    const before = ReplyRunTests.checkpointEvents(host);

    const taking = await ReplyRunTests.checkpointRunAsync(host, conversation.id, "taking", 1, new ReplyCheckpoints(host.checkpoints), work);
    await taking.run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));

    Assert.areEqual("", before.join(","));
    Assert.areEqual([`${EventName.ReplyCheckpointStarted}:taking`, `${EventName.ReplyCheckpointEnded}:taking`].join(","), ReplyRunTests.checkpointEvents(host).join(","));
    Assert.areEqual([2, 1].join(","), [host.adapter.requests.length, host.checkpoints.captures.length].join(","));
  }

  @TestMethod
  public async announcesItsCheckpointsEndWhenTheCheckpointFailsOrIsNotTaken(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const conversation = await host.createConversationAsync(project);
    const work = new WorkFolder(project.id, project.rootPath);
    host.checkpoints.captureError = new Error("The store is locked.");
    const failing = await ReplyRunTests.checkpointRunAsync(host, conversation.id, "failing", 0, new ReplyCheckpoints(host.checkpoints), work);
    await failing.run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));
    host.checkpoints.captureError = null;
    host.checkpoints.captureOutcome = CaptureOutcome.LowDiskSpace;
    const untaken = await ReplyRunTests.checkpointRunAsync(host, conversation.id, "untaken", 1, new ReplyCheckpoints(host.checkpoints), work);
    await untaken.run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));

    Assert.areEqual([`${EventName.ReplyCheckpointStarted}:failing`, `${EventName.ReplyCheckpointEnded}:failing`, `${EventName.ReplyCheckpointStarted}:untaken`,
      `${EventName.ReplyCheckpointEnded}:untaken`].join(","), ReplyRunTests.checkpointEvents(host).join(","));
    Assert.areEqual([MessageStatus.Completed, MessageStatus.Completed].join(","),
      (await Promise.all(["failing", "untaken"].map(t => host.messages.findAsync(t)))).map(t => t?.status).join(","));
  }

  @TestMethod
  public async announcesItsCheckpointsEndWhenItIsStoppedDuringTheCheckpoint(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    mkdirSync(project.rootPath, { recursive: true });
    const conversation = await host.createConversationAsync(project);
    host.checkpoints.holds = "capture";
    const stopped = await ReplyRunTests.checkpointRunAsync(host, conversation.id, "stopped", 0, new ReplyCheckpoints(host.checkpoints),
      new WorkFolder(project.id, project.rootPath));
    const executed = stopped.run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));
    await host.until("the checkpoint", () => host.checkpoints.captures.length === 1);
    const during = ReplyRunTests.checkpointEvents(host);

    stopped.active.cancel();
    await executed;

    Assert.areEqual(`${EventName.ReplyCheckpointStarted}:stopped`, during.join(","));
    Assert.areEqual([`${EventName.ReplyCheckpointStarted}:stopped`, `${EventName.ReplyCheckpointEnded}:stopped`].join(","), ReplyRunTests.checkpointEvents(host).join(","));
    Assert.areEqual(0, host.adapter.requests.length);
  }

  @TestMethod
  public async withdrawsTheApprovalItsProviderAbortsAndKeepsTheOthers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const controller = new AbortController();
    const withdrawn = listener.onApprovalRequested(ReplyRunTests.ask("first"), controller.signal);
    const kept = listener.onApprovalRequested(ReplyRunTests.ask("second"));
    const first = (await host.approvals.listPendingAsync(reply.id)).find(t => t.summary === "first")!;
    const second = (await host.approvals.listPendingAsync(reply.id)).find(t => t.summary === "second")!;

    controller.abort();

    const failure = await Assert.throwsAsync(() => withdrawn, ServiceException);
    Assert.areEqual(ErrorCode.Conflict, failure.info.name);
    Assert.areEqual(first.id, failure.info.arguments[0]);
    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.findAsync(first.id))?.status);
    Assert.areEqual(ApprovalStatus.Pending, (await host.approvals.findAsync(second.id))?.status);
    Assert.areEqual([first.id].join(","), ReplyRunTests.updatedApprovals(host).join(","));
    Assert.areEqual(MessageStatus.AwaitingApproval, (await host.messages.findAsync(reply.id))?.status);
    Assert.isTrue(active.decide(new ApprovalDecideParams(second.id, "yes")));
    Assert.areEqual("yes", await kept);
    Assert.areEqual(MessageStatus.Running, (await host.messages.findAsync(reply.id))?.status);
    active.cancel();
    await executed;
  }

  @TestMethod
  public async runsOnOnceItsOnlyApprovalIsWithdrawn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const controller = new AbortController();
    const created = host.listener.next(EventName.ApprovalCreated);
    const withdrawn = listener.onApprovalRequested(ReplyRunTests.ask("only"), controller.signal);
    await created;
    Assert.areEqual(MessageStatus.AwaitingApproval, (await host.messages.findAsync(reply.id))?.status);

    controller.abort();

    await Assert.throwsAsync(() => withdrawn, ServiceException);
    Assert.areEqual(MessageStatus.Running, (await host.messages.findAsync(reply.id))?.status);
    Assert.isFalse(active.isAwaitingDecision);
    active.cancel();
    await executed;
  }

  @TestMethod
  public async keepsAReplyCompletedWhenItsApprovalIsDecidedRightAfterTheCompletionWrite(): Promise<void> {
    await using host = await CoreHost.createAsync();
    let asked: Promise<string> = Promise.resolve("not asked");
    const reply = await ReplyRunTests.completeAsync(host, async ({ active, replyId }) => {
      Assert.isTrue(active.decide(new ApprovalDecideParams((await host.approvals.listPendingAsync(replyId))[0]?.id ?? "", "yes")));
      Assert.areEqual("yes", await asked);
    }, async listener => {
      ({ asked } = await ReplyRunTests.askAsync(host, listener));
    });

    Assert.areEqual(MessageStatus.Completed, reply.stored?.status);
    Assert.isFalse(Object.isNullOrUndefined(reply.stored?.endedAt));
    Assert.areEqual(MessageStatus.Completed, reply.statuses.at(-1));
  }

  @TestMethod
  public async keepsAReplyCompletedWhenItsApprovalIsWithdrawnRightAfterTheCompletionWrite(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const controller = new AbortController();
    let asked: Promise<string> = Promise.resolve("not asked");
    const reply = await ReplyRunTests.completeAsync(host, async () => {
      controller.abort();
      await Assert.throwsAsync(() => asked, ServiceException);
    }, async listener => {
      ({ asked } = await ReplyRunTests.askAsync(host, listener, controller.signal));
    });

    Assert.areEqual(MessageStatus.Completed, reply.stored?.status);
    Assert.isFalse(Object.isNullOrUndefined(reply.stored?.endedAt));
    Assert.areEqual(MessageStatus.Completed, reply.statuses.at(-1));
  }

  @TestMethod
  public async keepsAReplyCompletedWhenItsTurnAsksRightAfterTheCompletionWrite(): Promise<void> {
    await using host = await CoreHost.createAsync();
    let asked: Promise<string> = Promise.resolve("not asked");
    const reply = await ReplyRunTests.completeAsync(host, async ({ listener }) => {
      ({ asked } = await ReplyRunTests.askAsync(host, listener));
    });

    await Assert.throwsAsync(() => asked, ServiceException);
    Assert.areEqual(MessageStatus.Completed, reply.stored?.status);
    Assert.isFalse(Object.isNullOrUndefined(reply.stored?.endedAt));
    Assert.areEqual(MessageStatus.Completed, reply.statuses.at(-1));
  }

  @TestMethod
  public async asksNothingWhenTheRequestWasWithdrawnBeforeItArrived(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const controller = new AbortController();
    controller.abort(new RangeError("withdrawn"));

    await Assert.throwsAsync(() => listener.onApprovalRequested(ReplyRunTests.ask("late"), controller.signal), RangeError);

    Assert.areEqual(0, (await host.approvals.listPendingAsync(reply.id)).length);
    Assert.areEqual(0, host.listener.count(EventName.ApprovalCreated));
    active.cancel();
    await executed;
  }

  @TestMethod
  public async keepsADecisionMadeJustBeforeItsRequestIsWithdrawn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const controller = new AbortController();
    const asked = listener.onApprovalRequested(ReplyRunTests.ask("decided"), controller.signal);
    const approval = (await host.approvals.listPendingAsync(reply.id))[0]!;

    Assert.isTrue(active.decide(new ApprovalDecideParams(approval.id, "yes")));
    controller.abort();

    Assert.areEqual("yes", await asked);
    Assert.areEqual(ApprovalStatus.Pending, (await host.approvals.findAsync(approval.id))?.status);
    Assert.areEqual(0, ReplyRunTests.updatedApprovals(host).length);
    active.cancel();
    await executed;
  }

  @TestMethod
  public async asksTheQuestionsAsAQuestionApprovalAndGivesTheTurnTheAnswers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const asked = listener.onQuestionsAsked(ReplyRunTests.questions());
    const approval = (await host.approvals.listPendingAsync(reply.id))[0]!;
    const answers = [new QuestionAnswer("platform", ["Desktop app"], null), new QuestionAnswer("token", [], "s3cret")];

    Assert.areEqual(ApprovalKind.Question, approval.kind);
    Assert.areEqual("AskUserQuestion", approval.nativeKind);
    Assert.areEqual("Which platform?", approval.summary);
    Assert.areEqual(JSON.stringify(Resources.questionOptions.map(t => t.toJson())), JSON.stringify(approval.options.map(t => t.toJson())));
    Assert.areEqual("platform,token", approval.questions.map(t => t.id).join(","));
    Assert.isNull(approval.payload);
    Assert.areEqual(MessageStatus.AwaitingApproval, (await host.messages.findAsync(reply.id))?.status);
    Assert.areEqual(1, host.listener.count(EventName.ApprovalCreated));
    Assert.isTrue(active.decide(new ApprovalDecideParams(approval.id, Resources.answerOptionId, answers)));
    Assert.areEqual(JSON.stringify(answers.map(t => t.toJson())), JSON.stringify((await asked)?.map(t => t.toJson())));
    Assert.areEqual(MessageStatus.Running, (await host.messages.findAsync(reply.id))?.status);
    active.cancel();
    await executed;
  }

  @TestMethod
  public async namesTheSubAgentThatAsksInTheQuestionApprovalsPayload(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const created = host.listener.next(EventName.ApprovalCreated);
    const asked = listener.onQuestionsAsked(ReplyRunTests.questions("Explore the parser"));
    void asked.catch(() => undefined);
    await created;
    const approval = (await host.approvals.listPendingAsync(reply.id))[0]!;

    Assert.areEqual(JSON.stringify({ subAgent: "Explore the parser" }), JSON.stringify(approval.payload));
    Assert.areEqual(JSON.stringify({ subAgent: "Explore the parser" }), JSON.stringify(Approval.fromJson(host.listener.events
      .find(t => t.name === EventName.ApprovalCreated)!.payload).payload));
    active.cancel();
    await executed;
  }

  @TestMethod
  public async givesTheTurnNoAnswersWhenTheQuestionsAreSkipped(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const asked = listener.onQuestionsAsked(ReplyRunTests.questions());

    Assert.isTrue(active.decide(new ApprovalDecideParams((await host.approvals.listPendingAsync(reply.id))[0]!.id, Resources.skipOptionId)));
    Assert.isNull(await asked);
    active.cancel();
    await executed;
  }

  @TestMethod
  public async postsQuestionsWithoutHoldingTheTurnOnlyWhileItsRunIsOpenAndCancelsThemWhenTheReplyStops(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const postAsync = (id: string, questions: readonly ApprovalQuestion[]): Promise<void> => listener.onQuestionsPostedAsync(new QuestionAsk(id, "request_user_input_async", questions));

    await postAsync("msg-1", ReplyRunTests.questions().questions);
    const posted = await host.approvals.listPendingAsync(reply.id);
    active.cancel();
    await executed;
    await postAsync("msg-2", ReplyRunTests.questions().questions);

    Assert.areEqual("msg-1", posted.map(t => ReplyRun.replyToOf(t)).join(","));
    Assert.areEqual("Which platform?", posted.map(t => t.summary).join(","));
    Assert.areEqual(1, host.listener.count(EventName.ApprovalCreated));
    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.listAsync(new ConversationIdParams(reply.conversationId))).map(t => t.status).join(","));
    Assert.isNull(ReplyRun.replyToOf(new Approval("apr-1", reply.id, ApprovalKind.Tool, "Bash", "Run", { replyTo: "msg-1" }, Resources.questionOptions, ApprovalStatus.Pending, null, "t", null)));
    Assert.isNull(ReplyRun.replyToOf(new Approval("apr-2", reply.id, ApprovalKind.Question, "AskUserQuestion", "Ask", null, Resources.questionOptions,
      ApprovalStatus.Pending, null, "t", null, ReplyRunTests.questions().questions)));
  }

  @TestMethod
  public async withdrawsTheQuestionsItsProviderAbortsAndAsksNoneAlreadyWithdrawn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const controller = new AbortController();
    const withdrawn = listener.onQuestionsAsked(ReplyRunTests.questions(), controller.signal);
    const approval = (await host.approvals.listPendingAsync(reply.id))[0]!;

    controller.abort();

    Assert.areEqual(approval.id, (await Assert.throwsAsync(() => withdrawn, ServiceException)).info.arguments[0]);
    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.findAsync(approval.id))?.status);
    Assert.areEqual("platform,token", (await host.approvals.findAsync(approval.id))?.questions.map(t => t.id).join(","));
    await Assert.throwsAsync(() => listener.onQuestionsAsked(ReplyRunTests.questions(), controller.signal), Error);
    Assert.areEqual(1, host.listener.count(EventName.ApprovalCreated));
    active.cancel();
    await executed;
  }

  private static questions(subAgent: string | null = null): QuestionAsk {
    return new QuestionAsk("req-q", "AskUserQuestion", [
      new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window"), new QuestionOption("Web", "A browser")],
        false, false, false),
      new ApprovalQuestion("token", "Token", "Which token?", [], false, true, true)
    ], subAgent);
  }

  private static async completeAsync(host: CoreHost, after: (turn: { listener: ITurnListener; active: ActiveRun; replyId: string }) => Promise<void>,
    during: (listener: ITurnListener) => Promise<void> = (): Promise<void> => Promise.resolve()): Promise<{ stored: Message | null; statuses: readonly MessageStatus[] }> {
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const reply = new Message("raced-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null,
      null, [], "alice", "Alice");
    await host.messages.insertAsync(reply);
    const active = new ActiveRun(reply.id);
    let listener: ITurnListener | null = null;
    const messages = new AfterStatusMessages(host.context, MessageStatus.Completed, async () => {
      if (!Object.isNull(listener))
        await after({ listener, active, replyId: reply.id });
    });
    host.adapter.holdTurn = async (): Promise<void> => {
      listener = host.adapter.lastListener;
      if (!Object.isNull(listener))
        await during(listener);
    };
    const run = new ReplyRun(reply, ReplyRunTests.provenance, active, messages, host.approvals, host.events, host.directory.path);

    await run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));

    return { stored: await host.messages.findAsync(reply.id), statuses: messages.statuses };
  }

  private static async askAsync(host: CoreHost, listener: ITurnListener, signal?: AbortSignal): Promise<{ asked: Promise<string> }> {
    const created = host.listener.next(EventName.ApprovalCreated);
    const asked = listener.onApprovalRequested(ReplyRunTests.ask("late"), signal);
    void asked.catch(() => undefined);
    await created;
    return { asked };
  }

  private static async hold(host: CoreHost): Promise<{ reply: Message; active: ActiveRun; listener: ITurnListener; executed: Promise<void> }> {
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const reply = new Message("held-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null,
      null, [], "alice", "Alice");
    await host.messages.insertAsync(reply);
    host.adapter.holdUntilAbort = true;
    const active = new ActiveRun(reply.id);
    const run = new ReplyRun(reply, ReplyRunTests.provenance, active, host.messages, host.approvals, host.events, host.directory.path);
    const executed = run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));
    await host.adapter.requested(1);

    return { reply, active, listener: host.adapter.lastListener!, executed };
  }

  @TestMethod
  public async wakesNothingForATurnWithNoWayToWakeItsReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { active, listener, executed } = await ReplyRunTests.hold(host);

    const woken = await listener.onWakeAsync(new TurnWake("task-1", "npm start"));
    active.cancel();
    await executed;

    Assert.isNull(woken);
  }

  @TestMethod
  public async refusesAnApprovalItCouldNotStoreWithThatFailureAndWaitsForNoDecision(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    const insert = host.approvals.insertAsync.bind(host.approvals);
    const refused = new Error("disk full");
    host.approvals.insertAsync = () => Promise.reject(refused);

    const failure = await Assert.throwsAsync(() => listener.onApprovalRequested(ReplyRunTests.ask("unstored")), Error);
    const awaiting = active.isAwaitingDecision;
    host.approvals.insertAsync = insert;
    active.cancel();
    await executed;

    Assert.isTrue(failure === refused);
    Assert.isFalse(awaiting);
    Assert.areEqual(0, (await host.approvals.listPendingAsync(reply.id)).length);
  }

  @TestMethod
  public async logsAWaitingMessageItsSteerableTurnCouldNotSend(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const reply = new Message("steered-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null,
      null, [], "alice", "Alice");
    const sending = Promise.withResolvers<void>();
    const run = new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path, null,
      host.log, null, null, null, null, null, undefined, null, () => sending.promise);

    run.onSteerable(() => Promise.resolve(true));
    sending.reject(new Error("queue gone"));
    await sending.promise.catch(() => undefined);

    Assert.isTrue(run.isSteerable);
    Assert.isTrue(host.log.lines.includes(Resources.formatWaitingMessageNotSent(conversation.id, "Error")));
  }

  @TestMethod
  public async storesEveryToolCallRecordQueuedBeforeTheReplyEndsAndThenItsEnd(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const reply = new Message("recorded-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null,
      null, [], "alice", "Alice");
    await host.messages.insertAsync(reply);
    const run = new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path);
    await run.onDetailAsync(new TurnDetail(DetailKind.Note, "Console", { servedTool: "browser_console", servedInput: {} }, "k1"));
    await run.onDetailAsync(new TurnDetail(DetailKind.Note, "Screenshot", { servedTool: "browser_screenshot", servedInput: {} }, "s1"));
    const update = host.messages.updateAsync.bind(host.messages);
    const reached = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    let held = false;
    host.messages.updateAsync = async (message, transaction) => {
      if (!held && JSON.stringify(message.details).includes(ReplyRunTests.cart.url)) {
        held = true;
        reached.resolve();
        await released.promise;
      }
      await update(message, transaction);
    };

    run.noteToolCall(new ToolCallRecord("browser_console", {}, { page: ReplyRunTests.cart }));
    run.noteToolCall(new ToolCallRecord("browser_screenshot", {}, { page: ReplyRunTests.paid }));
    await reached.promise;
    const answered = run.answerAsync("Answered");
    released.resolve();
    await answered;
    run.noteToolCall(new ToolCallRecord("browser_console", {}, { page: ReplyRunTests.paid }));
    const stored = await host.messages.findAsync(reply.id);

    Assert.areEqual(MessageStatus.Completed, stored?.status);
    Assert.areEqual(JSON.stringify([{ servedTool: "browser_console", servedInput: {}, page: ReplyRunTests.cart }, { servedTool: "browser_screenshot", servedInput: {}, page: ReplyRunTests.paid }]),
      JSON.stringify(stored?.details.filter(t => t.text !== "Answered").map(t => t.payload)));
    Assert.areEqual(1, stored?.details.filter(t => t.text === "Answered").length);
  }

  private static ask(summary: string): ApprovalAsk {
    return new ApprovalAsk(summary, ApprovalKind.Command, "command", summary, null, [
      new ApprovalOption("yes", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once),
      new ApprovalOption("no", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once)
    ]);
  }

  @TestMethod
  public async nestsASubAgentsStepsUnderItAndFollowsItAfterTheReplyEndsUntilItEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const agent = (status: SubAgentStatus, id: string | null = "a1"): TurnDetail =>
      new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("t1", "Explore", "Explore", null, status, true).toJson(), id);
    host.adapter.extraDetails = [agent(SubAgentStatus.Running), new TurnDetail(DetailKind.Command, "> ls", null, "c1", "a1"),
      new TurnDetail(DetailKind.Note, "orphan", null, "n1", "unknown"), new TurnDetail(DetailKind.SubAgent, "Broken", { status: "Running" }, "a2"),
      agent(SubAgentStatus.Running, null)];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]!.id;
    const listener = host.adapter.lastListener!;
    const ended = (await host.messages.findAsync(id))!;
    await host.messages.updateAsync(ended.withDetail(new MessageDetail(ended.details.length, DetailKind.Note, "Stored after the end", null, "t")));

    await listener.onDetailAsync(new TurnDetail(DetailKind.Note, "late", null, null));
    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "> cat a.ts", null, "c2", "a1"));
    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "> broken", null, "c3", "a2"));
    await listener.onDetailAsync(agent(SubAgentStatus.Completed));
    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "> after", null, "c4", "a1"));
    await listener.onDetailAsync(agent(SubAgentStatus.Running));
    const reply = (await host.messages.findAsync(id))!;

    Assert.areEqual(MessageStatus.Completed, reply.status);
    Assert.areEqual(`Explore:null,> ls:0,orphan:null,Broken:null,Explore:null,Stored after the end:null,> cat a.ts:0`,
      reply.details.filter(t => t.kind !== DetailKind.Text).map(t => `${t.text}:${t.parentSequence}`).join());
    Assert.areEqual(SubAgentStatus.Completed, SubAgent.fromJson(reply.details[0]!.payload).status);
  }

  @TestMethod
  public async stopsFollowingASubAgentWhoseReplyIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.extraDetails = [new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("t1", null, "Explore", null, SubAgentStatus.Running, true).toJson(), "a1")];
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const listener = host.adapter.lastListener!;
    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));
    const appended = host.listener.count(EventName.DetailAppended);

    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "> ls", null, "c1", "a1"));
    await listener.onDetailAsync(new TurnDetail(DetailKind.Command, "> cat", null, "c2", "a1"));

    Assert.areEqual(appended, host.listener.count(EventName.DetailAppended));
  }

  @TestMethod
  public async asksInAFinishedReplyWhileItsSubAgentsRunAndCancelsWhatStillWaitsOnceTheLastEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const agent = (id: string, status: SubAgentStatus): TurnDetail =>
      new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent(id, "Explore", "Explore", null, status, true).toJson(), id);
    host.adapter.extraDetails = [agent("a1", SubAgentStatus.Running), agent("a2", SubAgentStatus.Running)];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "hello", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]!.id;
    const listener = host.adapter.lastListener!;
    const controller = new AbortController();

    const decided = listener.onApprovalRequested(ReplyRunTests.ask("decided"));
    const withdrawn = listener.onApprovalRequested(ReplyRunTests.ask("withdrawn"), controller.signal);
    const waiting = listener.onQuestionsAsked(ReplyRunTests.questions());
    const pendingAsync = async (summary: string): Promise<Approval> => (await host.approvals.listPendingAsync(id)).find(t => t.summary === summary)!;
    const question = await pendingAsync("Which platform?");
    await host.engine.decideAsync(new ApprovalDecideParams((await pendingAsync("decided")).id, "yes"));
    Assert.areEqual("yes", await decided);
    const withdrawal = await pendingAsync("withdrawn");
    controller.abort();
    await Assert.throwsAsync(() => withdrawn, ServiceException);
    await listener.onDetailAsync(agent("a1", SubAgentStatus.Completed));
    Assert.areEqual(ApprovalStatus.Pending, (await host.approvals.findAsync(question.id))?.status);
    await listener.onDetailAsync(agent("a2", SubAgentStatus.Completed));

    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => waiting, ServiceException)).info.name);
    Assert.areEqual(JSON.stringify([ApprovalStatus.Cancelled, ApprovalStatus.Cancelled]),
      JSON.stringify((await Promise.all([question, withdrawal].map(t => host.approvals.findAsync(t.id)))).map(t => t?.status)));
    Assert.areEqual(3, host.listener.count(EventName.ApprovalCreated));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(id))?.status);
    Assert.isFalse(host.listener.events.some(t => t.name === EventName.MessageUpdated && Message.fromJson(t.payload).status === MessageStatus.AwaitingApproval));
    await Assert.throwsAsync(() => listener.onApprovalRequested(ReplyRunTests.ask("after")), ServiceException);
    await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(question.id, Resources.skipOptionId)), ServiceException);
  }

  @TestMethod
  public async keepsAFinishedRepliesApprovalsOpenUntilTheTasksItsTurnStartedEnd(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const agent = (status: SubAgentStatus): TurnDetail =>
      new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("a1", "Explore", "Explore", null, status, true).toJson(), "a1");
    const tasks = [["server"], ["server", "watch"]] as const;
    const asks: Promise<string>[] = [];
    const ids: string[] = [];

    for (const [index, started] of tasks.entries()) {
      host.adapter.extraDetails = index === 0 ? [] : [agent(SubAgentStatus.Running)];
      host.adapter.afterDetails = async () => {
        for (const task of started)
          await host.adapter.lastListener!.onTaskStartedAsync(new TaskStart(task, `npm ${task}`, () => Promise.resolve()));
        await host.adapter.lastListener!.onTaskEndedAsync(new TaskEnd("watch", BackgroundTaskStatus.Completed));
      };
      const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, `run ${index}`, ReplyRunTests.requested, (await host.providerOfAsync()).id));
      await host.engine.waitForIdle();
      ids.push(sent.replies[0]!.id);
      const listener = host.adapter.lastListener!;
      const asked = listener.onApprovalRequested(ReplyRunTests.ask(`late ${index}`));
      void asked.catch(() => undefined);
      asks.push(asked);
      if (index === 1)
        await listener.onDetailAsync(agent(SubAgentStatus.Completed));
      Assert.areEqual(1, (await host.approvals.listPendingAsync(ids[index]!)).length);
      await listener.onTaskEndedAsync(new TaskEnd("server", BackgroundTaskStatus.Completed));
    }

    await host.adapter.lastListener!.onTaskEndedAsync(new TaskEnd("server", BackgroundTaskStatus.Completed));
    for (const asked of asks)
      await Assert.throwsAsync(() => asked, ServiceException);
    Assert.areEqual("0,0", (await Promise.all(ids.map(t => host.approvals.listPendingAsync(t)))).map(t => t.length).join(","));
  }

  @TestMethod
  public async cancelsTheApprovalsOfAStoppedReplyAlsoWhileItsSubAgentRuns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const { reply, active, listener, executed } = await ReplyRunTests.hold(host);
    await listener.onDetailAsync(new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("a1", null, "Explore", null, SubAgentStatus.Running, true).toJson(), "a1"));
    const asked = listener.onApprovalRequested(ReplyRunTests.ask("asked"));

    active.cancel();
    await executed;

    await Assert.throwsAsync(() => asked, ServiceException);
    Assert.areEqual(0, (await host.approvals.listPendingAsync(reply.id)).length);
    Assert.isFalse(active.isOpen);
    await Assert.throwsAsync(() => listener.onApprovalRequested(ReplyRunTests.ask("late")), ServiceException);
  }

  @TestMethod
  public async stopsTheSubAgentsOfAReplyWhoseTurnEndedWhileTheyRunWhenThatReplyIsCancelledWithoutListingOneWithNoStopOfItsOwn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const agent = (status: SubAgentStatus): TurnDetail =>
      new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("a1", "Explore", "Explore", null, status, true).toJson(), "a1");
    const stops: string[] = [];
    const stop = (id: string) => (): Promise<void> => {
      stops.push(id);
      return Promise.resolve();
    };
    host.adapter.extraDetails = [agent(SubAgentStatus.Running)];
    host.adapter.afterDetails = async () => {
      await host.adapter.lastListener!.onTaskStartedAsync(new TaskStart("a1", "Explore", stop("a1"), "a1", false));
      await host.adapter.lastListener!.onTaskStartedAsync(new TaskStart("server", "npm run dev", stop("server")));
    };
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "run", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]!.id;
    const listener = host.adapter.lastListener!;
    const asked = listener.onApprovalRequested(ReplyRunTests.ask("late"));
    void asked.catch(() => undefined);
    const listed = (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.command);

    const first = host.engine.cancelAsync(new MessageIdParams(id));
    const second = host.engine.cancelAsync(new MessageIdParams(id));
    const cancelled = await first;
    await second;
    await listener.onTaskEndedAsync(new TaskEnd("a1", BackgroundTaskStatus.Stopped));
    await listener.onDetailAsync(agent(SubAgentStatus.Stopped));

    Assert.areEqual(MessageStatus.Completed, cancelled.status);
    Assert.areEqual("a1", stops.join());
    Assert.areEqual("npm run dev", listed.join());
    Assert.areEqual("npm run dev", (await host.tasks.listAsync(new ConversationIdParams(conversation.id))).map(t => t.command).join());
    await Assert.throwsAsync(() => asked, ServiceException);
    Assert.areEqual(0, (await host.approvals.listPendingAsync(id)).length);
    Assert.areEqual(SubAgentStatus.Stopped, ReplyRunTests.subAgentStatus((await host.messages.findAsync(id))!));
  }

  @TestMethod
  public async showsStoppedOnASubAgentWithNoTaskWhenTheReplyWhoseTurnEndedIsCancelledSoTheReplyEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.extraDetails = [new TurnDetail(DetailKind.SubAgent, "Explore",
      new SubAgent("a1", "Explore", "Explore", null, SubAgentStatus.Running, true).toJson(), "a1")];
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "run", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]!.id;
    const running = ReplyRunTests.subAgentStatus((await host.messages.findAsync(id))!);

    const cancelled = await host.engine.cancelAsync(new MessageIdParams(id));

    Assert.areEqual(SubAgentStatus.Running, running);
    Assert.areEqual(SubAgentStatus.Stopped, ReplyRunTests.subAgentStatus(cancelled));
    Assert.areEqual(SubAgentStatus.Stopped, ReplyRunTests.subAgentStatus((await host.messages.findAsync(id))!));
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.engine.cancelAsync(new MessageIdParams(id)), ServiceException)).info.name);
  }

  @TestMethod
  public async keepsAReplyWhoseTurnEndedCancellableWhenItsSubAgentsStopIsRefusedAndTriesThatStopAgain(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const agent = (status: SubAgentStatus): TurnDetail =>
      new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("a1", "Explore", "Explore", null, status, true).toJson(), "a1");
    const stops: string[] = [];
    host.adapter.extraDetails = [agent(SubAgentStatus.Running)];
    host.adapter.afterDetails = () => host.adapter.lastListener!.onTaskStartedAsync(new TaskStart("a1", "Explore", () => {
      stops.push("a1");
      return stops.length === 1 ? Promise.reject(new Error("still busy")) : Promise.resolve();
    }, "a1"));
    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "run", ReplyRunTests.requested, (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();
    const id = sent.replies[0]!.id;
    const listener = host.adapter.lastListener!;

    const refused = await Assert.throwsAsync(() => host.engine.cancelAsync(new MessageIdParams(id)), ServiceException);
    const afterRefusal = ReplyRunTests.subAgentStatus((await host.messages.findAsync(id))!);
    await Assert.throwsAsync(() => listener.onApprovalRequested(ReplyRunTests.ask("after")), ServiceException);
    const listedAfterAsk = (await host.approvals.listPendingAsync(id)).length;
    await host.engine.cancelAsync(new MessageIdParams(id));
    await listener.onTaskEndedAsync(new TaskEnd("a1", BackgroundTaskStatus.Stopped));
    await listener.onDetailAsync(agent(SubAgentStatus.Stopped));

    Assert.areEqual(ErrorCode.ProviderError, refused.info.name);
    Assert.isTrue(refused.message.includes("still busy"));
    Assert.areEqual(SubAgentStatus.Running, afterRefusal);
    Assert.areEqual("a1,a1", stops.join());
    Assert.areEqual(0, listedAfterAsk);
    Assert.areEqual(0, (await host.approvals.listPendingAsync(id)).length);
    Assert.areEqual(SubAgentStatus.Stopped, ReplyRunTests.subAgentStatus((await host.messages.findAsync(id))!));
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.engine.cancelAsync(new MessageIdParams(id)), ServiceException)).info.name);
  }

  @TestMethod
  public endsATaskWhoseEndArrivesWhileItsStartStillReadsTheMembershipAndReleasesTheReply(): Promise<void> {
    return ReplyRunTests.runAsync(async (host, _, alice) => {
      const read = ReplyRunTests.holdMemberRead(host, false);
      host.adapter.afterDetails = async () => {
        const listener = host.adapter.lastListener!;
        read.arm();
        const started = listener.onTaskStartedAsync(new TaskStart("server", "npm run dev", () => Promise.resolve()));
        await read.reached;
        const ended = listener.onTaskEndedAsync(new TaskEnd("server", BackgroundTaskStatus.Completed));
        read.release();
        await Promise.all([started, ended]);
      };

      const reply = await ReplyRunTests.replyAsync(host, alice);
      const asked = host.adapter.lastListener!.onApprovalRequested(ReplyRunTests.ask("late"));
      void asked.catch(() => undefined);

      Assert.areEqual(`npm run dev ${BackgroundTaskStatus.Completed}`,
        (await host.tasks.listAsync(new ConversationIdParams(reply.conversationId))).map(t => `${t.command} ${t.status}`).join());
      Assert.areEqual(0, (await host.approvals.listPendingAsync(reply.id)).length);
      await Assert.throwsAsync(() => asked, ServiceException);
    });
  }

  @TestMethod
  public stopsAndDropsATaskThatStartsAfterItsTeammateLeftAndReleasesTheReplyItKeptOpen(): Promise<void> {
    return ReplyRunTests.runAsync(async (host, _, alice) => {
      const read = ReplyRunTests.holdMemberRead(host, true);
      const stops: string[] = [];
      const starts: Promise<void>[] = [];
      host.adapter.afterDetails = async () => {
        read.arm();
        starts.push(host.adapter.lastListener!.onTaskStartedAsync(new TaskStart("server", "npm run dev", () => {
          stops.push("server");
          return Promise.resolve();
        })));
        await read.reached;
      };

      const reply = await ReplyRunTests.replyAsync(host, alice);
      const asked = host.adapter.lastListener!.onApprovalRequested(ReplyRunTests.ask("late"));
      void asked.catch(() => undefined);
      const keptOpen = (await host.approvals.listPendingAsync(reply.id)).length;
      read.release();
      await Promise.all(starts);

      Assert.areEqual(1, keptOpen);
      Assert.areEqual("server", stops.join());
      Assert.areEqual(0, (await host.tasks.listAsync(new ConversationIdParams(reply.conversationId))).length);
      await Assert.throwsAsync(() => asked, ServiceException);
      Assert.areEqual(0, (await host.approvals.listPendingAsync(reply.id)).length);
    });
  }

  private static holdMemberRead(host: CoreHost, left: boolean): { readonly arm: () => void; readonly reached: Promise<void>; readonly release: () => void } {
    const find = host.conversations.findMemberAsync.bind(host.conversations);
    const reached = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    let armed = false;
    host.conversations.findMemberAsync = async (params, transaction) => {
      if (!armed)
        return await find(params, transaction);
      armed = false;
      reached.resolve();
      await released.promise;
      return left ? null : await find(params, transaction);
    };
    return {
      arm: () => {
        armed = true;
      },
      reached: reached.promise,
      release: () => released.resolve()
    };
  }

  @TestMethod
  public async takesASteerOnlyWhileItsTurnOffersOneAndLogsASteerThatFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const conversation = await host.createConversationAsync(project);
    const reply = new Message("steered-reply", conversation.id, 0, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null,
      null, []);
    await host.messages.insertAsync(reply);
    const run = new ReplyRun(reply, ReplyRunTests.provenance, new ActiveRun(reply.id), host.messages, host.approvals, host.events, host.directory.path, null,
      host.log);
    const steer = new TurnSteer("Look again", []);
    const seen: string[] = [];
    host.adapter.afterDetails = async () => {
      const before = await run.steer(steer);
      run.onSteerable(t => {
        seen.push(t.text);
        return Promise.resolve(true);
      });
      const taken = await run.steer(steer);
      const offered = run.isSteerable;
      run.onSteerable(() => Promise.reject(new Error("closed")));
      const failed = await run.steer(steer);
      run.onSteerable(null);
      const withdrawn = run.isSteerable;
      run.onSteerable(() => Promise.resolve(true));
      seen.push([before, taken, offered, failed, withdrawn, run.isSteerable].join("|"));
    };

    await run.executeAsync(host.adapter, new TurnRequest(null, project.rootPath, "fixture", ReplyRunTests.requested, null));
    const ended = run.isSteerable;
    run.onSteerable(() => Promise.resolve(true));

    Assert.areEqual("Look again|false|true|true|false|false|true", seen.join("|"));
    Assert.areEqual("false|false|false", [ended, run.isSteerable, await run.steer(steer)].join("|"));
    Assert.areEqual(JSON.stringify([Resources.formatSteerRefused(reply.id, "Error")]), JSON.stringify(host.log.lines.filter(t => t.includes("steer"))));
  }

  @TestMethod
  public addsEachRecordToTheFirstStepOfItsCallStoresItsImageAndKeepsItWhenTheStepIsReportedAgain(): Promise<void> {
    return ReplyRunTests.runAsync(async (host, tools, alice) => {
      const click = { servedTool: "browser_click", servedInput: { ref: "e5", element: "Pay" } };
      host.adapter.steps = [
        new TurnDetail(DetailKind.Note, "Click Pay", click, "c1"),
        new TurnDetail(DetailKind.Note, "Click Pay", click, "c2"),
        () => tools.records[0]?.(new ToolCallRecord("browser_click", { element: "Pay", ref: "e5" }, { page: ReplyRunTests.cart },
          { data: ReplyRunTests.png, mediaType: "image/png" })),
        new TurnDetail(DetailKind.Note, "Click Pay", { ...click, status: "completed" }, "c1"),
        () => tools.records[0]?.(new ToolCallRecord("browser_click", { ref: "e5", element: "Pay" }, { page: ReplyRunTests.paid }, null,
          { id: "request-1", risk: "Medium", decision: "AllowedOnce", isRemembered: false }))
      ];

      const reply = await ReplyRunTests.replyAsync(host, alice);
      const stored = join(host.directory.path, "images", `${reply.id}-0.png`);

      Assert.areEqual(JSON.stringify([
        { ...click, status: "completed", page: ReplyRunTests.cart, storedPath: stored },
        { ...click, page: ReplyRunTests.paid, permission: { risk: "Medium", decision: "AllowedOnce", isRemembered: false, isAsked: false } }
      ]).toLowerCase(), JSON.stringify(ReplyRunTests.notesOf(reply)).toLowerCase());
      Assert.areEqual(ReplyRunTests.png, readFileSync(stored).toString("base64"));
      Assert.areEqual(JSON.stringify([`${reply.id}-0.png`]), JSON.stringify(readdirSync(join(host.directory.path, "images"))));
    });
  }

  @TestMethod
  public keepsARecordWhoseStepHasntComeForItAndPairsAStepThatKeptNoInputByItsTool(): Promise<void> {
    return ReplyRunTests.runAsync(async (host, tools, alice) => {
      host.adapter.steps = [
        () => tools.records[0]?.(new ToolCallRecord("browser_screenshot", { type: "png" }, { page: ReplyRunTests.cart },
          { data: ReplyRunTests.png, mediaType: "image/tiff" })),
        () => tools.records[0]?.(new ToolCallRecord("browser_console", {}, { page: ReplyRunTests.paid })),
        new TurnDetail(DetailKind.Note, "Plain", "plain", "p1"),
        new TurnDetail(DetailKind.Note, "Screenshot", { servedTool: "browser_screenshot" }, "s1"),
        new TurnDetail(DetailKind.Note, "Console", { servedTool: "browser_console", servedInput: {} }, "k1")
      ];

      const reply = await ReplyRunTests.replyAsync(host, alice);

      Assert.areEqual(JSON.stringify([
        "plain",
        { servedTool: "browser_screenshot", page: ReplyRunTests.cart },
        { servedTool: "browser_console", servedInput: {}, page: ReplyRunTests.paid }
      ]), JSON.stringify(ReplyRunTests.notesOf(reply)));
    });
  }

  @TestMethod
  public marksARecordsPermissionAsAskedOnlyWhenTheReplyShowedACardForIt(): Promise<void> {
    return ReplyRunTests.runAsync(async (host, tools, alice) => {
      const click = (element: string): { servedTool: string; servedInput: { element: string } } => ({ servedTool: "browser_click", servedInput: { element } });
      const record = (element: string, id: string): ToolCallRecord =>
        new ToolCallRecord("browser_click", { element }, {}, null, { id, risk: "Low", decision: "AllowedOnce", isRemembered: false });
      host.adapter.steps = [
        new TurnDetail(DetailKind.Note, "Click Search", click("Search"), "c1"),
        new TurnDetail(DetailKind.Note, "Click Next", click("Next"), "c2"),
        async () => {
          const created = host.listener.next(EventName.ApprovalCreated);
          const asking = host.engine.askPermissionAsync("session-1", "browser",
            new PermissionAsk("browser.click", "Click Search", { module: "browser", subject: null, risk: "Low", details: [] }, false, null, null, "request-1"),
            new AbortController().signal);
          await created;
          const pending = (await host.approvals.listAsync(new ConversationIdParams(tools.openings[0]?.conversationId ?? ""))).find(t => t.status === ApprovalStatus.Pending);
          await host.engine.decideAsync(new ApprovalDecideParams(pending?.id ?? "", "allowOnce"));
          await asking;
          tools.records[0]?.(record("Search", "request-1"));
          tools.records[0]?.(record("Next", "request-2"));
        }
      ];

      const reply = await ReplyRunTests.replyAsync(host, alice);

      Assert.areEqual(JSON.stringify([
        { ...click("Search"), permission: { risk: "Low", decision: "AllowedOnce", isRemembered: false, isAsked: true } },
        { ...click("Next"), permission: { risk: "Low", decision: "AllowedOnce", isRemembered: false, isAsked: false } }
      ]), JSON.stringify(ReplyRunTests.notesOf(reply)));
    });
  }

  @TestMethod
  public storesTheRecordsAfterOneThatFailedToStoreAndCompletesTheTurn(): Promise<void> {
    return ReplyRunTests.runAsync(async (host, tools, alice) => {
      const update = host.messages.updateAsync.bind(host.messages);
      let failed = false;
      host.messages.updateAsync = (message, transaction) => {
        if (!failed && JSON.stringify(message.details).includes(JSON.stringify(ReplyRunTests.cart))) {
          failed = true;
          return Promise.reject(new Error("disk full"));
        }
        return update(message, transaction);
      };
      host.adapter.steps = [
        new TurnDetail(DetailKind.Note, "Console", { servedTool: "browser_console", servedInput: {} }, "k1"),
        new TurnDetail(DetailKind.Note, "Screenshot", { servedTool: "browser_screenshot", servedInput: {} }, "s1"),
        () => {
          tools.records[0]?.(new ToolCallRecord("browser_console", {}, { page: ReplyRunTests.cart }));
          tools.records[0]?.(new ToolCallRecord("browser_screenshot", {}, { page: ReplyRunTests.paid }));
        }
      ];

      const reply = await ReplyRunTests.replyAsync(host, alice);

      Assert.isTrue(failed);
      Assert.areEqual(MessageStatus.Completed, reply.status);
      Assert.areEqual(JSON.stringify([
        { servedTool: "browser_console", servedInput: {}, page: ReplyRunTests.cart },
        { servedTool: "browser_screenshot", servedInput: {}, page: ReplyRunTests.paid }
      ]), JSON.stringify(ReplyRunTests.notesOf(reply)));
    });
  }

  @TestMethod
  public dropsARecordThatComesAfterTheReplyEnded(): Promise<void> {
    return ReplyRunTests.runAsync(async (host, tools, alice) => {
      host.adapter.steps = [new TurnDetail(DetailKind.Note, "Console", { servedTool: "browser_console", servedInput: {} }, "k1")];

      const before = await ReplyRunTests.replyAsync(host, alice);
      tools.records[0]?.(new ToolCallRecord("browser_console", {}, { page: ReplyRunTests.cart }));

      Assert.areEqual(JSON.stringify([{ servedTool: "browser_console", servedInput: {} }]), JSON.stringify(ReplyRunTests.notesOf(await host.messages.findAsync(before.id))));
    });
  }

  @TestMethod
  public async givesATurnTheSharedServersItsTeammateGetsAsItsProviderAnswersForTheTurnsFolderAndNotesThoseLeftOutBeforeTheProvidersDetails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const asked: string[] = [];
    host.adapter.sharedServerUnavailable = (server, provider, folder) => {
      asked.push(`${server.name} ${provider.id} ${folder}`);
      return null;
    };
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const conversation = await host.createConversationAsync();
    for (const [name, variable] of [["search", "SEARCH_KEY"], ["unset", "UNSET_KEY"]] as const) {
      const server = await host.sharedServers.createAsync(new SharedMcpServerDefinition(name, SharedMcpTransport.Stdio, "npx", [], [variable], null, [], null));
      await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
    }
    host.environment["SEARCH_KEY"] = "set";

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    Assert.areEqual("search", host.adapter.requests.map(t => t.sharedServers.map(u => u.name).join(",")).join(";"));
    Assert.areEqual(["search", "unset"].map(t => `${t} ${provider.id} ${host.adapter.requests[0]?.workingDirectory}`).join(";"), asked.join(";"));
    const reply = (await host.messages.listOutlinesAsync(conversation.id, null)).at(-1);
    Assert.isDefined(reply);
    const message = await host.messages.findAsync(reply.id);
    Assert.isNotNull(message);
    const details = message.details;
    Assert.areEqual(DetailKind.Note, details[0]?.kind);
    Assert.areEqual(Resources.formatSharedMcpServerLeftOut("unset", Resources.formatSharedMcpVariableUnset("UNSET_KEY")), details[0]?.text);
    Assert.areEqual(JSON.stringify({ source: Resources.sharedMcpServersSource }), JSON.stringify(details[0]?.payload));
    Assert.areNotEqual(DetailKind.Note, details[1]?.kind);
  }

  @TestMethod
  public async givesATurnAndItsHelperTheSavedValuesOfTheirSharedServersAndNotesAMissingSecretWithoutAnyValue(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    host.adapter.savedSecretsUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const conversation = await host.createConversationAsync();
    const value = "saved-value-7f3c9a1e";
    const references = ["teamrun.mcpSecret0123456789abcdef0123456789abcdef", "teamrun.mcpSecretfedcba9876543210fedcba9876543210"] as const;
    for (const [name, variable, reference] of [["search", "GITHUB_TOKEN", references[0]], ["docs", "DOCS_KEY", references[1]]] as const) {
      const server = await host.sharedServers.createAsync(new SharedMcpServerDefinition(name, SharedMcpTransport.Stdio, "npx", [], [variable], null, [], null));
      await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
      await host.sharedServers.setSecretAsync(new SharedMcpSecretSetParams(server.id, variable, reference));
    }
    host.secrets.values.set(references[0], value);
    host.adapter.holdTurn = async request => {
      const token = SenderEnvironment.read(request.environment);
      if (!Object.isNull(token)) {
        await host.engine.startSubAgentAsync(new SubAgentStartParams(token, "helper", "Write the fix", "Fix it."));
        await host.engine.waitSubAgents(new SubAgentWaitParams(token, [], 5_000));
      }
    };

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await host.engine.waitForIdle();

    Assert.areEqual(2, host.adapter.requests.length);
    for (const request of host.adapter.requests) {
      Assert.areEqual("search", request.sharedServers.map(t => t.name).join(","));
      Assert.areEqual(value, request.sharedValues.valueOf("search", "GITHUB_TOKEN"));
      Assert.isFalse(JSON.stringify(request).includes(value));
    }
    const reply = (await host.messages.listOutlinesAsync(conversation.id, null)).at(-1);
    Assert.isDefined(reply);
    const message = await host.messages.findAsync(reply.id);
    Assert.isNotNull(message);
    const details = message.details;
    Assert.areEqual(Resources.formatSharedMcpServerLeftOut("docs", Resources.formatSharedMcpSecretMissing("DOCS_KEY")), details[0]?.text);
    Assert.isFalse(JSON.stringify([details, host.log.lines]).includes(value));
  }

  @TestMethod
  public async notesEachSharedServerFailureOfEachProviderOncePerChatAcrossItsTurnsUntilTheChatIsForgotten(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const [work, home] = [await host.createProviderAsync("fake", "Work"), await host.createProviderAsync("fake", "Home")];
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, work.id, Harness.Provider, null, null));
    const bob = await host.teammates.createAsync(new TeammateCreateParams("Bob", null, home.id, Harness.Provider, null, null));
    const [first, second] = [await host.createConversationAsync(), await host.createConversationAsync()];
    const failure = (provider: Provider, kind: SharedMcpFailureKind): SharedMcpFailure => new SharedMcpFailure(provider.id, provider.label, "docs", kind);
    let kinds = [SharedMcpFailureKind.SignIn, SharedMcpFailureKind.SignIn];
    host.adapter.afterDetails = async () => {
      const provider = host.adapter.requests.at(-1)?.provider ?? null;
      if (!Object.isNull(provider))
        for (const kind of kinds)
          await host.adapter.lastListener?.onSharedServerFailedAsync(failure(provider, kind));
    };
    const notesOfAsync = async (conversationId: string): Promise<string[]> => (await Promise.all((await host.messages.listOutlinesAsync(conversationId, null))
      .filter(t => t.author === MessageAuthor.Provider).map(t => host.messages.findAsync(t.id))))
      .map(t => (t?.details ?? []).filter(u => u.kind === DetailKind.Note).map(u => `${u.text}|${JSON.stringify(u.payload)}`).join(";"));
    const send = async (conversationId: string, teammate: Teammate): Promise<void> => {
      await host.engine.sendAsync(new MessageSendParams(conversationId, `@${teammate.name} look`, null, null, [], [teammate.id]));
      await host.engine.waitForIdle();
    };

    await send(first.id, alice);
    await send(first.id, bob);
    kinds = [SharedMcpFailureKind.SignIn, SharedMcpFailureKind.Connection];
    await send(first.id, alice);
    await send(second.id, alice);
    await host.engine.forgetAsync([first.id]);
    await send(first.id, alice);

    const note = (provider: Provider, kind: SharedMcpFailureKind): string =>
      `${Resources.formatSharedMcpServerFailed(failure(provider, kind))}|${JSON.stringify({ source: Resources.sharedMcpServersSource })}`;
    const both = [note(work, SharedMcpFailureKind.SignIn), note(work, SharedMcpFailureKind.Connection)].join(";");
    Assert.areEqual(JSON.stringify([note(work, SharedMcpFailureKind.SignIn), note(home, SharedMcpFailureKind.SignIn),
      note(work, SharedMcpFailureKind.Connection), both]), JSON.stringify(await notesOfAsync(first.id)));
    Assert.areEqual(JSON.stringify([both]), JSON.stringify(await notesOfAsync(second.id)));
    Assert.areEqual(JSON.stringify([
      "The provider \"Work\" couldn't connect to the shared MCP server docs, so its tools aren't in this chat.",
      "The shared MCP server docs needs a sign-in in the provider \"Home\", so its tools aren't in this chat.",
      "The provider \"Home\" blocked the shared MCP server docs, so its tools aren't in this chat: not in allowed_mcp_servers"
    ]), JSON.stringify([Resources.formatSharedMcpServerFailed(failure(work, SharedMcpFailureKind.Connection)),
      Resources.formatSharedMcpServerFailed(failure(home, SharedMcpFailureKind.SignIn)),
      Resources.formatSharedMcpServerFailed(new SharedMcpFailure(home.id, home.label, "docs", SharedMcpFailureKind.Blocked, "not in allowed_mcp_servers"))]));
  }

  @TestMethod
  public async notesOncePerChatThatAProviderInAnUntrustedFolderLeftOutTeamRunsTools(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync("fake", "Gemini");
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const [first, second] = [await host.createConversationAsync(), await host.createConversationAsync()];
    const untrusted = new SharedMcpFailure(provider.id, provider.label, "teamrun", SharedMcpFailureKind.Untrusted, "Trust the folder first.");
    host.adapter.afterDetails = () => host.adapter.lastListener?.onSharedServerFailedAsync(untrusted);
    const notesOfAsync = async (conversationId: string): Promise<string[]> => (await Promise.all((await host.messages.listOutlinesAsync(conversationId, null))
      .filter(t => t.author === MessageAuthor.Provider).map(t => host.messages.findAsync(t.id))))
      .map(t => (t?.details ?? []).filter(u => u.kind === DetailKind.Note).map(u => u.text).join(";"));
    const send = async (conversationId: string): Promise<void> => {
      await host.engine.sendAsync(new MessageSendParams(conversationId, `@${alice.name} look`, null, null, [], [alice.id]));
      await host.engine.waitForIdle();
    };

    await send(first.id);
    await send(first.id);
    await send(first.id);
    await send(second.id);

    const note = "The provider \"Gemini\" connected none of this chat's MCP servers, so TeamRun's tools aren't in this chat: Trust the folder first.";
    Assert.areEqual(note, Resources.formatSharedMcpServerFailed(untrusted));
    Assert.areEqual("TeamRun's tools aren't in this chat with the provider \"Gemini\": Check its settings.", Resources.formatSharedMcpServerFailed(
      new SharedMcpFailure(provider.id, provider.label, "teamrun", SharedMcpFailureKind.Unlisted, "Check its settings.")));
    Assert.areEqual(JSON.stringify([note, "", ""]), JSON.stringify(await notesOfAsync(first.id)));
    Assert.areEqual(JSON.stringify([note]), JSON.stringify(await notesOfAsync(second.id)));
  }

  @TestMethod
  public async givesNoSharedServersToATurnOfAnEngineBuiltWithoutThem(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.sharedServerUnavailable = () => null;
    const provider = await host.createProviderAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, provider.id, Harness.Provider, null, null));
    const conversation = await host.createConversationAsync();
    const server = await host.sharedServers.createAsync(new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null));
    await host.sharedServers.setProviderAsync(new SharedMcpProviderSetParams(server.id, provider.id, true));
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates,
      host.registry, host.events);

    await engine.sendAsync(new MessageSendParams(conversation.id, "@Alice look", null, null, [], [alice.id]));
    await engine.waitForIdle();

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(0, host.adapter.requests[0]?.sharedServers.length);
  }

  private static async checkpointRunAsync(host: CoreHost, conversationId: string, id: string, sequence: number, module: ReplyCheckpoints | null,
    folder: WorkFolder | null): Promise<{ run: ReplyRun; active: ActiveRun }> {
    const reply = new Message(id, conversationId, sequence, MessageAuthor.Provider, null, MessageStatus.Pending, [], ReplyRunTests.provenance, "t", null, null, [],
      "alice", "Alice");
    await host.messages.insertAsync(reply);
    const active = new ActiveRun(reply.id);
    return { run: new ReplyRun(reply, ReplyRunTests.provenance, active, host.messages, host.approvals, host.events, host.directory.path, null, null, null, null,
      null, module, folder), active };
  }

  private static checkpointEvents(host: CoreHost): readonly string[] {
    return host.listener.events.filter(t => t.name === EventName.ReplyCheckpointStarted || t.name === EventName.ReplyCheckpointEnded)
      .map(t => `${t.name}:${MessageIdParams.fromJson(t.payload).messageId}`);
  }

  private static subAgentStatus(message: Message): SubAgentStatus {
    return SubAgent.fromJson(message.details.find(t => t.kind === DetailKind.SubAgent)!.payload).status;
  }

  private static updatedApprovals(host: CoreHost): readonly string[] {
    return host.listener.events.filter(t => t.name === EventName.ApprovalUpdated).map(t => Approval.fromJson(t.payload).id);
  }

  private static notesOf(reply: Message | null | undefined): readonly unknown[] {
    return reply?.details.filter(t => t.kind === DetailKind.Note).map(t => t.payload) ?? [];
  }

  private static async runAsync(test: (host: CoreHost, tools: FakeTurnToolSessions, alice: Teammate) => Promise<void>): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, tools);
    await test(host, tools, await host.teammates.createAsync(new TeammateCreateParams("Alice", "Alice's role", (await host.createProviderAsync("fake", "Alice")).id, Harness.Provider, null,
      null)));
  }

  private static async replyAsync(host: CoreHost, alice: Teammate): Promise<Message> {
    const conversation = await host.createConversationAsync();
    const result = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Alice pay", null, null, [], [alice.id]));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]?.id ?? "");
    Assert.isDefined(reply);
    Assert.isNotNull(reply);
    return reply;
  }
}
