/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type SearchSourceContribution, TextRange } from "@noldova/desktop.window";
import {
  ChatFindHit,
  ChatFindResult,
  Conversation,
  ConversationIdParams,
  ConversationListParams,
  EventName,
  MessageAuthor,
  MessageSearchHit,
  MessageSearchResult,
  MethodName
} from "@noldova/teamrun.protocol";

import { MessageFocus } from "../../../src/app/models/message-focus";
import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { TeamRunSearchSources } from "../../../src/app/services/teamrun-search-sources";
import { Resources } from "../../../src/resources";
import { DeferredResponse } from "../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("TeamRunSearchSources", () => {
  const older = new Conversation("c2", "p1", "Second", SampleData.timestamp, SampleData.timestamp);
  const chats = [new ChatFindHit("c2", "p1", "Terminal tab freezes on Windows", ["Builder", "Reviewer"], SampleData.timestamp),
    new ChatFindHit("c3", null, "", [], SampleData.timestamp)];
  const messages = [
    new MessageSearchHit("c2", "p1", "Second", "m1", 0, MessageAuthor.Provider, null, "Builder", "a1", "codex", "…the terminal opens in the project folder…",
      "2026-11-05T11:00:00.000Z"),
    new MessageSearchHit("c3", null, "Notes", "m2", 0, MessageAuthor.User, null, null, null, null, "Open a terminal per teammate", "2026-11-07T11:59:30.000Z"),
    new MessageSearchHit("c3", null, "Notes", "m4", 1, MessageAuthor.Provider, null, null, "a1", "codex", "The terminal is ready", "2026-11-07T11:59:30.000Z"),
    new MessageSearchHit("c3", null, "Notes", "m5", 2, MessageAuthor.User, "Reviewer", null, null, null, "Run it in the terminal", "2026-11-07T11:59:30.000Z"),
    new MessageSearchHit("c3", null, "Notes", "m6", 3, MessageAuthor.TeamRun, null, null, null, null, "The terminal closed", "2026-11-07T11:59:30.000Z")];
  const signal = new AbortController().signal;
  let context: FakeWindowPartContext;
  let store: ChatStoreService;
  const load = async (): Promise<void> => {
    context = SampleData.createContext();
    context.answer(MethodName.ConversationList, u => ConversationListParams.fromJson(u).projectId === "p1" ? [SampleData.conversation.toJson(), older.toJson()] : [])
      .answer(MethodName.ChatFind, () => new ChatFindResult(chats, 7).toJson())
      .answer(MethodName.MessageSearch, () => new MessageSearchResult(messages, 14, false).toJson());
    store = ChatStoreService.of(context);
    await Wait.until(() => expect(store.loaded()).toBe(true));
    await Wait.until(() => expect(store.isBusy()).toBe(false));
  };
  const sources = (): { chats: SearchSourceContribution; messages: SearchSourceContribution } => {
    const [chatsSource, messagesSource] = TeamRunSearchSources.of(context);
    if (Object.isUndefined(chatsSource) || Object.isUndefined(messagesSource))
      throw new Error("TeamRun adds two search sources.");
    return { chats: chatsSource, messages: messagesSource };
  };

  afterEach(() => {
    ChatStoreService.release(context);
    vi.useRealTimers();
  });

  it("lists the latest chats before typing, each with its project and teammates, and an untitled one as Untitled", async () => {
    await load();

    const recent = await sources().chats.recentAsync(signal);

    expect(recent.map(t => [t.id, t.title, t.detail, t.titleMatch, t.detailMatch, t.keyLabel])).toEqual([
      ["c2", "Terminal tab freezes on Windows", "repo · Builder, Reviewer", null, null, null],
      ["c3", "Untitled", "", null, null, null]
    ]);
    expect(context.parametersOf(MethodName.ChatFind)).toEqual({ query: "", limit: Resources.searchLimit });
  });

  it("finds chats by title with the match marked and Core's total, and leaves out and opens nothing for a chat deleted since", async () => {
    await load();
    const answer = await sources().chats.searchAsync("TERM", signal);

    expect([answer.total, ...answer.results.map(t => [t.id, t.titleMatch])]).toEqual([7, ["c2", new TextRange(0, 4)], ["c3", null]]);
    expect(context.parametersOf(MethodName.ChatFind)).toEqual({ query: "TERM", limit: Resources.searchLimit });

    await answer.results[0]?.openAsync();
    expect(context.openedDocuments).toEqual([{ name: "teamrun.conversation", instance: "c2", title: "Terminal tab freezes on Windows", options: { breadcrumb: ["repo"] } }]);
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c2").toJson());
    const later = await sources().chats.searchAsync("term", signal);
    await answer.results[0]?.openAsync();

    expect([later.total, ...later.results.map(t => t.id)]).toEqual([6, "c3"]);
    expect(context.openedDocuments.length).toBe(1);
  });

  it("finds messages as snippets with the match marked, who wrote them as the chat names them, in which chat and how long ago, and has no recent items", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-07T12:00:00.000Z"));
    await load();
    const source = sources().messages;

    const answer = await source.searchAsync("terminal", signal);

    expect(await source.recentAsync(signal)).toEqual([]);
    expect(context.parametersOf(MethodName.MessageSearch)).toEqual({ query: "terminal", limit: Resources.searchLimit });
    expect([answer.total, ...answer.results.map(t => [t.id, t.title, t.titleMatch, t.detail])]).toEqual([14,
      ["m1", "…the terminal opens in the project folder…", new TextRange(5, 8), "Builder in Second · 2 days ago"],
      ["m2", "Open a terminal per teammate", new TextRange(7, 8), "You in Notes · just now"],
      ["m4", "The terminal is ready", new TextRange(4, 8), "Codex · Work in Notes · just now"],
      ["m5", "Run it in the terminal", new TextRange(14, 8), "Reviewer in Notes · just now"],
      ["m6", "The terminal closed", new TextRange(4, 8), "TeamRun in Notes · just now"]]);
  });

  it("leaves out a chat's project TeamRun no longer lists, and names a message's untitled chat Untitled", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-07T12:00:00.000Z"));
    await load();
    context.answer(MethodName.ChatFind, () => new ChatFindResult([new ChatFindHit("c4", "p9", "Gone project", ["Builder"], SampleData.timestamp)], 1).toJson())
      .answer(MethodName.MessageSearch, () => new MessageSearchResult([new MessageSearchHit("c4", "p9", " ", "m3", 0, MessageAuthor.User, null, null, null, null, "A terminal here",
        "2026-11-07T11:59:30.000Z")], 1, false).toJson());

    const [chat, message] = await Promise.all([sources().chats.searchAsync("gone", signal), sources().messages.searchAsync("terminal", signal)]);

    expect([...chat.results.map(t => [t.id, t.detail]), ...message.results.map(t => [t.id, t.detail])])
      .toEqual([["c4", "Builder"], ["m3", "You in Untitled · just now"]]);
  });

  it("opens a message's chat at that message, and nothing once its chat is deleted", async () => {
    await load();
    const [found, other] = (await sources().messages.searchAsync("terminal", signal)).results;

    await found?.openAsync();

    expect(context.openedDocuments).toEqual([{ name: "teamrun.conversation", instance: "c2", title: "Second", options: { breadcrumb: ["repo"] } }]);
    await Wait.until(() => expect(store.focus()).toEqual(new MessageFocus("c2", "m1", 0)));
    context.emit(EventName.ConversationDeleted, new ConversationIdParams("c3").toJson());
    await other?.openAsync();
    expect(context.openedDocuments.length).toBe(1);
  });

  it("asks Core once typing stops for the search delay, and never for a query typed over before then or already given up", async () => {
    await load();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { chats: chatsSource, messages: messagesSource } = sources();
    const start = context.requests.length;
    const methods = [MethodName.ChatFind, MethodName.MessageSearch].map(t => FakeWindowPartContext.qualify(t));
    const searched = (): JsonValue[] => context.requests.slice(start).filter(t => methods.includes(t.method)).map(t => t.parameters);
    const typedOver = new AbortController();
    const kept = new AbortController();

    const early = [chatsSource.searchAsync("t", AbortSignal.abort()), chatsSource.searchAsync("te", typedOver.signal), messagesSource.searchAsync("te", typedOver.signal)];
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds - 1);
    typedOver.abort();
    const late = [chatsSource.searchAsync("term", kept.signal), messagesSource.searchAsync("term", kept.signal)];
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds - 1);
    const beforeTheDelay = searched();
    await vi.advanceTimersByTimeAsync(1);
    const answers = await Promise.all([...early, ...late]);

    expect([beforeTheDelay, searched(), answers.map(t => t.total)]).toEqual([[],
      [{ query: "term", limit: Resources.searchLimit }, { query: "term", limit: Resources.searchLimit }], [0, 0, 0, 7, 14]]);
  });

  it("sends a message search only once the one before it has answered, and drops one typed over while it waited", async () => {
    await load();
    const first = new DeferredResponse();
    let calls = 0;
    context.answer(MethodName.MessageSearch, () => calls++ === 0 ? first.promise : new MessageSearchResult(messages, 14, false).toJson());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { messages: messagesSource } = sources();
    const start = context.requests.length;
    const method = FakeWindowPartContext.qualify(MethodName.MessageSearch);
    const searched = (): JsonValue[] => context.requests.slice(start).filter(t => t.method === method).map(t => t.parameters);
    const typedOver = new AbortController();

    const slow = messagesSource.searchAsync("o", signal);
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds);
    const dropped = messagesSource.searchAsync("op", typedOver.signal);
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds);
    typedOver.abort();
    const kept = messagesSource.searchAsync("ope", signal);
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds);
    const whileWaiting = searched();
    first.resolve(new MessageSearchResult(messages.slice(0, 1), 3, false).toJson());
    const answers = await Promise.all([slow, dropped, kept]);

    expect([whileWaiting, searched(), answers.map(t => t.total)]).toEqual([[{ query: "o", limit: Resources.searchLimit }],
      [{ query: "o", limit: Resources.searchLimit }, { query: "ope", limit: Resources.searchLimit }], [3, 0, 14]]);
  });

  it("still sends the next message search when the one before it failed", async () => {
    await load();
    const first = new DeferredResponse();
    let calls = 0;
    context.answer(MethodName.MessageSearch, () => calls++ === 0 ? first.promise : new MessageSearchResult(messages, 14, false).toJson());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { messages: messagesSource } = sources();

    const failed = messagesSource.searchAsync("o", signal).then(() => "answered", () => "failed");
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds);
    const next = messagesSource.searchAsync("op", signal);
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds);
    first.reject(new Error("Core stopped."));

    expect([await failed, (await next).total]).toEqual(["failed", 14]);
  });

  it("answers a capped message search with at least the cap, so a longer query never counts more than a shorter one", async () => {
    await load();
    let calls = 0;
    context.answer(MethodName.MessageSearch, () => calls++ === 0 ? new MessageSearchResult(messages.slice(0, 3), 3, true).toJson()
      : new MessageSearchResult(messages, 65, false).toJson());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { messages: messagesSource } = sources();

    const shorter = messagesSource.searchAsync("op", signal);
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds);
    const shorterTotal = (await shorter).total;
    const longer = messagesSource.searchAsync("ope", signal);
    await vi.advanceTimersByTimeAsync(Resources.searchDelayMilliseconds);
    const longerTotal = (await longer).total;

    expect([shorterTotal, longerTotal, longerTotal <= shorterTotal]).toEqual([Resources.messageSearchCap, 65, true]);
  });

  it("says how long ago in minutes, hours, days, months and years, and just now under a minute", () => {
    const minute = 60_000;

    expect([0, minute - 1, 5 * minute, 60 * minute, 2 * 1_440 * minute, 45 * 1_440 * minute, 400 * 1_440 * minute].map(t => Resources.formatSince(t)))
      .toEqual(["just now", "just now", "5 minutes ago", "1 hour ago", "2 days ago", "1 month ago", "1 year ago"]);
  });
});
