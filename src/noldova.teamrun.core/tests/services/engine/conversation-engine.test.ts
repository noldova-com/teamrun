/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, parse, sep } from "node:path";

import "@noldova/context.core";
import { SqlQuery } from "@noldova/context.data.sql";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { CaptureOutcome, ChangeStatus, CompareOutcome, PreviewOutcome, RestoreOutcome } from "@noldova/checkpoints.protocol";
import { ApprovalAsk, ConversationEngine, QuestionAsk, RequestDispatcher, Resources, TurnDetail, TurnOutcome, UsageLimit } from "@noldova/teamrun.core";
import {
  Approval,
  AttachmentInput,
  ApprovalDecideParams,
  ApprovalKind,
  ApprovalOption,
  ApprovalOutcome,
  ApprovalQuestion,
  ApprovalScope,
  ApprovalStatus,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMemberParams,
  ConversationMoveParams,
  ConversationRewindParams,
  ConversationRewindResult,
  ConversationRewoundPayload,
  DepartmentCreateParams,
  DepartmentMemberSetParams,
  DepartmentUpdateParams,
  DetailEventPayload,
  DetailKind,
  ErrorCode,
  EventName,
  Harness,
  Message,
  MessageAuthor,
  MessageIdParams,
  MessageListParams,
  MessageSendParams,
  MessageSendResult,
  MessageStatus,
  ProjectFolderChange,
  Provenance,
  ProviderEnabledParams,
  ProviderIdParams,
  QuestionAnswer,
  QuestionOption,
  RequestedSettings,
  MessageDetail,
  ObservedSettings,
  OrganizationChat,
  OrganizationParent,
  SubAgent,
  SubAgentStatus,
  TeammateCreateParams,
  TeammatePlaceParams
} from "@noldova/teamrun.protocol";

import { CoreHost } from "../../fixtures/core-host.fixture.js";
import { FailingDelivery } from "../../fixtures/failing-delivery.fixture.js";
import { GitRepository } from "../../fixtures/git-repository.fixture.js";
import { FakeProviderAdapter } from "../../fixtures/fake-provider-adapter.fixture.js";
import { FakeTurnToolSessions } from "../../fixtures/fake-turn-tool-sessions.fixture.js";

@TestClass
export class ConversationEngineTests {
  @TestMethod
  public async persistsFileOnlyMessagesAndRestoresTheirReferencesAfterRewind(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const settings = new RequestedSettings("fake", null, null);
    const result = await host.engine.sendAsync(new MessageSendParams(conversation.id, "", settings, (await host.providerOfAsync()).id,
      [new AttachmentInput("notes.txt", "text/plain", Buffer.from("durable file contents").toString("base64"), null)]));
    await host.runsEndAsync();
    const saved = (await host.messages.findAsync(result.sent.id))?.attachments[0];
    Assert.isDefined(saved);
    Assert.areEqual("durable file contents", readFileSync(saved!.path, "utf8"));
    Assert.areEqual(saved!.path, host.adapter.requests[0]?.attachments[0]?.path);
    Assert.isTrue(host.adapter.requests[0]?.prompt.includes(JSON.stringify(saved!.path)) ?? false);
    const second = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Second", settings, (await host.providerOfAsync()).id));
    await host.runsEndAsync();
    await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, second.sent.id, false));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "After rewind", settings, (await host.providerOfAsync()).id));
    await host.runsEndAsync();
    Assert.isTrue(host.adapter.requests.at(-1)?.prompt.includes(JSON.stringify(saved!.path)) ?? false);
    Assert.areEqual("durable file contents", readFileSync(saved!.path, "utf8"));
  }

  @TestMethod
  public async discardsCopiesWhenTheMessageTransactionFails(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.context.database.connection.executeAsync(new SqlQuery("CREATE TRIGGER reject_message BEFORE INSERT ON messages BEGIN SELECT RAISE(ABORT, 'fixture failure'); END"));
    const provider = await host.providerOfAsync();
    await Assert.throwsAsync(() => host.engine.sendAsync(new MessageSendParams(conversation.id, "test", new RequestedSettings("fake", null, null), provider.id,
      [new AttachmentInput("a.txt", "text/plain", "YQ==", null)])), Error);
    Assert.areEqual(0, readdirSync(join(host.directory.path, "attachments")).length);
    Assert.areEqual(0, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length);
    Assert.areEqual(0, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesASendWhoseChatMovesToAnotherProjectWhileItIsPlanned(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.openProjectAsync("beta");
    const params = await ConversationEngineTests.paramsAsync(host, conversation.id, "Check");
    const listAsync = host.teammates.listAsync.bind(host.teammates);
    const moves: unknown[] = [];
    host.teammates.listAsync = async transaction => {
      if (moves.length === 0)
        moves.push(await host.conversations.moveAsync(new ConversationMoveParams(conversation.id, other.id)));
      return listAsync(transaction);
    };

    const refused = await Assert.throwsAsync(() => host.engine.sendAsync(params), ServiceException);

    Assert.areEqual(JSON.stringify([ErrorCode.Conflict, Resources.chatMovedWhileSent]), JSON.stringify([refused.info.name, refused.message]));
    Assert.areEqual(1, moves.length);
    Assert.areEqual(other.id, (await host.conversations.findAsync(conversation.id))?.projectId);
    Assert.areEqual(0, (await host.messages.listAsync(ConversationEngineTests.list(conversation.id))).length);
    Assert.areEqual(0, host.adapter.requests.length);
  }

  @TestMethod
  public async refusesTheSecondOfTwoSendsThatBothFoundTheChatIdleWhileTheyWerePlanned(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const first = await ConversationEngineTests.paramsAsync(host, conversation.id, "First");
    const second = await ConversationEngineTests.paramsAsync(host, conversation.id, "Second");
    const both = Promise.withResolvers<void>();
    const gate = Promise.withResolvers<void>();
    const checks = { planned: 0 };
    host.adapter.holdTurn = () => gate.promise;
    const findOpenReplyAsync = host.messages.findOpenReplyAsync.bind(host.messages);
    host.messages.findOpenReplyAsync = async (chatId, transaction) => {
      const open = await findOpenReplyAsync(chatId, transaction);
      if (!Object.isUndefined(transaction) || checks.planned >= 2)
        return open;
      if (++checks.planned === 2)
        both.resolve();
      await both.promise;
      return open;
    };

    const outcomes = await Promise.all([first, second].map(params => host.engine.sendAsync(params).then(t => t.sent.details[0]?.text ?? null,
      (error: unknown) => error instanceof ServiceException ? [error.info.name, error.message] : String(error))));
    gate.resolve();
    await host.engine.waitForIdle();

    Assert.areEqual(JSON.stringify(["First", [ErrorCode.Conflict, Resources.formatReplyInProgress(conversation.id)]]), JSON.stringify(outcomes));
    Assert.areEqual("First", (await host.messages.listAsync(ConversationEngineTests.list(conversation.id))).filter(t => t.author === MessageAuthor.User)
      .map(t => t.details[0]?.text).join());
    Assert.areEqual(1, host.adapter.requests.length);
  }

  private static readonly accept: ApprovalOption = new ApprovalOption("accept", "Allow", ApprovalOutcome.Approved, ApprovalScope.Once);
  private static readonly decline: ApprovalOption = new ApprovalOption("decline", "Deny", ApprovalOutcome.Denied, ApprovalScope.Once);
  private static readonly ask: ApprovalAsk =
    new ApprovalAsk("req-1", ApprovalKind.Command, "commandExecution", "Run npm test", { command: "npm test" }, [ConversationEngineTests.accept, ConversationEngineTests.decline]);

  @TestMethod
  public async finalizesRepliesWhenEventDeliveryFailsAndReleasesTheProject(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const broken = FailingDelivery.on(host.events, {
      onEvent: event => {
        if (event.name === EventName.MessageCreated)
          throw new Error("delivery failed");
      }
    });
    const fail = await ConversationEngineTests.paramsAsync(host, conversation.id, "Fail");
    await Assert.throwsAsync(() => host.engine.sendAsync(fail), Error);
    Assert.isNull(await host.messages.findOpenReplyAsync(conversation.id));
    Assert.areEqual(MessageStatus.Failed, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).at(-1)?.status);
    broken[Symbol.dispose]();
    const terminalDelivery = FailingDelivery.on(host.events, {
      onEvent: event => {
        if (event.name === EventName.MessageUpdated)
          throw new Error("status delivery failed");
      }
    });
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Fail status"));
    await Assert.throwsAsync(() => host.engine.waitForIdle(), Error);
    Assert.areEqual(0, host.engine.activeRunCount);
    Assert.isNull(await host.messages.findOpenReplyAsync(conversation.id));
    terminalDelivery[Symbol.dispose]();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Recover"));
    await host.engine.waitForIdle();
    Assert.areEqual(MessageStatus.Completed, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).at(-1)?.status);
  }

  @TestMethod
  public async growsAStreamedDetailInPlace(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.detailTexts = [];
    host.adapter.streamedTexts = ["Hel", "Hello", "Hello world"];
    const conversation = await host.createConversationAsync();

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Stream"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);

    Assert.areEqual(1, reply?.details.length);
    Assert.areEqual("Hello world", reply?.details[0]?.text);
    Assert.areEqual(0, reply?.details[0]?.sequence);
    Assert.areEqual(1, host.listener.count(EventName.DetailAppended));
    Assert.areEqual(2, host.listener.count(EventName.DetailUpdated));
    const updated = host.listener.events.filter(t => t.name === EventName.DetailUpdated).map(t => DetailEventPayload.fromJson(t.payload).detail.text);
    Assert.areEqual("Hello,Hello world", updated.join(","));
  }

  @TestMethod
  public async routesOverlappingApprovalsByTheirOwnIdentifiers(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.approvalAsks = ["first", "second"].map(t => new ApprovalAsk(
      t, ApprovalKind.Command, "command", t, null, [ConversationEngineTests.accept, ConversationEngineTests.decline]));
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask twice"));
    await host.until("both approvals", async () => (await host.approvals.listPendingAsync(sent.replies[0]!.id)).length === 2, host.runs());
    const first = (await host.approvals.listPendingAsync(sent.replies[0]!.id)).find(t => t.summary === "first")!;
    const second = (await host.approvals.listPendingAsync(sent.replies[0]!.id)).find(t => t.summary === "second")!;
    await host.engine.decideAsync(new ApprovalDecideParams(second.id, "decline"));
    await host.until("the declined detail", async () => (await host.messages.findAsync(sent.replies[0]!.id))?.details.some(t => t.text === "second: decline") ?? false, host.runs());
    Assert.areEqual(MessageStatus.AwaitingApproval, (await host.messages.findAsync(sent.replies[0]!.id))?.status);
    await host.engine.decideAsync(new ApprovalDecideParams(first.id, "accept"));
    await host.engine.waitForIdle();
    const reply = (await host.messages.findAsync(sent.replies[0]!.id))!;
    Assert.areEqual(MessageStatus.Completed, reply.status);
    Assert.isTrue(reply.details.some(t => t.text === "first: accept"));
    Assert.areEqual(0, (await host.approvals.listPendingAsync(reply.id)).length);
  }

  @TestMethod
  public async allowsConcurrentConversationsAndKeepsDestructiveOperationsExclusive(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync();
    const repository = new GitRepository(project.rootPath);
    repository.write("base.txt", "base\n");
    repository.commit();
    const index = readFileSync(join(project.rootPath, ".git", "index"));
    const first = await host.createConversationAsync(project);
    const second = await host.createConversationAsync(project);
    const other = await host.openProjectAsync("other");
    host.adapter.holdUntilAbort = true;
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, first.id, "Wait"));
    await host.adapter.requested(1);
    Assert.areEqual(1, host.adapter.requests.length);
    try {
      const overlap = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, second.id, "Overlap"));
      await host.adapter.requested(2);
      Assert.areEqual(2, host.adapter.requests.length);
      Assert.areEqual(2, host.engine.activeRunCount);
      repository.write("shared.txt", "shared edits\n");
      await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
      Assert.areEqual(1, host.engine.activeRunCount);
      await Assert.throwsAsync(() => host.conversations.deleteAsync(new ConversationIdParams(first.id)), ServiceException);
      await Assert.throwsAsync(() => host.conversations.moveAsync(new ConversationMoveParams(first.id, other.id)), ServiceException);
      const failure = await ConversationEngineTests.rejection(host.engine.rewindAsync(new ConversationRewindParams(first.id, sent.sent.id, true)));
      Assert.areEqual(ErrorCode.Conflict, failure.info.name);
      Assert.isTrue((await host.messages.findAsync(sent.replies[0]!.id))?.details.some(t => t.text === Resources.formatOutsideChanges(["shared.txt"])) ?? false);
      await host.engine.cancelAsync(new MessageIdParams(overlap.replies[0]!.id));
      const during = await ConversationEngineTests.paramsAsync(host, second.id, "During rewind");
      const rewind = host.engine.rewindAsync(new ConversationRewindParams(first.id, sent.sent.id, true));
      const blocked = await ConversationEngineTests.rejection(host.engine.sendAsync(during));
      Assert.areEqual(ErrorCode.Conflict, blocked.info.name);
      await rewind;
      Assert.isTrue(index.equals(readFileSync(join(project.rootPath, ".git", "index"))));
    }
    finally {
      await host.engine.shutdown();
    }
    host.adapter.holdUntilAbort = false;
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, second.id, "After"));
    await host.engine.waitForIdle();
  }

  @TestMethod
  public async completesRepliesWhenTheCheckpointsModuleFailsBeforeOrAfterTheProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "file.txt": "original\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.checkpoints.captureError = new Error("secret capture text");
    const before = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Before"));
    await host.engine.waitForIdle();
    host.checkpoints.captureError = null;
    host.checkpoints.compareError = new Error("secret compare text");
    host.adapter.writeFiles = { "file.txt": "changed\n" };
    const after = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "After"));
    await host.engine.waitForIdle();
    const kind = Resources.formatFailureKind(new Error());

    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(before.replies[0]!.id))?.status);
    Assert.isNull(await host.messages.findCheckpointAsync(before.replies[0]!.id));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(after.replies[0]!.id))?.status);
    Assert.isFalse(Object.isNull(await host.messages.findCheckpointAsync(after.replies[0]!.id)));
    Assert.isUndefined((await host.messages.findAsync(after.replies[0]!.id))?.details.find(t => t.kind === DetailKind.FileChange));
    Assert.areEqual("changed\n", readFileSync(join(folder, "file.txt"), "utf8"));
    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(host.log.lines.includes(Resources.formatCheckpointNotTaken(before.replies[0]!.id, kind)));
    Assert.isTrue(host.log.lines.includes(Resources.formatChangesNotCompared(after.replies[0]!.id, kind)));
    Assert.isFalse(host.log.lines.some(t => t.includes("secret")));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async takesEachRepliesCheckpointOfItsProjectsFolderByTheProjectsId(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "file.txt": "original\n" });
    const project = await host.openProjectAsync("repo");
    const conversation = await host.createConversationAsync(project);

    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Hello"));
    await host.engine.waitForIdle();
    const capture = host.checkpoints.captures[0];

    Assert.areEqual(1, host.checkpoints.captures.length);
    Assert.areEqual(project.id, capture?.folder.identity);
    Assert.areEqual(folder, capture?.folder.path);
    Assert.areEqual(Resources.formatCheckpointLabel(sent.replies[0]!.id), capture?.label);
    Assert.isFalse(Object.isNull(await host.messages.findCheckpointAsync(sent.replies[0]!.id)));
    Assert.isNull(await host.messages.findCheckpointAsync(sent.sent.id));
  }

  @TestMethod
  public async sendsAMessageAndCompletesTheReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Hello"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);

    Assert.areEqual(MessageAuthor.User, result.sent.author);
    Assert.areEqual(0, result.sent.sequence);
    Assert.areEqual("Hello", result.sent.details[0]?.text);
    Assert.areEqual(MessageStatus.Pending, result.replies[0]!.status);
    Assert.areEqual(result.sent.id, result.replies[0]!.inReplyTo);
    Assert.areEqual(MessageStatus.Completed, reply?.status);
    Assert.areEqual("Working", reply?.details[0]?.text);
    Assert.areEqual("fake-large", reply?.provenance?.observed.model);
    Assert.areEqual("session-1", reply?.provenance?.nativeSessionId);
    Assert.isFalse(reply?.provenance?.resumedNativeSession === true);
    Assert.isFalse(Object.isNull(reply?.endedAt));
    Assert.areEqual(join(host.directory.path, "alpha"), host.adapter.requests[0]?.workingDirectory);
    Assert.areEqual(2, host.listener.count(EventName.MessageCreated));
    Assert.areEqual(1, host.listener.count(EventName.DetailAppended));
    Assert.isTrue(host.listener.count(EventName.MessageUpdated) >= 3);
    Assert.areEqual(0, host.engine.activeRunCount);
    Assert.isTrue((await host.context.database.changeFeed.readAfterAsync(0)).length >= 4);
  }

  @TestMethod
  public async resumesTheProvidersSessionOnTheNextMessage(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "First"));
    await host.engine.waitForIdle();

    const second = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Second"));
    await host.engine.waitForIdle();

    Assert.areEqual("session-1", host.adapter.requests[1]?.resumeNativeSessionId);
    Assert.isTrue((await host.messages.findAsync(second.replies[0]!.id))?.provenance?.resumedNativeSession === true);
    Assert.areEqual(4, (await host.messages.listAsync(ConversationEngineTests.list(conversation.id))).length);
  }

  @TestMethod
  public async waitsForAnApprovalDecision(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.approvalAsk = ConversationEngineTests.ask;
    const conversation = await host.createConversationAsync();

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Run the tests"));
    await host.until("the approval", async () => (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length === 1, host.runs());
    const pending = (await host.approvals.listAsync(new ConversationIdParams(conversation.id)))[0];
    Assert.isFalse(Object.isUndefined(pending));
    if (Object.isUndefined(pending))
      return;
    const awaiting = await host.messages.findAsync(result.replies[0]!.id);
    const decided = await host.engine.decideAsync(new ApprovalDecideParams(pending.id, "accept"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);
    const duplicate = await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(pending.id, "accept")), ServiceException);

    Assert.areEqual(ErrorCode.Conflict, duplicate.info.name);

    Assert.areEqual(MessageStatus.AwaitingApproval, awaiting?.status);
    Assert.areEqual(ApprovalStatus.Approved, decided.status);
    Assert.areEqual("accept", decided.decision);
    Assert.areEqual(MessageStatus.Completed, reply?.status);
    Assert.areEqual("decided accept", reply?.details[1]?.text);
    Assert.areEqual(1, host.listener.count(EventName.ApprovalCreated));
    Assert.areEqual(1, host.listener.count(EventName.ApprovalUpdated));
    Assert.areEqual(0, (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length);
  }

  @TestMethod
  public async cancelsARunningReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Wait"));
    await host.until("the running reply", async () => (await host.messages.findAsync(result.replies[0]!.id))?.status === MessageStatus.Running, host.runs());
    const cancelled = await host.engine.cancelAsync(new MessageIdParams(result.replies[0]!.id));

    Assert.areEqual(MessageStatus.Cancelled, cancelled.status);
    Assert.isFalse(Object.isNull(cancelled.endedAt));
    Assert.areEqual(1, cancelled.details.length);
    Assert.areNotEqual(DetailKind.Note, cancelled.details[0]?.kind);
    Assert.areEqual(ErrorCode.Conflict, (await ConversationEngineTests.rejection(host.engine.cancelAsync(new MessageIdParams(result.replies[0]!.id)))).info.name);
  }

  @TestMethod
  public async cancelsAReplyThatIsAwaitingApproval(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.approvalAsk = ConversationEngineTests.ask;
    const conversation = await host.createConversationAsync();

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Run the tests"));
    await host.until("the approval", async () => (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length === 1, host.runs());
    const cancelled = await host.engine.cancelAsync(new MessageIdParams(result.replies[0]!.id));
    const approval = await host.approvals.findAsync(host.listener.events.filter(t => t.name === EventName.ApprovalCreated).map(t => Approval.fromJson(t.payload).id)[0] ?? "");

    Assert.areEqual(MessageStatus.Cancelled, cancelled.status);
    Assert.areEqual(ApprovalStatus.Cancelled, approval?.status);
    Assert.areEqual(0, (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length);
  }

  @TestMethod
  public async recordsFailedAndThrowingTurns(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = "quota exhausted";
    const failed = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "One"));
    await host.engine.waitForIdle();
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.error = null;
    host.adapter.failWith = new Error("boom");
    const thrown = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Two"));
    await host.engine.waitForIdle();
    host.adapter.failWith = "text failure";
    const plain = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Three"));
    await host.engine.waitForIdle();

    const failedReply = await host.messages.findAsync(failed.replies[0]!.id);
    const thrownReply = await host.messages.findAsync(thrown.replies[0]!.id);

    Assert.areEqual(MessageStatus.Failed, failedReply?.status);
    Assert.areEqual("The provider's turn failed: quota exhausted", failedReply?.details[1]?.text);
    Assert.areEqual(DetailKind.Error, failedReply?.details[1]?.kind);
    Assert.areEqual(MessageStatus.Failed, thrownReply?.status);
    Assert.areEqual("The provider's turn failed: boom", thrownReply?.details[0]?.text);
    Assert.areEqual("The provider's turn failed: text failure", (await host.messages.findAsync(plain.replies[0]!.id))?.details[0]?.text);
  }

  @TestMethod
  public async logsEachFailedReplyByItsProviderAndKindButNeverItsText(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const prompt = "Summarize the plan in secret.md";
    host.adapter.outcome = TurnOutcome.Failed;
    host.adapter.error = prompt;
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "One", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    host.adapter.outcome = TurnOutcome.Completed;
    host.adapter.error = null;
    host.adapter.failWith = Object.assign(new TypeError(prompt), { code: "ERR_PROVIDER" });
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Two", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    host.adapter.failWith = prompt;
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Three"));
    await host.engine.waitForIdle();
    const usual = await host.providerOfAsync();

    const named = `A reply from fake with the provider ending in "${provider.id.slice(-Resources.loggedIdLength)}" ended in an error`;
    Assert.areEqual([
      `${named}: the provider reported a failed turn.`,
      `${named}: TypeError ERR_PROVIDER.`,
      `A reply from fake with the provider ending in "${usual.id.slice(-Resources.loggedIdLength)}" ended in an error: string.`
    ].join("\n"), host.log.lines.filter(t => t.startsWith("A reply from")).join("\n"));
    Assert.isFalse(host.log.lines.some(t => t.includes(prompt) || t.includes(provider.id) || t.includes(usual.id)));
  }

  @TestMethod
  public async logsAFailedReplyEvenWhenPublishingItsFailureThrows(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    host.adapter.failWith = new TypeError("Summarize the plan in secret.md");
    FailingDelivery.on(host.events, {
      onEvent: event => {
        if (event.name === EventName.MessageUpdated && Message.fromJson(event.payload).status === MessageStatus.Failed)
          throw new RangeError("The window is gone.");
      }
    });

    await host.engine.sendAsync(new MessageSendParams(conversation.id, "One", new RequestedSettings("fake", null, null), provider.id));
    await Assert.throwsAsync(() => host.engine.waitForIdle(), RangeError);

    Assert.areEqual(`A reply from fake with the provider ending in "${provider.id.slice(-Resources.loggedIdLength)}" ended in an error: TypeError.`,
      host.log.lines.filter(t => t.startsWith("A reply from")).join("\n"));
  }

  @TestMethod
  public async givesTheOrganizationRoleLineOnlyToTheChatsTeammateBeforeTheWholeMessageWithItsAttachmentAndMentions(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const grokProvider = await host.createProviderAsync("fake", "Grok");
    const benProvider = await host.createProviderAsync("fake", "Ben");
    const grok = await host.teammates.createAsync(new TeammateCreateParams("Grok", null, grokProvider.id, Harness.Provider, null, null));
    const ben = await host.teammates.createAsync(new TeammateCreateParams("Ben", null, benProvider.id, Harness.Provider, null, null));
    await host.organization.placeAsync(new TeammatePlaceParams(Resources.defaultOrganizationId, grok.id, OrganizationParent.person, 0));
    const chat = await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, grok.id));

    const result = await host.engine.sendAsync(new MessageSendParams(chat.id, "@Grok @Ben look", null, null,
      [new AttachmentInput("notes.txt", "text/plain", Buffer.from("notes").toString("base64"), null)], [grok.id, ben.id]));
    await host.engine.waitForIdle();
    const saved = (await host.messages.findAsync(result.sent.id))?.attachments[0];
    const promptOf = (providerId: string): string => host.adapter.requests.find(t => t.provider?.id === providerId)?.prompt ?? String.empty;
    const role = Resources.formatOrganizationRole(Resources.organizationNoDepartment, Resources.organizationReportsToPerson);

    Assert.areEqual(2, host.adapter.requests.length);
    Assert.isTrue(promptOf(grokProvider.id).includes(Resources.formatOrganizationRolePrompt(role, "@Grok @Ben look")));
    Assert.isFalse(promptOf(benProvider.id).includes(role));
    Assert.areEqual("true true true true", [grokProvider, benProvider]
      .flatMap(t => [promptOf(t.id).includes("@Ben look"), promptOf(t.id).includes(JSON.stringify(saved?.path ?? "missing"))]).join(" "));
    Assert.areEqual("@Grok @Ben look", (await host.messages.findAsync(result.sent.id))?.details[0]?.text);
  }

  @TestMethod
  public async tellsADepartmentsLeaderAndMemberTheirPlaceAndWhomTheyReportToAndReopensATeammatesChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const type = await host.typeAsync();
    const leadProvider = await host.createProviderAsync("fake", "Lead");
    const memberProvider = await host.createProviderAsync("fake", "Member");
    const lead = await host.teammates.createAsync(new TeammateCreateParams("Lead", null, leadProvider.id, Harness.Provider, null, null));
    const member = await host.teammates.createAsync(new TeammateCreateParams("Member", null, memberProvider.id, Harness.Provider, null, null));
    const design = await host.organization.createAsync(new DepartmentCreateParams(Resources.defaultOrganizationId, "Design", type, OrganizationParent.person));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(Resources.defaultOrganizationId, lead.id, design.id));
    await host.organization.setMemberAsync(new DepartmentMemberSetParams(Resources.defaultOrganizationId, member.id, design.id));
    await host.organization.updateAsync(new DepartmentUpdateParams(Resources.defaultOrganizationId, design.id, undefined, lead.id));
    const leadChat = await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, lead.id));
    const memberChat = await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, member.id));
    const reopened = await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, member.id));

    await host.engine.sendAsync(new MessageSendParams(leadChat.id, "@Lead Status?", null, null, [], [lead.id]));
    await host.engine.sendAsync(new MessageSendParams(memberChat.id, "@Member Status?", null, null, [], [member.id]));
    await host.engine.waitForIdle();
    const promptOf = (providerId: string): string => host.adapter.requests.find(t => t.provider?.id === providerId)?.prompt ?? String.empty;

    Assert.areEqual(memberChat.id, reopened.id);
    Assert.isTrue(promptOf(leadProvider.id).includes(Resources.formatOrganizationRole(Resources.formatOrganizationLeader("Design"),
      Resources.organizationReportsToPerson)));
    Assert.isTrue(promptOf(memberProvider.id).includes(Resources.formatOrganizationRole(Resources.formatOrganizationMember("Design"), "Lead")));
  }

  @TestMethod
  public async givesNoOrganizationRoleLineToATeammateOutsideTheOrganization(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const provider = await host.createProviderAsync("fake", "Grok");
    const grok = await host.teammates.createAsync(new TeammateCreateParams("Grok", null, provider.id, Harness.Provider, null, null));
    const chat = await host.engine.openOrganizationChatAsync(new OrganizationChat(Resources.defaultOrganizationId, grok.id));

    const result = await host.engine.sendAsync(new MessageSendParams(chat.id, "@Grok look", null, null, [], [grok.id]));
    await host.engine.waitForIdle();

    Assert.isFalse((host.adapter.requests[0]?.prompt ?? "missing").includes(Resources.formatOrganizationRole(Resources.organizationNoDepartment,
      Resources.organizationReportsToPerson)));
    Assert.isTrue((host.adapter.requests[0]?.prompt ?? String.empty).includes("look"));
    Assert.isNull((await host.messages.findAsync(result.sent.id))?.details[0]?.payload ?? null);
  }

  @TestMethod
  public async runsTheGroupsOtherRepliesWhenOneReplysFailureEscapes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ana = await host.teammates.createAsync(new TeammateCreateParams("Ana", null, provider.id, Harness.Provider, null, null));
    const ben = await host.teammates.createAsync(new TeammateCreateParams("Ben", null, provider.id, Harness.Provider, null, null));
    host.adapter.steps = [(): void => {
      if (host.adapter.requests.length === 1)
        throw new TypeError("Ana's turn broke.");
    }];
    FailingDelivery.on(host.events, {
      onEvent: event => {
        if (event.name === EventName.MessageUpdated && Message.fromJson(event.payload).status === MessageStatus.Failed)
          throw new RangeError("The window is gone.");
      }
    });

    const result = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ana @Ben go", null, null, [], [ana.id, ben.id]));
    await Assert.throwsAsync(() => host.engine.waitForIdle(), RangeError);
    const [failed, answered] = await Promise.all(result.replies.map(t => host.messages.findAsync(t.id)));

    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual([ana.id, ben.id].join(), [failed?.teammateId, answered?.teammateId].join());
    Assert.areEqual(MessageStatus.Failed, failed?.status);
    Assert.areEqual(Resources.formatTurnFailed("Ana's turn broke."), failed?.details.at(-1)?.text);
    Assert.areEqual(MessageStatus.Completed, answered?.status);
  }

  @TestMethod
  public async failsAReplyAsNotFoundWhenItsChatIsGoneBeforeItsTurnAndClosesTheGroup(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ana = await host.teammates.createAsync(new TeammateCreateParams("Ana", null, provider.id, Harness.Provider, null, null));
    const ben = await host.teammates.createAsync(new TeammateCreateParams("Ben", null, provider.id, Harness.Provider, null, null));
    const findAsync = host.conversations.findAsync.bind(host.conversations);
    let gone = false;
    host.conversations.findAsync = async (id, transaction) => gone && id === conversation.id ? null : await findAsync(id, transaction);
    host.adapter.steps = [(): void => {
      gone = true;
    }];

    const result = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ana @Ben go", null, null, [], [ana.id, ben.id]));
    const thrown = await Assert.throwsAsync(() => host.engine.waitForIdle(), ServiceException);
    gone = false;
    const first = result.replies[0];
    const second = result.replies[1];
    Assert.isDefined(first);
    Assert.isDefined(second);
    const answered = await host.messages.findAsync(first.id);
    const failed = await host.messages.findAsync(second.id);
    Assert.isNotNull(answered);
    Assert.isNotNull(failed);
    const note = failed.details.at(-1);
    Assert.isDefined(note);

    Assert.areEqual(ErrorCode.NotFound, thrown.info.name);
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual([ana.id, ben.id].join(), [answered.teammateId, failed.teammateId].join());
    Assert.areEqual([MessageStatus.Completed, MessageStatus.Failed].join(), [answered.status, failed.status].join());
    Assert.areEqual(Resources.formatConversationNotFound(conversation.id), note.text);
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async keepsAReplyStoppedWhileItsTurnIsPreparedCancelledWhenThePreparationFails(): Promise<void> {
    const stops: Promise<unknown>[] = [];
    let conversationId = String.empty;
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, () => {
      stops.push(host.engine.cancelConversationAsync(new ConversationIdParams(conversationId)).catch((error: unknown) => error));
      return Promise.reject(new RangeError("The command settings are locked."));
    });
    conversationId = (await host.createConversationAsync()).id;

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversationId, "One"));
    await Assert.throwsAsync(() => host.engine.waitForIdle(), RangeError);
    const stopped = await Promise.all(stops);
    const reply = await host.messages.findAsync(result.replies[0]?.id ?? String.empty);

    Assert.areEqual(1, stopped.length);
    Assert.isTrue(stopped[0] instanceof RangeError);
    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual(MessageStatus.Cancelled, reply?.status);
    Assert.areEqual(`${DetailKind.Error} The command settings are locked.`, reply?.details.map(t => `${t.kind} ${t.text}`).join());
  }

  @TestMethod
  public async failsAReplyWhosePreparationThrowsAValueThatIsNotAnErrorWithThatValuesText(): Promise<void> {
    const failure = "The command settings are locked.";
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, () => {
      throw failure;
    });
    const conversation = await host.createConversationAsync();

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "One"));
    const ended = await host.engine.waitForIdle().then(() => null, (error: unknown) => error);
    const reply = await host.messages.findAsync(result.replies[0]?.id ?? String.empty);

    Assert.areEqual(failure, ended);
    Assert.areEqual(MessageStatus.Failed, reply?.status);
    Assert.areEqual(`${DetailKind.Error} ${failure}`, reply?.details.map(t => `${t.kind} ${t.text}`).join());
  }

  @TestMethod
  public async closesAReplysToolsBeforeNotingItsUsageLimitAndWhenThatFails(): Promise<void> {
    const tools = new FakeTurnToolSessions();
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, undefined, tools);
    const conversation = await host.createConversationAsync();
    host.adapter.limits.set((await host.providerOfAsync()).id, new UsageLimit(null));
    const endsWhenNoted: number[] = [];
    host.planUsage.list = (): never => {
      endsWhenNoted.push(tools.opened[0]?.ends ?? 0);
      throw new RangeError("The plan usage is unreadable.");
    };

    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "One"));
    await Assert.throwsAsync(() => host.engine.waitForIdle(), RangeError);

    Assert.areEqual(1, tools.opened.length);
    Assert.areEqual(1, endsWhenNoted.at(-1));
    Assert.areEqual(1, tools.opened[0]?.ends);
  }

  @TestMethod
  public async runsTheGroupsOtherRepliesWhenWritingOneReplysFailureAlsoFails(): Promise<void> {
    let reads = 0;
    await using host = await CoreHost.createAsync(false, false, undefined, undefined, () => {
      reads += 1;
      return reads === 1 ? Promise.reject(new TypeError("The command settings are locked.")) : Promise.resolve(null);
    });
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();
    const ana = await host.teammates.createAsync(new TeammateCreateParams("Ana", null, provider.id, Harness.Provider, null, null));
    const ben = await host.teammates.createAsync(new TeammateCreateParams("Ben", null, provider.id, Harness.Provider, null, null));
    FailingDelivery.on(host.events, {
      onEvent: event => {
        if (event.name === EventName.MessageUpdated && Message.fromJson(event.payload).status === MessageStatus.Failed)
          throw new RangeError("The window is gone.");
      }
    });

    const result = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ana @Ben go", null, null, [], [ana.id, ben.id]));
    await Assert.throwsAsync(() => host.engine.waitForIdle(), TypeError);
    const [failed, answered] = await Promise.all(result.replies.map(t => host.messages.findAsync(t.id)));

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual([ana.id, ben.id].join(), [failed?.teammateId, answered?.teammateId].join());
    Assert.areEqual(MessageStatus.Failed, failed?.status);
    Assert.areEqual(MessageStatus.Completed, answered?.status);
  }

  @TestMethod
  public async logsAReplyFailedBeforeItsRunByItsKindButNeverTheErrorsText(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const prompt = "Summarize the plan in secret.md";
    FailingDelivery.on(host.events, {
      onEvent: event => {
        if (event.name === EventName.MessageCreated)
          throw new RangeError(prompt);
      }
    });

    const fail = await ConversationEngineTests.paramsAsync(host, conversation.id, "Fail");
    await Assert.throwsAsync(() => host.engine.sendAsync(fail), RangeError);

    Assert.areEqual(MessageStatus.Failed, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).at(-1)?.status);
    Assert.areEqual(`A reply from fake with the provider ending in "${(await host.providerOfAsync()).id.slice(-Resources.loggedIdLength)}" ended in an error: RangeError.`,
      host.log.lines.join("\n"));
  }

  @TestMethod
  public async recordsAnInterruptedTurn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.outcome = TurnOutcome.Interrupted;

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "One"));
    await host.engine.waitForIdle();

    Assert.areEqual(MessageStatus.Interrupted, (await host.messages.findAsync(result.replies[0]!.id))?.status);
  }

  @TestMethod
  public async rejectsASecondMessageWhileAReplyIsOpen(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();

    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "First"));
    const failure = await ConversationEngineTests.rejection(host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Second")));
    await host.engine.shutdown();

    Assert.areEqual(ErrorCode.Conflict, failure.info.name);
    Assert.areEqual(0, host.engine.activeRunCount);
    Assert.areEqual(MessageStatus.Cancelled, (await host.messages.listAsync(ConversationEngineTests.list(conversation.id)))[1]?.status);
  }

  @TestMethod
  public async rejectsUnknownConversationsProvidersAndProviders(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const other = new FakeProviderAdapter("other");
    host.registry.register(other);
    const conversation = await host.createConversationAsync();
    const otherProvider = await host.createProviderAsync("other", "Other");

    const missingConversation = await ConversationEngineTests.rejection(host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, "nope", "Hi")));
    const missingKind = await ConversationEngineTests.rejection(host.engine.sendAsync(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("nope", null, null), otherProvider.id)));
    const missingProvider = await ConversationEngineTests.rejection(host.engine.sendAsync(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), "acc-nope")));
    const mismatch = await ConversationEngineTests.rejection(host.engine.sendAsync(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), otherProvider.id)));

    Assert.areEqual(ErrorCode.NotFound, missingConversation.info.name);
    Assert.areEqual(ErrorCode.InvalidParams, missingKind.info.name);
    Assert.areEqual(ErrorCode.NotFound, missingProvider.info.name);
    Assert.areEqual(ErrorCode.InvalidParams, mismatch.info.name);
  }

  @TestMethod
  public async refusesAPersonsSendThatNamesAKindAndNoProviderStoringAndRunningNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();

    const refused = await ConversationEngineTests.rejection(host.engine.sendAsync(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", "m1", null), null)));

    Assert.areEqual(ErrorCode.InvalidParams, refused.info.name);
    Assert.areEqual("The send names the kind \"fake\" but no provider; name one of its providers.", refused.info.message);
    Assert.areEqual("fake", refused.info.arguments.join());
    Assert.areEqual(0, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length);
    Assert.areEqual(0, host.adapter.requests.length);
  }

  @TestMethod
  public async sendsThroughAProviderAndResumesOnlyThatProvidersSession(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provider = await host.createProviderAsync();

    const first = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Hi", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Again", new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id));
    await host.engine.waitForIdle();

    Assert.areEqual(provider.id, (await host.messages.findAsync(first.replies[0]!.id))?.provenance?.providerId);
    Assert.areEqual(provider.id, host.adapter.requests[0]?.provider?.id);
    Assert.isNull(host.adapter.requests[1]?.resumeNativeSessionId);
  }

  @TestMethod
  public async failsWhenTheProjectRowIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    await host.context.database.connection.executeAsync(new SqlQuery("PRAGMA foreign_keys = OFF"));
    await host.context.database.connection.executeAsync(new SqlQuery("DELETE FROM projects"));

    const failure = await ConversationEngineTests.rejection(host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Hi")));

    Assert.areEqual(ErrorCode.NotFound, failure.info.name);
  }

  @TestMethod
  public async takesOnlyAnswersThatFitTheQuestionsAndKeepsNoneToASecretQuestion(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionAsk = new QuestionAsk("req-q", "AskUserQuestion", [
      new ApprovalQuestion("platform", "Platform", "Which platform?", [new QuestionOption("Desktop app", "The window"), new QuestionOption("Web", "A browser")],
        false, false, false),
      new ApprovalQuestion("parts", "Parts", "Which parts?", [new QuestionOption("Attachments", "Files"), new QuestionOption("Slash commands", "Commands")],
        true, false, false),
      new ApprovalQuestion("token", "Token", "Which token?", [], false, true, true)
    ]);
    const conversation = await host.createConversationAsync();
    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    await host.until("the approval", async () => (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length === 1, host.runs());
    const approval = (await host.approvals.listAsync(new ConversationIdParams(conversation.id)))[0]!;
    const refused = async (optionId: string, answers: readonly QuestionAnswer[] | null): Promise<string> =>
      (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(approval.id, optionId, answers)), ServiceException)).info.name;
    const answers = [new QuestionAnswer("platform", ["Desktop app"], null), new QuestionAnswer("parts", ["Attachments", "Slash commands"], null),
      new QuestionAnswer("token", [], "s3cret")];

    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.answerOptionId, null));
    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.answerOptionId, []));
    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.skipOptionId, answers));
    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.answerOptionId, [new QuestionAnswer("size", ["Big"], null)]));
    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.answerOptionId, [answers[0]!, new QuestionAnswer("platform", ["Web"], null)]));
    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.answerOptionId, [new QuestionAnswer("platform", ["Phone"], null)]));
    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.answerOptionId, [new QuestionAnswer("platform", ["Desktop app", "Web"], null)]));
    Assert.areEqual(ErrorCode.InvalidParams, await refused(Resources.answerOptionId, [new QuestionAnswer("platform", [], "Phone")]));
    Assert.areEqual(ApprovalStatus.Pending, (await host.approvals.findAsync(approval.id))?.status);
    const decided = await host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.answerOptionId, answers));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);

    Assert.areEqual(ApprovalStatus.Approved, decided.status);
    Assert.areEqual("platform,parts", decided.answers?.map(t => t.questionId).join(","));
    Assert.areEqual("platform,parts", (await host.approvals.findAsync(approval.id))?.answers?.map(t => t.questionId).join(","));
    Assert.isFalse(JSON.stringify((await host.approvals.findAsync(approval.id))?.toJson()).includes("s3cret"));
    const published = host.listener.events.filter(t => t.name === EventName.ApprovalUpdated).map(t => Approval.fromJson(t.payload));
    Assert.areEqual("platform,parts", published.at(-1)?.answers?.map(t => t.questionId).join(","));
    Assert.isFalse(published.some(t => JSON.stringify(t.toJson()).includes("s3cret")));
    Assert.areEqual(`answered ${JSON.stringify(answers.map(t => t.toJson()))}`, reply?.details.at(-1)?.text);
    Assert.areEqual(approval.id, (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).map(t => t.id).join(","));
  }

  @TestMethod
  public async queuesAnswersGivenWhileThePostingTurnRunsAndSendsEachAsTheNextMessageOnceTheTurnBeforeEnds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const turn = Promise.withResolvers<void>();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1"), ConversationEngineTests.posted("msg-2")];
    host.adapter.formatQuestionReply = (replyTo, question, answer) => `reply ${replyTo}: ${question} = ${answer}`;
    host.adapter.holdTurn = () => turn.promise;
    const conversation = await host.createConversationAsync();
    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 2);
    const first = ConversationEngineTests.at(posted, 0);
    const second = ConversationEngineTests.at(posted, 1);

    Assert.areEqual(ApprovalKind.Question, first.kind);
    Assert.areEqual("request_user_input_async", first.nativeKind);
    Assert.areEqual("Which platform?\nPick one", first.summary);
    Assert.areEqual(JSON.stringify([{ replyTo: "msg-1" }, { replyTo: "msg-2" }]), JSON.stringify([first.payload, second.payload]));
    Assert.areEqual(MessageStatus.Running, (await host.messages.findAsync(ConversationEngineTests.at(result.replies, 0).id))?.status);
    const decided = await host.engine.decideAsync(new ApprovalDecideParams(first.id, Resources.answerOptionId,
      [new QuestionAnswer("0", ["Desktop app"], "and the web"), new QuestionAnswer("1", [], "Nothing")]));
    await host.engine.decideAsync(new ApprovalDecideParams(second.id, Resources.answerOptionId, [new QuestionAnswer("1", [], "Later")]));
    Assert.areEqual(ApprovalStatus.Approved, decided.status);
    Assert.areEqual(2, (await host.messages.listAsync(ConversationEngineTests.list(conversation.id))).length);
    Assert.areEqual(1, host.adapter.requests.length);

    host.adapter.questionPosts = [];
    turn.resolve();
    await host.adapter.requested(3);
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(ConversationEngineTests.list(conversation.id));

    Assert.areEqual(6, messages.length);
    Assert.areEqual([MessageStatus.Completed, MessageStatus.Completed, MessageStatus.Completed].join(), [messages[1], messages[3], messages[5]].map(t => t?.status).join());
    Assert.areEqual(MessageAuthor.User, messages[2]?.author);
    Assert.areEqual("> Which platform?\n> Pick one\n\nDesktop app, and the web\n\n> Anything else?\n\nNothing", messages[2]?.details[0]?.text);
    Assert.isTrue(host.adapter.requests[1]?.prompt.endsWith("reply msg-1: Which platform?\nPick one = Desktop app, and the web\nreply msg-1: Anything else? = Nothing") ?? false);
    Assert.areEqual("> Anything else?\n\nLater", messages[4]?.details[0]?.text);
    Assert.isTrue(host.adapter.requests[2]?.prompt.endsWith("reply msg-2: Anything else? = Later") ?? false);
    Assert.areEqual(ApprovalStatus.Approved, (await host.approvals.findAsync(first.id))?.status);
    Assert.areEqual(JSON.stringify([{ replyTo: "msg-1" }, { replyTo: "msg-2" }]),
      JSON.stringify((await Promise.all([first.id, second.id].map(t => host.approvals.findAsync(t)))).map(t => t?.payload)));
    Assert.areEqual(0, (await host.approvals.listUnsentAnswersAsync()).length);
  }

  @TestMethod
  public async keepsAPostedQuestionOpenAfterItsTurnEndsAndSendsAnAnswerToItAtOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1")];
    const conversation = await host.createConversationAsync();
    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    await host.engine.waitForIdle();
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 1);
    const approval = ConversationEngineTests.at(posted, 0);

    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(ConversationEngineTests.at(result.replies, 0).id))?.status);
    Assert.areEqual(ApprovalStatus.Pending, approval.status);
    host.adapter.questionPosts = [];
    await host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(ConversationEngineTests.list(conversation.id));

    Assert.areEqual("> Which platform?\n> Pick one\n\nWeb", messages[2]?.details[0]?.text);
    Assert.isTrue(host.adapter.requests[1]?.prompt.endsWith("> Which platform?\n> Pick one\n\nWeb") ?? false);
    Assert.areEqual(4, messages.length);
    Assert.areEqual(MessageStatus.Completed, messages[3]?.status);
  }

  @TestMethod
  public async sendsAnAnswerToAPostedQuestionToTheTeammateThatAskedIt(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1")];
    const conversation = await host.createConversationAsync();
    const alice = await host.teammates.createAsync(new TeammateCreateParams("Alice", null, (await host.providerOfAsync()).id, Harness.Provider, null, null));
    await host.conversations.addMemberAsync(new ConversationMemberParams(conversation.id, alice.id));
    await host.engine.sendAsync(new MessageSendParams(conversation.id, "Ask me", null, null, [], [], alice.id));
    await host.engine.waitForIdle();
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 1);
    const approval = ConversationEngineTests.at(posted, 0);
    host.adapter.questionPosts = [];

    await host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(ConversationEngineTests.list(conversation.id));

    Assert.areEqual(4, messages.length);
    Assert.areEqual(alice.id, messages[3]?.teammateId);
    Assert.areEqual(MessageStatus.Completed, messages[3]?.status);
  }

  @TestMethod
  public async closesASkippedPostedQuestionAndSendsNothing(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1")];
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    await host.engine.waitForIdle();
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 1);
    const approval = ConversationEngineTests.at(posted, 0);

    const skipped = await host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.skipOptionId));
    await host.engine.waitForIdle();

    Assert.areEqual(ApprovalStatus.Denied, skipped.status);
    Assert.areEqual(ApprovalStatus.Denied, (await host.approvals.findAsync(approval.id))?.status);
    Assert.areEqual(2, (await host.messages.listAsync(ConversationEngineTests.list(conversation.id))).length);
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(ErrorCode.Conflict,
      (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.skipOptionId)), ServiceException)).info.name);
  }

  @TestMethod
  public async cancelsTheOpenPostedQuestionsOfAStoppedReplyAndStillSendsAnAnswerGivenBeforeTheStop(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1"), ConversationEngineTests.posted("msg-2")];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 2);
    const answered = ConversationEngineTests.at(posted, 0);
    const open = ConversationEngineTests.at(posted, 1);
    await host.engine.decideAsync(new ApprovalDecideParams(answered.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    host.adapter.questionPosts = [];
    host.adapter.holdUntilAbort = false;

    await host.engine.cancelAsync(new MessageIdParams(ConversationEngineTests.at(result.replies, 0).id));
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(ConversationEngineTests.list(conversation.id));

    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.findAsync(open.id))?.status);
    Assert.areEqual(ApprovalStatus.Approved, (await host.approvals.findAsync(answered.id))?.status);
    Assert.areEqual(MessageStatus.Cancelled, messages[1]?.status);
    Assert.areEqual("> Which platform?\n> Pick one\n\nWeb", messages[2]?.details[0]?.text);
    Assert.areEqual(4, messages.length);
  }

  @TestMethod
  public async dropsThePostedQuestionsOfADeletedChat(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1")];
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    await host.engine.waitForIdle();
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 1);
    const approval = ConversationEngineTests.at(posted, 0);

    await host.conversations.deleteAsync(new ConversationIdParams(conversation.id));

    Assert.isNull(await host.approvals.findAsync(approval.id));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.answerOptionId,
      [new QuestionAnswer("0", ["Web"], null)])), ServiceException)).info.name);
    await host.engine.waitForIdle();
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async logsAnAnswerToAPostedQuestionItCouldntSend(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1")];
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    await host.engine.waitForIdle();
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 1);
    const approval = ConversationEngineTests.at(posted, 0);
    await host.providers.setEnabledAsync(new ProviderEnabledParams((await host.providerOfAsync()).id, false));
    const logged = Resources.formatQuestionReplyNotSent(conversation.id, "ServiceException");

    const decided = await host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    await host.until("the reply-not-sent line", () => host.log.lines.includes(logged));

    Assert.areEqual(ApprovalStatus.Approved, decided.status);
    Assert.areEqual(2, (await host.messages.listAsync(ConversationEngineTests.list(conversation.id))).length);
    Assert.areEqual(1, host.adapter.requests.length);
  }

  @TestMethod
  public async neitherKeepsNorSendsTheAnswerToASecretPostedQuestion(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const turn = Promise.withResolvers<void>();
    host.adapter.questionPosts = [ConversationEngineTests.postedSecret("msg-1"), ConversationEngineTests.postedSecret("msg-2")];
    host.adapter.formatQuestionReply = (replyTo, question, answer) => `reply ${replyTo}: ${question} = ${answer}`;
    host.adapter.holdTurn = () => turn.promise;
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 2);
    const first = ConversationEngineTests.at(posted, 0);
    const second = ConversationEngineTests.at(posted, 1);
    const decided = await host.engine.decideAsync(new ApprovalDecideParams(first.id, Resources.answerOptionId,
      [new QuestionAnswer("0", ["Web"], null), new QuestionAnswer("1", [], "hunter2")]));
    const secretOnly = await host.engine.decideAsync(new ApprovalDecideParams(second.id, Resources.answerOptionId, [new QuestionAnswer("1", [], "hunter2")]));

    host.adapter.questionPosts = [];
    turn.resolve();
    await host.adapter.requested(2);
    await host.engine.waitForIdle();
    const messages = await host.messages.listAsync(ConversationEngineTests.list(conversation.id));

    Assert.areEqual("0", decided.answers?.map(t => t.questionId).join(","));
    Assert.areEqual("0", (await host.approvals.findAsync(first.id))?.answers?.map(t => t.questionId).join(","));
    Assert.areEqual(0, secretOnly.answers?.length);
    Assert.areEqual(JSON.stringify({ replyTo: "msg-2" }), JSON.stringify(secretOnly.payload));
    Assert.areEqual(4, messages.length);
    Assert.areEqual("> Which platform?\n> Pick one\n\nWeb", messages[2]?.details[0]?.text);
    Assert.isFalse(host.adapter.requests.some(t => t.prompt.includes("hunter2")));
  }

  @TestMethod
  public async keepsAnAnswerQueuedAtQuitUnsentAndSendsItAfterTheNextStart(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1")];
    host.adapter.formatQuestionReply = (replyTo, question, answer) => `reply ${replyTo}: ${question} = ${answer}`;
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 1);
    const approval = ConversationEngineTests.at(posted, 0);
    const decided = await host.engine.decideAsync(new ApprovalDecideParams(approval.id, Resources.answerOptionId, [new QuestionAnswer("0", ["Web"], null)]));
    host.adapter.questionPosts = [];
    host.adapter.holdUntilAbort = false;

    await host.engine.shutdown();

    Assert.areEqual(JSON.stringify({ replyTo: "msg-1", answerUnsent: true }), JSON.stringify(decided.payload));
    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(2, (await host.messages.listAsync(ConversationEngineTests.list(conversation.id))).length);
    Assert.areEqual(approval.id, (await host.approvals.listUnsentAnswersAsync()).map(t => t.id).join(","));
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates, host.registry, host.events);

    await engine.reconcileAsync();
    await host.adapter.requested(2);
    await engine.waitForIdle();
    const messages = await host.messages.listAsync(ConversationEngineTests.list(conversation.id));

    Assert.areEqual("> Which platform?\n> Pick one\n\nWeb", messages[2]?.details[0]?.text);
    Assert.isTrue(host.adapter.requests[1]?.prompt.endsWith("reply msg-1: Which platform?\nPick one = Web") ?? false);
    Assert.areEqual(MessageStatus.Completed, messages[3]?.status);
    Assert.areEqual(JSON.stringify({ replyTo: "msg-1" }), JSON.stringify((await host.approvals.findAsync(approval.id))?.payload));
    Assert.areEqual(0, (await host.approvals.listUnsentAnswersAsync()).length);
  }

  @TestMethod
  public async keepsPostedQuestionsOpenWhenItMarksAReplyAnEarlierRuntimeLeftOpenInterrupted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    host.adapter.questionPosts = [ConversationEngineTests.posted("msg-1")];
    host.adapter.holdUntilAbort = true;
    const conversation = await host.createConversationAsync();
    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Ask me"));
    const posted = await ConversationEngineTests.postsAsync(host, conversation.id, 1);
    const approval = ConversationEngineTests.at(posted, 0);
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates, host.registry, host.events);
    const reply = ConversationEngineTests.at(result.replies, 0);

    await engine.reconcileAsync();

    Assert.areEqual(MessageStatus.Interrupted, (await host.messages.findAsync(reply.id))?.status);
    Assert.areEqual(ApprovalStatus.Pending, (await host.approvals.findAsync(approval.id))?.status);
    host.adapter.holdUntilAbort = false;
    await host.engine.cancelAsync(new MessageIdParams(reply.id));
    await host.engine.waitForIdle();
  }

  @TestMethod
  public async decidesApprovalsWithValidation(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Hi"));
    await host.engine.waitForIdle();
    const orphan = new Approval("apr-1", result.replies[0]!.id, ApprovalKind.Tool, "Bash", "Run", null,
      [ConversationEngineTests.accept], ApprovalStatus.Pending, null, "t", null);
    await host.approvals.insertAsync(orphan);

    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(orphan.id, "accept")), ServiceException)).info.name);
    Assert.areEqual(ApprovalStatus.Pending, (await host.approvals.findAsync(orphan.id))?.status);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams("nope", "accept")), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(orphan.id, "accept")), ServiceException)).info.name);
    const fresh = new Approval("apr-2", result.replies[0]!.id, ApprovalKind.Tool, "Bash", "Run", null,
      [ConversationEngineTests.accept], ApprovalStatus.Pending, null, "t", null);
    await host.approvals.insertAsync(fresh);
    Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(fresh.id, "mystery")), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.InvalidParams, (await Assert.throwsAsync(() => host.engine.decideAsync(new ApprovalDecideParams(fresh.id, "accept", [new QuestionAnswer("q", ["Yes"], null)])),
      ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await ConversationEngineTests.rejection(host.engine.cancelAsync(new MessageIdParams("nope")))).info.name);
  }

  @TestMethod
  public async reconcilesRepliesAnEarlierRuntimeLeftOpen(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.adapter.holdUntilAbort = true;
    host.adapter.approvalAsk = new ApprovalAsk("r1", ApprovalKind.Command, "exec", "run", null, [ConversationEngineTests.accept]);
    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Hold"));
    await host.until("the approval", async () => (await host.approvals.listAsync(new ConversationIdParams(conversation.id))).length === 1, host.runs());
    const pendingApproval = (await host.approvals.listAsync(new ConversationIdParams(conversation.id)))[0]!;
    const engine = new ConversationEngine(host.context, host.projects, host.conversations, host.messages, host.approvals, host.providers, host.teammates, host.registry, host.events);

    const interrupted = await engine.reconcileAsync();
    const reply = await host.messages.findAsync(result.replies[0]!.id);

    Assert.areEqual(1, interrupted.length);
    Assert.areEqual(MessageStatus.Interrupted, reply?.status);
    Assert.areEqual("The runtime stopped before this reply ended.", reply?.details[reply.details.length - 1]?.text);
    Assert.isFalse(Object.isNull(reply?.endedAt));
    Assert.isNotNull(reply!.startedAt);
    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.findAsync(pendingApproval.id))?.status);
    Assert.isNull(await host.messages.findOpenReplyAsync(conversation.id));
    Assert.areEqual(0, (await engine.reconcileAsync()).length);
    await host.engine.cancelAsync(new MessageIdParams(result.replies[0]!.id));
    await host.engine.waitForIdle();
  }

  @TestMethod
  public async stopsEverySubAgentAnEarlierRuntimeLeftRunningInAnyReply(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const provenance = new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false);
    const agent = (sequence: number, status: SubAgentStatus, parent: number | null = null): MessageDetail => new MessageDetail(sequence, DetailKind.SubAgent,
      "Explore", new SubAgent(`t${sequence}`, null, "Explore", null, status, true).toJson(), "t", parent);
    const ended = new Message("ended", conversation.id, 1, MessageAuthor.Provider, null, MessageStatus.Running, [agent(0, SubAgentStatus.Running),
      agent(1, SubAgentStatus.Running, 0), agent(2, SubAgentStatus.Completed), new MessageDetail(3, DetailKind.SubAgent, "Broken", { status: "Running" }, "t")],
    provenance, "t", "t", null).withStatus(MessageStatus.Completed, "t2");
    const open = new Message("open", conversation.id, 2, MessageAuthor.Provider, null, MessageStatus.Running, [agent(0, SubAgentStatus.Running)], provenance, "t", "t", null);
    await host.messages.insertAsync(ended);
    await host.messages.insertAsync(open);
    const late = new Approval("late", "ended", ApprovalKind.Command, "command", "Run", null, [new ApprovalOption("yes", "Allow", ApprovalOutcome.Approved,
      ApprovalScope.Once)], ApprovalStatus.Pending, null, "t", null);
    await host.approvals.insertAsync(late);
    const statuses = async (id: string): Promise<string> => (await host.messages.findAsync(id))!.details.map(t => t.kind === DetailKind.SubAgent && t.text === "Explore"
      ? SubAgent.fromJson(t.payload).status : t.text).join();

    const interrupted = await host.engine.reconcileAsync();

    Assert.areEqual("open", interrupted.map(t => t.id).join());
    Assert.areEqual("Stopped,Stopped,Completed,Broken", await statuses("ended"));
    Assert.areEqual("Stopped,The runtime stopped before this reply ended.", await statuses("open"));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync("ended"))?.status);
    Assert.areEqual("open:0,open,ended:0,ended:1,ended", host.listener.events.filter(t => t.name === EventName.DetailUpdated || t.name === EventName.MessageUpdated)
      .map(t => t.name === EventName.MessageUpdated ? Message.fromJson(t.payload).id : `${DetailEventPayload.fromJson(t.payload).messageId}:${DetailEventPayload.fromJson(t.payload).detail.sequence}`).join());
    Assert.areEqual("Broken", (await host.messages.listWithRunningSubAgentsAsync()).map(t => t.details[3]?.text).join());
    Assert.areEqual(ApprovalStatus.Cancelled, (await host.approvals.findAsync("late"))?.status);
    Assert.isTrue(host.listener.events.some(t => t.name === EventName.ApprovalUpdated && Approval.fromJson(t.payload).id === "late"));
  }

  @TestMethod
  public async reportsFilesChangedInTheWorkingTreeBesidesTheProvidersOwn(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n", "gone.txt": "remove me\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const reportedPath = join(folder, "reported.txt");
    host.adapter.writeFiles = { "base.txt": "changed\n", "reported.txt": "by the provider\n", "nested/added.txt": "new\n" };
    host.adapter.extraDetails = [new TurnDetail(DetailKind.FileChange, "Edit: reported.txt", { files: [reportedPath], changes: [] }, null)];
    host.adapter.afterDetails = () => rmSync(join(folder, "gone.txt"));

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change things"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);
    const tree = reply?.details.find(t => t.text.startsWith("Shared working-tree changes"));
    const payload = tree?.payload as { files: string[]; changes: { path: string; kind: string; diff: string | null }[]; source: string };

    Assert.areEqual(MessageStatus.Completed, reply?.status);
    Assert.areEqual("Shared working-tree changes (may include other chats or tools): base.txt, gone.txt, nested\\added.txt", tree?.text.replaceAll("/", "\\"));
    Assert.areEqual("workingTree", payload.source);
    Assert.areEqual("add,delete,update", payload.changes.map(t => t.kind).sort().join(","));
    Assert.isTrue(payload.changes.every(t => t.diff !== null));
    Assert.isTrue(payload.files.every(t => t.startsWith(folder)));
    Assert.areEqual("--- a/base.txt\n+++ b/base.txt\n@@ -1,1 +1,1 @@\n-one\n+changed\n", payload.changes.find(t => t.kind === "update")?.diff);
  }

  @TestMethod
  public async leavesThePathsGitIgnoresOutOfTheWorkingTreeChanges(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n", ".gitignore": "/_build/\n" });
    execFileSync("git", ["init", "-q"], { cwd: folder, windowsHide: true });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "changed\n", "_build/out.json": "{}\n", "_build/maps/out.js.map": "{}\n" };

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change things"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(String(result.replies[0]?.id)))?.details ?? [];
    const payload = details.find(t => t.text.startsWith("Shared working-tree changes"))?.payload as { files: string[]; changes: { path: string }[] };

    Assert.areEqual(`${join(folder, "base.txt")}|${join(folder, "base.txt")}`, `${payload.files.join()}|${payload.changes.map(t => t.path).join()}`);
    Assert.isFalse(details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
  }

  @TestMethod
  public async listsTheFileACommandEditedPastMoreIgnoredFilesThanTheChangesHoldThatComeFirst(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "src/chat.ts": "one\n", ".gitignore": "/_build/\n" });
    execFileSync("git", ["init", "-q"], { cwd: folder, windowsHide: true });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const built = Array.from({ length: Resources.maximumEvidenceFiles + 1 }, (_, index) => [`_build/${index}.js`, "built\n"] as const);
    host.adapter.writeFiles = { ...Object.fromEntries(built), "src/chat.ts": "two\n" };

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Fix the chat"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(String(result.replies[0]?.id)))?.details ?? [];
    const payload = details.find(t => t.text.startsWith("Shared working-tree changes"))?.payload as { files: string[] };

    Assert.areEqual(join(folder, "src", "chat.ts"), payload.files.join());
    Assert.isFalse(details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
  }

  @TestMethod
  public async reportsChangesWithoutTheDiffsTheModuleCouldntReadOrCut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n", "image.bin": "a\u0000b" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "changed\n", "image.bin": "c\u0000d", "large.txt": "x".repeat(Resources.maximumDiffBytes) };
    host.checkpoints.statuses.set("base.txt", ChangeStatus.Unknown);

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change things"));
    await host.engine.waitForIdle();
    const tree = (await host.messages.findAsync(result.replies[0]!.id))?.details.find(t => t.text.startsWith("Shared working-tree changes"));
    const payload = tree?.payload as { changes: { path: string; kind: string; diff: string | null }[] };

    Assert.areEqual("base.txt:update:null,image.bin:update:null,large.txt:add:null",
      payload.changes.map(t => `${t.path.split(/[\\/]/u).at(-1)}:${t.kind}:${t.diff}`).join(","));
    Assert.areEqual("image.bin,large.txt", host.checkpoints.reads.map(t => t.path).join(","));
    Assert.isTrue(host.checkpoints.reads.every(t => t.limit === Resources.maximumDiffBytes && Object.isNull(t.against?.checkpoint)));
  }

  @TestMethod
  public async listsTheFirstFilesOfALargeChangeAndNotesThatItLeftTheRestOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = Object.fromEntries(Array.from({ length: Resources.maximumEvidenceFiles + 1 },
      (_, index) => [`file-${String(index).padStart(5, "0")}.txt`, "x\n"]));

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Install"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]!.id))?.details ?? [];
    const payload = details.find(t => t.kind === DetailKind.FileChange)?.payload as { changes: { path: string; diff: string | null }[] };

    Assert.areEqual(Resources.maximumEvidenceFiles, payload.changes.length);
    Assert.isTrue(payload.changes.every(t => !Object.isNull(t.diff)));
    Assert.areEqual(Resources.maximumEvidenceFiles, host.checkpoints.reads.length);
    Assert.areEqual(JSON.stringify({ source: Resources.workingTreeSource, changesNote: true, partialEvidence: true }),
      JSON.stringify(details.find(t => t.text === Resources.incompleteWorkingTreeEvidence)?.payload));
  }

  @TestMethod
  public async leavesTheFilesTheProviderReportedOutBeforeTheEvidenceSpendsItsBounds(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const reported = Array.from({ length: Resources.maximumEvidenceFiles }, (_, index) => `file-${String(index).padStart(5, "0")}.txt`);
    host.adapter.writeFiles = Object.fromEntries([...reported, "unreported.txt"].map(t => [t, "x\n"]));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.FileChange, "Edits", { files: reported.map(t => join(folder, t)), changes: [] }, null)];

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Install"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]!.id))?.details ?? [];
    const tree = details.find(t => t.text.startsWith("Shared working-tree changes"))?.payload as { changes: { path: string }[] };

    Assert.areEqual("unreported.txt", tree.changes.map(t => t.path.split(/[\\/]/u).at(-1)).join(","));
    Assert.areEqual("unreported.txt", host.checkpoints.reads.map(t => t.path).join(","));
    Assert.isFalse(details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
  }

  @TestMethod
  public async notesOnceThatCommandsRanOutsideTheChatsFolderAndNamesAShortFolder(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const outside = parse(folder).root;
    host.adapter.extraDetails = [
      new TurnDetail(DetailKind.Command, "printf", { command: "printf 'echo hi' > greet.sh", cwd: outside }, null),
      new TurnDetail(DetailKind.Command, "cat", { command: "cat greet.sh", cwd: outside }, null),
      new TurnDetail(DetailKind.Command, "ls", { command: "ls", cwd: join(folder, "src") }, null),
      new TurnDetail(DetailKind.Command, "pwd", { command: "pwd" }, null),
      new TurnDetail(DetailKind.Command, "true", null, null),
      new TurnDetail(DetailKind.Reasoning, "Thinking", { cwd: dirname(folder) }, null)];

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write greet.sh"));
    await host.engine.waitForIdle();
    const notes = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details.filter(t => t.kind === DetailKind.Note) ?? [];

    Assert.areEqual(Resources.formatCommandsOutsideFolders(outside), notes.map(t => t.text).join("|"));
    Assert.areEqual(JSON.stringify({ source: Resources.workingTreeSource, changesNote: true, folders: [outside] }), JSON.stringify(notes[0]?.payload));
  }

  @TestMethod
  public async namesTheChatsFolderWhenTheOutsideFoldersAreTooLongToName(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const outside = join(host.directory.path, "o".repeat(Resources.maximumNamedFoldersLength));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, "printf", { command: "printf hi > greet.sh", cwd: outside }, null)];

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write greet.sh"));
    await host.engine.waitForIdle();
    const note = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details.find(t => t.kind === DetailKind.Note);

    Assert.areEqual(Resources.formatCommandsOutsideFolder(folder), note?.text);
  }

  @TestMethod
  public async comparesTheCommandsFoldersByTheirRealPathsAndNamesEachOutsideFolderOnce(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "physical"), {});
    mkdirSync(join(folder, "src"));
    const alias = join(host.directory.path, "alias");
    symlinkSync(folder, alias, "junction");
    const other = join(host.directory.path, "other");
    mkdirSync(other);
    const otherAlias = join(host.directory.path, "other-alias");
    symlinkSync(other, otherAlias, "junction");
    const upper = join(host.directory.path, "PHYSICAL");
    const conversation = await host.createConversationAsync(await host.openProjectAsync("alias"));
    host.adapter.extraDetails = [folder, join(folder, "src"), "src", upper, "../other", other + sep, otherAlias]
      .map(t => new TurnDetail(DetailKind.Command, "ls", { command: "ls", cwd: t }, null));

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "List"));
    await host.engine.waitForIdle();
    const notes = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details.filter(t => t.kind === DetailKind.Note) ?? [];
    const payload = JSON.stringify(notes.map(t => t.payload));

    Assert.areEqual(JSON.stringify([{ source: Resources.workingTreeSource, changesNote: true, folders: existsSync(upper) ? [other] : [upper, other] }]), payload);
  }

  @TestMethod
  public async notesThatTheFolderWasntComparedAfterAReplyWhoseCommandsRanWithoutACheckpointOrACompare(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, "printf", { command: "printf hi > greet.sh", cwd: parse(host.directory.path).root }, null)];
    const setups = [
      (): void => { host.checkpoints.captureError = new Error("capture"); },
      (): void => { host.checkpoints.captureError = null; host.checkpoints.compareError = new Error("compare"); },
      (): void => { host.checkpoints.compareError = null; host.checkpoints.compareOutcome = CompareOutcome.CheckpointMissing; }];
    const notes: string[] = [];

    for (const setup of setups) {
      setup();
      const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write greet.sh"));
      await host.engine.waitForIdle();
      const details = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details ?? [];
      notes.push(details.filter(t => t.kind === DetailKind.Note).map(t => `${t.text}:${JSON.stringify(t.payload)}`).join("|"));
    }

    const note = `${Resources.uncomparedWorkingTree}:${JSON.stringify({ source: Resources.workingTreeSource, changesNote: true, partialEvidence: true })}`;
    Assert.areEqual([note, note, note].join(","), notes.join(","));
  }

  @TestMethod
  public async notesThatTheFolderWasntComparedAfterATurnThatFailedOnceItsCommandsRan(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, "printf", { command: "printf hi > greet.sh" }, null)];
    host.adapter.afterDetails = (): void => {
      throw new Error("The provider exited.");
    };

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write greet.sh"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]?.id ?? String.empty);

    Assert.areEqual(MessageStatus.Failed, reply?.status);
    Assert.areEqual(Resources.uncomparedWorkingTree, reply?.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
  }

  @TestMethod
  public async listsAFileACommandWroteInsideTheChatsFolderWithoutANote(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "greet.sh": "echo hi\n" };
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, "printf", { command: "printf 'echo hi' > greet.sh", cwd: folder, writes: ["greet.sh"],
      unnamedWrites: [] }, null)];

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write greet.sh"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details ?? [];

    Assert.areEqual(Resources.formatWorkingTreeChanges("greet.sh"), details.filter(t => t.kind === DetailKind.FileChange).map(t => t.text).join("|"));
    Assert.isFalse(details.some(t => t.kind === DetailKind.Note));
  }

  @TestMethod
  public async listsTheFilesACommandNamedOutsideTheChatsFolderWithTheirDiffsAndNoNote(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const outside = ConversationEngineTests.folder(join(host.directory.path, "out"), { "notes.txt": "one\ntwo\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const greet = join(outside, "greet.sh");
    const notes = join(outside, "notes.txt");
    host.adapter.extraDetails = [
      new TurnDetail(DetailKind.Command, "printf", { command: "/bin/bash -lc 'printf hi > greet.sh'", cwd: outside, writes: ["greet.sh"], unnamedWrites: [] },
        "c1"),
      new TurnDetail(DetailKind.Command, "echo", { tool: "Bash", input: { command: `echo three >> ${notes}` }, writes: [notes], unnamedWrites: [] }, "c2")];
    host.adapter.afterDetails = (): void => {
      writeFileSync(greet, "echo hi\n");
      writeFileSync(notes, "one\ntwo\nthree\n");
    };

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write greet.sh"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details ?? [];
    const listed = details.find(t => t.kind === DetailKind.FileChange);

    Assert.areEqual(Resources.formatCommandWrites(`${greet}, ${notes}`), listed?.text);
    Assert.areEqual(JSON.stringify({
      files: [greet, notes], status: Resources.completedStatus, changes: [
        { path: greet, kind: Resources.addKind, diff: `--- /dev/null\n+++ ${greet}\n@@ -0,0 +1,1 @@\n+echo hi` },
        { path: notes, kind: Resources.updateKind, diff: `--- ${notes}\n+++ ${notes}\n@@ -1,2 +1,3 @@\n one\n two\n+three` }
      ], source: Resources.workingTreeSource
    }), JSON.stringify(listed?.payload));
    Assert.isFalse(details.some(t => t.kind === DetailKind.Note));
  }

  @TestMethod
  public async keepsTheNoteForAnOutsideFolderWhereACommandRanWhatItCouldntName(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const outside = ConversationEngineTests.folder(join(host.directory.path, "out"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const note = outside.length <= Resources.maximumNamedFoldersLength ? Resources.formatCommandsOutsideFolders(outside)
      : Resources.formatCommandsOutsideFolder(folder);
    host.adapter.extraDetails = [
      new TurnDetail(DetailKind.Command, "python", { command: "/bin/bash -lc 'python gen.py'", cwd: outside, writes: [], unnamedWrites: ["."] }, null),
      new TurnDetail(DetailKind.Command, "cat", { command: "/bin/bash -lc 'cat gen.py'", cwd: join(host.directory.path, "elsewhere"), writes: [],
        unnamedWrites: [] }, null)];
    host.adapter.afterDetails = (): void => {
      writeFileSync(join(outside, "generated.txt"), "x\n");
    };

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Generate"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details ?? [];

    Assert.areEqual(note, details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
    Assert.isFalse(details.some(t => t.kind === DetailKind.FileChange));
  }

  @TestMethod
  public async saysItLeftOutFilesWhenACommandNamedMoreOutsideTheChatsFolderThanItReads(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const outside = ConversationEngineTests.folder(join(host.directory.path, "out"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const files = Array.from({ length: Resources.maximumEvidenceFiles + 1 }, (_, index) => join(outside, `f-${index}.txt`));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, "touch", { command: "touch", writes: files, unnamedWrites: [] }, null)];

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Touch them"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]?.id ?? String.empty))?.details ?? [];

    Assert.areEqual(Resources.incompleteWorkingTreeEvidence, details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
    Assert.isFalse(details.some(t => t.kind === DetailKind.FileChange));
  }

  @TestMethod
  public async listsTheFilesACommandNamedOutsideTheChatsFolderAfterATurnThatFailed(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const outside = ConversationEngineTests.folder(join(host.directory.path, "out"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const written = join(outside, "a.txt");
    const reported = join(outside, "b.txt");
    host.adapter.extraDetails = [
      new TurnDetail(DetailKind.Command, "echo", { command: "echo", writes: [written, reported], unnamedWrites: [] }, null),
      new TurnDetail(DetailKind.FileChange, "Write", { files: [reported], changes: [] }, null)];
    host.adapter.afterDetails = (): void => {
      writeFileSync(written, "a\n");
      writeFileSync(reported, "b\n");
      throw new Error("The provider exited.");
    };

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write a.txt"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]?.id ?? String.empty);

    Assert.areEqual(MessageStatus.Failed, reply?.status);
    Assert.areEqual(`Write|${Resources.formatCommandWrites(written)}`, reply?.details.filter(t => t.kind === DetailKind.FileChange).map(t => t.text).join("|"));
    Assert.areEqual(Resources.uncomparedWorkingTree, reply?.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
  }

  @TestMethod
  public async readsDiffsUpToItsByteBoundAndNotesTheFilesItLeftWithoutOne(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), {});
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const files = Math.ceil(Resources.maximumEvidenceDiffBytes / Resources.maximumDiffBytes) + 2;
    host.adapter.writeFiles = Object.fromEntries(Array.from({ length: files }, (_, index) => [`large-${index}.txt`, "x".repeat(Resources.maximumDiffBytes - 100)]));

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Write large files"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]!.id))?.details ?? [];
    const payload = details.find(t => t.kind === DetailKind.FileChange)?.payload as { changes: { path: string; diff: string | null }[] };

    Assert.areEqual(files, payload.changes.length);
    Assert.areEqual(files - 1, host.checkpoints.reads.length);
    Assert.areEqual(`${"diff,".repeat(files - 2)}none,none`, payload.changes.map(t => Object.isNull(t.diff) ? "none" : "diff").join(","));
    Assert.areEqual(Resources.maximumEvidenceDiffBytes, host.checkpoints.readBytes);
    Assert.isTrue((host.checkpoints.reads.at(-1)?.limit ?? 0) < Resources.maximumDiffBytes);
    Assert.isTrue(details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
  }

  @TestMethod
  public async keepsTheEvidenceCompleteWithinItsBoundsAndPassesTheRepliesSignalToTheModule(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "two\n", "new.txt": "x\n" };

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(result.replies[0]!.id))?.details ?? [];

    Assert.isFalse(details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
    const [capture, ...afterTurn] = host.checkpoints.signals;
    Assert.isTrue(capture instanceof AbortSignal && capture.aborted);
    Assert.areEqual(3, afterTurn.length);
    Assert.isTrue(afterTurn.every(t => t instanceof AbortSignal && t !== capture && t === afterTurn[0] && !t.aborted));
  }

  @TestMethod
  @TestData("capture", 0)
  @TestData("compare", 1)
  public async stopsAReplyBeforeItsTurnWhileTheModuleCapturesAndAfterItWhileItCompares(held: "capture" | "compare", turns: number): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.checkpoints.holds = held;
    host.adapter.writeFiles = { "base.txt": "two\n" };
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
    await host.until(`the held ${held}`, () => (held === "capture" ? host.checkpoints.captures : host.checkpoints.compares).length === 1, host.runs());

    const stopped = await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));

    Assert.areEqual(MessageStatus.Cancelled, stopped.status);
    Assert.isTrue(host.checkpoints.signals.at(-1)?.aborted ?? false);
    Assert.areEqual(turns, host.adapter.requests.length);
    Assert.areEqual(turns === 1, !Object.isNullOrUndefined(stopped.provenance?.nativeTurnId));
    Assert.isUndefined(stopped.details.find(t => t.kind === DetailKind.FileChange));
    Assert.areEqual(turns === 1, stopped.details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
    Assert.isFalse(host.log.lines.some(t => t.startsWith("The checkpoints module")));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async listsWhatAReplyStoppedDuringItsTurnChanged(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.holdUntilAbort = true;
    host.adapter.writeFiles = { "base.txt": "two\n" };
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
    await host.until("the written file", () => readFileSync(join(folder, "base.txt"), "utf8") === "two\n", host.runs());

    const stopped = await host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));

    Assert.areEqual(MessageStatus.Cancelled, stopped.status);
    Assert.areEqual("Shared working-tree changes (may include other chats or tools): base.txt",
      stopped.details.find(t => t.kind === DetailKind.FileChange)?.text);
    Assert.isFalse(stopped.details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
    Assert.isFalse(host.checkpoints.signals.at(-1)?.aborted ?? true);
  }

  @TestMethod
  @TestData("stop")
  @TestData("quit")
  public async notesAStoppedRepliesChangesAsIncompleteWhenAnotherStopOrQuittingEndsTheirCompare(ending: "stop" | "quit"): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.holdUntilAbort = true;
    host.adapter.writeFiles = { "base.txt": "two\n" };
    host.checkpoints.holds = "compare";
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
    const id = sent.replies[0]!.id;
    await host.until("the written file", () => readFileSync(join(folder, "base.txt"), "utf8") === "two\n", host.runs());
    const first = host.engine.cancelAsync(new MessageIdParams(id));
    await host.until("the held compare", () => host.checkpoints.compares.length === 1, host.runs());

    await (ending === "stop" ? host.engine.cancelAsync(new MessageIdParams(id)) : host.engine.shutdown());
    const stopped = await first;

    Assert.areEqual(MessageStatus.Cancelled, stopped.status);
    Assert.isTrue(host.checkpoints.signals.at(-1)?.aborted ?? false);
    Assert.isUndefined(stopped.details.find(t => t.kind === DetailKind.FileChange));
    Assert.isTrue(stopped.details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
    Assert.areEqual(0, host.engine.activeRunCount);
  }

  @TestMethod
  public async logsACheckpointTheModuleDidntTakeAndChangesItDidntCompareByTheirOutcomes(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.checkpoints.captureOutcome = CaptureOutcome.HeldUp;
    const before = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Before"));
    await host.engine.waitForIdle();
    host.checkpoints.captureOutcome = null;
    host.checkpoints.compareOutcome = CompareOutcome.CheckpointMissing;
    host.adapter.writeFiles = { "base.txt": "two\n" };
    const after = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "After"));
    await host.engine.waitForIdle();

    Assert.isNull(await host.messages.findCheckpointAsync(before.replies[0]!.id));
    Assert.isTrue(host.log.lines.includes(Resources.formatCheckpointNotTaken(before.replies[0]!.id, CaptureOutcome.HeldUp.value)));
    Assert.isTrue(host.log.lines.includes(Resources.formatChangesNotCompared(after.replies[0]!.id, CompareOutcome.CheckpointMissing.value)));
    Assert.isUndefined((await host.messages.findAsync(after.replies[0]!.id))?.details.find(t => t.kind === DetailKind.FileChange));
    Assert.areEqual(MessageStatus.Completed, (await host.messages.findAsync(after.replies[0]!.id))?.status);
  }

  @TestMethod
  public async recognizesProviderPathsThroughADirectoryAliasIncludingDeletedFiles(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "physical"), { "base.txt": "before\n", "gone.txt": "remove me\n" });
    const alias = join(host.directory.path, "alias");
    symlinkSync(folder, alias, "junction");
    const conversation = await host.createConversationAsync(await host.openProjectAsync("alias"));
    host.adapter.writeFiles = { "base.txt": "changed\n", "reported.txt": "reported\n" };
    host.adapter.extraDetails = [new TurnDetail(DetailKind.FileChange, "Provider edits", {
      files: [join(alias, "reported.txt"), join(alias, "gone.txt"), join(alias, "absent", "unknown.txt")], changes: []
    }, null)];
    host.adapter.afterDetails = () => rmSync(join(folder, "gone.txt"));

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change through an alias"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);
    Assert.areEqual(MessageStatus.Completed, reply?.status);
    const tree = reply?.details.find(t => t.text.startsWith("Shared working-tree changes"));
    Assert.areEqual("Shared working-tree changes (may include other chats or tools): base.txt", tree?.text);
  }

  @TestMethod
  public async staysQuietWhenTheWorkingTreeDidNotChange(): Promise<void> {
    await using host = await CoreHost.createAsync();
    ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Nothing"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);

    Assert.isUndefined(reply?.details.find(t => t.kind === DetailKind.FileChange));
  }

  @TestMethod
  public async storesGeneratedImagesAsFiles(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
    host.adapter.extraDetails = [
      new TurnDetail(DetailKind.Note, "Generated image", { itemType: "imageGeneration", imageData: png, mediaType: "image/png", savedPath: null }, null),
      new TurnDetail(DetailKind.Note, "Unknown media", { imageData: png, mediaType: "image/tiff" }, null),
      new TurnDetail(DetailKind.Note, "No data", { imageData: null, mediaType: "image/png" }, null),
      new TurnDetail(DetailKind.Note, "Plain", "text", null)
    ];

    const result = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Draw"));
    await host.engine.waitForIdle();
    const reply = await host.messages.findAsync(result.replies[0]!.id);
    const stored = reply?.details[0]?.payload as { imageData: string | null; storedPath: string };

    Assert.isNull(stored.imageData);
    Assert.areEqual(join(host.directory.path, "images", `${result.replies[0]!.id}-0.png`).toLowerCase(), stored.storedPath.toLowerCase());
    Assert.areEqual(png, readFileSync(stored.storedPath).toString("base64"));
    Assert.areEqual(png, (reply?.details[1]?.payload as { imageData: string }).imageData);
    Assert.isNull((reply?.details[2]?.payload as { imageData: null }).imageData);
    Assert.areEqual("text", reply?.details[3]?.payload);
  }

  @TestMethod
  public async rewindsAConversationRestoringTheFilesAndStartingAFreshSession(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "changed\n", "new.txt": "x\n" };
    const first = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "First"));
    await host.engine.waitForIdle();
    host.adapter.writeFiles = { "base.txt": "changed again\n" };
    const second = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Second"));
    await host.engine.waitForIdle();
    const checkpoint = await host.messages.findCheckpointAsync(second.replies[0]!.id);

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, second.sent.id, true));
    host.adapter.writeFiles = {};
    const third = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Third"));
    await host.engine.waitForIdle();

    Assert.areEqual(`${second.sent.id},${second.replies[0]!.id}`, result.removedMessageIds.join(","));
    Assert.isTrue(result.conversation.sessionReset);
    Assert.areEqual(1, result.restoredFiles);
    Assert.isNull(result.restoreRefusal);
    Assert.areEqual("changed\n", readFileSync(join(folder, "base.txt"), "utf8"));
    Assert.areEqual("x\n", readFileSync(join(folder, "new.txt"), "utf8"));
    Assert.areEqual(checkpoint, host.checkpoints.previews[0]?.checkpoint);
    Assert.isFalse(Object.isNull(await host.messages.findCheckpointAsync(first.replies[0]!.id)));
    Assert.areNotEqual(checkpoint, await host.messages.findCheckpointAsync(first.replies[0]!.id));
    Assert.areEqual(checkpoint, host.checkpoints.restores[0]?.plan.checkpoint);
    Assert.isFalse(existsSync(join(folder, ".git")));
    Assert.areEqual(1, host.listener.count(EventName.ConversationRewound));
    Assert.areEqual(2, ConversationRewoundPayload.fromJson(host.listener.events.find(t => t.name === EventName.ConversationRewound)?.payload).fromSequence);
    Assert.isNull(host.adapter.requests[2]?.resumeNativeSessionId);
    Assert.isTrue(host.adapter.requests[2]?.prompt.startsWith("This chat continues from an earlier session") ?? false);
    Assert.isTrue(host.adapter.requests[2]?.prompt.includes("User: First\n\nAssistant: Working\n\nNow the user says:\n\nThird") ?? false);
    Assert.areEqual("Third", third.sent.details[0]?.text);
    Assert.isFalse((await host.conversations.findAsync(conversation.id))?.sessionReset ?? true);
    const kept = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.author === MessageAuthor.User);
    Assert.areEqual("First,Third", kept.map(t => t.details[0]?.text).join(","));
  }

  @TestMethod
  public async rewindsOnlyThePathsTheRemovedRepliesChangedLeavingEveryOtherChangeAsItIs(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n", "other.txt": "o\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "changed\n" };
    host.adapter.extraDetails = [new TurnDetail(DetailKind.FileChange, "Edits", {
      files: [join(folder, "reported.txt"), "relative.txt", folder, dirname(folder), join(dirname(folder), "elsewhere.txt"), "a\\b.txt"], changes: []
    }, null)];
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Edit"));
    await host.engine.waitForIdle();
    writeFileSync(join(folder, "other.txt"), "outside\n");
    writeFileSync(join(folder, "late.txt"), "late\n");

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));

    Assert.areEqual(JSON.stringify(["base.txt", "relative.txt", "reported.txt", ...sep === "/" ? [] : ["a/b.txt"]].sort()),
      JSON.stringify([...host.checkpoints.previews[0]?.paths ?? []].sort()));
    Assert.areEqual(1, result.restoredFiles);
    Assert.areEqual("one\n", readFileSync(join(folder, "base.txt"), "utf8"));
    Assert.areEqual("outside\n", readFileSync(join(folder, "other.txt"), "utf8"));
    Assert.isTrue(existsSync(join(folder, "late.txt")));
  }

  @TestMethod
  public async rewindsTheWholeFolderPastAReplyWhoseComparisonFailedOrWasRefused(): Promise<void> {
    const setups = [
      (host: CoreHost): void => { host.checkpoints.compareError = new Error("compare"); },
      (host: CoreHost): void => { host.checkpoints.compareOutcome = CompareOutcome.CheckpointMissing; }];
    const results: string[] = [];

    for (const setup of setups) {
      await using host = await CoreHost.createAsync();
      const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
      const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
      setup(host);
      host.adapter.afterDetails = (): void => writeFileSync(join(folder, "base.txt"), "changed\n");
      const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Edit"));
      await host.engine.waitForIdle();
      const notes = (await host.messages.findAsync(sent.replies[0]?.id ?? String.empty))?.details.filter(t => t.kind === DetailKind.Note) ?? [];
      const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));
      results.push([...notes.map(t => `${t.text}:${JSON.stringify(t.payload)}`), JSON.stringify(host.checkpoints.previews[0]?.paths), result.restoredFiles,
        readFileSync(join(folder, "base.txt"), "utf8")].join("|"));
    }

    const note = `${Resources.incompleteWorkingTreeEvidence}:${JSON.stringify({ source: Resources.workingTreeSource, changesNote: true, partialEvidence: true })}`;
    Assert.areEqual([`${note}|null|1|one\n`, `${note}|null|1|one\n`].join(","), results.join(","));
  }

  @TestMethod
  public async rewindsTheWholeFolderPastAReplyWhoseEvidenceLeftFilesOut(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.afterDetails = (): void => {
      for (let index = 0; index <= Resources.maximumEvidenceFiles; index++)
        writeFileSync(join(folder, `file-${String(index).padStart(5, "0")}.txt`), "x\n");
    };
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Install"));
    await host.engine.waitForIdle();
    const details = (await host.messages.findAsync(sent.replies[0]?.id ?? String.empty))?.details ?? [];

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));

    Assert.isTrue(details.some(t => t.text === Resources.incompleteWorkingTreeEvidence));
    Assert.areEqual("null", JSON.stringify(host.checkpoints.previews[0]?.paths));
    Assert.areEqual(Resources.maximumEvidenceFiles + 1, result.restoredFiles);
    Assert.areEqual("base.txt", readdirSync(folder).join());
  }

  @TestMethod
  public async rewindsTheWholeFolderPastALaterRemovedReplyThatTookNoCheckpoint(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "first\n" };
    const first = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "First"));
    await host.engine.waitForIdle();
    host.checkpoints.captureError = new Error("capture");
    host.adapter.writeFiles = {};
    host.adapter.afterDetails = (): void => writeFileSync(join(folder, "late.txt"), "late\n");
    const second = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Second"));
    await host.engine.waitForIdle();
    const secondReply = await host.messages.findAsync(second.replies[0]?.id ?? String.empty);
    const secondCheckpoint = await host.messages.findCheckpointAsync(second.replies[0]?.id ?? String.empty);

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, first.sent.id, true));

    Assert.isNull(secondCheckpoint);
    Assert.areEqual(MessageStatus.Completed, secondReply?.status);
    Assert.isFalse(secondReply?.details.some(t => t.kind === DetailKind.Note) ?? true);
    Assert.areEqual("null", JSON.stringify(host.checkpoints.previews[0]?.paths));
    Assert.areEqual(2, result.restoredFiles);
    Assert.areEqual("base.txt:one\n", readdirSync(folder).map(t => `${t}:${readFileSync(join(folder, t), "utf8")}`).join());
  }

  @TestMethod
  public async rewindsNothingPastAReplyThatReportedNoPaths(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Note, "Read the files", null, null)];
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Look"));
    await host.engine.waitForIdle();
    writeFileSync(join(folder, "base.txt"), "later\n");

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));

    Assert.areEqual("[]", JSON.stringify(host.checkpoints.previews[0]?.paths));
    Assert.areEqual(0, result.restoredFiles);
    Assert.areEqual("later\n", readFileSync(join(folder, "base.txt"), "utf8"));
  }

  @TestMethod
  public async rewindsAFileACommandRenamedAndOneItDeleted(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "old.txt": "old\n", "gone.txt": "gone\n", "kept.txt": "kept\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.extraDetails = [new TurnDetail(DetailKind.Command, "mv", { command: "mv old.txt new.txt && rm gone.txt", cwd: folder }, null)];
    host.adapter.afterDetails = (): void => {
      renameSync(join(folder, "old.txt"), join(folder, "new.txt"));
      rmSync(join(folder, "gone.txt"));
    };
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Tidy"));
    await host.engine.waitForIdle();
    writeFileSync(join(folder, "kept.txt"), "later\n");

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));

    Assert.areEqual(JSON.stringify(["gone.txt", "new.txt", "old.txt"]), JSON.stringify([...host.checkpoints.previews[0]?.paths ?? []].sort()));
    Assert.areEqual(3, result.restoredFiles);
    Assert.areEqual("gone.txt:gone\n,kept.txt:later\n,old.txt:old\n",
      readdirSync(folder).sort().map(t => `${t}:${readFileSync(join(folder, t), "utf8")}`).join());
  }

  @TestMethod
  public async rewindsAFileTwoRemovedRepliesChangedToTheFirstRepliesCheckpoint(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n", "other.txt": "o\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const sent: MessageSendResult[] = [];
    for (let i = 0; i < 2; i++) {
      host.adapter.writeFiles = { "base.txt": `reply ${i}\n` };
      sent.push(await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, `Message ${i}`)));
      await host.engine.waitForIdle();
    }
    writeFileSync(join(folder, "other.txt"), "later\n");

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent[0]?.sent.id ?? String.empty, true));

    Assert.areEqual(JSON.stringify(["base.txt"]), JSON.stringify(host.checkpoints.previews[0]?.paths));
    Assert.areEqual(1, result.restoredFiles);
    Assert.areEqual("one\n|later\n", ["base.txt", "other.txt"].map(t => readFileSync(join(folder, t), "utf8")).join("|"));
  }

  @TestMethod
  public async rewindsTheFilesASubAgentOfARemovedReplyChanged(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.extraDetails = [
      new TurnDetail(DetailKind.SubAgent, "Explore", new SubAgent("t1", "Explore", "Explore", null, SubAgentStatus.Completed, true).toJson(), "agent"),
      new TurnDetail(DetailKind.FileChange, "Edit", { files: [join(folder, "agent.txt")], changes: [] }, "edit", "agent")];
    host.adapter.afterDetails = (): void => writeFileSync(join(folder, "agent.txt"), "agent\n");
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Delegate"));
    await host.engine.waitForIdle();
    writeFileSync(join(folder, "base.txt"), "later\n");

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));

    Assert.areEqual(JSON.stringify(["agent.txt"]), JSON.stringify(host.checkpoints.previews[0]?.paths));
    Assert.areEqual(1, result.restoredFiles);
    Assert.isFalse(existsSync(join(folder, "agent.txt")));
    Assert.areEqual("later\n", readFileSync(join(folder, "base.txt"), "utf8"));
  }

  @TestMethod
  public async rewindsReadingNoDetailsAndRestoringTheFirstRemovedRepliesCheckpointThroughOnePreview(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    const sent: MessageSendResult[] = [];
    for (let i = 0; i < 3; i++) {
      host.adapter.writeFiles = { "base.txt": `reply ${i}\n` };
      sent.push(await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, `Message ${i}`)));
      await host.engine.waitForIdle();
    }
    let detailedLists = 0;
    const list = host.messages.listAsync.bind(host.messages);
    host.messages.listAsync = (params, transaction) => {
      detailedLists++;
      return list(params, transaction);
    };
    const checkpoint = await host.messages.findCheckpointAsync(sent[0]!.replies[0]!.id);

    await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent[0]!.sent.id, true));

    Assert.areEqual(0, detailedLists);
    Assert.areEqual(1, host.checkpoints.previews.length);
    Assert.areEqual(1, host.checkpoints.restores.length);
    Assert.areEqual(checkpoint, host.checkpoints.previews[0]?.checkpoint);
    Assert.areEqual("one\n", readFileSync(join(folder, "base.txt"), "utf8"));
  }

  @TestMethod
  public async rewindsAndPublishesItWhenTheModuleRefusesTheRestore(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "reply\n" };
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
    await host.engine.waitForIdle();
    host.checkpoints.restoreOutcome = RestoreOutcome.MovedOn;
    const invalidated = host.listener.count(EventName.StateInvalidated);

    const moved = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));

    Assert.areEqual(2, moved.removedMessageIds.length);
    Assert.isNull(moved.restoredFiles);
    Assert.areEqual(Resources.formatRestoreRefusal(RestoreOutcome.MovedOn.value), moved.restoreRefusal);
    Assert.areNotEqual(Resources.formatRestoreRefusal("unknown outcome"), moved.restoreRefusal);
    Assert.areEqual(1, host.listener.count(EventName.ConversationRewound));
    Assert.areEqual(invalidated + 1, host.listener.count(EventName.StateInvalidated));
    Assert.areEqual("reply\n", readFileSync(join(folder, "base.txt"), "utf8"));
  }

  @TestMethod
  public async rewindsNothingWhenThePreviewOrTheRestoreThrows(): Promise<void> {
    for (const failing of ["preview", "restore"] as const) {
      await using host = await CoreHost.createAsync();
      const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
      const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
      host.adapter.writeFiles = { "base.txt": "reply\n" };
      const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
      await host.engine.waitForIdle();
      const failure = new Error(`The ${failing} failed.`);
      host.checkpoints.previewError = failing === "preview" ? failure : null;
      host.checkpoints.restoreError = failing === "restore" ? failure : null;

      const thrown = await Assert.throwsAsync(() => host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true)), Error);

      Assert.areEqual(failure, thrown);
      Assert.areEqual(2, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length);
      Assert.areEqual(0, host.listener.count(EventName.ConversationRewound));
      Assert.areEqual("reply\n", readFileSync(join(folder, "base.txt"), "utf8"));
    }
  }

  @TestMethod
  @TestData("error")
  @TestData("text")
  public async saysTheFilesWereRestoredAndWhyWhenARewindCantRemoveItsMessagesAndRemovesThemOnASecondRewind(thrownAs: "error" | "text"): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "reply\n" };
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
    await host.engine.waitForIdle();
    const reason = thrownAs === "error" ? "The disk is full." : "database or disk is full";
    const failure: unknown = thrownAs === "error" ? new Error(reason) : reason;
    const connection = host.context.database.connection;
    const runInTransactionAsync = connection.runInTransactionAsync.bind(connection);
    let failures = 1;
    connection.runInTransactionAsync = async work => failures-- > 0
      ? await runInTransactionAsync(async transaction => {
        await work(transaction);
        throw failure;
      })
      : await runInTransactionAsync(work);

    const thrown = await Assert.throwsAsync(() => host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true)), ServiceException);
    const kept = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length;
    const restored = readFileSync(join(folder, "base.txt"), "utf8");
    const again = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, true));

    const described = RequestDispatcher.describe(thrown);
    Assert.areEqual(`${ErrorCode.Internal}:${Resources.formatRewindNotSavedAfterRestore(reason)}:true:true`,
      `${described.name}:${described.message}:${described.message.endsWith(`Rewind again to remove them. They couldn't be removed: ${reason}`)}:${thrown.cause === failure}`);
    Assert.areEqual("2:one\n", `${kept}:${restored}`);
    Assert.areEqual(2, again.removedMessageIds.length);
    Assert.areEqual(0, (await host.messages.listAsync(new MessageListParams(conversation.id, null))).length);
    Assert.areEqual(1, host.listener.count(EventName.ConversationRewound));
  }

  @TestMethod
  public async failsARewindThatRestoresNoFilesWithItsOwnErrorWhenItsMessagesCantBeRemoved(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    host.adapter.writeFiles = { "base.txt": "reply\n" };
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Change"));
    await host.engine.waitForIdle();
    const failure = new Error("The disk is full.");
    const connection = host.context.database.connection;
    const runInTransactionAsync = connection.runInTransactionAsync.bind(connection);
    connection.runInTransactionAsync = async work => await runInTransactionAsync(async transaction => {
      await work(transaction);
      throw failure;
    });

    const thrown = await Assert.throwsAsync(() => host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent.sent.id, false)), Error);

    Assert.areEqual(failure, thrown);
    Assert.areEqual("2:reply\n", `${(await host.messages.listAsync(new MessageListParams(conversation.id, null))).length}:${readFileSync(join(folder, "base.txt"), "utf8")}`);
  }

  @TestMethod
  public async failsAProjectChatsReplyWithoutStartingTheProviderWhileTheProjectsFolderIsMissingAndRunsItOnceTheFolderIsBack(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync("repo");
    const conversation = await host.createConversationAsync(project);
    rmSync(project.rootPath, { recursive: true });

    const missing = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Gone"));
    await host.engine.waitForIdle();
    const failed = await ConversationEngineTests.replyOfAsync(host, missing);

    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual(MessageStatus.Failed, failed.status);
    Assert.areEqual(`${DetailKind.Error} ${Resources.formatWorkFolderMissing(project.rootPath)}`, failed.details.map(t => `${t.kind} ${t.text}`).join());
    Assert.areEqual(MessageStatus.Failed, host.listener.events.filter(t => t.name === EventName.MessageUpdated).map(t => Message.fromJson(t.payload))
      .filter(t => t.id === failed.id).at(-1)?.status);
    Assert.areEqual(0, host.engine.activeRunCount);

    mkdirSync(project.rootPath);
    const back = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Back"));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Still here"));
    await host.engine.waitForIdle();

    Assert.areEqual(2, host.adapter.requests.length);
    Assert.areEqual(MessageStatus.Completed, (await ConversationEngineTests.replyOfAsync(host, back)).status);
    Assert.areEqual(`${project.id} true,${project.id} false`, host.listener.events.filter(t => t.name === EventName.ProjectFolderChanged)
      .map(t => ProjectFolderChange.fromJson(t.payload)).map(t => `${t.projectId} ${t.folderMissing}`).join());
  }

  @TestMethod
  public async failsAProjectChatsReplyWhenTheProjectsFolderIsAFileNow(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync("repo");
    const conversation = await host.createConversationAsync(project);
    rmSync(project.rootPath, { recursive: true });
    writeFileSync(project.rootPath, "not a folder");

    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "File"));
    await host.engine.waitForIdle();

    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual(Resources.formatWorkFolderMissing(project.rootPath), (await ConversationEngineTests.replyOfAsync(host, sent)).details.at(-1)?.text);
  }

  @TestMethod
  public async failsAProjectChatsReplyWithTheMissingNoteWhenItsFolderCantBeReadWhateverTheError(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync("repo");
    const conversation = await host.createConversationAsync(project);
    const notes: string[] = [];

    for (const code of ["EACCES", "ENOTDIR", "EBUSY"]) {
      host.folderStat.failNext(project.rootPath, code);
      const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, code));
      await host.engine.waitForIdle();
      notes.push((await ConversationEngineTests.replyOfAsync(host, sent)).details.map(t => t.text).join());
    }

    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual([1, 2, 3].map(() => Resources.formatWorkFolderMissing(project.rootPath)).join("|"), notes.join("|"));
  }

  @TestMethod
  public async leavesAReplyCancelledWhileItsFolderIsCheckedCancelledWithoutStartingItsProvider(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync("repo");
    const conversation = await host.createConversationAsync(project);
    host.folderStat.hold(project.rootPath);
    const before = host.folderStat.paths.length;

    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Cancel"));
    await host.until("the held folder check", () => host.folderStat.paths.length > before, host.runs());
    const cancelled = host.engine.cancelAsync(new MessageIdParams(sent.replies[0]!.id));
    host.folderStat.release(project.rootPath, false);
    await cancelled;
    await host.engine.waitForIdle();
    const reply = await ConversationEngineTests.replyOfAsync(host, sent);

    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual(MessageStatus.Cancelled, reply.status);
    Assert.areEqual(0, reply.details.length);
  }

  @TestMethod
  public async failsAProjectChatsReplyAsUnreachableWhenItsFolderCheckNeverAnswersWhileOtherChatsReplyMeanwhile(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync("share");
    const conversation = await host.createConversationAsync(project);
    const other = await host.createConversationAsync(await host.openProjectAsync("local"));
    host.folderStat.hold(project.rootPath);

    const held = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Held"));
    const free = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, other.id, "Free"));
    while ((await ConversationEngineTests.replyOfAsync(host, free)).status !== MessageStatus.Completed)
      await host.listener.next(EventName.MessageUpdated);
    const waiting = (await ConversationEngineTests.replyOfAsync(host, held)).status;
    host.timer.advance(1_000);
    await host.engine.waitForIdle();
    const failed = await ConversationEngineTests.replyOfAsync(host, held);

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areNotEqual(MessageStatus.Failed, waiting);
    Assert.areEqual(MessageStatus.Failed, failed.status);
    Assert.areEqual(Resources.formatWorkFolderUnreachable(project.rootPath), failed.details.at(-1)?.text);
    Assert.areEqual(`${project.id} true`, host.listener.events.filter(t => t.name === EventName.ProjectFolderChanged)
      .map(t => ProjectFolderChange.fromJson(t.payload)).map(t => `${t.projectId} ${t.folderMissing}`).join());
  }

  @TestMethod
  public async checksAProjectsFolderOnceForEveryReplyOfASend(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const project = await host.openProjectAsync("share");
    const conversation = await host.createConversationAsync(project);
    const provider = await host.providerOfAsync();
    const [ana, ben] = await Promise.all(["Ana", "Ben"].map(t => host.teammates.createAsync(new TeammateCreateParams(t, null, provider.id, Harness.Provider, null, null))));
    const before = host.folderStat.paths.length;
    host.folderStat.hold(project.rootPath);

    const sent = await host.engine.sendAsync(new MessageSendParams(conversation.id, "@Ana @Ben go", null, null, [], [ana!.id, ben!.id]));
    await host.until("the reply's folder check", () => host.folderStat.paths.length > before, host.runs());
    host.timer.advance(1_000);
    await host.engine.waitForIdle();

    Assert.areEqual(1, host.folderStat.paths.length - before);
    Assert.areEqual(0, host.adapter.requests.length);
    Assert.areEqual([ana, ben].map(() => `${MessageStatus.Failed} ${Resources.formatWorkFolderUnreachable(project.rootPath)}`).join("|"),
      (await Promise.all(sent.replies.map(t => host.messages.findAsync(t.id)))).map(t => `${t?.status} ${t?.details.at(-1)?.text}`).join("|"));
  }

  @TestMethod
  public async runsAChatWithoutAProjectWhoseFolderIsGoneInItsFolderMadeAnew(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.conversations.createAsync(new ConversationCreateParams(null, null));
    const folder = host.context.chatFolders.prepare(conversation.id);
    rmSync(folder, { recursive: true });

    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Again"));
    await host.engine.waitForIdle();

    Assert.areEqual(1, host.adapter.requests.length);
    Assert.areEqual(MessageStatus.Completed, (await ConversationEngineTests.replyOfAsync(host, sent)).status);
    Assert.isTrue(existsSync(folder));
  }

  @TestMethod
  public async rewindsWithoutFilesWhenTheModuleHasNoPlanOrTheProjectsFolderIsGone(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const folder = ConversationEngineTests.folder(join(host.directory.path, "repo"), { "base.txt": "one\n" });
    const conversation = await host.createConversationAsync(await host.openProjectAsync("repo"));
    for (const text of ["First", "Second"]) {
      host.adapter.writeFiles = { "base.txt": `${text}\n` };
      await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, text));
      await host.engine.waitForIdle();
    }
    const sent = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.author === MessageAuthor.User);
    host.checkpoints.previewOutcome = PreviewOutcome.HeldUp;

    const held = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent[1]!.id, true));
    host.checkpoints.previewOutcome = null;
    rmSync(folder, { recursive: true });
    const gone = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, sent[0]!.id, true));

    Assert.isNull(held.restoredFiles);
    Assert.areEqual(Resources.formatRestoreRefusal(PreviewOutcome.HeldUp.value), held.restoreRefusal);
    Assert.areEqual(0, host.checkpoints.restores.length);
    Assert.isNull(gone.restoredFiles);
    Assert.areEqual(Resources.formatRestoreRefusal(PreviewOutcome.FolderMissing.value), gone.restoreRefusal);
    Assert.areEqual(2, gone.removedMessageIds.length);
    Assert.isFalse(existsSync(folder));
  }

  @TestMethod
  public async rewindsByForkingTheProvidersSessionWhenItCan(): Promise<void> {
    await using host = await CoreHost.createAsync(true);
    const conversation = await host.createConversationAsync();
    const first = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "First"));
    await host.engine.waitForIdle();
    const second = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Second"));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Third"));
    await host.engine.waitForIdle();
    Assert.areEqual("turn-1", (await host.messages.findAsync(first.replies[0]!.id))?.provenance?.nativeTurnId);
    Assert.areEqual("session-1", (await host.messages.findAsync(second.replies[0]!.id))?.provenance?.nativeSessionId);

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, second.sent.id, false));
    const fourth = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Fourth"));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Fifth"));
    await host.engine.waitForIdle();

    Assert.isTrue(result.sessionKept);
    Assert.isFalse(result.conversation.sessionReset);
    Assert.areEqual("fork-1", result.conversation.forkedSession?.nativeSessionId);
    Assert.areEqual("fake", result.conversation.forkedSession?.kind);
    Assert.areEqual((await host.providerOfAsync()).id, result.conversation.forkedSession?.providerId);
    Assert.areEqual(4, result.removedMessageIds.length);
    Assert.areEqual("session-1", host.adapter.forkRequests[0]?.nativeSessionId);
    Assert.areEqual("turn-1", host.adapter.forkRequests[0]?.lastTurnId);
    Assert.areEqual("fake", host.adapter.forkRequests[0]?.requested.kind);
    Assert.areEqual("Fourth", host.adapter.requests[3]?.prompt);
    Assert.areEqual("fork-1", host.adapter.requests[3]?.resumeNativeSessionId);
    Assert.isNull(host.adapter.requests[3]?.resumeAt);
    Assert.isNull((await host.conversations.findAsync(conversation.id))?.forkedSession);
    Assert.areEqual("fork-1", (await host.messages.findAsync(fourth.replies[0]!.id))?.provenance?.nativeSessionId);
    Assert.areEqual("fork-1", host.adapter.requests[4]?.resumeNativeSessionId);

    const whole = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, first.sent.id, false));
    Assert.isFalse(whole.sessionKept);
    Assert.isTrue(whole.conversation.sessionReset);
    Assert.areEqual(1, host.adapter.forkRequests.length);
  }

  @TestMethod
  public async rewindsByResumingAtTheKeptTurnForAProviderThatForksWhenItResumes(): Promise<void> {
    await using host = await CoreHost.createAsync(true);
    host.adapter.forksWhenResuming = true;
    const conversation = await host.createConversationAsync();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "First"));
    await host.engine.waitForIdle();
    const second = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Second"));
    await host.engine.waitForIdle();

    const result = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, second.sent.id, false));
    const third = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Third"));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Fourth"));
    await host.engine.waitForIdle();

    Assert.isTrue(result.sessionKept);
    Assert.areEqual("session-1", result.conversation.forkedSession?.nativeSessionId);
    Assert.areEqual("turn-1", result.conversation.forkedSession?.resumeAt);
    Assert.areEqual("session-1", host.adapter.requests[2]?.resumeNativeSessionId);
    Assert.areEqual("turn-1", host.adapter.requests[2]?.resumeAt);
    Assert.areEqual("fork-of-session-1-at-turn-1", (await host.messages.findAsync(third.replies[0]!.id))?.provenance?.nativeSessionId);
    Assert.isNull((await host.conversations.findAsync(conversation.id))?.forkedSession);
    Assert.areEqual("fork-of-session-1-at-turn-1", host.adapter.requests[3]?.resumeNativeSessionId);
    Assert.isNull(host.adapter.requests[3]?.resumeAt);
  }

  @TestMethod
  public async rewindsWithTheTranscriptWhenTheSessionCannotBeForked(): Promise<void> {
    await using host = await CoreHost.createAsync(true);
    const conversation = await host.createConversationAsync();
    const send = async (text: string): Promise<MessageSendResult> => host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, text));
    const rewindTo = (messageId: string): Promise<ConversationRewindResult> =>
      host.engine.rewindAsync(new ConversationRewindParams(conversation.id, messageId, false));

    await send("First");
    await host.engine.waitForIdle();
    const second = await send("Second");
    await host.engine.waitForIdle();
    host.adapter.forkFailure = new Error("no such thread");
    const refused = await rewindTo(second.sent.id);
    Assert.isFalse(refused.sessionKept);
    Assert.isTrue(refused.conversation.sessionReset);
    Assert.areEqual(1, host.adapter.forkRequests.length);
    host.adapter.forkFailure = null;

    host.adapter.reportsTurnIds = false;
    await send("Third");
    await host.engine.waitForIdle();
    host.adapter.reportsTurnIds = true;
    const fourth = await send("Fourth");
    await host.engine.waitForIdle();
    Assert.isFalse((await rewindTo(fourth.sent.id)).sessionKept);
    Assert.areEqual(1, host.adapter.forkRequests.length);

    const fifth = await send("Fifth");
    await host.engine.waitForIdle();
    const sixth = await send("Sixth");
    await host.engine.waitForIdle();
    Assert.areNotEqual((await host.messages.findAsync(fifth.replies[0]!.id))?.provenance?.nativeSessionId,
      (await host.messages.findAsync(fourth.replies[0]!.id))?.provenance?.nativeSessionId);
    Assert.isTrue((await rewindTo(sixth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);

    const provider = await host.createProviderAsync();
    const seventh = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Seventh", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    const eighth = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Eighth", new RequestedSettings("fake", null, null), provider.id));
    await host.engine.waitForIdle();
    Assert.areEqual(provider.id, (await host.messages.findAsync(seventh.replies[0]!.id))?.provenance?.providerId);
    Assert.areEqual("fork-2", (await host.conversations.findAsync(conversation.id))?.forkedSession?.nativeSessionId);
    Assert.areNotEqual("fork-2", (await host.messages.findAsync(seventh.replies[0]!.id))?.provenance?.nativeSessionId);
    Assert.areEqual((await host.messages.findAsync(seventh.replies[0]!.id))?.provenance?.nativeSessionId,
      (await host.messages.findAsync(eighth.replies[0]!.id))?.provenance?.nativeSessionId);
    await host.providers.deleteAsync(new ProviderIdParams(provider.id));
    Assert.isFalse((await rewindTo(eighth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);

    const ninth = await send("Ninth");
    await host.engine.waitForIdle();
    const foreign = (await host.messages.findAsync(ninth.replies[0]!.id))!;
    const provenance = new Provenance(null, new RequestedSettings("gone", null, null), foreign.provenance!.observed, "s-gone", false, "t-gone");
    await host.messages.updateAsync(foreign.withProvenance(provenance));
    const tenth = await send("Tenth");
    await host.engine.waitForIdle();
    Assert.isFalse((await rewindTo(tenth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);

    const eleventh = await send("Eleventh");
    await host.engine.waitForIdle();
    const other = await host.createProviderAsync("fake", "Other");
    const twelfth = await host.engine.sendAsync(new MessageSendParams(conversation.id, "Twelfth", new RequestedSettings("fake", null, null), other.id));
    await host.engine.waitForIdle();
    Assert.areNotEqual((await host.messages.findAsync(eleventh.replies[0]!.id))?.provenance?.nativeSessionId,
      (await host.messages.findAsync(twelfth.replies[0]!.id))?.provenance?.nativeSessionId);
    Assert.isFalse((await rewindTo(twelfth.sent.id)).sessionKept);
    Assert.areEqual(2, host.adapter.forkRequests.length);
  }

  @TestMethod
  public async rewindsWithoutFilesBeforeAnyCheckpointAndWithoutAPreambleWhenNothingIsLeft(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    host.checkpoints.captureOutcome = CaptureOutcome.FolderMissing;
    host.adapter.detailTexts = [];
    const first = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "x".repeat(30_000)));
    await host.engine.waitForIdle();
    host.adapter.detailTexts = ["Working"];
    const second = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Second"));
    await host.engine.waitForIdle();

    const partial = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, second.sent.id, true));
    const third = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Third"));
    await host.engine.waitForIdle();
    const whole = await host.engine.rewindAsync(new ConversationRewindParams(conversation.id, first.sent.id, false));
    const fourth = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Fourth"));
    await host.engine.waitForIdle();
    await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Fifth"));
    await host.engine.waitForIdle();

    Assert.isNull(partial.restoredFiles);
    Assert.areEqual(Resources.noCheckpointRefusal, partial.restoreRefusal);
    Assert.isNull(whole.restoreRefusal);
    Assert.areEqual(0, host.checkpoints.previews.length);
    Assert.areEqual(2, partial.removedMessageIds.length);
    Assert.isTrue(host.adapter.requests[2]?.prompt.includes("Earlier messages were omitted") ?? false);
    Assert.isTrue((host.adapter.requests[2]?.prompt.length ?? 0) < 25_000);
    Assert.areEqual(4, whole.removedMessageIds.length);
    Assert.areEqual("Fourth", host.adapter.requests[3]?.prompt);
    Assert.isNull(host.adapter.requests[3]?.resumeNativeSessionId);
    Assert.areEqual((await host.messages.findAsync(fourth.replies[0]!.id))?.provenance?.nativeSessionId, host.adapter.requests[4]?.resumeNativeSessionId);
    const left = (await host.messages.listAsync(new MessageListParams(conversation.id, null))).filter(t => t.author === MessageAuthor.User);
    Assert.areEqual("Fourth,Fifth", left.map(t => t.details[0]?.text).join(","));
    Assert.isFalse(Object.isNull(third.replies[0]!.id));
  }

  @TestMethod
  public async rejectsRewindsOfUnknownOrForeignMessagesAndOpenReplies(): Promise<void> {
    await using host = await CoreHost.createAsync();
    const conversation = await host.createConversationAsync();
    const other = await host.createConversationAsync(await host.openProjectAsync("beta"));
    const sent = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, other.id, "Elsewhere"));
    await host.engine.waitForIdle();
    const rewind = (conversationId: string, messageId: string): Promise<unknown> =>
      host.engine.rewindAsync(new ConversationRewindParams(conversationId, messageId, false));

    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind("nope", sent.sent.id), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind(conversation.id, "nope"), ServiceException)).info.name);
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind(conversation.id, sent.sent.id), ServiceException)).info.name);
    await host.context.database.connection.executeAsync(new SqlQuery("PRAGMA foreign_keys = OFF"));
    await host.context.database.connection.executeAsync(new SqlQuery("DELETE FROM projects WHERE id = ?", [other.projectId]));
    Assert.areEqual(ErrorCode.NotFound, (await Assert.throwsAsync(() => rewind(other.id, sent.sent.id), ServiceException)).info.name);
    host.adapter.holdUntilAbort = true;
    const held = await host.engine.sendAsync(await ConversationEngineTests.paramsAsync(host, conversation.id, "Hold"));
    Assert.areEqual(ErrorCode.Conflict, (await Assert.throwsAsync(() => rewind(conversation.id, held.sent.id), ServiceException)).info.name);
    await host.engine.cancelAsync(new MessageIdParams(held.replies[0]!.id));
    await host.engine.waitForIdle();
  }

  private static folder(path: string, files: Readonly<Record<string, string>>): string {
    mkdirSync(path, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(path, name, ".."), { recursive: true });
      writeFileSync(join(path, name), content);
    }
    return path;
  }

  private static posted(id: string): QuestionAsk {
    return new QuestionAsk(id, "request_user_input_async", [
      new ApprovalQuestion("0", "", "Which platform?\nPick one", [new QuestionOption("Desktop app", ""), new QuestionOption("Web", "")], false, true, false),
      new ApprovalQuestion("1", "", "Anything else?", [], false, true, false)
    ]);
  }

  private static postedSecret(id: string): QuestionAsk {
    return new QuestionAsk(id, "request_user_input_async", [
      new ApprovalQuestion("0", "", "Which platform?\nPick one", [new QuestionOption("Desktop app", ""), new QuestionOption("Web", "")], false, true, false),
      new ApprovalQuestion("1", "", "Your token?", [], false, true, true)
    ]);
  }

  private static async postsAsync(host: CoreHost, conversationId: string, count: number): Promise<readonly Approval[]> {
    await host.until(`${count} approvals`, async () => (await host.approvals.listAsync(new ConversationIdParams(conversationId))).length === count, host.runs());
    return [...await host.approvals.listAsync(new ConversationIdParams(conversationId))].sort((a, b) => JSON.stringify(a.payload).localeCompare(JSON.stringify(b.payload)));
  }

  private static at<T>(items: readonly T[], index: number): T {
    const item = items[index];
    if (Object.isUndefined(item))
      throw new Error(`Nothing is at ${index}.`);
    return item;
  }

  private static async replyOfAsync(host: CoreHost, sent: MessageSendResult): Promise<Message> {
    const reply = await host.messages.findAsync(sent.replies.at(0)?.id ?? String.empty);
    if (Object.isNull(reply))
      throw new Error("The send's first reply is not stored.");
    return reply;
  }

  private static async paramsAsync(host: CoreHost, conversationId: string, text: string): Promise<MessageSendParams> {
    return new MessageSendParams(conversationId, text, new RequestedSettings("fake", null, null), (await host.providerOfAsync()).id);
  }

  private static list(conversationId: string): MessageListParams {
    return new MessageListParams(conversationId, null);
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
