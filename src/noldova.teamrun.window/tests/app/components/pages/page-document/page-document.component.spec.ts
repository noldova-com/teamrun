/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { WebViewEventKind } from "@noldova/desktop.protocol";
import { FileSaveOutcome, WindowPartTokens } from "@noldova/desktop.window";
import { PageAuthor, PageRequest, type PageView } from "@noldova/teamrun.protocol";
import { ClipboardWriter, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, ClipboardWriterFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { PageDocumentComponent } from "../../../../../src/app/components/pages/page-document/page-document.component";
import { PageDocuments } from "../../../../../src/app/services/pages/page-documents";
import { AccessibilityFixture } from "../../../../fixtures/accessibility.fixture";
import { EmulatedMediaFixture } from "../../../../fixtures/emulated-media.fixture";
import { PagesWindow, PagesWindowContext } from "../../../../fixtures/pages-window.fixture";
import type { RecordingWebView } from "../../../../fixtures/recording-web-view.fixture";
import { Wait } from "../../../../fixtures/wait.fixture";

describe("PageDocumentComponent", () => {
  let context: PagesWindowContext;
  let fixture: ComponentFixture<PageDocumentComponent>;
  let shown: (version: number | null) => PageView;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const view = (): RecordingWebView | undefined => context.pageViews.opened.at(-1);
  const text = (selector: string): string | undefined => element().querySelector(selector)?.textContent?.trim();
  const bars = (): readonly string[] => [...element().querySelectorAll(".nol-teamrun-page-bar-message")].map(t => (t.textContent ?? "").trim());
  const button = (action: string): HTMLButtonElement | null => element().querySelector(`button[data-action="${action}"]`);
  const menuItem = (label: string): HTMLButtonElement | undefined => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")]
    .find(t => (t.textContent ?? "").includes(label));
  const opens = (): readonly (number | null)[] => context.requests.filter(t => t.method === "teamrun.pageOpen").map(t => PagesWindow.versionOf(t.parameters));
  const rem = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const tooltipPart = (name: string): string | null => document.querySelector(`.cdk-overlay-container nol-tooltip .nol-tooltip-${name}`)?.textContent?.trim() ?? null;
  const resolved = (property: "color" | "backgroundColor" | "fontSize", value: string): string => {
    const probe = document.createElement("span");
    probe.style[property] = value;
    element().append(probe);
    const computed = getComputedStyle(probe)[property];
    probe.remove();
    return computed;
  };
  const systemColor = (name: string): string => resolved("color", name);
  const token = (name: string): number => Number.parseFloat(getComputedStyle(element()).getPropertyValue(`--nol-${name}`)) * rem();

  const openAsync = async (): Promise<RecordingWebView> => {
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    element().style.cssText = "position: fixed; left: 0; top: 0; width: 40rem; height: 30rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(view()?.navigations.length).toBe(1));
    await Wait.until(() => expect(text(".nol-teamrun-page-authors")).not.toBe(""));
    const opened = view();
    if (opened === undefined)
      throw new Error("The document opened no view.");
    return opened;
  };

  beforeEach(() => {
    context = new PagesWindowContext();
    shown = version => PagesWindow.view(1, version);
    context.answerModule("teamrun.pageOpen", t => shown(PagesWindow.versionOf(t)).toJson());
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it("opens its view on the page's own pane and profile before asking for the page, then goes to the page's address", async () => {
    const opened = await openAsync();

    expect([opened.pane.name.toString(), opened.pane.instance, opened.profileKey]).toEqual(["teamrun.page", PagesWindow.pageId, "pages"]);
    expect(opened.navigations).toEqual([PagesWindow.addressOf(null)]);
    expect(context.requests.map(t => [t.method, t.parameters])).toEqual([["teamrun.pageOpen", new PageRequest(PagesWindow.pageId, null).toJson()]]);
  });

  it("names the page with its version, who made and edited it, and when, and keeps the tab's title the page's", async () => {
    shown = () => PagesWindow.view(3, null, PagesWindow.sol);
    await openAsync();

    await Wait.until(() => expect(text(".nol-teamrun-page-authors")).toBe("v3 · Made by Opus · Edited by Sol · 5 min ago"));
    expect(text(".nol-teamrun-page-name")).toBe("Onboarding options");
    expect(context.updates.map(t => [t.name, t.instance, t.update.title])).toEqual([["teamrun.page", PagesWindow.pageId, "Onboarding options"]]);
  });

  it("mounts the view in its place below the toolbar, which is 2.5rem high with its controls 0.375rem in from its sides", async () => {
    const opened = await openAsync();

    await Wait.until(() => expect(opened.isShown).toBe(true));
    const toolbar = element().querySelector<HTMLElement>(".nol-teamrun-page-toolbar")?.getBoundingClientRect();
    const first = button("reload")?.getBoundingClientRect();
    const last = button("more")?.getBoundingClientRect();
    expect([toolbar?.height, first === undefined || toolbar === undefined ? null : first.left - toolbar.left,
      last === undefined || toolbar === undefined ? null : toolbar.right - last.right]).toEqual([2.5 * rem(), 0.375 * rem(), 0.375 * rem()]);
    expect(opened.host).toBe(element().querySelector(".nol-teamrun-page-view"));
    expect(opened.bounds).toEqual({ x: 0, y: Math.round(2.5 * rem()), width: Math.round(40 * rem()), height: Math.round(27.5 * rem()) });
  });

  it("says the page couldn't be opened when it went elsewhere and can't be taken back", async () => {
    const opened = await openAsync();
    opened.failNavigation = true;

    opened.emit(WebViewEventKind.State, { address: "https://cdn.jsdelivr.net/elsewhere", title: "", isLoading: true, canGoBack: true, canGoForward: false });

    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));
  });

  it("takes the page back to its address when it leaves its origin or path, and leaves it where it is for its own links and history", async () => {
    const opened = await openAsync();
    const own = new URL(PagesWindow.addressOf(null));

    opened.emit(WebViewEventKind.State, { address: "https://cdn.jsdelivr.net/elsewhere", title: "", isLoading: true, canGoBack: true, canGoForward: false });
    opened.emit(WebViewEventKind.State, { address: PagesWindow.addressOf(null), title: "Onboarding options", isLoading: false, canGoBack: true, canGoForward: false });
    opened.emit(WebViewEventKind.State, { address: `${PagesWindow.addressOf(null)}#costs`, title: "Onboarding options", isLoading: false, canGoBack: true, canGoForward: false });
    opened.emit(WebViewEventKind.State, { address: `${own.origin}${own.pathname}?tab=costs`, title: "Onboarding options", isLoading: false, canGoBack: true,
      canGoForward: false });
    opened.emit(WebViewEventKind.State, { address: `${own.origin}/pages/other`, title: "", isLoading: true, canGoBack: true, canGoForward: false });
    opened.emit(WebViewEventKind.State, { address: "", title: "", isLoading: true, canGoBack: false, canGoForward: false });
    opened.emit(WebViewEventKind.NavigationRefused, { address: "https://example.com/", origin: "https://example.com", isRedirect: false });

    expect(opened.navigations).toEqual([PagesWindow.addressOf(null), PagesWindow.addressOf(null), PagesWindow.addressOf(null)]);
  });

  it("reloads the page's latest version from its toolbar and its declared key, once for two presses at once, and ignores another key", async () => {
    const opened = await openAsync();

    button("reload")?.click();
    await Wait.until(() => expect(opened.navigations.length).toBe(2));
    opened.emit(WebViewEventKind.Key, { name: "other" });
    opened.emit(WebViewEventKind.Key, { name: "reload" });
    opened.emit(WebViewEventKind.Key, { name: "reload" });

    await Wait.until(() => expect(opens()).toEqual([null, null, null, null]));
    await Wait.until(() => expect(opened.navigations.length).toBe(3));
  });

  it("copies the file's path from More, and says so when the clipboard refuses it", async () => {
    const clipboard = new ClipboardWriterFixture();
    TestBed.overrideProvider(ClipboardWriter, { useValue: clipboard });
    await openAsync();

    for (const refused of [false, true]) {
      clipboard.answer = () => Promise.resolve(!refused);
      button("more")?.click();
      await Wait.until(() => expect(menuItem("Copy the file's path")).toBeDefined());
      menuItem("Copy the file's path")?.click();
      await Wait.until(() => expect(clipboard.texts.length).toBe(refused ? 2 : 1));
    }

    await Wait.until(() => expect(bars()).toEqual(["That didn't work. Try again."]));
    expect(clipboard.texts).toEqual([PagesWindow.file, PagesWindow.file]);
  });

  it("shows the stopped page, without its view, after a crash or a missed ping of its own page, and runs it again on Reload", async () => {
    const opened = await openAsync();
    await Wait.until(() => expect(opened.isShown).toBe(true));

    context.emitModule("teamrun.pageStopped", PagesWindow.page(1, PagesWindow.opus, "other-page").toJson());
    context.emitModule("teamrun.pageStopped", null);
    expect(text(".nol-teamrun-page-state-heading")).toBeUndefined();
    context.emitModule("teamrun.pageStopped", PagesWindow.page().toJson());
    await Wait.until(() => expect([text(".nol-teamrun-page-state-heading"), opened.isShown]).toEqual(["This page stopped responding", false]));
    button("restart")?.click();
    await Wait.until(() => expect([text(".nol-teamrun-page-state-heading"), opened.isShown, opened.navigations.length]).toEqual([undefined, true, 2]));
    opened.emit(WebViewEventKind.Crashed);

    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page stopped responding"));
  });

  it("reloads in place when a teammate or the chat's own agent updates its page and says who, until dismissed", async () => {
    const opened = await openAsync();
    shown = () => PagesWindow.view(2, null, PagesWindow.sol);

    context.emitModule("teamrun.pageUpdated", PagesWindow.page(5, PagesWindow.sol, "other-page").toJson());
    context.emitModule("teamrun.pageUpdated", { id: PagesWindow.pageId });
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(2, PagesWindow.sol).toJson());
    await Wait.until(() => expect(bars()).toEqual(["Sol updated this page to v2 5 min ago."]));
    button("dismiss")?.click();
    await Wait.until(() => expect(bars()).toEqual([]));
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(3, new PageAuthor(null, "Codex")).toJson());

    await Wait.until(() => expect(opens()).toEqual([null, null, null]));
    await Wait.until(() => expect(bars()).toEqual(["Codex updated this page to v3 5 min ago."]));
    await Wait.until(() => expect(opened.calls.filter(t => t === "reload")).toHaveLength(2));
    expect(opened.navigations).toEqual([PagesWindow.addressOf(null)]);
  });

  it("reads its page again once the runtime starts again, leaving the stopped state, with the bar of an edit made meanwhile and none for an unchanged page", async () => {
    const opened = await openAsync();
    context.emitModule("teamrun.pageStopped", PagesWindow.page().toJson());
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page stopped responding"));
    shown = () => PagesWindow.view(2, null, PagesWindow.sol);

    PageDocuments.resync(context);

    await Wait.until(() => expect(bars()).toEqual(["Sol updated this page to v2 5 min ago."]));
    expect([text(".nol-teamrun-page-state-heading"), text(".nol-teamrun-page-authors"), opens()])
      .toEqual([undefined, "v2 · Made by Opus · Edited by Sol · 5 min ago", [null, null]]);
    button("dismiss")?.click();
    await Wait.until(() => expect(bars()).toEqual([]));
    PageDocuments.resync(context);
    await Wait.until(() => expect(opened.calls.filter(t => t === "reload")).toHaveLength(2));
    expect([bars(), opens()]).toEqual([[], [null, null, null]]);
  });

  it("shows no update bar for the person's own Restore that lands while it reads its page again after the runtime started again", async () => {
    shown = version => PagesWindow.view(3, version, PagesWindow.sol);
    let restored: (page: JsonValue) => void = () => undefined;
    context.answerModule("teamrun.pageRestore", () => new Promise<JsonValue>(resolve => {
      restored = resolve;
    }));
    await openAsync();
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
    menuItem("v1 · Opus")?.click();
    await Wait.until(() => expect(button("restore")).not.toBeNull());
    button("restore")?.click();
    await Wait.until(() => expect(context.requests.some(t => t.method === "teamrun.pageRestore")).toBe(true));
    let read: (view: JsonValue) => void = () => undefined;
    context.answerModule("teamrun.pageOpen", () => new Promise<JsonValue>(resolve => {
      read = resolve;
    }));

    PageDocuments.resync(context);
    await Wait.until(() => expect(opens()).toEqual([null, 1, null]));
    shown = version => PagesWindow.view(4, version, PagesWindow.you);
    context.answerModule("teamrun.pageOpen", t => shown(PagesWindow.versionOf(t)).toJson());
    restored(PagesWindow.page(4, PagesWindow.you).toJson());
    await Wait.until(() => expect(context.updates.at(-1)?.update.title).toBe("Onboarding options"));
    read(PagesWindow.view(4, null, PagesWindow.you).toJson());
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    fixture.detectChanges();

    expect([bars(), opens()]).toEqual([[], [null, 1, null, null]]);
  });

  it("opens again once the runtime starts again a page it couldn't open or read before, with no update bar", async () => {
    context.pageViews.failure = new Error("No pane.");
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));
    context.pageViews.failure = null;
    context.answerModule("teamrun.pageOpen", () => {
      throw new Error("No page.");
    });

    PageDocuments.resync(context);

    await Wait.until(() => expect([context.pageViews.opened.length, opens()]).toEqual([1, [null]]));
    await fixture.whenStable();
    expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened");
    context.answerModule("teamrun.pageOpen", () => PagesWindow.view(2).toJson());
    PageDocuments.resync(context);
    await Wait.until(() => expect([text(".nol-teamrun-page-state-heading"), view()?.navigations]).toEqual([undefined, [PagesWindow.addressOf(null)]]));
    expect(bars()).toEqual([]);
  });

  it("goes to the current version's address on an update while an older version shows, and while the page couldn't be opened", async () => {
    shown = version => PagesWindow.view(2, version, PagesWindow.sol);
    const opened = await openAsync();
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
    menuItem("v1 · Opus")?.click();
    await Wait.until(() => expect(opened.navigations.at(-1)).toBe(PagesWindow.addressOf(1)));

    context.emitModule("teamrun.pageUpdated", PagesWindow.page(2, PagesWindow.sol).toJson());
    await Wait.until(() => expect(opened.navigations.at(-1)).toBe(PagesWindow.addressOf(null)));
    opened.failNavigation = true;
    button("reload")?.click();
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));
    opened.failNavigation = false;
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(2, PagesWindow.sol).toJson());

    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBeUndefined());
    expect([opened.navigations.length, opened.calls.includes("reload")]).toEqual([5, false]);
  });

  it("saves the shown version's HTML under the page's file name, and says so when the save fails", async () => {
    context.answerModule("teamrun.pageRead", () => "<p>v1</p>");
    await openAsync();

    button("save")?.click();
    await Wait.until(() => expect(context.savedFiles.length).toBe(1));
    context.saveOutcome = FileSaveOutcome.Failed;
    button("save")?.click();

    await Wait.until(() => expect(bars()).toEqual(["That didn't work. Try again."]));
    expect([context.savedFiles[0]?.name, new TextDecoder().decode(context.savedFiles[0]?.bytes)]).toEqual(["options.html", "<p>v1</p>"]);
    expect(context.requests.filter(t => t.method === "teamrun.pageRead").map(t => t.parameters))
      .toEqual([new PageRequest(PagesWindow.pageId, 1).toJson(), new PageRequest(PagesWindow.pageId, 1).toJson()]);
  });

  it("says so when the page's HTML isn't text", async () => {
    context.answerModule("teamrun.pageRead", (): JsonValue => ({ html: 1 }));
    await openAsync();

    button("save")?.click();

    await Wait.until(() => expect(bars()).toEqual(["That didn't work. Try again."]));
    expect(context.savedFiles).toEqual([]);
  });

  it("opens the page in the system browser for Open and for Print", async () => {
    await openAsync();

    button("open")?.click();
    button("print")?.click();

    await Wait.until(() => expect(context.links).toEqual([PagesWindow.addressOf(null), PagesWindow.addressOf(null)]));
  });

  it("shows the zoom and close keys in More and Print's key in its tooltip, and zooms and prints from the page's declared keys", async () => {
    const mod = navigator.platform.startsWith("Mac") ? "\u2318" : "Ctrl+";
    const opened = await openAsync();

    button("more")?.click();
    await Wait.until(() => expect(menuItem("Close the page")).toBeDefined());
    const keys = ["Zoom in", "Zoom out", "Actual size", "Close the page"].map(t => menuItem(t)?.querySelector(".nol-menu-item-shortcut")?.textContent?.trim());
    const described = (button("print")?.getAttribute("aria-describedby") ?? "").split(" ").map(t => document.getElementById(t)?.textContent?.trim()).join(" ");
    for (const name of ["zoomIn", "zoomOut", "actualSize", "print", "other"])
      opened.emit(WebViewEventKind.Key, { name });

    expect(keys).toEqual([`${mod}=`, `${mod}-`, `${mod}0`, `${mod}W`]);
    expect(described).toBe(`Print or save as PDF · ${mod}P`);
    await Wait.until(() => expect(opened.calls.filter(t => t.startsWith("zoom"))).toEqual(["zoom in", "zoom out", "zoom 1"]));
    await Wait.until(() => expect(context.links).toEqual([PagesWindow.addressOf(null)]));
  });

  it("names More in a tooltip below it, as every toolbar button", async () => {
    await openAsync();
    const tooltip = (): string | undefined => document.querySelector<HTMLElement>(".cdk-overlay-container nol-tooltip")?.textContent?.trim();

    button("more")?.dispatchEvent(new PointerEvent("pointerenter"));

    await Wait.until(() => expect(tooltip()).toBe("More"));
    const shown = document.querySelector(".cdk-overlay-container nol-tooltip")?.getBoundingClientRect() ?? new DOMRect();
    expect(shown.top).toBeGreaterThanOrEqual(button("more")?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY);
  });

  it("shows the page's title and its version line in the title field's tooltip on hover when the row cuts them", async () => {
    shown = () => PagesWindow.view(3, null, PagesWindow.sol);
    await openAsync();
    element().style.width = "16rem";
    const field = element().querySelector<HTMLElement>(".nol-teamrun-page-title") ?? element();
    await userEvent.hover(field);

    try {
      await Wait.until(() => expect([tooltipPart("title"), tooltipPart("description")])
        .toEqual(["Onboarding options", "v3 · Made by Opus · Edited by Sol · 5 min ago"]));
    }
    finally {
      await userEvent.unhover(field);
    }
  });

  it("puts the title field after Reload in the toolbar's arrow-key order, named by the page's title, and shows its tooltip when it takes focus while cut", async () => {
    shown = () => PagesWindow.view(3, null, PagesWindow.sol);
    await openAsync();
    element().style.width = "16rem";
    const field = element().querySelector<HTMLElement>(".nol-teamrun-page-title") ?? element();
    button("reload")?.focus();

    await userEvent.keyboard("{ArrowRight}");

    await Wait.until(() => expect([tooltipPart("title"), tooltipPart("description")])
      .toEqual(["Onboarding options", "v3 · Made by Opus · Edited by Sol · 5 min ago"]));
    expect([document.activeElement === field, field.getAttribute("role"), field.getAttribute("aria-label")]).toEqual([true, "group", "Onboarding options"]);
  });

  it("runs each of the page's keys pressed with focus on its toolbar, once for a held key, and none while composing or for another key", async () => {
    const mod: KeyboardEventInit = navigator.platform.startsWith("Mac") ? { metaKey: true } : { ctrlKey: true };
    const opened = await openAsync();
    const reload = button("reload");
    reload?.focus();
    const press = (init: KeyboardEventInit): boolean => reload?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })) ?? true;

    const results = [
      press({ key: "=", code: "Equal", ...mod }),
      press({ key: "+", code: "Equal", shiftKey: true, ...mod }),
      press({ key: "-", code: "Minus", ...mod }),
      press({ key: "0", code: "Digit0", ...mod }),
      press({ key: "p", code: "KeyP", ...mod }),
      press({ key: "r", code: "KeyR", ...mod }),
      press({ key: "r", code: "KeyR", repeat: true, ...mod }),
      press({ key: "p", code: "KeyP", isComposing: true, ...mod }),
      press({ key: "k", code: "KeyK", ...mod })
    ];

    expect([document.activeElement === reload, results]).toEqual([true, [false, false, false, false, false, false, true, true, true]]);
    await Wait.until(() => expect(opened.calls.filter(t => t.startsWith("zoom"))).toEqual(["zoom in", "zoom in", "zoom out", "zoom 1"]));
    await Wait.until(() => expect([context.links, opens()]).toEqual([[PagesWindow.addressOf(null)], [null, null]]));
  });

  it("prints nothing from the page's key before the page opens", async () => {
    context.answerModule("teamrun.pageOpen", () => {
      throw new Error("No page.");
    });
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));

    view()?.emit(WebViewEventKind.Key, { name: "print" });
    await fixture.whenStable();

    expect(context.links).toEqual([]);
  });

  it("says when the computer is offline until it's back, and reloads the page from the bar", async () => {
    let isOnline = false;
    vi.spyOn(navigator, "onLine", "get").mockImplementation(() => isOnline);
    const opened = await openAsync();

    expect(bars()).toEqual(["Offline: sources from outside the page may not load. The page will try again when you reload."]);
    button("offline-reload")?.click();
    await Wait.until(() => expect(opened.navigations.length).toBe(2));
    isOnline = true;
    window.dispatchEvent(new Event("online"));
    await Wait.until(() => expect(bars()).toEqual([]));
    isOnline = false;
    window.dispatchEvent(new Event("offline"));
    await Wait.until(() => expect(bars()).toHaveLength(1));
  });

  it("opens More over the live view, and shows the file in its folder, zooms and closes from it", async () => {
    const opened = await openAsync();

    button("more")?.click();
    await Wait.until(() => expect([opened.isShown, menuItem("Show the file in its folder")]).toEqual([true, expect.anything()]));
    menuItem("Show the file in its folder")?.click();
    await Wait.until(() => expect([opened.isShown, context.shownInFolder]).toEqual([true, [PagesWindow.file]]));
    for (const label of ["Zoom in", "Zoom out", "Actual size", "Close the page"]) {
      button("more")?.click();
      await Wait.until(() => expect(menuItem(label)).toBeDefined());
      menuItem(label)?.click();
    }

    await Wait.until(() => expect(opened.calls.filter(t => t.startsWith("zoom"))).toEqual(["zoom in", "zoom out", "zoom 1"]));
    expect(context.closedDocuments).toEqual([{ name: "teamrun.page", instance: PagesWindow.pageId }]);
  });

  it("shows an older version read-only with its bar and the version in the tab's title, restores it as a new version without an update bar, and goes back", async () => {
    shown = version => PagesWindow.view(3, version, PagesWindow.sol);
    context.answerModule("teamrun.pageRestore", () => PagesWindow.page(4, PagesWindow.you).toJson());
    const opened = await openAsync();

    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
    expect(menuItem("v3 · Sol")?.textContent).toContain("5 min ago · current");
    menuItem("v1 · Opus")?.click();
    await Wait.until(() => expect(bars()).toEqual(["You're looking at v1, made by Opus. The current version is v3."]));
    expect([opened.navigations.at(-1), context.updates.at(-1)?.update.title]).toEqual([PagesWindow.addressOf(1), "Onboarding options · v1"]);
    button("restore")?.click();
    await Wait.until(() => expect(bars()).toEqual([]));
    expect(context.requests.filter(t => t.method === "teamrun.pageRestore").map(t => t.parameters)).toEqual([new PageRequest(PagesWindow.pageId, 1).toJson()]);
    expect(opens()).toEqual([null, 1, null]);
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(4, PagesWindow.you).toJson());

    await Wait.until(() => expect(opens()).toEqual([null, 1, null, null]));
    expect(bars()).toEqual([]);
  });

  it("keeps the bar of a teammate's edit that lands while the person's Restore runs, and hides the Restore's own update however it arrives", async () => {
    shown = version => PagesWindow.view(3, version, PagesWindow.sol);
    let answer: (page: JsonValue) => void = () => undefined;
    context.answerModule("teamrun.pageRestore", () => new Promise<JsonValue>(resolve => {
      answer = resolve;
    }));
    await openAsync();
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
    menuItem("v1 · Opus")?.click();
    await Wait.until(() => expect(button("restore")).not.toBeNull());

    button("restore")?.click();
    await Wait.until(() => expect(context.requests.some(t => t.method === "teamrun.pageRestore")).toBe(true));
    shown = version => PagesWindow.view(4, version, PagesWindow.sol);
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(4, PagesWindow.sol).toJson());
    await Wait.until(() => expect(bars()).toEqual(["Sol updated this page to v4 5 min ago."]));
    answer(PagesWindow.page(5, PagesWindow.you).toJson());
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(5, PagesWindow.you).toJson());
    await Wait.until(() => expect(opens()).toEqual([null, 1, null, null, null]));
    expect(bars()).toEqual(["Sol updated this page to v4 5 min ago."]);

    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
    menuItem("v1 · Opus")?.click();
    await Wait.until(() => expect(button("restore")).not.toBeNull());
    button("restore")?.click();
    await Wait.until(() => expect(context.requests.filter(t => t.method === "teamrun.pageRestore")).toHaveLength(2));
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(6, PagesWindow.you).toJson());
    await Wait.until(() => expect(bars()).toEqual(["You updated this page to v6 5 min ago."]));
    answer(PagesWindow.page(6, PagesWindow.you).toJson());

    await Wait.until(() => expect(bars()).toEqual([]));
  });

  it("shows the bar of a teammate's next edit after a Restore that failed", async () => {
    shown = version => PagesWindow.view(3, version, PagesWindow.sol);
    context.answerModule("teamrun.pageRestore", () => {
      throw new Error("No restore.");
    });
    await openAsync();
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
    menuItem("v1 · Opus")?.click();
    await Wait.until(() => expect(button("restore")).not.toBeNull());
    button("restore")?.click();
    await Wait.until(() => expect(bars()).toContain("That didn't work. Try again."));

    shown = version => PagesWindow.view(4, version, PagesWindow.sol);
    context.emitModule("teamrun.pageUpdated", PagesWindow.page(4, PagesWindow.sol).toJson());

    await Wait.until(() => expect(bars()).toEqual(["Sol updated this page to v4 5 min ago.", "That didn't work. Try again."]));
  });

  it("reloads in place when a teammate shows its page again, as for an edit", async () => {
    const opened = await openAsync();
    shown = () => PagesWindow.view(2, null, PagesWindow.sol);

    context.emitModule("teamrun.pageShown", PagesWindow.page(2, PagesWindow.sol, "other-page").toJson());
    context.emitModule("teamrun.pageShown", PagesWindow.page(2, PagesWindow.sol).toJson());

    await Wait.until(() => expect(bars()).toEqual(["Sol updated this page to v2 5 min ago."]));
    await Wait.until(() => expect(opened.calls.filter(t => t === "reload")).toHaveLength(1));
    expect([opens(), text(".nol-teamrun-page-authors"), opened.navigations.length]).toEqual([[null, null], "v2 · Made by Opus · Edited by Sol · 5 min ago", 1]);
  });

  it("goes back to the current version from an older one, and from the current version's own row", async () => {
    shown = version => PagesWindow.view(2, version, PagesWindow.sol);
    await openAsync();
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
    menuItem("v1 · Opus")?.click();
    await Wait.until(() => expect(button("current")).not.toBeNull());

    button("current")?.click();
    await Wait.until(() => expect(opens()).toEqual([null, 1, null]));
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
    menuItem("Versions")?.click();
    await Wait.until(() => expect(menuItem("v2 · Sol")).toBeDefined());
    menuItem("v2 · Sol")?.click();

    await Wait.until(() => expect(opens()).toEqual([null, 1, null, null]));
    await Wait.until(() => expect(context.updates.at(-1)?.update.title).toBe("Onboarding options"));
  });

  it("says the page couldn't be opened when its view, its page or its address fails, and tries again on Reload", async () => {
    context.pageViews.failure = new Error("No pane.");
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));
    button("restart")?.click();
    await fixture.whenStable();
    expect([context.requests, context.pageViews.opened, text(".nol-teamrun-page-state-heading")]).toEqual([[], [], "This page couldn't be opened"]);
    context.pageViews.failure = null;
    button("restart")?.click();
    button("restart")?.click();
    await Wait.until(() => expect([context.pageViews.opened.length, view()?.navigations]).toEqual([1, [PagesWindow.addressOf(null)]]));
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBeUndefined());
    fixture.destroy();

    context.pageViews.failure = null;
    context.answerModule("teamrun.pageOpen", () => {
      throw new Error("No page.");
    });
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));

    context.answerModule("teamrun.pageOpen", () => PagesWindow.view().toJson());
    const opened = context.pageViews.opened.at(-1);
    if (opened === undefined)
      throw new Error("The document opened no view.");
    opened.failNavigation = true;
    button("restart")?.click();
    await Wait.until(() => expect(opened.navigations.length).toBe(1));
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));
  });

  it("closes its view when the tab closes, and a view the host closed is left alone", async () => {
    const opened = await openAsync();

    fixture.destroy();
    expect(opened.isClosed).toBe(true);

    const second = await openAsync();
    second.closeFromHost();
    fixture.destroy();
    expect(second.calls.includes("close")).toBe(false);
  });

  it("says the page couldn't be opened once the host closes its view, and opens a new view on Reload", async () => {
    const first = await openAsync();

    first.closeFromHost();
    await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page couldn't be opened"));
    button("restart")?.click();

    await Wait.until(() => expect(context.pageViews.opened.length).toBe(2));
    await Wait.until(() => expect([view()?.navigations, text(".nol-teamrun-page-state-heading")]).toEqual([[PagesWindow.addressOf(null)], undefined]));
  });

  it("closes a view that opens only after its tab closed", async () => {
    const gate = { open: (): void => undefined };
    const views = context.pageViews;
    const later = new Promise<void>(t => gate.open = t);
    const openAsyncOf = views.openAsync.bind(views);
    views.openAsync = async (pane, profileKey) => {
      await later;
      return openAsyncOf(pane, profileKey);
    };
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    fixture.autoDetectChanges();

    fixture.destroy();
    gate.open();

    await Wait.until(() => expect(views.opened[0]?.isClosed).toBe(true));
    expect(context.requests).toEqual([]);
  });

  it("names only the maker of a later version its maker edited", async () => {
    shown = () => PagesWindow.view(2);
    await openAsync();

    await Wait.until(() => expect(text(".nol-teamrun-page-authors")).toBe("v2 · Made by Opus · 5 min ago"));
  });

  it("keeps the page a later load showed when an earlier load fails after it", async () => {
    const opened = await openAsync();
    let fail: (error: Error) => void = () => undefined;
    context.answerModule("teamrun.pageOpen", () => new Promise<JsonValue>((_, reject) => {
      fail = reject;
    }));
    button("reload")?.click();
    await Wait.until(() => expect(opens()).toEqual([null, null]));
    context.answerModule("teamrun.pageOpen", () => PagesWindow.view(2).toJson());
    button("reload")?.click();
    await Wait.until(() => expect(opened.navigations.length).toBe(2));

    fail(new Error("Late."));
    await fixture.whenStable();

    expect([text(".nol-teamrun-page-state-heading"), text(".nol-teamrun-page-authors")]).toEqual([undefined, "v2 · Made by Opus · 5 min ago"]);
  });

  it("opens More and leaves the zoom alone once the host closed the view", async () => {
    const opened = await openAsync();
    opened.closeFromHost();
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Zoom in")).toBeDefined());

    menuItem("Zoom in")?.click();
    await fixture.whenStable();

    expect(opened.calls.includes("zoom in")).toBe(false);
  });

  it("loads nothing for an update that arrives before its view opens, and loads the page once the view opens", async () => {
    let release: () => void = () => undefined;
    context.pageViews.waiting = new Promise<void>(resolve => {
      release = resolve;
    });
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(context.pageViews.opened.length).toBe(1));

    context.emitModule("teamrun.pageUpdated", PagesWindow.page(2, PagesWindow.sol).toJson());
    await fixture.whenStable();
    expect(opens()).toEqual([]);
    release();

    await Wait.until(() => expect(opens()).toEqual([null]));
  });

  it("mounts and shows the view it gets while More is already open", async () => {
    let release: () => void = () => undefined;
    context.pageViews.waiting = new Promise<void>(resolve => {
      release = resolve;
    });
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    element().style.cssText = "position: fixed; left: 0; top: 0; width: 40rem; height: 30rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(context.pageViews.opened.length).toBe(1));
    button("more")?.click();
    await Wait.until(() => expect(menuItem("Close the page")).toBeDefined());

    release();

    await Wait.until(() => expect([view()?.host === element().querySelector(".nol-teamrun-page-view"), view()?.isShown]).toEqual([true, true]));
    expect(view()?.bounds).toEqual({ x: 0, y: Math.round(2.5 * rem()), width: Math.round(40 * rem()), height: Math.round(27.5 * rem()) });
  });

  it("offers only Close in More until the page opens", async () => {
    context.answerModule("teamrun.pageOpen", () => new Promise<JsonValue>(() => undefined));
    fixture = TestBed.createComponent(PageDocumentComponent);
    fixture.componentRef.setInput("instance", PagesWindow.pageId);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(opens()).toEqual([null]));

    button("more")?.click();
    await Wait.until(() => expect(menuItem("Close the page")).toBeDefined());

    expect(["Show the file in its folder", "Versions", "Zoom in", "Close the page"].map(t => menuItem(t)?.getAttribute("aria-disabled") === "true"))
      .toEqual([true, true, true, false]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const box = (selector: string): DOMRect => element().querySelector(selector)?.getBoundingClientRect() ?? new DOMRect();
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await fixture.whenStable();
    };

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it.each([40, 16])("at %drem wide, keeps the toolbar's controls 0.375rem in from its sides, cuts the title before Open, and sets the bar full width under it with its action at its padding's end", async width => {
      const opened = await openAsync();
      shown = () => PagesWindow.view(2, null, PagesWindow.sol);
      element().style.width = `${width}rem`;
      context.emitModule("teamrun.pageUpdated", PagesWindow.page(2, PagesWindow.sol).toJson());
      await Wait.until(() => expect(bars()).toHaveLength(1));
      await settle();
      const host = element().getBoundingClientRect();
      const toolbar = box(".nol-teamrun-page-toolbar");
      const bar = box(".nol-teamrun-page-bar");
      const name = element().querySelector<HTMLElement>(".nol-teamrun-page-name");
      const dismiss = box("button[data-action=dismiss]");
      const style = getComputedStyle(element().querySelector(".nol-teamrun-page-bar") ?? element());
      const quiet = getComputedStyle(button("dismiss") ?? element());

      expect(element().scrollWidth).toBe(element().clientWidth);
      AppearanceFixture.expectPixels(toolbar.height, 2.5 * rem());
      AppearanceFixture.expectPixels(box("button[data-action=reload]").left - toolbar.left, 0.375 * rem());
      AppearanceFixture.expectPixels(toolbar.right - box("button[data-action=more]").right, 0.375 * rem());
      expect(box(".nol-teamrun-page-title").right).toBeLessThanOrEqual(box("button[data-action=open]").left);
      expect(name === null ? null : getComputedStyle(name).textOverflow).toBe("ellipsis");
      expect(name === null ? null : name.scrollWidth > name.clientWidth).toBe(width === 16);
      AppearanceFixture.expectPixels(bar.left - host.left, 0);
      AppearanceFixture.expectPixels(host.right - bar.right, 0);
      AppearanceFixture.expectPixels(bar.top - toolbar.bottom, 0);
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingTop), 0.4375 * rem());
      AppearanceFixture.expectPixels(bar.right - dismiss.right, token("space-3"));
      AppearanceFixture.expectPixels(dismiss.height, token("button-height"));
      AppearanceFixture.expectPixels(dismiss.top + dismiss.height / 2, bar.top + (bar.height - Number.parseFloat(style.borderBottomWidth)) / 2);
      expect([style.borderTopWidth, style.borderRadius, style.marginBottom, style.fontSize, quiet.fontSize, quiet.borderTopStyle])
        .toEqual(["0px", "0px", "0px", `${0.75 * rem()}px`, `${0.75 * rem()}px`, "none"]);
      if (forcedColors === "active")
        expect([style.borderBottomStyle, style.borderBottomColor, style.borderBottomWidth])
          .toEqual(["solid", systemColor("CanvasText"), getComputedStyle(element()).getPropertyValue("--nol-border-width").trim()]);
      await Wait.until(() => expect(opened.bounds).toEqual({ x: 0, y: Math.round(bar.bottom - host.top), width: Math.round(host.width),
        height: Math.round(host.bottom - bar.bottom) }));
      if (forcedColors === "none")
        expect([style.backgroundColor, style.color, quiet.backgroundColor])
          .toEqual([...["selected", "text"].map(t => AppearanceFixture.readColor(FixtureTheme.theme, mode, t)), "rgba(0, 0, 0, 0)"]);
      if (forcedColors === "none")
        expect([".nol-teamrun-page-name", ".nol-teamrun-page-authors"].map(t => getComputedStyle(element().querySelector(t) ?? element()).color))
          .toEqual(["text-strong", "text-muted"].map(t => AppearanceFixture.readColor(FixtureTheme.theme, mode, t)));
    });

    it.each([40, 16])("at %drem wide, sets the title and its version line on one row in the title field, the version line right after the title, and cuts the title first", async width => {
      await openAsync();
      element().style.width = `${width}rem`;
      await settle();
      const field = box(".nol-teamrun-page-title");
      const name = box(".nol-teamrun-page-name");
      const authors = box(".nol-teamrun-page-authors");
      const nameText = element().querySelector<HTMLElement>(".nol-teamrun-page-name");
      const authorsText = element().querySelector<HTMLElement>(".nol-teamrun-page-authors");
      const isCut = (text: HTMLElement | null): boolean => text !== null && text.scrollWidth > text.clientWidth;

      AppearanceFixture.expectPixels(field.height, 1.875 * rem());
      AppearanceFixture.expectPixels(field.top + field.height / 2, box(".nol-teamrun-page-toolbar").top + 1.25 * rem());
      AppearanceFixture.expectPixels(name.top + name.height / 2, field.top + field.height / 2);
      AppearanceFixture.expectPixels(authors.top + authors.height / 2, field.top + field.height / 2);
      AppearanceFixture.expectPixels(name.left - field.left, 0.625 * rem());
      AppearanceFixture.expectPixels(authors.left - name.right, token("space-2"));
      AppearanceFixture.expectPixels(field.left - box("button[data-action=reload]").right, 0.375 * rem() + 0.125 * rem());
      expect(authors.right).toBeLessThanOrEqual(field.right - 0.625 * rem() + 1);
      expect([isCut(nameText), isCut(authorsText) ? nameText?.clientWidth : 0]).toEqual([width === 16, 0]);
      expect(getComputedStyle(element().querySelector(".nol-teamrun-page-title") ?? element()).borderRadius).toBe(`${token("radius-small")}px`);
      if (forcedColors === "none")
        expect(getComputedStyle(element().querySelector(".nol-teamrun-page-title") ?? element()).backgroundColor)
          .toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "window"));
    });

    it.each([40, 16])("at %drem wide, sets the older version's band with a default-size secondary Restore and a quiet Back, 0.375rem apart at its padding's end", async width => {
      shown = version => PagesWindow.view(3, version, PagesWindow.sol);
      await openAsync();
      element().style.width = `${width}rem`;
      button("more")?.click();
      await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
      menuItem("Versions")?.click();
      await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
      menuItem("v1 · Opus")?.click();
      await Wait.until(() => expect(bars()).toHaveLength(1));
      await settle();
      const bar = box(".nol-teamrun-page-bar");
      const restore = box("button[data-action=restore]");
      const current = box("button[data-action=current]");
      const looks = ["restore", "current"].map(t => button(t)?.classList);

      expect(element().scrollWidth).toBe(element().clientWidth);
      AppearanceFixture.expectPixels(bar.right - current.right, token("space-3"));
      expect(current.left >= restore.right ? current.left - restore.right : current.top - restore.bottom).toBeCloseTo(0.375 * rem(), 0);
      AppearanceFixture.expectPixels(restore.height, token("button-height"));
      AppearanceFixture.expectPixels(current.height, token("button-height"));
      expect(looks.map(t => [t?.contains("nol-button-secondary"), t?.contains("nol-button-text"), t?.contains("nol-button-compact")]))
        .toEqual([[true, false, false], [false, true, false]]);
      if (forcedColors === "none")
        expect(getComputedStyle(element().querySelector(".nol-teamrun-page-bar") ?? element()).backgroundColor)
          .toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "selected"));
    });

    it.each([40, 16])("at %drem wide, heads the versions submenu VERSIONS in the kit's uppercase group look, muted, spaced and inset like the rows' start, and names the group Versions", async width => {
      shown = version => PagesWindow.view(3, version, PagesWindow.sol);
      await openAsync();
      element().style.width = `${width}rem`;
      await settle();
      button("more")?.click();
      await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
      menuItem("Versions")?.click();
      await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
      const row = menuItem("v1 · Opus") ?? element();
      const group = row.closest<HTMLElement>("nol-menu-group") ?? element();
      const label = group.querySelector<HTMLElement>(".nol-menu-label") ?? group;
      const style = getComputedStyle(label);
      const rowStyle = getComputedStyle(row);
      const heading = label.getBoundingClientRect();
      const first = row.getBoundingClientRect();

      expect([group.getAttribute("role"), group.getAttribute("aria-label"), label.textContent?.trim(), style.textTransform, style.fontWeight])
        .toEqual(["group", "Versions", "Versions", "uppercase", getComputedStyle(group).getPropertyValue("--nol-weight-emphasis").trim()]);
      expect(style.fontSize).toBe(resolved("fontSize", "var(--nol-text-small)"));
      expect(Number.parseFloat(style.letterSpacing) / Number.parseFloat(style.fontSize)).toBeCloseTo(0.05, 3);
      expect(style.color).toBe(forcedColors === "none" ? AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-muted") : systemColor("CanvasText"));
      const [top, inline, bottom] = getComputedStyle(element()).getPropertyValue("--nol-menu-label-padding").trim().split(/\s+/).map(t => Number.parseFloat(t) * rem());
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingTop), top ?? Number.NaN);
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingLeft), inline ?? Number.NaN);
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingBottom), bottom ?? Number.NaN);
      AppearanceFixture.expectPixels(heading.left, first.left);
      AppearanceFixture.expectPixels(heading.left + Number.parseFloat(style.paddingLeft), first.left + Number.parseFloat(rowStyle.paddingLeft));
      expect(first.top).toBeGreaterThanOrEqual(heading.bottom);
    });

    it("at a width that cuts only the title, keeps the whole version line and the title's start", async () => {
      await openAsync();
      await settle();
      const nameText = element().querySelector<HTMLElement>(".nol-teamrun-page-name") ?? element();
      const authorsText = element().querySelector<HTMLElement>(".nol-teamrun-page-authors") ?? element();
      const field = box(".nol-teamrun-page-title");
      const spare = field.width - 2 * 0.625 * rem() - nameText.scrollWidth - token("space-2") - authorsText.scrollWidth;
      element().style.width = `${element().getBoundingClientRect().width - spare - nameText.scrollWidth / 2}px`;
      await settle();

      expect([nameText.scrollWidth > nameText.clientWidth, nameText.clientWidth > 0, authorsText.scrollWidth]).toEqual([true, true, authorsText.clientWidth]);
    });

    it.each([40, 16])("at %drem wide, sets the offline band full width below the toolbar in the warning colour on the warning fill with a default-size Reload at its padding's end, and the view below it", async width => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      const opened = await openAsync();
      element().style.width = `${width}rem`;
      await settle();
      const host = element().getBoundingClientRect();
      const toolbar = box(".nol-teamrun-page-toolbar");
      const bar = box(".nol-teamrun-page-bar");
      const reload = box("button[data-action=offline-reload]");
      const style = getComputedStyle(element().querySelector(".nol-teamrun-page-bar") ?? element());

      expect(element().scrollWidth).toBe(element().clientWidth);
      AppearanceFixture.expectPixels(bar.left - host.left, 0);
      AppearanceFixture.expectPixels(host.right - bar.right, 0);
      AppearanceFixture.expectPixels(bar.top - toolbar.bottom, 0);
      AppearanceFixture.expectPixels(bar.right - reload.right, token("space-3"));
      AppearanceFixture.expectPixels(reload.height, token("button-height"));
      expect(reload.bottom).toBeLessThanOrEqual(bar.bottom);
      expect(style.fontSize).toBe(`${0.75 * rem()}px`);
      await Wait.until(() => expect(opened.bounds?.y).toBe(Math.round(bar.bottom - host.top)));
      if (forcedColors === "none")
        expect([style.color, style.backgroundColor])
          .toEqual([AppearanceFixture.readColor(FixtureTheme.theme, mode, "warning"), resolved("backgroundColor", "var(--nol-warning-background)")]);
      else
        expect([style.color, style.backgroundColor]).toEqual([systemColor("CanvasText"), systemColor("Canvas")]);
    });

    it.each([40, 16])("at %drem wide, centres the stopped page's heading and Reload in the place below the toolbar, 0.625rem apart and 1.875rem in, with its text at most 26.25rem wide", async width => {
      const opened = await openAsync();
      element().style.width = `${width}rem`;
      opened.emit(WebViewEventKind.Crashed);
      await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page stopped responding"));
      await settle();
      const area = box(".nol-teamrun-page-area");
      const heading = box(".nol-teamrun-page-state-heading");
      const detail = box(".nol-teamrun-page-state-detail");
      const state = getComputedStyle(element().querySelector(".nol-teamrun-page-state") ?? element());

      expect(element().scrollWidth).toBe(element().clientWidth);
      AppearanceFixture.expectPixels(detail.top - heading.bottom, 0.625 * rem());
      AppearanceFixture.expectPixels(box(".nol-teamrun-page-state button").top - detail.bottom, 0.625 * rem());
      AppearanceFixture.expectPixels(Number.parseFloat(state.paddingLeft), 1.875 * rem());
      AppearanceFixture.expectPixels(detail.width, Math.min(26.25 * rem(), area.width - 2 * 1.875 * rem()));
      for (const selector of [".nol-teamrun-page-state-heading", ".nol-teamrun-page-state button"]) {
        const part = box(selector);
        AppearanceFixture.expectPixels(part.left - area.left, area.right - part.right);
        expect([part.left >= area.left, part.right <= area.right]).toEqual([true, true]);
      }
    });
  });

  describe("under forced colours, at 200% zoom, by keyboard and to a screen reader", () => {
    const settle = async (): Promise<void> => {
      await fixture.whenStable();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      await fixture.whenStable();
    };
    const states: readonly { readonly state: string; readonly show: () => Promise<void> }[] = [
      { state: "an edit's bar", show: async () => {
        await openAsync();
        shown = () => PagesWindow.view(2, null, PagesWindow.sol);
        context.emitModule("teamrun.pageUpdated", PagesWindow.page(2, PagesWindow.sol).toJson());
        await Wait.until(() => expect(bars()).toHaveLength(1));
      } },
      { state: "an older version's band", show: async () => {
        shown = version => PagesWindow.view(3, version, PagesWindow.sol);
        await openAsync();
        button("more")?.click();
        await Wait.until(() => expect(menuItem("Versions")).toBeDefined());
        menuItem("Versions")?.click();
        await Wait.until(() => expect(menuItem("v1 · Opus")).toBeDefined());
        menuItem("v1 · Opus")?.click();
        await Wait.until(() => expect([bars().length, AccessibilityFixture.popups(document.body)]).toEqual([1, 0]));
      } },
      { state: "the offline band", show: async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        await openAsync();
        await Wait.until(() => expect(button("offline-reload")).not.toBeNull());
      } },
      { state: "the stopped page", show: async () => {
        const opened = await openAsync();
        opened.emit(WebViewEventKind.Crashed);
        await Wait.until(() => expect(text(".nol-teamrun-page-state-heading")).toBe("This page stopped responding"));
      } }
    ];

    it.each(states)("keeps every control, bar and focus ring of the page document visible under forced colours with $state", async ({ show }) => {
      await show();
      await settle();

      expect(await AccessibilityFixture.expectVisibleForcedAsync(element())).toBeGreaterThan(0);
    });

    it.each(states)("neither cuts, crosses nor loses a control of the page document at 200% zoom with $state", async ({ show }) => {
      await show();
      await AccessibilityFixture.expectFitsZoomedAsync(element(), settle);
    });

    it.each(states)("reaches each control of the page document by keyboard with a ring, and names each for a screen reader, with $state", async ({ show }) => {
      await show();
      await settle();

      expect([await AccessibilityFixture.expectKeyboardAsync(element()) > 0, AccessibilityFixture.expectNamed(element()) > 0]).toEqual([true, true]);
    });
  });
});
