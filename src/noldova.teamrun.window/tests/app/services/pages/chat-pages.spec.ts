/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal } from "@angular/core";

import "@noldova/context.core";
import { FileSaveOutcome, LinkPlace, ViewBadge } from "@noldova/desktop.window";
import { Page, PageListRequest, PageRequest } from "@noldova/teamrun.protocol";

import { ChatPages } from "../../../../src/app/services/pages/chat-pages";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SamplePages } from "../../../fixtures/sample-pages.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("ChatPages", () => {
  const options = SamplePages.page("p1", "Onboarding options", 1, 30);
  const checklist = SamplePages.page("p2", "Launch checklist", 1, 0, SamplePages.sol);
  let context: FakeWindowPartContext;
  let store: ChatPages;

  const titles = (): string[] => store.pagesOf(SamplePages.chatId).map(t => `${t.title} v${t.version}`);
  const create = (next: FakeWindowPartContext = SamplePages.context([options, checklist])): void => {
    context = next;
    store = ChatPages.of(context);
  };

  afterEach(() => ChatPages.release(context));

  it("lists a chat's pages once, newest change first, by the chat's id", async () => {
    create();

    store.watch(SamplePages.chatId);
    store.watch(SamplePages.chatId);

    await Wait.until(() => expect(titles()).toEqual(["Launch checklist v1", "Onboarding options v1"]));
    expect(context.requests.filter(t => t.method === SamplePages.list).map(t => t.parameters)).toEqual([new PageListRequest(SamplePages.chatId).toJson()]);
    expect(store.isLoaded(SamplePages.chatId)).toBe(true);
  });

  it("follows shown and updated pages, keeps the newer version, moves a changed page first, and ignores another chat's list", async () => {
    create();
    store.watch(SamplePages.chatId);
    await Wait.until(() => expect(titles()).toHaveLength(2));

    context.emitModule(SamplePages.updated, SamplePages.page("p1", "Onboarding options", 2, -1, SamplePages.sol).toJson());
    context.emitModule(SamplePages.updated, SamplePages.page("p1", "Onboarding options", 1, 30).toJson());
    context.emitModule(SamplePages.shown, SamplePages.page("p3", "Elsewhere", 1, 0, SamplePages.opus, "c2").toJson());
    context.emitModule(SamplePages.shown, { id: "broken" });

    expect(titles()).toEqual(["Onboarding options v2", "Launch checklist v1"]);
    expect(store.pagesOf("c2").map(t => t.title)).toEqual(["Elsewhere"]);
    expect(store.latest(options).version).toBe(2);
  });

  it("leaves canvases out of the chat's list and its shown and updated events, and marks none open", async () => {
    create(SamplePages.context([options, SamplePages.canvas("k1", "Board")]));
    store.watch(SamplePages.chatId);
    await Wait.until(() => expect(store.isLoaded(SamplePages.chatId)).toBe(true));

    context.emitModule(SamplePages.shown, SamplePages.canvas("k2", "Shown board").toJson());
    context.emitModule(SamplePages.updated, SamplePages.canvas("k1", "Board", 2).toJson());

    expect(titles()).toEqual(["Onboarding options v1"]);
    expect(store.isOpen("k2")).toBe(false);
  });

  it("keeps a page an event brings while the chat's list is still loading", async () => {
    const list = new DeferredResponse();
    create(SamplePages.context(() => list.promise));
    store.watch(SamplePages.chatId);

    context.emitModule(SamplePages.updated, SamplePages.page("p1", "Onboarding options", 3).toJson());
    list.resolve([options.toJson()]);

    await Wait.until(() => expect(titles()).toEqual(["Onboarding options v3"]));
  });

  it("lists no pages when the list's answer isn't a list", async () => {
    create(SamplePages.context(() => ({ pages: [options.toJson()] })));

    store.watch(SamplePages.chatId);

    await Wait.until(() => expect(store.isLoaded(SamplePages.chatId)).toBe(true));
    expect([titles(), store.loadErrorOf(SamplePages.chatId)]).toEqual([[], null]);
  });

  it("keeps a page opened or closed while a list of open documents was on its way", async () => {
    const next = SamplePages.context([options, checklist]);
    next.openInstances = ["p2"];
    create(next);
    await Wait.until(() => expect(store.isOpen("p2")).toBe(true));
    const late = new DeferredResponse();
    const listed = vi.spyOn(context, "listOpenDocumentsAsync").mockReturnValue(late.promise.then(() => ["p2"]));
    context.emitModule(SamplePages.updated, options.toJson());
    await Wait.until(() => expect(listed).toHaveBeenCalled());

    store.open(options);
    for (const listener of context.documentClosedListeners)
      listener("p2");
    late.resolve(null);
    await listed.mock.results[0]?.value;

    expect([store.isOpen("p1"), store.isOpen("p2")]).toEqual([true, false]);
  });

  it("keeps the open pages it has when the window gives no list of open documents", async () => {
    const next = SamplePages.context([options]);
    next.openInstances = ["p1"];
    create(next);
    await Wait.until(() => expect(store.isOpen("p1")).toBe(true));
    const listed = vi.spyOn(context, "listOpenDocumentsAsync").mockResolvedValue(null);

    context.emitModule(SamplePages.updated, options.toJson());

    await Wait.until(() => expect(listed).toHaveBeenCalled());
    await listed.mock.results[0]?.value;
    expect(store.isOpen("p1")).toBe(true);
  });

  it("says when the chat's pages can't be listed, and lists them on a retry", async () => {
    let fails = true;
    create(SamplePages.context(() => {
      if (fails)
        throw new Error("down");
      return [options.toJson()];
    }));

    store.watch(SamplePages.chatId);
    await Wait.until(() => expect(store.loadErrorOf(SamplePages.chatId)).toBe("TeamRun couldn't list this chat's pages."));
    fails = false;
    store.retry(SamplePages.chatId);

    await Wait.until(() => expect(titles()).toEqual(["Onboarding options v1"]));
    expect(store.loadErrorOf(SamplePages.chatId)).toBeNull();
  });

  it("opens a page's document by its id and title, and marks it open until its tab closes", () => {
    create();

    store.open(options);
    const open = store.isOpen("p1");
    for (const listener of context.documentClosedListeners)
      listener("p1");

    expect([context.openedDocuments.map(t => [t.name, t.instance, t.title]), open, store.isOpen("p1")])
      .toEqual([[[SamplePages.document, "p1", "Onboarding options"]], true, false]);
  });

  it("reads the open pages from the window when it starts and on each page update, and keeps none when the window can't say", async () => {
    const next = SamplePages.context([options]);
    next.openInstances = ["p2"];
    create(next);
    await Wait.until(() => expect(store.isOpen("p2")).toBe(true));

    context.openInstances = ["p1"];
    context.emitModule(SamplePages.updated, options.toJson());

    await Wait.until(() => expect([store.isOpen("p1"), store.isOpen("p2")]).toEqual([true, false]));
  });

  it("marks a page a teammate shows open without asking the window, whose list doesn't hold the page's document yet, and asks nothing for a shown or updated event that isn't a page", async () => {
    const next = SamplePages.context([options]);
    next.openInstances = ["p2"];
    create(next);
    await Wait.until(() => expect(store.isOpen("p2")).toBe(true));
    const listed = vi.spyOn(context, "listOpenDocumentsAsync").mockResolvedValue([]);

    context.emitModule(SamplePages.shown, options.toJson());
    context.emitModule(SamplePages.shown, null);
    context.emitModule(SamplePages.updated, null);

    expect([store.isOpen("p1"), store.isOpen("p2"), listed.mock.calls.length]).toEqual([true, true, 0]);
  });

  it("names who is editing a page from the editors its window gives, and no one before it gives them", () => {
    create();
    const editors = signal<ReadonlyMap<string, string>>(new Map([["p1", "Sol"]]));

    const named = [store.editorOf("p1")];
    const release = ChatPages.provide(context, signal(null), () => () => undefined, editors);
    named.push(store.editorOf("p1"), store.editorOf("p2"));
    editors.set(new Map([["p2", "Opus"]]));
    named.push(store.editorOf("p1"), store.editorOf("p2"));
    release();

    expect(named).toEqual([null, "Sol", null, null, "Opus"]);
  });

  it("opens a page in the system browser at its server's address", async () => {
    create(SamplePages.context([options]).answerModule(SamplePages.open, () => SamplePages.view(options).toJson()));

    await store.openInBrowser(options);

    expect([context.requests.find(t => t.method === SamplePages.open)?.parameters, context.links, context.linkPlaces, store.error()])
      .toEqual([new PageRequest("p1").toJson(), ["http://127.0.0.1:4100/pages/p1"], [LinkPlace.System], null]);
  });

  it("says when the page can't open in the system browser, and clears it on the next action", async () => {
    create(SamplePages.context([options]).answerModule(SamplePages.open, () => {
      throw new Error("The page server isn't listening.");
    }).answerModule(SamplePages.read, () => "<p>hi</p>"));

    await store.openInBrowser(options);
    const error = store.error();
    await store.save(options);

    expect([error, store.error(), context.links]).toEqual(["TeamRun couldn't open the page in the system browser.", null, []]);
  });

  it("saves a page's latest HTML under its file's name, and says when saving fails, though not when it's cancelled", async () => {
    create(SamplePages.context([options]).answerModule(SamplePages.read, () => "<p>hi</p>"));

    await store.save(options);
    context.saveOutcome = FileSaveOutcome.Cancelled;
    await store.save(options);
    const cancelled = store.error();
    context.saveOutcome = FileSaveOutcome.Failed;
    await store.save(options);

    expect(context.savedFiles.map(t => [t.name, new TextDecoder().decode(t.bytes)])).toEqual([["p1.html", "<p>hi</p>"], ["p1.html", "<p>hi</p>"], ["p1.html", "<p>hi</p>"]]);
    expect(context.requests.filter(t => t.method === SamplePages.read).map(t => t.parameters)).toEqual(Array.from({ length: 3 }, () => new PageRequest("p1").toJson()));
    expect([cancelled, store.error()]).toEqual([null, "TeamRun couldn't save the page as a file."]);
  });

  it("saves a page whose path names no file under the fallback file name", async () => {
    create(SamplePages.context([options]).answerModule(SamplePages.read, () => "<p>hi</p>"));

    await store.save(Page.fromJson({ ...options.toJson(), path: "site/" }));

    expect(context.savedFiles.map(t => t.name)).toEqual(["page.html"]);
  });

  it("says when a page's HTML isn't text, and saves nothing", async () => {
    create(SamplePages.context([options]).answerModule(SamplePages.read, () => null));

    await store.save(options);

    expect([context.savedFiles, store.error()]).toEqual([[], "TeamRun couldn't save the page as a file."]);
  });

  it("copies the path of the page's own copy, and says when the clipboard refuses it", async () => {
    create(SamplePages.context([options]).answerModule(SamplePages.open, () => SamplePages.view(options).toJson()));
    const copied: string[] = [];

    await store.copyPath(options, t => Promise.resolve(copied.push(t) > 0));
    const error = store.error();
    await store.copyPath(options, () => Promise.resolve(false));

    expect([copied, error, store.error()]).toEqual([["D:\\profile\\pages\\p1.html"], null, "TeamRun couldn't copy the file's path."]);
  });

  it("takes the shown chat from its window, and lets the events go on release", () => {
    create();
    const chat = signal<string | null>("c1");
    let stopped = false;

    const release = ChatPages.provide(context, chat, () => () => {
      stopped = true;
    }, signal(new Map()));
    const shown = [store.chatId()];
    chat.set("c2");
    shown.push(store.chatId());
    release();

    expect([shown, context.events, ChatPages.of(context) === store, stopped]).toEqual([["c1", "c2"], [], false, true]);
  });

  it("counts the shown chat's pages on the Pages view's tab, and shows none without a chat or with no pages", async () => {
    create(SamplePages.context([options, checklist]));
    const chat = signal<string | null>(null);
    let follower: (chatId: string | null) => void = () => undefined;
    const release = ChatPages.provide(context, chat, t => {
      follower = t;
      return () => undefined;
    }, signal(new Map()));
    const badges = [context.badges.get("teamrun.pages")];

    chat.set(SamplePages.chatId);
    follower(SamplePages.chatId);
    await Wait.until(() => expect(context.badges.get("teamrun.pages")).toEqual(new ViewBadge(2, "2 pages")));
    context.emitModule(SamplePages.shown, SamplePages.page("p3", "Welcome email").toJson());
    await Wait.until(() => expect(context.badges.get("teamrun.pages")).toEqual(new ViewBadge(3, "3 pages")));
    chat.set(null);
    follower(null);
    badges.push(context.badges.get("teamrun.pages"));
    release();

    expect(badges).toEqual([null, null]);
  });
});
