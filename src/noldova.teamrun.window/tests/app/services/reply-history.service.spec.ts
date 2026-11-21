/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  ConversationRewoundPayload,
  DetailEventPayload,
  DetailKind,
  EventName,
  Message,
  MessageDetail,
  MessageIdParams,
  MessageStatus,
  MethodName,
  ReplyPage,
  ReplyPanel,
  ReplySummary
} from "@noldova/teamrun.protocol";

import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { ClockService } from "../../../src/app/services/clock.service";
import { EngineResync } from "../../../src/app/services/engine-resync";
import { ReplyHistoryService } from "../../../src/app/services/reply-history.service";
import { Resources } from "../../../src/resources";
import { FakeClock } from "../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("ReplyHistoryService", () => {
  let clock: FakeClock;
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  let history: ReplyHistoryService;
  let replies: Message[];

  const command = (sequence: number): MessageDetail =>
    new MessageDetail(sequence, DetailKind.Command, "> ls\nout", { tool: "Bash", toolUseId: `t${sequence}` }, SampleData.timestamp);
  const reply = (id: string, sequence: number, text: string = "> ls\nout"): Message =>
    SampleData.withStatus(new Message(id, "c1", sequence, SampleData.reply.author, null, MessageStatus.Running, [], SampleData.provenance, SampleData.timestamp,
      SampleData.timestamp, null), MessageStatus.Completed, [new MessageDetail(0, DetailKind.Command, text, { tool: "Bash", toolUseId: "t0" }, SampleData.timestamp)]);
  const summary = (message: Message): JsonValue => ReplySummary.fromMessage(message).toJson();
  const page = (hasEarlier: boolean = false): JsonValue =>
    new ReplyPage(replies.map(t => ReplySummary.fromMessage(t)).toSorted((a, b) => b.preview.sequence - a.preview.sequence), hasEarlier, false).toJson();
  const ids = (): string[] => history.source()?.items.map(t => t.preview.id) ?? [];
  const pending = (): { readonly promise: Promise<JsonValue>; resolve: (value: JsonValue) => void; reject: (reason: unknown) => void } => {
    let resolve: (value: JsonValue) => void = () => undefined;
    let reject: (reason: unknown) => void = () => undefined;
    const promise = new Promise<JsonValue>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, resolve, reject };
  };
  const settle = async (): Promise<void> => {
    for (let turn = 0; turn < 20; turn++)
      await Promise.resolve();
  };
  const wait = async (milliseconds: number): Promise<void> => {
    clock.advance(milliseconds);
    await settle();
  };
  const touch = async (message: Message): Promise<void> => {
    context.emit(EventName.MessageUpdated, message.toJson());
    await wait(Resources.replyRefreshDelay);
  };

  beforeEach(() => {
    replies = [reply("r1", 1), reply("r2", 3)];
    context = SampleData.createContext()
      .answer(MethodName.MessageActivityPage, () => page())
      .answer(MethodName.MessageSummary, t => {
        const found = replies.find(u => u.id === MessageIdParams.fromJson(t).messageId);
        return Object.isUndefined(found) ? null : summary(found);
      });
    store = new ChatStoreService(context);
    clock = new FakeClock(Date.parse(SampleData.timestamp));
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: ChatStoreService, useValue: store }, { provide: ClockService, useValue: clock },
        ReplyHistoryService]
    });
    history = TestBed.inject(ReplyHistoryService);
  });

  afterEach(() => {
    store.dispose();
  });

  it("reads nothing before a conversation is open, and no older page when the last one said there is none", async () => {
    context.emit(EventName.MessageCreated, reply("r3", 5).toJson());
    await wait(Resources.replyRefreshDelay);
    await history.loadOlder();
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));

    await history.loadOlder();

    expect(context.count(MethodName.MessageActivityPage)).toBe(1);
    expect(context.count(MethodName.MessageSummary)).toBe(0);
  });

  it("reads the open conversation's newest page again when the window reconnects to the engine, and nothing while none is open", async () => {
    EngineResync.request(context);
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));
    replies = [...replies, reply("r3", 5)];

    EngineResync.request(context);

    await Wait.until(() => expect(ids()).toEqual(["r1", "r2", "r3"]));
    expect(context.count(MethodName.MessageActivityPage)).toBe(2);
  });

  it("drops a page or a failure that arrives after another panel was chosen", async () => {
    const first = pending();
    const second = pending();
    const answers = [first, second];
    context.answer(MethodName.MessageActivityPage, () => (answers.shift() as ReturnType<typeof pending>).promise);
    context.answer(MethodName.MessageChangesPage, () => new ReplyPage([], false, false).toJson());

    history.select("c1", ReplyPanel.Activity);
    history.select("c1", ReplyPanel.Changes);
    first.resolve(page());
    await Wait.until(() => expect(history.source()?.items).toEqual([]));
    history.select("c1", ReplyPanel.Activity);
    history.select("c1", ReplyPanel.Changes);
    second.reject(new Error("Too late."));
    await settle();

    expect(history.error()).toBeNull();
    expect(history.loading()).toBe(false);
    expect(history.source()?.items).toEqual([]);
  });

  it("says why a page failed when the runtime rejects it with a plain text", async () => {
    context.answer(MethodName.MessageActivityPage, () => Promise.reject("The runtime stopped."));

    history.select("c1", ReplyPanel.Activity);

    await Wait.until(() => expect(history.error()).toBe("The runtime stopped."));
    expect(history.source()).toBeNull();
  });

  it("reads older pages until one adds no reply, though it says there are more", async () => {
    context.answer(MethodName.MessageActivityPage, () => page(true));
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));

    await history.loadAll();

    expect(context.count(MethodName.MessageActivityPage)).toBe(2);
    expect(ids()).toEqual(["r1", "r2"]);
  });

  it("keeps the replies it has when an older page fails", async () => {
    context.answer(MethodName.MessageActivityPage, () => page(true));
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));
    context.fail(MethodName.MessageActivityPage, "The page is gone.");

    await history.loadOlder();

    expect(history.error()).toBe("The page is gone.");
    expect(ids()).toEqual(["r1", "r2"]);
  });

  it("reads no details for a reply the runtime no longer has", async () => {
    context.answer(MethodName.MessageDetails, () => null);

    expect(await history.readDetails("gone")).toBeNull();
  });

  it("reads the newest page again when its conversation is rewound, but not when another is, nor on a resync, which the panel follows", async () => {
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));

    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c2", 0).toJson());
    context.emit(EventName.StateResyncRequested, null);
    await settle();
    expect(context.count(MethodName.MessageActivityPage)).toBe(1);
    replies.pop();
    context.emit(EventName.ConversationRewound, new ConversationRewoundPayload("c1", 3).toJson());

    await Wait.until(() => expect(ids()).toEqual(["r1"]));
    expect(context.count(MethodName.MessageActivityPage)).toBe(2);
  });

  it("reads a reply that changed while its page loaded once the page arrives", async () => {
    const answer = pending();
    context.answer(MethodName.MessageActivityPage, () => answer.promise);
    history.select("c1", ReplyPanel.Activity);
    const changed = reply("r2", 3, "> ls -la\nout");

    replies[1] = changed;
    await touch(changed);
    expect(context.count(MethodName.MessageSummary)).toBe(0);
    answer.resolve(page());

    await Wait.until(() => expect(history.source()?.items.at(-1)?.preview.toJson()).toEqual(ReplySummary.fromMessage(changed).preview.toJson()));
  });

  it("keeps only the summary read after a reply's last change", async () => {
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));
    const answers = [pending(), pending()];
    const reads = [...answers];
    context.answer(MethodName.MessageSummary, () => (reads.shift() as ReturnType<typeof pending>).promise);
    const earlier = reply("r2", 3, "> earlier\nout");
    const later = reply("r2", 3, "> later\nout");

    await touch(earlier);
    await touch(later);
    answers[1]?.resolve(summary(later));
    answers[0]?.resolve(summary(earlier));
    await settle();

    expect(context.count(MethodName.MessageSummary)).toBe(2);
    expect(history.source()?.items.at(-1)?.preview.toJson()).toEqual(ReplySummary.fromMessage(later).preview.toJson());
  });

  it("adds the first reply to an empty feed", async () => {
    replies = [];
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(history.source()?.items).toEqual([]));
    replies.push(reply("r1", 1));

    await touch(replies[0] as Message);

    await Wait.until(() => expect(ids()).toEqual(["r1"]));
  });

  it("leaves out a reply older than the pages it has read", async () => {
    replies = [reply("r5", 5), reply("r7", 7)];
    context.answer(MethodName.MessageActivityPage, () => page(true));
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r5", "r7"]));
    replies.push(reply("r1", 1));

    await touch(replies[2] as Message);

    expect(context.count(MethodName.MessageSummary)).toBe(1);
    expect(ids()).toEqual(["r5", "r7"]);
  });

  it("says why a reply could not be read again, but not once another conversation is open", async () => {
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));
    context.fail(MethodName.MessageSummary, "The reply is locked.");
    await touch(reply("r2", 3));
    await Wait.until(() => expect(history.error()).toBe("The reply is locked."));
    context.answer(MethodName.MessageSummary, () => Promise.reject("The runtime stopped."));
    await touch(reply("r2", 3));
    await Wait.until(() => expect(history.error()).toBe("The runtime stopped."));

    const late = pending();
    context.answer(MethodName.MessageSummary, () => late.promise);
    await touch(reply("r2", 3));
    history.select(null, ReplyPanel.Activity);
    late.reject(new Error("Too late."));
    await settle();

    expect(history.error()).toBeNull();
  });

  it("reads a reply changed twice within the delay once, when the delay since its first change ends", async () => {
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));

    context.emit(EventName.DetailAppended, new DetailEventPayload("r2", command(1)).toJson());
    await wait(Resources.replyRefreshDelay / 2);
    context.emit(EventName.DetailAppended, new DetailEventPayload("r2", command(2)).toJson());
    await wait(Resources.replyRefreshDelay / 2 - 1);

    expect(clock.remaining).toEqual([1]);
    expect(context.count(MethodName.MessageSummary)).toBe(0);
    await wait(1);
    expect(context.count(MethodName.MessageSummary)).toBe(1);
  });

  it("reads nothing for a change it was about to read when another conversation opens", async () => {
    history.select("c1", ReplyPanel.Activity);
    await Wait.until(() => expect(ids()).toEqual(["r1", "r2"]));

    context.emit(EventName.DetailAppended, new DetailEventPayload("r2", command(1)).toJson());
    history.select(null, ReplyPanel.Activity);
    await wait(Resources.replyRefreshDelay * 2);

    expect(context.count(MethodName.MessageSummary)).toBe(0);
  });
});
