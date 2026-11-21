/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { DetailKind, EventName, Message, MessageAuthor, MessageDetail, MessageIdParams, MessageStatus, MethodName, OrganizationMessage,
  OrganizationMessageSendParams, OrganizationRecipient, OrganizationRecipientState, OrganizationTarget } from "@noldova/teamrun.protocol";

import { ListNotArrayException } from "../../../src/app/exceptions/list-not-array.exception";
import { OrganizationMessagesStoreService } from "../../../src/app/services/organization-messages-store.service";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("OrganizationMessagesStoreService", () => {
  const started = (teammateId: string, messageId: string): OrganizationRecipient =>
    new OrganizationRecipient(teammateId, teammateId, OrganizationRecipientState.Started, `chat-${teammateId}`, messageId);
  const sent = (id: string, target: OrganizationTarget, createdAt: string, ...recipients: readonly OrganizationRecipient[]): OrganizationMessage =>
    new OrganizationMessage(id, target, `text ${id}`, createdAt, recipients);
  const reply = (id: string, inReplyTo: string, status: MessageStatus, createdAt: string = "2026-11-20T10:00:00.000Z"): Message =>
    new Message(id, "chat-ada", 1, MessageAuthor.Provider, inReplyTo, status, [new MessageDetail(0, DetailKind.Text, id, null, createdAt)], SampleData.provenance,
      createdAt, status === MessageStatus.Pending ? null : createdAt, open.includes(status) ? null : createdAt, [], "ada", "Ada");
  const open: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];
  const toAda = sent("o1", OrganizationTarget.teammate("ada"), "2026-11-20T09:00:00.000Z", started("ada", "s1"));
  const toEveryone = sent("o2", OrganizationTarget.everyone, "2026-11-20T09:30:00.000Z", started("ada", "s2"), started("bob", "s3"));
  const idsOf = (replies: readonly Message[]): string => replies.map(t => `${t.id}:${t.status}`).join(",");
  let context: FakeWindowPartContext;

  const create = (messages: readonly OrganizationMessage[] = [toAda, toEveryone],
    replies: (id: string) => JsonValue | Promise<JsonValue> = () => []): OrganizationMessagesStoreService => {
    context = new FakeWindowPartContext()
      .answer(MethodName.OrganizationMessageList, () => messages.map(t => t.toJson()))
      .answer(MethodName.OrganizationMessageReplyList, t => replies(MessageIdParams.fromJson(t).messageId));
    return OrganizationMessagesStoreService.of(context);
  };
  const loaded = async (store: OrganizationMessagesStoreService, count: number = 2): Promise<void> =>
    Wait.until(() => expect(store.messages()).toHaveLength(count));

  afterEach(() => {
    OrganizationMessagesStoreService.release(context);
  });

  it("is one store per window part and groups the listed messages by target, the latest conversation first", async () => {
    const again = sent("o3", OrganizationTarget.teammate("ada"), "2026-11-20T09:45:00.000Z", started("ada", "s4"));
    const store = create([toAda, toEveryone, again]);

    expect(store).toBe(OrganizationMessagesStoreService.of(context));
    await loaded(store, 3);

    expect(store.conversations().map(t => `${t.key}=${t.messages.map(u => u.id).join("+")}`)).toEqual(["Teammate:ada=o1+o3", "Everyone:=o2"]);
    expect(store.conversations()[0]?.last.id).toBe("o3");
    expect(store.loadError()).toBeNull();
  });

  it("applies each updated message in place, adds a new one, and keeps the listed history with the updates made while the list was read", async () => {
    const history = sent("o0", OrganizationTarget.leaders, "2026-11-20T08:00:00.000Z", started("ada", "s0"));
    const store = create([]);
    await Wait.until(() => expect(context.count(MethodName.OrganizationMessageList)).toBe(1));
    const listed = new DeferredResponse();
    context.answer(MethodName.OrganizationMessageList, () => listed.promise);
    const stopped = toAda.withRecipient(new OrganizationRecipient("ada", "ada", OrganizationRecipientState.Stopped));

    const reading = store.reload();
    context.emit(EventName.OrganizationMessageUpdated, toAda.toJson());
    context.emit(EventName.OrganizationMessageUpdated, toEveryone.toJson());
    context.emit(EventName.OrganizationMessageUpdated, stopped.toJson());
    listed.resolve([history.toJson(), toAda.toJson()]);
    await reading;

    expect(store.messages().map(t => `${t.id}:${t.recipients[0]?.state}`)).toEqual(["o0:Started", "o1:Stopped", "o2:Started"]);
  });

  it("drops a list answer or failure that a newer reading replaced", async () => {
    const store = create([]);
    await Wait.until(() => expect(context.count(MethodName.OrganizationMessageList)).toBe(1));
    const answers: DeferredResponse[] = [];
    context.answer(MethodName.OrganizationMessageList, () => {
      const answer = new DeferredResponse();
      answers.push(answer);
      return answer.promise;
    });

    const readings = [store.reload(), store.reload(), store.reload()];
    await Wait.until(() => expect(answers).toHaveLength(3));
    answers.at(0)?.resolve([toEveryone.toJson()]);
    answers.at(1)?.reject(new Error("too late"));
    answers.at(2)?.resolve([toAda.toJson()]);
    await Promise.all(readings);

    expect(store.messages().map(t => t.id)).toEqual(["o1"]);
    expect(store.loadError()).toBeNull();
  });

  it.each([
    ["an error", (): never => { throw new Error("runtime down"); }, "runtime down"],
    ["a string", (): Promise<JsonValue> => Promise.reject("refused"), "refused"],
    ["a value that isn't a list", (): JsonValue => ({}), new ListNotArrayException("object").message]
  ])("reports a list answered with %s and clears it once a list reads", async (_, answer, shown) => {
    let fail = true;
    context = new FakeWindowPartContext().answer(MethodName.OrganizationMessageList, () => fail ? answer() : [toAda.toJson()]);
    const store = OrganizationMessagesStoreService.of(context);
    await Wait.until(() => expect(store.loadError()).toBe(shown));

    fail = false;
    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect(store.messages()).toHaveLength(1));
    expect(store.loadError()).toBeNull();
  });

  it("reads a message's replies once and keeps each live reply in order, ignoring messages that answer nothing it sent", async () => {
    const store = create(undefined, id => id === "o1" ? [reply("r1", "s1", MessageStatus.Completed).toJson()] : []);
    await loaded(store);

    const replies = store.repliesOf("o1");
    expect(replies).toBe(store.repliesOf("o1"));
    await Wait.until(() => expect(idsOf(replies())).toBe("r1:Completed"));
    context.emit(EventName.MessageCreated, reply("r2", "s1", MessageStatus.Running, "2026-11-20T11:00:00.000Z").toJson());
    context.emit(EventName.MessageCreated, reply("x1", "elsewhere", MessageStatus.Running).toJson());
    context.emit(EventName.MessageCreated, new Message("u1", "chat-ada", 2, MessageAuthor.User, null, MessageStatus.Completed, [], null, "t", null, "t").toJson());
    context.emit(EventName.MessageUpdated, reply("r2", "s1", MessageStatus.Completed, "2026-11-20T11:00:00.000Z").toJson());

    expect(idsOf(replies())).toBe("r1:Completed,r2:Completed");
    expect(context.count(MethodName.OrganizationMessageReplyList)).toBe(1);
  });

  it("keeps a reply that changed while its replies were read, and a reply that came before they were asked for", async () => {
    const answer = new DeferredResponse();
    const store = create(undefined, () => answer.promise);
    await loaded(store);
    context.emit(EventName.MessageCreated, reply("r0", "s2", MessageStatus.Running, "2026-11-20T09:31:00.000Z").toJson());

    const replies = store.repliesOf("o2");
    context.emit(EventName.MessageUpdated, reply("r0", "s2", MessageStatus.Completed, "2026-11-20T09:31:00.000Z").toJson());
    answer.resolve([reply("r0", "s2", MessageStatus.Running, "2026-11-20T09:31:00.000Z").toJson(), reply("r9", "s3", MessageStatus.Completed).toJson()]);

    await Wait.until(() => expect(idsOf(replies())).toBe("r0:Completed,r9:Completed"));
  });

  it("counts a reply unread once, as it completes, under its conversation, until that conversation is read", async () => {
    const store = create(undefined, () => [reply("old", "s1", MessageStatus.Completed).toJson()]);
    await loaded(store);
    await Wait.until(() => expect(store.repliesOf("o1")()).toHaveLength(1));

    context.emit(EventName.MessageUpdated, reply("old", "s1", MessageStatus.Completed).toJson());
    context.emit(EventName.MessageCreated, reply("r1", "s2", MessageStatus.Running).toJson());
    expect(store.unreadOf(OrganizationTarget.everyone)).toBe(0);
    context.emit(EventName.MessageUpdated, reply("r1", "s2", MessageStatus.Completed).toJson());
    context.emit(EventName.MessageUpdated, reply("r1", "s2", MessageStatus.Completed).toJson());
    context.emit(EventName.MessageUpdated, reply("r2", "s3", MessageStatus.Completed).toJson());

    expect(store.unreadOf(OrganizationTarget.everyone)).toBe(2);
    expect(store.unreadOf(OrganizationTarget.teammate("ada"))).toBe(0);
    store.markRead(OrganizationTarget.teammate("ada"));
    expect(store.unreadOf(OrganizationTarget.everyone)).toBe(2);
    store.markRead(OrganizationTarget.everyone);
    context.emit(EventName.MessageUpdated, reply("r1", "s2", MessageStatus.Completed).toJson());
    expect(store.unreadOf(OrganizationTarget.everyone)).toBe(0);
  });

  it.each([
    ["an error", (): never => { throw new Error("chat gone"); }, "chat gone"],
    ["a string", (): Promise<JsonValue> => Promise.reject("chat gone"), "chat gone"],
    ["a value that isn't a list", (): JsonValue => "nope", new ListNotArrayException("string").message]
  ])("reports replies answered with %s under that message alone, and clears it once its replies read", async (_, answer, shown) => {
    let fail = true;
    const store = create(undefined, id => fail ? answer() : id === "o2" ? [reply("r9", "s2", MessageStatus.Completed).toJson()] : []);
    await loaded(store);

    store.repliesOf("o1");
    await Wait.until(() => expect(store.repliesErrorOf("o1")).toBe(shown));
    fail = false;
    const other = store.repliesOf("o2");
    await Wait.until(() => expect(idsOf(other())).toBe("r9:Completed"));

    expect(store.repliesErrorOf("o2")).toBeNull();
    expect(store.repliesErrorOf("o1")).toBe(shown);
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(store.repliesErrorOf("o1")).toBeNull());
  });

  it("reads a message's replies again once a recipient's sent message is known, keeping a reply that came before", async () => {
    const queued = sent("o4", OrganizationTarget.teammate("ada"), "2026-11-20T09:50:00.000Z", new OrganizationRecipient("ada", "ada", OrganizationRecipientState.Queued));
    let listed: JsonValue = [];
    const store = create([queued], () => listed);
    await loaded(store, 1);
    const replies = store.repliesOf("o4");
    await Wait.until(() => expect(context.count(MethodName.OrganizationMessageReplyList)).toBe(1));

    context.emit(EventName.MessageCreated, reply("r4", "s4", MessageStatus.Running).toJson());
    expect(replies()).toEqual([]);
    listed = [reply("r4", "s4", MessageStatus.Running).toJson()];
    context.emit(EventName.OrganizationMessageUpdated, sent("o4", OrganizationTarget.teammate("ada"), "2026-11-20T09:50:00.000Z", started("ada", "s4")).toJson());

    await Wait.until(() => expect(idsOf(replies())).toBe("r4:Running"));
    context.emit(EventName.OrganizationMessageUpdated, sent("o4", OrganizationTarget.teammate("ada"), "2026-11-20T09:50:00.000Z", started("ada", "s4")).toJson());
    expect(context.count(MethodName.OrganizationMessageReplyList)).toBe(2);
  });

  it("reads the list and every open message's replies again after a resync", async () => {
    let replies = [reply("r1", "s1", MessageStatus.Running).toJson()];
    const store = create(undefined, () => replies);
    await loaded(store);
    const shown = store.repliesOf("o1");
    await Wait.until(() => expect(idsOf(shown())).toBe("r1:Running"));

    replies = [reply("r1", "s1", MessageStatus.Completed).toJson()];
    context.emit(EventName.StateResyncRequested, null);

    await Wait.until(() => expect(idsOf(shown())).toBe("r1:Completed"));
    expect(context.count(MethodName.OrganizationMessageList)).toBe(2);
    expect(context.count(MethodName.OrganizationMessageReplyList)).toBe(2);
  });

  it("sends to a target and stops a message, applying what the runtime answers", async () => {
    const store = create([]);
    const queued = sent("o9", OrganizationTarget.leaders, "2026-11-20T12:00:00.000Z", new OrganizationRecipient("ada", "Ada", OrganizationRecipientState.Queued));
    const stopped = queued.withRecipient(new OrganizationRecipient("ada", "Ada", OrganizationRecipientState.Stopped));
    context.answer(MethodName.OrganizationMessageSend, () => queued.toJson()).answer(MethodName.OrganizationMessageStop, () => stopped.toJson());
    await Wait.until(() => expect(context.count(MethodName.OrganizationMessageList)).toBe(1));

    expect((await store.sendAsync(OrganizationTarget.leaders, "Hello")).id).toBe("o9");
    expect(context.parametersOf(MethodName.OrganizationMessageSend)).toEqual(new OrganizationMessageSendParams(OrganizationTarget.leaders, "Hello").toJson());
    expect(store.messages().map(t => t.recipients[0]?.state)).toEqual([OrganizationRecipientState.Queued]);
    await store.stopAsync("o9");

    expect(context.parametersOf(MethodName.OrganizationMessageStop)).toEqual(new MessageIdParams("o9").toJson());
    expect(store.messages().map(t => t.recipients[0]?.state)).toEqual([OrganizationRecipientState.Stopped]);
  });

  it("drops a replies answer or failure that a newer reading replaced", async () => {
    const answers: DeferredResponse[] = [];
    const store = create(undefined, () => {
      const answer = new DeferredResponse();
      answers.push(answer);
      return answer.promise;
    });
    await loaded(store);
    const replies = store.repliesOf("o1");
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(answers).toHaveLength(2));
    context.emit(EventName.StateResyncRequested, null);
    await Wait.until(() => expect(answers).toHaveLength(3));

    answers.at(2)?.resolve([reply("r1", "s1", MessageStatus.Completed).toJson()]);
    await Wait.until(() => expect(idsOf(replies())).toBe("r1:Completed"));
    answers.at(0)?.resolve([reply("r1", "s1", MessageStatus.Running).toJson()]);
    answers.at(1)?.reject(new Error("stale"));
    const after = store.repliesOf("o2");
    answers.at(3)?.resolve([reply("r9", "s2", MessageStatus.Completed).toJson()]);
    await Wait.until(() => expect(idsOf(after())).toBe("r9:Completed"));

    expect(idsOf(replies())).toBe("r1:Completed");
    expect(store.repliesErrorOf("o1")).toBeNull();
  });

  it("stops following events and answers once released", async () => {
    const answer = new DeferredResponse();
    const store = create(undefined, () => answer.promise);
    await loaded(store);
    const replies = store.repliesOf("o1");

    OrganizationMessagesStoreService.release(context);
    context.emit(EventName.OrganizationMessageUpdated, sent("o5", OrganizationTarget.everyone, "t").toJson());
    answer.resolve([reply("r1", "s1", MessageStatus.Completed).toJson()]);
    const next = OrganizationMessagesStoreService.of(context);
    await loaded(next);

    expect(next).not.toBe(store);
    expect(store.messages()).toHaveLength(2);
    expect(replies()).toEqual([]);
  });
});
