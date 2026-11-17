/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { userEvent } from "vitest/browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { ViewBadge, WindowPartTokens } from "@noldova/desktop.window";
import { type Page, PageRequest } from "@noldova/teamrun.protocol";
import { ClipboardWriter, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { PagesViewComponent } from "../../../../../src/app/components/pages/pages-view/pages-view.component";
import { ChatPages } from "../../../../../src/app/services/pages/chat-pages";
import { PagesClock } from "../../../../../src/app/services/pages/pages-clock";
import { AccessibilityFixture } from "../../../../fixtures/accessibility.fixture";
import { EmulatedMediaFixture } from "../../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../../fixtures/sample-data.fixture";
import { SamplePages } from "../../../../fixtures/sample-pages.fixture";
import { Wait } from "../../../../fixtures/wait.fixture";

describe("PagesViewComponent", () => {
  const now = Date.parse(SampleData.timestamp);
  const checklist = SamplePages.page("p1", "Launch checklist", 1, 0, SamplePages.sol);
  const options = SamplePages.page("p2", "Onboarding options", 3, 2, SamplePages.sol);
  const email = SamplePages.page("p3", "Welcome email, three tones", 2, 60);
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<PagesViewComponent>;
  let chat: WritableSignal<string | null>;
  let release: () => void;
  let copied: string[];

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string): string[] => [...element().querySelectorAll(selector)].map(t => t.textContent?.trim() ?? "");
  const rows = (): HTMLButtonElement[] => [...element().querySelectorAll<HTMLButtonElement>(".row-open")];
  const row = (id: string): HTMLButtonElement => element().querySelector(`[data-nol-teamrun-page="${id}"]`) as HTMLButtonElement;
  const menuLabelOf = (item: Element): string => item.querySelector(".nol-menu-item-label")?.textContent?.trim() ?? "";
  const menuItems = (): string[] => [...document.querySelectorAll("[role='menuitem']")].map(t => menuLabelOf(t));
  const menuItem = (label: string): HTMLElement => {
    const item = [...document.querySelectorAll<HTMLElement>("[role='menuitem']")].find(t => menuLabelOf(t) === label);
    if (Object.isUndefined(item))
      throw new Error(`The menu has no item ${label}.`);
    return item;
  };
  const create = async (list: readonly Page[] | (() => JsonValue | Promise<JsonValue>) = [checklist, email, options], chatId: string | null = SamplePages.chatId): Promise<void> => {
    context = SamplePages.context(list).answerModule(SamplePages.open, t => SamplePages.view(PageRequest.fromJson(t).pageId === "p1" ? checklist : options).toJson())
      .answerModule(SamplePages.read, () => "<p>checklist</p>");
    chat = signal(chatId);
    copied = [];
    release = PagesViewComponent.provide(context, chat, () => () => undefined, signal(new Map()));
    TestBed.configureTestingModule({
      providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: PagesClock, useValue: { now: (): number => now, every: (): (() => void) => () => undefined } },
        { provide: ClipboardWriter, useValue: { writeTextAsync: (text: string): Promise<boolean> => {
          copied.push(text);
          return Promise.resolve(true);
        } } }]
    });
    fixture = TestBed.createComponent(PagesViewComponent);
    fixture.autoDetectChanges();
    if (!Object.isNull(chatId))
      await Wait.until(() => expect(ChatPages.of(context).isLoaded(chatId)).toBe(true));
    await fixture.whenStable();
  };

  afterEach(() => {
    fixture.destroy();
    release();
  });

  it("lists the shown chat's pages newest change first, with each one's version, maker, last editor and age, and their count on the view's tab", async () => {
    await create();

    expect([context.badges.get("teamrun.pages"), texts(".title"), texts(".meta")]).toEqual([new ViewBadge(3, "3 pages"),
      ["Launch checklist", "Onboarding options", "Welcome email, three tones"],
      ["v1 · Made by Opus · just now", "v3 · Made by Opus · Edited by Sol · 2 min ago", "v2 · Made by Opus · Edited by Opus · 1 h ago"]]);
    expect(rows().map(t => t.getAttribute("aria-label"))).toEqual(["Launch checklist, v1 · Made by Opus · just now",
      "Onboarding options, v3 · Made by Opus · Edited by Sol · 2 min ago", "Welcome email, three tones, v2 · Made by Opus · Edited by Opus · 1 h ago"]);
  });

  it("adds a page a teammate shows, and moves an edited one first", async () => {
    await create();

    context.emitModule(SamplePages.updated, SamplePages.page("p3", "Welcome email, three tones", 3, -1, SamplePages.sol).toJson());
    context.emitModule(SamplePages.shown, SamplePages.page("p4", "Pricing table", 1, -2).toJson());
    await fixture.whenStable();

    expect(texts(".title")).toEqual(["Pricing table", "Welcome email, three tones", "Launch checklist", "Onboarding options"]);
  });

  it("follows the chat the window shows", async () => {
    await create();
    context.answerModule(SamplePages.list, () => [SamplePages.page("p9", "Other chat's page", 1, 0, SamplePages.opus, "c2").toJson()]);

    chat.set("c2");
    await Wait.until(() => expect(texts(".title")).toEqual(["Other chat's page"]));
  });

  it("opens a page on a row's click, and marks the open page's row current, with no row selected", async () => {
    await create();

    rows()[1]?.click();
    await fixture.whenStable();

    expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([["teamrun.page", "p2", "Onboarding options"]]);
    expect(rows().map(t => [t.getAttribute("aria-current"), t.getAttribute("aria-selected")])).toEqual([[null, null], ["true", null], [null, null]]);
  });

  it("is one tab stop whose arrows, Home and End move along the rows, and whose Enter opens the row", async () => {
    await create();
    const stops = (): string[] => rows().filter(t => t.tabIndex === 0).map(t => t.dataset["nolTeamrunPage"] ?? "");

    const first = stops();
    rows()[0]?.focus();
    await userEvent.keyboard("{ArrowDown}");
    const second = [document.activeElement === row("p2"), stops()];
    await userEvent.keyboard("{End}{ArrowDown}");
    const last = [document.activeElement === row("p3"), stops()];
    await userEvent.keyboard("{Home}{ArrowUp}");
    const home = document.activeElement === row("p1");
    await userEvent.keyboard("{Enter}");

    expect([first, second, last, home]).toEqual([["p1"], [true, ["p2"]], [true, ["p3"]], true]);
    expect(context.openedDocuments.map(t => t.instance)).toEqual(["p1"]);
  });

  it("opens a row's menu with Shift+F10, and its items open the page, open it in the system browser, save it, and copy its file's path", async () => {
    await create();
    row("p1").focus();

    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await Wait.until(() => expect(menuItems()).toEqual(["Open", "Open in the system browser", "Save as file…", "Copy the file's path"]));
    menuItem("Open in the system browser").click();
    await Wait.until(() => expect(context.links).toEqual(["http://127.0.0.1:4100/pages/p1"]));
    row("p1").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await Wait.until(() => expect(menuItems()).toHaveLength(4));
    menuItem("Save as file…").click();
    await Wait.until(() => expect(context.savedFiles.map(t => [t.name, new TextDecoder().decode(t.bytes)])).toEqual([["p1.html", "<p>checklist</p>"]]));
    row("p1").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await Wait.until(() => expect(menuItems()).toHaveLength(4));
    menuItem("Open").click();
    await Wait.until(() => expect(context.openedDocuments.map(t => t.instance)).toEqual(["p1"]));
    row("p1").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await Wait.until(() => expect(menuItems()).toHaveLength(4));
    menuItem("Copy the file's path").click();

    await Wait.until(() => expect(copied).toEqual([SamplePages.view(checklist).file]));
  });

  it("says when a row's action fails, as an alert", async () => {
    await create();
    context.answerModule(SamplePages.open, () => {
      throw new Error("down");
    });

    row("p1").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await Wait.until(() => expect(menuItems()).toHaveLength(4));
    menuItem("Open in the system browser").click();

    await Wait.until(() => expect(texts(".error[role='alert']")).toEqual(["TeamRun couldn't open the page in the system browser."]));
  });

  it("shows the empty state with an example ask when the chat has no pages", async () => {
    await create([]);

    expect([texts(".empty-title"), texts(".empty-text"), rows().length]).toEqual([["No pages yet"],
      ["When a teammate shows a page it wrote, it's listed here. Ask one, for example \"@Opus show the comparison as a page\"."], 0]);
  });

  it("shows nothing until the chat's pages are listed", async () => {
    await create(() => new Promise<JsonValue>(() => undefined), null);
    chat.set(SamplePages.chatId);
    await fixture.whenStable();

    expect([texts(".empty-title"), rows().length, texts(".error")]).toEqual([[], 0, []]);
  });

  it("asks for a chat when the window shows none", async () => {
    await create([], null);

    expect(texts(".no-chat")).toEqual(["Open a chat to see its pages."]);
  });

  it("says when the chat's pages can't be listed, and lists them on Try again", async () => {
    let fails = true;
    await create(() => {
      if (fails)
        throw new Error("down");
      return [checklist.toJson()];
    });

    const error = texts(".load-error[role='alert'] .error-text");
    fails = false;
    (element().querySelector(".retry") as HTMLButtonElement).click();

    await Wait.until(() => expect(texts(".title")).toEqual(["Launch checklist"]));
    expect(error).toEqual(["TeamRun couldn't list this chat's pages."]);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("in a 16rem panel, insets the rows 0.375rem from its sides and stacks them with no gap, pads them 0.5rem by 0.75rem with two 18 px lines, tops their icons beside the text 0.625rem away, and cuts long titles with an ellipsis",
      async () => {
        await create([SamplePages.page("p1", `Launch checklist ${"a".repeat(80)}`), options]);
        element().style.width = "16rem";
        await fixture.whenStable();

        const box = (view: Element | null): DOMRect => (view as HTMLElement).getBoundingClientRect();
        const host = box(element());
        const inline = AppearanceFixture.measureLook("space-3") / 2;
        const start = host.left + inline + AppearanceFixture.measureLook("space-3");

        AppearanceFixture.expectPixels(box(element().querySelector(".rows")).top, host.top + AppearanceFixture.measureLook("view-padding-block"));
        for (const view of rows()) {
          const glyph = box(view.querySelector(".glyph"));
          AppearanceFixture.expectPixels(glyph.left, start);
          AppearanceFixture.expectPixels(glyph.top, box(view).top + AppearanceFixture.measureLook("space-2") + AppearanceFixture.toPixels(0.0625));
          AppearanceFixture.expectPixels(box(view.querySelector(".text")).left - glyph.right, AppearanceFixture.toPixels(0.625));
          AppearanceFixture.expectPixels(box(view.querySelector(".text")).top, box(view).top + AppearanceFixture.measureLook("space-2"));
        }
        for (const view of rows())
          AppearanceFixture.expectPixels(box(view).height, 2 * AppearanceFixture.measureLook("space-2") + 2 * AppearanceFixture.measureLook("line-panel"));
        AppearanceFixture.expectPixels(box(element().querySelector(".row")).left, host.left + inline);
        AppearanceFixture.expectPixels(box(rows()[1] ?? null).top - box(rows()[0] ?? null).bottom, 0);
        AppearanceFixture.expectTruncates(element().querySelector(".title") as HTMLElement);
        AppearanceFixture.expectPixels(box(element().querySelector(".rows")).right, host.right - inline);
      });

    it("centres the empty state in the view's height, with a 2.25rem icon, a title at the title size and text at the panel's, on 18 px lines and 0.5rem apart", async () => {
      await create([]);
      element().style.height = "30rem";
      await fixture.whenStable();

      const box = (selector: string): DOMRect => (element().querySelector(selector) as HTMLElement).getBoundingClientRect();
      const host = element().getBoundingClientRect();
      const empty = box(".empty");
      const title = getComputedStyle(element().querySelector(".empty-title") as HTMLElement);

      AppearanceFixture.expectPixels(empty.top + empty.height / 2, host.top + host.height / 2);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(element().querySelector(".empty-glyph") as HTMLElement).fontSize), AppearanceFixture.toPixels(2.25));
      const text = getComputedStyle(element().querySelector(".empty-text") as HTMLElement);
      AppearanceFixture.expectPixels(Number.parseFloat(title.fontSize), AppearanceFixture.measureLook("text-title"));
      AppearanceFixture.expectPixels(Number.parseFloat(title.lineHeight), AppearanceFixture.measureLook("line-panel"));
      AppearanceFixture.expectPixels(Number.parseFloat(text.fontSize), AppearanceFixture.measureLook("text-panel"));
      AppearanceFixture.expectPixels(Number.parseFloat(text.lineHeight), AppearanceFixture.measureLook("line-panel"));
      expect(title.fontWeight).toBe("500");
      AppearanceFixture.expectPixels(box(".empty-title").top - box(".empty-glyph").bottom, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(box(".empty-text").top - box(".empty-title").bottom, AppearanceFixture.measureLook("space-2"));
    });

    it("keeps one tab stop for the rows, ringed, and fits a 200% zoom", async () => {
      await create();

      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBe(1);
      await AccessibilityFixture.expectFitsZoomedAsync(element(), () => fixture.whenStable());
    });

    it("keeps the empty state readable and fitting at a 200% zoom", async () => {
      await create([]);

      await AccessibilityFixture.expectFitsZoomedAsync(element(), () => fixture.whenStable());
      expect(texts(".empty-title")).toEqual(["No pages yet"]);
    });
  });

  describe.each([ThemeMode.Light, ThemeMode.Dark])("in the fixture theme's %s mode", mode => {
    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    it("fills the open page's row with the selected colour, draws the row icons in the text colour and the titles in the strong one", async () => {
      await create();

      rows()[1]?.click();
      await fixture.whenStable();

      const fills = [...element().querySelectorAll(".row")].map(t => getComputedStyle(t).backgroundColor);
      expect([fills[1], getComputedStyle(rows()[0]?.querySelector(".glyph") as HTMLElement).color, getComputedStyle(rows()[0]?.querySelector(".title") as HTMLElement).color])
        .toEqual([AppearanceFixture.readColor(FixtureTheme.theme, mode, "selected"), AppearanceFixture.readColor(FixtureTheme.theme, mode, "text"),
          AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-strong")]);
    });
  });

  it("keeps a row's More shown and pressed while the menu it opened is open, though focus moves into the menu, and lets it go once the menu closes", async () => {
    await create();
    const more = element().querySelector(".row-more") as HTMLButtonElement;

    more.click();
    await Wait.until(() => expect(menuItems()).toHaveLength(4));
    menuItem("Open").focus();
    await fixture.whenStable();
    const opened = [more.getAttribute("aria-pressed"), getComputedStyle(more).opacity, element().querySelectorAll(".row-more[aria-pressed='true']").length];
    await userEvent.keyboard("{Escape}");
    await Wait.until(() => expect(menuItems()).toEqual([]));
    await fixture.whenStable();

    expect([opened, more.getAttribute("aria-pressed")]).toEqual([["true", "1", 1], "false"]);
  });

  it("presses the row's More while the menu Shift+F10 opened from the row is open, and lets it go once that menu closes", async () => {
    await create();
    const more = (id: string): string | null => row(id).closest(".row")?.querySelector(".row-more")?.getAttribute("aria-pressed") ?? null;

    row("p2").focus();
    await userEvent.keyboard("{Shift>}{F10}{/Shift}");
    await Wait.until(() => expect(menuItems()).toHaveLength(4));
    await fixture.whenStable();
    const opened = [more("p1"), more("p2"), more("p3")];
    await userEvent.keyboard("{Escape}");
    await Wait.until(() => expect(menuItems()).toEqual([]));
    await fixture.whenStable();

    expect([opened, more("p2")]).toEqual([["false", "true", "false"], "false"]);
  });
});
