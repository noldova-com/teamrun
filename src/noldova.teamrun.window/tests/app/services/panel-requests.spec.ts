/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { windowPart } from "@noldova/browser.window";
import browserPackage from "@noldova/browser.window/package.json";
import {
  Conversation,
  EventName,
  MethodName,
  PanelAnsweredParams,
  PanelName,
  PanelOutcome,
  PanelRequestedPayload,
  WindowFocusedParams,
  WindowIdParams
} from "@noldova/teamrun.protocol";
import declaration from "@noldova/teamrun/module.json";

import { ChatStoreService } from "../../../src/app/services/chat-store.service";
import { CommandTargetsService } from "../../../src/app/services/command-targets.service";
import { PanelRequests } from "../../../src/app/services/panel-requests";
import { Resources } from "../../../src/resources";
import { BrowserPartContext } from "../../fixtures/browser-part-context.fixture";
import { FakeWindowPartContext } from "../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../fixtures/sample-data.fixture";
import { Wait } from "../../fixtures/wait.fixture";

describe("PanelRequests", () => {
  let context: FakeWindowPartContext;
  let store: ChatStoreService;

  const answering = (): FakeWindowPartContext => new FakeWindowPartContext().answer(MethodName.MessageListOpen, () => [])
    .answer(MethodName.WindowFocused, () => null).answer(MethodName.WindowClosed, () => null).answer(MethodName.PanelAnswered, () => null);
  const sent = (method: MethodName, from: FakeWindowPartContext = context): readonly JsonValue[] =>
    from.requests.filter(t => t.method === FakeWindowPartContext.qualify(method)).map(t => t.parameters);
  const reports = (): readonly (string | null)[] => sent(MethodName.WindowFocused).map(t => WindowFocusedParams.fromJson(t).shownConversationId);
  const focuses = (): readonly boolean[] => sent(MethodName.WindowFocused).map(t => WindowFocusedParams.fromJson(t).focused);
  const answers = (): readonly (readonly [string, string, PanelOutcome])[] => sent(MethodName.PanelAnswered).map(t => PanelAnsweredParams.fromJson(t))
    .map(t => [t.requestId, t.windowId, t.outcome] as const);
  const windowOf = (from: FakeWindowPartContext = context): string => WindowFocusedParams.fromJson(sent(MethodName.WindowFocused, from)[0]!).windowId;
  const request = (panel: PanelName, conversationId: string | null, open: boolean, requestId: string = "r1", windowId: string = windowOf()): void =>
    context.emit(EventName.PanelRequested, new PanelRequestedPayload(requestId, windowId, panel, conversationId, open).toJson());

  beforeEach(() => {
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    context = answering();
    store = ChatStoreService.watch(context);
    PanelRequests.register(context, store);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    PanelRequests.release(context);
    ChatStoreService.release(context);
  });

  it("reports its window again with its shown chat when asked, as after the runtime started again, and reports nothing for a window it doesn't serve", async () => {
    await store.conversationInView("c1");
    vi.spyOn(document, "hasFocus").mockReturnValue(true);

    PanelRequests.reportAgain(context);
    PanelRequests.reportAgain(answering());

    expect(reports().at(-1)).toBe("c1");
    expect(focuses().at(-1)).toBe(true);
    expect(new Set(sent(MethodName.WindowFocused).map(t => WindowFocusedParams.fromJson(t).windowId))).toEqual(new Set([store.windowId]));
  });

  it("reports its own window, by its store's window id, at once, on each focus and when the shown chat changes, focused only on a focus, and that it closed when released", () => {
    const other = answering();
    PanelRequests.register(other, ChatStoreService.watch(other));

    globalThis.dispatchEvent(new Event("focus"));
    void store.conversationInView("c1");
    store.conversationOutOfView("c1");
    store.deselectConversation();
    expect(reports()).toEqual([null, null, "c1", null]);
    expect(focuses()).toEqual([false, true, false, false]);
    PanelRequests.release(context);
    globalThis.dispatchEvent(new Event("focus"));

    expect(reports()).toHaveLength(4);
    expect(new Set(sent(MethodName.WindowFocused).map(t => WindowFocusedParams.fromJson(t).windowId))).toEqual(new Set([windowOf()]));
    expect(windowOf()).toBe(store.windowId);
    expect(sent(MethodName.WindowClosed).map(t => WindowIdParams.fromJson(t).windowId)).toEqual([windowOf()]);
    expect(windowOf(other)).not.toBe(windowOf());
    expect(context.events).not.toContain(FakeWindowPartContext.qualify(EventName.PanelRequested));
    PanelRequests.release(other);
    ChatStoreService.release(other);
  });

  it("names the Browser in module.json at the version the window's specs install, so Noldova Desktop runs its browser.openPage", () => {
    expect(declaration.optionalDependencies.browser).toBe(browserPackage.version);
  });

  it("stops listening to keys when released", () => {
    PanelRequests.release(context);
    vi.mocked(document.hasFocus).mockClear();

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));

    expect(document.hasFocus).not.toHaveBeenCalled();
  });

  it("opens and closes the pages and a chat for a request named for its window, answers each, and leaves another window's alone", () => {
    request(PanelName.Teammates, null, true, "r0", "another window");
    expect([context.openedDocuments, sent(MethodName.PanelAnswered)]).toEqual([[], []]);

    request(PanelName.Teammates, null, true, "r1");
    request(PanelName.Providers, null, false, "r2");
    request(PanelName.Chat, "c9", true, "r3");
    request(PanelName.Chat, "c9", false, "r4");

    expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([
      [Resources.teammatesDocumentName, Resources.teammatesDocumentInstance, Resources.teammatesTitle],
      [Resources.conversationDocumentName, "c9", Resources.untitledConversation]
    ]);
    expect(context.closedDocuments).toEqual([
      { name: Resources.providersDocumentName, instance: Resources.providersDocumentInstance },
      { name: Resources.conversationDocumentName, instance: "c9" }
    ]);
    expect(answers()).toEqual(["r1", "r2", "r3", "r4"].map(t => [t, windowOf(), PanelOutcome.Done]));
  });

  it("shows each view without instances for an open and hides the dock that holds it for a close, opening and closing no document", () => {
    const views: readonly (readonly [PanelName, string])[] = [[PanelName.Projects, Resources.projectsViewName], [PanelName.Activity, Resources.activityViewName],
      [PanelName.Changes, Resources.changesViewName], [PanelName.Plan, Resources.planViewName], [PanelName.SubAgents, Resources.subAgentsViewName],
      [PanelName.BackgroundTasks, Resources.backgroundTasksViewName]];

    for (const [panel] of views) {
      request(panel, null, true, `open ${panel}`);
      request(panel, null, false, `close ${panel}`);
    }

    expect(context.shownViews).toEqual(views.map(t => t[1]));
    expect(context.hiddenViewDocks).toEqual(views.map(t => ({ name: t[1], instance: null })));
    expect([context.openedDocuments, context.closedDocuments]).toEqual([[], []]);
    expect(answers()).toEqual(views.flatMap(([t]) => [[`open ${t}`, windowOf(), PanelOutcome.Done], [`close ${t}`, windowOf(), PanelOutcome.Done]]));
  });

  it("neither shows a view nor hides its dock within the settle time of a key or while a composer has text, refusing, and acts once that ends", () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.mocked(document.hasFocus).mockReturnValue(true);
    let typing = false;
    CommandTargetsService.of(context).provideComposer("c9", () => undefined, () => false, () => undefined, () => typing);

    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    request(PanelName.Activity, null, true, "r1");
    request(PanelName.BackgroundTasks, null, false, "r2");
    now += Resources.typingSettleTime;
    typing = true;
    request(PanelName.Projects, null, true, "r3");
    request(PanelName.Changes, null, false, "r4");
    typing = false;
    request(PanelName.Plan, null, true, "r5");
    request(PanelName.Changes, null, false, "r6");

    expect(answers().map(t => [t[0], t[2]])).toEqual([["r1", PanelOutcome.Refused], ["r2", PanelOutcome.Refused], ["r3", PanelOutcome.Refused],
      ["r4", PanelOutcome.Refused], ["r5", PanelOutcome.Done], ["r6", PanelOutcome.Done]]);
    expect([context.shownViews, context.hiddenViewDocks]).toEqual([[Resources.planViewName], [{ name: Resources.changesViewName, instance: null }]]);
  });

  it("answers that it failed when showing a view or hiding its dock throws", () => {
    vi.spyOn(context, "showView").mockImplementation(() => {
      throw new Error("No such view.");
    });
    vi.spyOn(context, "hideViewDock").mockImplementation(() => {
      throw new Error("No such dock.");
    });

    expect(() => request(PanelName.Projects, null, true, "r1")).toThrow("No such view.");
    expect(() => request(PanelName.Projects, null, false, "r2")).toThrow("No such dock.");

    expect(answers()).toEqual([["r1", windowOf(), PanelOutcome.Failed], ["r2", windowOf(), PanelOutcome.Failed]]);
  });

  it("opens a chat it knows by its title as an ordinary tab, not as a preview the next chat would replace", () => {
    vi.spyOn(store, "conversation").mockReturnValue(SampleData.conversation);

    request(PanelName.Chat, SampleData.conversation.id, true);

    expect(context.openedDocuments.map(t => [t.instance, t.title, t.options?.preview])).toEqual([[SampleData.conversation.id, SampleData.conversation.title, false]]);
  });

  it("refuses an open and a close within the settle time of a key anywhere in the focused window, and not after it", () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const press = (): boolean => document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));

    press();
    request(PanelName.Providers, null, true, "r1");
    vi.mocked(document.hasFocus).mockReturnValue(true);
    press();
    request(PanelName.Teammates, null, true, "r2");
    request(PanelName.Providers, null, false, "r3");
    now += Resources.typingSettleTime - 1;
    request(PanelName.Chat, "c9", false, "r4");
    now += 1;
    request(PanelName.Teammates, null, true, "r5");
    request(PanelName.Chat, "c9", false, "r6");

    expect(answers().map(t => [t[0], t[2]])).toEqual([["r1", PanelOutcome.Done], ["r2", PanelOutcome.Refused], ["r3", PanelOutcome.Refused],
      ["r4", PanelOutcome.Refused], ["r5", PanelOutcome.Done], ["r6", PanelOutcome.Done]]);
    expect(context.openedDocuments.map(t => t.instance)).toEqual([Resources.providersDocumentInstance, Resources.teammatesDocumentInstance]);
    expect(context.closedDocuments).toEqual([{ name: Resources.conversationDocumentName, instance: "c9" }]);
  });

  it("refuses to close a chat while a composer has the focus with text, and closes it once that ends", () => {
    let typing = true;
    CommandTargetsService.of(context).provideComposer("c9", () => undefined, () => false, () => undefined, () => typing);

    request(PanelName.Chat, "c9", false, "r1");
    const kept = [...context.closedDocuments];
    typing = false;
    request(PanelName.Chat, "c9", false, "r2");

    expect([kept, context.closedDocuments]).toEqual([[], [{ name: Resources.conversationDocumentName, instance: "c9" }]]);
    expect(answers()).toEqual([["r1", windowOf(), PanelOutcome.Refused], ["r2", windowOf(), PanelOutcome.Done]]);
  });

  it("opens nothing while a composer has the focus with text, refusing, and opens once that ends", () => {
    let typing = true;
    CommandTargetsService.of(context).provideComposer("c1", () => undefined, () => false, () => undefined, () => typing);

    request(PanelName.Providers, null, true, "r1");
    request(PanelName.Chat, "c9", true, "r2");
    const opened = [...context.openedDocuments];
    typing = false;
    request(PanelName.Providers, null, true, "r3");
    request(PanelName.Chat, "c9", true, "r4");

    expect(opened).toEqual([]);
    expect(context.openedDocuments.map(t => t.instance)).toEqual([Resources.providersDocumentInstance, "c9"]);
    expect(answers()).toEqual([["r1", PanelOutcome.Refused], ["r2", PanelOutcome.Refused], ["r3", PanelOutcome.Done], ["r4", PanelOutcome.Done]]
      .map(([requestId, outcome]) => [requestId, windowOf(), outcome]));
  });

  it("opens a chat's own Browser page in its project's workspace, or outside projects in theirs, closes it, and answers once each is done", async () => {
    vi.spyOn(store, "conversation").mockImplementation(t => t === SampleData.conversation.id ? SampleData.conversation : null);

    request(PanelName.Page, SampleData.conversation.id, true, "r1");
    request(PanelName.Page, "c9", true, "r2");
    request(PanelName.Page, "c9", false, "r3");
    await Wait.until(() => expect(answers()).toHaveLength(3));

    expect(context.ranCommands).toEqual([
      { name: "browser.openPage", commandArguments: { profileKey: "p1", instance: "c1" } },
      { name: "browser.openPage", commandArguments: { profileKey: "teamrun-chats", instance: "c9" } }
    ]);
    expect(context.closedDocuments).toEqual([{ name: "browser.page", instance: "c9" }]);
    expect(context.openedDocuments).toEqual([]);
    expect([...answers()].sort((a, b) => a[0].localeCompare(b[0]))).toEqual(["r1", "r2", "r3"].map(t => [t, windowOf(), PanelOutcome.Done]));
  });

  it("opens a chat's page with arguments the Browser's own command takes, for a chat in a project and one outside projects", async () => {
    const inProject = new Conversation("0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b", "0199a1b2-c3d4-7e5f-8a9b-1c1d2e3f4a5b", "First", SampleData.timestamp,
      SampleData.timestamp);
    vi.spyOn(store, "conversation").mockImplementation(t => t === inProject.id ? inProject : null);
    const browser = new BrowserPartContext();
    await windowPart.activateAsync(browser);
    const openPage = browser.commands.find(t => t.name === "browser.openPage");

    request(PanelName.Page, inProject.id, true, "r1");
    request(PanelName.Page, "0199a1b2-c3d4-7e5f-8a9b-2c1d2e3f4a5b", true, "r2");
    await Wait.until(() => expect(answers()).toHaveLength(2));

    expect(context.ranCommands.map(t => openPage?.isApplicable(t.commandArguments ?? null))).toEqual([true, true]);
    expect(browser.inAppBrowsers).toHaveLength(1);
    await windowPart.deactivateAsync();
  });

  it("refuses a chat's page while a composer has text, and answers that it failed when the Browser can't open it", async () => {
    const typing = vi.spyOn(CommandTargetsService.of(context), "isTypingInAnyChat").mockReturnValue(true);
    request(PanelName.Page, "c9", true, "r1");
    await Wait.until(() => expect(answers()).toHaveLength(1));
    typing.mockReturnValue(false);
    vi.spyOn(context, "runCommandAsync").mockRejectedValue(new Error("No Browser module."));

    request(PanelName.Page, "c9", true, "r2");
    await Wait.until(() => expect(answers()).toHaveLength(2));

    expect(answers()).toEqual([["r1", windowOf(), PanelOutcome.Refused], ["r2", windowOf(), PanelOutcome.Failed]]);
    expect(context.lines).toContain(Resources.formatChatPageNotChanged("c9", "Error"));
  });

  it("logs a chat page's open that fails without an error by what it threw", async () => {
    vi.spyOn(context, "runCommandAsync").mockImplementation(() => Promise.reject("No Browser module."));

    request(PanelName.Page, "c9", true, "r1");
    await Wait.until(() => expect(answers()).toHaveLength(1));

    expect([answers(), context.lines.filter(t => t.includes("c9"))]).toEqual([[["r1", windowOf(), PanelOutcome.Failed]],
      [Resources.formatChatPageNotChanged("c9", "string")]]);
  });

  it("answers that it failed when opening the page throws", () => {
    vi.spyOn(context, "openDocument").mockImplementation(() => {
      throw new Error("No such document.");
    });

    expect(() => request(PanelName.Providers, null, true)).toThrow("No such document.");

    expect(answers()).toEqual([["r1", windowOf(), PanelOutcome.Failed]]);
  });

  it("still acts when the runtime refuses its reports and answers", async () => {
    const refusing = new FakeWindowPartContext().answer(MethodName.MessageListOpen, () => []);
    PanelRequests.register(refusing, ChatStoreService.watch(refusing));

    refusing.emit(EventName.PanelRequested, new PanelRequestedPayload("r1", windowOf(refusing), PanelName.Providers, null, true).toJson());
    await Wait.until(() => expect(sent(MethodName.PanelAnswered, refusing)).toHaveLength(1));

    expect(refusing.openedDocuments.map(t => t.instance)).toEqual([Resources.providersDocumentInstance]);
    PanelRequests.release(refusing);
    ChatStoreService.release(refusing);
  });
});
