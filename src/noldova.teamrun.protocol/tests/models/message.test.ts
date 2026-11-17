/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  Chat, DetailKind, Message, MessageAuthor, MessageDetail, MessageSender, MessageStatus, ObservedSettings, PlanStep, PlanStepStatus, Provenance, ReplyPlan,
  RequestedSettings
} from "@noldova/teamrun.protocol";
import { TeammateMention } from "@noldova/teamrun.protocol";

@TestClass
export class MessageTests {
  @TestMethod
  public retainsHistoricalAuthorsAndResolvedMentionsAcrossCopies(): void {
    const mentions = [new TeammateMention("alice", "Alice")];
    const user = new Message("u", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t", [], null, null, mentions);
    mentions.push(new TeammateMention("bob", "Bob"));
    Assert.areEqual(1, user.mentions.length);
    const restored = Message.fromJson(user.toJson());
    Assert.areEqual("Alice", restored.mentions[0]?.name);
    const reply = new Message("r", "c", 1, MessageAuthor.Provider, "u", MessageStatus.Pending, [], MessageTests.provenance,
      "t", null, null, [], "alice", "Alice");
    for (const copy of [reply.withStatus(MessageStatus.Completed, "end"), reply.withDetails([]), reply.withDetail(MessageTests.text),
      reply.withProvenance(MessageTests.provenance), Message.fromJson(reply.toJson())]) {
      Assert.areEqual("alice", copy.teammateId);
      Assert.areEqual("Alice", copy.teammateName);
    }
    const mentioning = reply.withStatus(MessageStatus.Completed, "end").withMentions([new TeammateMention("bob", "Bob")]);
    Assert.areEqual("alice:bob:Bob", [mentioning.teammateId, ...Message.fromJson(mentioning.toJson()).mentions.flatMap(t => [t.teammateId, t.name])].join(":"));
    Assert.areEqual(0, reply.mentions.length);
    Assert.isNull(Message.fromJson(MessageTests.json).teammateId);
    Assert.isNull(Message.fromJson({ ...user.toJson(), teammateId: null, teammateName: null }).teammateName);
    Assert.throws(() => Message.fromJson({ ...user.toJson(), mentions: "Alice" }), JsonException);
    Assert.throws(() => Message.fromJson({ ...user.toJson(), teammateId: "alice", teammateName: "Alice" }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateName: null }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateId: null }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateId: " " }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateName: " " }), ArgumentException);
    Assert.throws(() => Message.fromJson({ ...reply.toJson(), teammateId: null, teammateName: null, mentions: user.mentions.map(t => t.toJson()) }),
      ArgumentException);
  }

  @TestMethod
  public awaitsPlanApprovalOnlyForACompletedPlanFirstReplyWithAnOpenPlanTextInAChatThatStillPlansFirstForItsMember(): void {
    const chat = new Chat("c", "p", "Chat", "t", "t").withPlanFirst(true);
    const planned = new Provenance(null, new RequestedSettings("codex", null, null, null, null, true), new ObservedSettings(null, null, null, null), null, false);
    const plan = (rejected: boolean = false, approved: boolean = false): MessageDetail =>
      new MessageDetail(0, DetailKind.Plan, "Tidy", new ReplyPlan([], null, "# Tidy", rejected, approved).toJson(), "t");
    const checklist = new MessageDetail(0, DetailKind.Plan, "Steps", new ReplyPlan([new PlanStep("Read", PlanStepStatus.Pending, null)], null).toJson(), "t");
    const reply = (details: readonly MessageDetail[], status: MessageStatus = MessageStatus.Completed, provenance: Provenance = planned): Message =>
      new Message("r", "c", 1, MessageAuthor.Provider, "u", status, details, provenance, "t", "t", status === MessageStatus.Running ? null : "t");
    const teammates = new Message("r", "c", 1, MessageAuthor.Provider, "u", MessageStatus.Completed, [plan()], planned, "t", "t", "t", [], "ada", "Ada");

    Assert.areEqual(JSON.stringify([true, false, true, false]), JSON.stringify([teammates.awaitsPlanApproval(chat.withPlanApproved(null)),
      teammates.awaitsPlanApproval(chat.withPlanApproved("ada")), reply([plan()]).awaitsPlanApproval(chat.withPlanApproved("ada")),
      reply([plan()]).awaitsPlanApproval(chat.withPlanApproved(null))]));
    Assert.areEqual(JSON.stringify([true, false, false, false, false, false, false, false, false]), JSON.stringify([
      reply([plan()]).awaitsPlanApproval(chat),
      reply([plan()], MessageStatus.Running).awaitsPlanApproval(chat),
      reply([plan()], MessageStatus.Completed, MessageTests.provenance).awaitsPlanApproval(chat),
      reply([plan()]).awaitsPlanApproval(chat.withPlanFirst(false)),
      reply([plan()]).awaitsPlanApproval(null),
      reply([plan()]).awaitsPlanApproval(new Chat("other", "p", "Chat", "t", "t").withPlanFirst(true)),
      reply([]).awaitsPlanApproval(chat),
      reply([checklist]).awaitsPlanApproval(chat),
      reply([plan(true)]).awaitsPlanApproval(chat) || reply([plan(false, true)]).awaitsPlanApproval(chat)
    ]));
  }

  @TestMethod
  public keepsTheSenderOfAMessageFromAnotherChatAcrossCopies(): void {
    const sender = new MessageSender("c2", "alice", "Alice");
    const sent = new Message("u", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t", [], null, null, [], sender);

    for (const copy of [sent.withStatus(MessageStatus.Completed, "end"), sent.withDetails([]), sent.withDetail(MessageTests.text), sent.withMentions([]),
      Message.fromJson(sent.toJson())])
      Assert.areEqual("c2,alice,Alice", [copy.sender?.chatId, copy.sender?.teammateId, copy.sender?.name].join(","));
    Assert.isFalse("sender" in new Message("u", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t").toJson());
    Assert.areEqual("$.sender.chatId",
      Assert.throws(() => Message.fromJson({ ...sent.toJson(), sender: { teammateId: "alice", name: "Alice" } }), JsonException).path);
  }

  @TestMethod
  public refusesASenderOnAReplyOrATeamRunNote(): void {
    const sender = new MessageSender("c2", "alice", "Alice");

    for (const author of [MessageAuthor.Provider, MessageAuthor.TeamRun]) {
      const provenance = author === MessageAuthor.Provider ? MessageTests.provenance : null;
      const error = Assert.throws(() => new Message("r", "c", 1, author, null, MessageStatus.Completed, [], provenance, "t", null, "t", [], null, null, [], sender),
        ArgumentException);
      Assert.areEqual("sender", error.parameterName);
    }
  }

  @TestMethod
  public replacesItsDetails(): void {
    const original = new Message("msg-1", "conv-1", 2, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, "Hi", null, "t1")], null, "t1", null, "t1");

    const replaced = original.withDetails([]);

    Assert.areEqual(1, original.details.length);
    Assert.areEqual(0, replaced.details.length);
    Assert.areEqual(original.id, replaced.id);
    Assert.areEqual(original.sequence, replaced.sequence);
  }

  private static readonly text: MessageDetail = new MessageDetail(0, DetailKind.Text, "Add login", null, "t");
  private static readonly provenance: Provenance =
    new Provenance(null, new RequestedSettings("codex", null, null), new ObservedSettings(null, null, null, null), null, false);
  private static readonly json: object = {
    id: "msg-2",
    chatId: "conv-1",
    sequence: 1,
    author: "Provider",
    inReplyTo: "msg-1",
    status: "Completed",
    details: [{ sequence: 0, kind: "Reasoning", text: "Looking at the login page.", payload: null, createdAt: "2026-09-08T09:00:02Z" },
      { sequence: 1, kind: "Command", text: "npm test", payload: { exitCode: 0 }, createdAt: "2026-09-08T09:00:05Z" }],
    provenance: {
      providerId: "acc-1",
      requested: { kind: "codex", model: null, effort: null, speed: null, mode: null },
      observed: { kind: "codex", model: "gpt-5-codex", effort: "medium", harnessVersion: "0.50.0", unavailableModel: false, speed: null, speedUnavailable: null },
      nativeSessionId: "thread-9",
      resumedNativeSession: false,
      nativeTurnId: null
    },
    createdAt: "2026-09-08T09:00:01Z",
    startedAt: "2026-09-08T09:00:02Z",
    endedAt: "2026-09-08T09:00:09Z"
  };

  @TestMethod
  public holdsTheUsersMessage(): void {
    const message = new Message("msg-1", "conv-1", 0, MessageAuthor.User, null, MessageStatus.Completed, [MessageTests.text], null, "t", null, "t");

    Assert.areEqual(MessageAuthor.User, message.author);
    Assert.isNull(message.inReplyTo);
    Assert.isNull(message.provenance);
    Assert.areEqual("Add login", message.details[0]?.text);
    Assert.isNull(message.toJson()["provenance"]);
  }

  @TestMethod
  public holdsAProvidersPendingReply(): void {
    const message = MessageTests.createReply(MessageStatus.Pending, [], MessageTests.provenance, null);

    Assert.areEqual("msg-1", message.inReplyTo);
    Assert.areEqual(0, message.details.length);
    Assert.areEqual("codex", message.provenance?.requested.kind);
    Assert.isNull(message.endedAt);
  }

  @TestMethod
  public keepsItsOwnCopyOfTheDetails(): void {
    const details = [MessageTests.text];
    const message = new Message("msg-1", "conv-1", 0, MessageAuthor.User, null, MessageStatus.Completed, details, null, "t", null, "t");
    details.push(MessageTests.text);

    Assert.areEqual(1, message.details.length);
  }

  @TestMethod
  public rejectsBlankRequiredText(): void {
    const create = (id: string, conversationId: string, inReplyTo: string | null, createdAt: string): Message =>
      new Message(id, conversationId, 0, MessageAuthor.User, inReplyTo, MessageStatus.Completed, [], null, createdAt, null, createdAt);

    Assert.throws(() => create(String.empty, "conv", null, "t"), ArgumentException);
    Assert.throws(() => create("msg", String.empty, null, "t"), ArgumentException);
    Assert.throws(() => create("msg", "conv", " ", "t"), ArgumentException);
    Assert.throws(() => create("msg", "conv", null, String.empty), ArgumentException);
  }

  @TestMethod
  public rejectsNegativeOrFractionalSequences(): void {
    Assert.throws(() => new Message("msg", "conv", -1, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"), ArgumentOutOfRangeException);
    Assert.throws(() => new Message("msg", "conv", 1.5, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t"), ArgumentOutOfRangeException);
  }

  @TestMethod
  public tiesTheProvenanceToTheAuthor(): void {
    const missing = Assert.throws(() => MessageTests.createReply(MessageStatus.Completed, [], null, "t2"), ArgumentException);

    Assert.areEqual("provenance", missing.parameterName);
    Assert.throws(
      () => new Message("msg", "conv", 0, MessageAuthor.TeamRun, null, MessageStatus.Completed, [], MessageTests.provenance, "t", null, "t"), ArgumentException);
  }

  @TestMethod
  public tiesTheEndTimeToTheStatus(): void {
    const openWithEnd = Assert.throws(() => MessageTests.createReply(MessageStatus.Running, [], MessageTests.provenance, "t2"), ArgumentException);

    Assert.areEqual("endedAt", openWithEnd.parameterName);
    Assert.throws(() => MessageTests.createReply(MessageStatus.AwaitingApproval, [], MessageTests.provenance, "t2"), ArgumentException);
    Assert.throws(() => MessageTests.createReply(MessageStatus.Failed, [], MessageTests.provenance, null), ArgumentException);
    Assert.doesNotThrow(() => MessageTests.createReply(MessageStatus.Interrupted, [], MessageTests.provenance, "t2"));
  }

  @TestMethod
  public tiesTheStartTimeToARunningReply(): void {
    const reply = (status: MessageStatus, startedAt: string | null, endedAt: string | null): Message =>
      new Message("r", "c", 1, MessageAuthor.Provider, "u", status, [], MessageTests.provenance, "t", startedAt, endedAt);

    const waitingWithStart = Assert.throws(() => reply(MessageStatus.Pending, "t1", null), ArgumentException);
    const runningWithoutStart = Assert.throws(() => reply(MessageStatus.Running, null, null), ArgumentException);

    Assert.areEqual("startedAt", waitingWithStart.parameterName);
    Assert.areEqual("startedAt", runningWithoutStart.parameterName);
    Assert.throws(() => reply(MessageStatus.AwaitingApproval, null, null), ArgumentException);
    Assert.throws(() => reply(MessageStatus.Running, " ", null), ArgumentException);
    Assert.throws(() => new Message("u", "c", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", "t", "t"), ArgumentException);
    Assert.isNull(reply(MessageStatus.Cancelled, null, "t2").startedAt);
    Assert.areEqual("t1", reply(MessageStatus.AwaitingApproval, "t1", null).startedAt);
  }

  @TestMethod
  public readsRepliesStoredBeforeStartTimesFromTheirCreation(): void {
    const stored = Object.fromEntries(Object.entries(MessageTests.json).filter(([key]) => key !== "startedAt"));

    Assert.areEqual("2026-09-08T09:00:01Z", Message.fromJson(stored).startedAt);
    Assert.areEqual("2026-09-08T09:00:01Z", Message.fromJson({ ...stored, status: "Running", endedAt: null }).startedAt);
    Assert.isNull(Message.fromJson({ ...stored, status: "Pending", endedAt: null }).startedAt);
    Assert.isNull(Message.fromJson({ ...stored, author: "User", inReplyTo: null, provenance: null }).startedAt);
    Assert.isNull(Message.fromJson({ ...MessageTests.json, status: "Cancelled", startedAt: null }).startedAt);
    Assert.areEqual("2026-09-08T09:00:01Z", Message.fromJson(stored).toJson()["startedAt"]);
  }

  @TestMethod
  public roundTripsThroughJson(): void {
    const message = Message.fromJson(MessageTests.json);

    Assert.areEqual("msg-2", message.id);
    Assert.areEqual(MessageAuthor.Provider, message.author);
    Assert.areEqual(MessageStatus.Completed, message.status);
    Assert.areEqual(DetailKind.Command, message.details[1]?.kind);
    Assert.areEqual("thread-9", message.provenance?.nativeSessionId);
    Assert.areEqual("gpt-5-codex", message.provenance?.observed.model);
    Assert.areEqual(JSON.stringify(MessageTests.json), JSON.stringify(message.toJson()));
  }

  @TestMethod
  public readsAMessageWithoutProvenance(): void {
    const json = { ...MessageTests.json, author: "TeamRun", provenance: null, startedAt: null };
    const message = Message.fromJson(json);

    Assert.areEqual(MessageAuthor.TeamRun, message.author);
    Assert.isNull(message.provenance);
    Assert.areEqual(JSON.stringify(json), JSON.stringify(message.toJson()));
  }

  @TestMethod
  public rejectsInvalidValuesWithTheirPath(): void {
    const badAuthor = Assert.throws(() => Message.fromJson({ ...MessageTests.json, author: "bot" }), JsonException);
    const badStatus = Assert.throws(() => Message.fromJson({ ...MessageTests.json, status: "done" }), JsonException);
    const image = { sequence: 0, kind: "image", text: String.empty, payload: null, createdAt: "t" };
    const badDetail = Assert.throws(() => Message.fromJson({ ...MessageTests.json, details: [image] }), JsonException);
    const badProvenance = Assert.throws(() => Message.fromJson({ ...MessageTests.json, provenance: { providerId: null } }), JsonException);

    Assert.areEqual("$.author", badAuthor.path);
    Assert.areEqual("$.status", badStatus.path);
    Assert.areEqual("$.details.0.kind", badDetail.path);
    Assert.areEqual("$.provenance.requested", badProvenance.path);
  }

  private static createReply(status: MessageStatus, details: readonly MessageDetail[], provenance: Provenance | null, endedAt: string | null): Message {
    return new Message("msg-2", "conv-1", 1, MessageAuthor.Provider, "msg-1", status, details, provenance, "t", status === MessageStatus.Pending ? null : "t",
      endedAt);
  }

  @TestMethod
  public producesUpdatedCopies(): void {
    const reply = MessageTests.createReply(MessageStatus.Pending, [], MessageTests.provenance, null);
    const detail = new MessageDetail(0, DetailKind.Reasoning, "Thinking", null, "t");
    const observed = new ObservedSettings("codex", "gpt-5-codex", "medium", "0.50.0");

    const running = reply.withStart("t1");
    const detailed = running.withDetail(detail);
    const traced = detailed.withProvenance(MessageTests.provenance.withObserved(observed));
    const ended = traced.withStatus(MessageStatus.Completed, "t2");

    Assert.areEqual(MessageStatus.Pending, reply.status);
    Assert.isNull(reply.startedAt);
    Assert.areEqual(0, reply.details.length);
    Assert.areEqual(MessageStatus.Running, running.status);
    Assert.areEqual("t1", running.startedAt);
    Assert.isNull(running.endedAt);
    Assert.areEqual("Thinking", detailed.details[0]?.text);
    Assert.areEqual("gpt-5-codex", traced.provenance?.observed.model);
    Assert.areEqual("t1", ended.startedAt);
    Assert.areEqual("t2", ended.endedAt);
    Assert.areEqual(reply.id, ended.id);
    Assert.throws(() => reply.withStatus(MessageStatus.Completed, null), ArgumentException);
    Assert.throws(() => reply.withStatus(MessageStatus.Running, null), ArgumentException);
  }
}
