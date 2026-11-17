/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { type Page, PageAuthor } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { PageCardComponent } from "../../../../../src/app/components/pages/page-card/page-card.component";
import { ChatPages } from "../../../../../src/app/services/pages/chat-pages";
import { PagesClock } from "../../../../../src/app/services/pages/pages-clock";
import { AccessibilityFixture } from "../../../../fixtures/accessibility.fixture";
import { EmulatedMediaFixture } from "../../../../fixtures/emulated-media.fixture";
import { FocusRing } from "../../../../fixtures/focus-ring.fixture";
import type { FakeWindowPartContext } from "../../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../../fixtures/sample-data.fixture";
import { SamplePages } from "../../../../fixtures/sample-pages.fixture";
import { Wait } from "../../../../fixtures/wait.fixture";

describe("PageCardComponent", () => {
  const now = Date.parse(SampleData.timestamp);
  const options = SamplePages.page("p1", "Onboarding options");
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<PageCardComponent>;
  let ticks: (() => void)[];
  let clockNow: number;
  let editors: WritableSignal<ReadonlyMap<string, string>>;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (selector: string): string => element().querySelector(selector)?.textContent?.trim() ?? "";
  const open = (): HTMLButtonElement => element().querySelector(".open") as HTMLButtonElement;
  const box = (selector: string): DOMRect => (element().querySelector(selector) as HTMLElement).getBoundingClientRect();
  const create = async (inputs: { readonly pageId?: string; readonly page?: Page | null; readonly editor?: string } = {}, pages: readonly Page[] = [options]):
    Promise<void> => {
    context = SamplePages.context(pages);
    const clock = { now: (): number => clockNow, every: (_: number, tick: () => void): (() => void) => {
      ticks.push(tick);
      return () => undefined;
    } };
    const editing = new Map<string, string>();
    if (!Object.isUndefined(inputs.editor))
      editing.set(inputs.pageId ?? options.id, inputs.editor);
    editors = signal(editing);
    ChatPages.provide(context, signal(SamplePages.chatId), () => () => undefined, editors);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, { provide: PagesClock, useValue: clock }] });
    fixture = TestBed.createComponent(PageCardComponent);
    fixture.componentRef.setInput("chatId", SamplePages.chatId);
    fixture.componentRef.setInput("pageId", inputs.pageId ?? options.id);
    fixture.componentRef.setInput("page", Object.isUndefined(inputs.page) ? options : inputs.page);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatPages.of(context).isLoaded(SamplePages.chatId)).toBe(true));
    await fixture.whenStable();
  };

  beforeEach(() => {
    ticks = [];
    clockNow = now;
  });

  afterEach(() => {
    fixture.destroy();
    ChatPages.release(context);
  });

  it("shows a new page's title, its version, maker and age, and Open as the kit's plain text button, on its maker's card too, that opens its document", async () => {
    await create();

    const variant = [open().classList.contains("nol-button-text"), open().classList.contains("nol-button-primary")];
    open().click();

    expect([text(".title"), text(".meta-text"), text(".open"), open().getAttribute("aria-label"), variant])
      .toEqual(["Onboarding options", "Page · v1 · Made by Opus · just now", "Open", "Open Onboarding options", [true, false]]);
    expect(context.openedDocuments.map(t => [t.name, t.instance, t.title])).toEqual([["teamrun.page", "p1", "Onboarding options"]]);
  });

  it("keeps the plain text Open whoever edited the page last, its maker or another teammate", async () => {
    await create({}, [SamplePages.page("p1", "Onboarding options", 2, 0, SamplePages.sol)]);

    const edited = [open().classList.contains("nol-button-text"), open().classList.contains("nol-button-primary"), text(".meta-text")];
    context.emitModule(SamplePages.updated, SamplePages.page("p1", "Onboarding options", 3, 0, SamplePages.opus).toJson());
    await fixture.whenStable();

    expect([edited, [open().classList.contains("nol-button-text"), open().classList.contains("nol-button-primary")]])
      .toEqual([[true, false, "v2 · Made by Opus · Edited by Sol · just now"], [true, false]]);
  });

  it("shows no Open while the page is open in a tab, keeping who is editing it with its spinner, and shows Open again once the tab closes", async () => {
    await create({ editor: "Sol" });

    open().click();
    await fixture.whenStable();
    const opened = [element().querySelectorAll("button").length, text(".meta-text"), element().querySelectorAll("nol-spinner").length];
    for (const listener of context.documentClosedListeners)
      listener("p1");
    await fixture.whenStable();

    expect([opened, element().querySelectorAll("button").length, open().classList.contains("nol-button-text")]).toEqual([[0, "Sol is editing · v1", 1], 1, true]);
  });

  it("names the card by its title and meta, as a group", async () => {
    await create();

    expect([element().getAttribute("role"), element().getAttribute("aria-label")]).toEqual(["group", "Onboarding options, Page · v1 · Made by Opus · just now"]);
  });

  it("ages its meta as minutes pass, in minutes, then hours, then days", async () => {
    await create();
    const ages: string[] = [];

    for (const minutes of [5, 3 * 60, 2 * 24 * 60]) {
      clockNow = now + minutes * 60_000;
      for (const tick of ticks)
        tick();
      await fixture.whenStable();
      ages.push(text(".meta-text"));
    }

    expect(ages).toEqual(["Page · v1 · Made by Opus · 5 min ago", "Page · v1 · Made by Opus · 3 h ago", "Page · v1 · Made by Opus · 2 d ago"]);
  });

  it("names who made the page and who edited it last once it has a later version, and an older card follows the latest", async () => {
    await create({}, [SamplePages.page("p1", "Onboarding options", 2, 0, SamplePages.sol)]);

    expect(text(".meta-text")).toBe("v2 · Made by Opus · Edited by Sol · just now");
    context.emitModule(SamplePages.updated, SamplePages.page("p1", "Onboarding options, phone", 3, 0, SamplePages.opus).toJson());
    await fixture.whenStable();

    expect([text(".title"), text(".meta-text")]).toEqual(["Onboarding options, phone", "v3 · Made by Opus · Edited by Opus · just now"]);
  });

  it("shows who is editing the page on every card for it, with a spinner, while the window names an editor", async () => {
    await create({ editor: "Sol" });
    const other = TestBed.createComponent(PageCardComponent);
    other.componentRef.setInput("chatId", SamplePages.chatId);
    other.componentRef.setInput("pageId", "p1");
    other.autoDetectChanges();
    await other.whenStable();

    expect([text(".meta-text"), (other.nativeElement as HTMLElement).querySelector(".meta-text")?.textContent?.trim(), element().querySelectorAll("nol-spinner").length])
      .toEqual(["Sol is editing · v1", "Sol is editing · v1", 1]);
    expect(element().getAttribute("aria-label")).toBe("Onboarding options, Sol is editing · v1");

    editors.set(new Map());
    await fixture.whenStable();
    await other.whenStable();
    expect((other.nativeElement as HTMLElement).querySelector(".meta-text")?.textContent?.trim()).toBe("Page · v1 · Made by Opus · just now");
    other.destroy();
  });

  it("finds a running edit's page in the chat's list by its id, and shows nothing until the list has it", async () => {
    await create({ pageId: "p9", page: null, editor: "Sol" });

    expect([element().childElementCount, getComputedStyle(element()).display]).toEqual([0, "none"]);
    context.emitModule(SamplePages.shown, SamplePages.page("p9", "Launch checklist").toJson());
    await fixture.whenStable();

    expect([text(".title"), text(".meta-text")]).toEqual(["Launch checklist", "Sol is editing · v1"]);
  });

  describe("stepOf", () => {
    const shown = SamplePages.page("p1", "Onboarding options");

    it.each([
      { name: "Codex's own tool name", tool: "teamrun_show_page" },
      { name: "Claude's server-named tool", tool: "mcp__teamrun__teamrun_show_page" },
      { name: "a dotted tool name", tool: "teamrun.teamrun_show_page" }
    ])("reads the page a show step's result gives, by $name", ({ tool }) => {
      expect(PageCardComponent.stepOf({ tool }, "Show a page", JSON.stringify(shown.toJson()))?.page?.toJson()).toEqual(shown.toJson());
    });

    it("reads the page from an MCP content list, and from a step that keeps its result under its first line", () => {
      const content = JSON.stringify([{ type: "text", text: JSON.stringify(shown.toJson()) }]);

      expect([PageCardComponent.stepOf({ tool: "mcp__teamrun__teamrun_edit_page" }, "", content)?.pageId,
        PageCardComponent.stepOf({ tool: "teamrun_show_page", status: "completed" }, `MCP tool teamrun/teamrun_show_page\n${JSON.stringify(shown.toJson())}`, null)?.pageId])
        .toEqual(["p1", "p1"]);
    });

    it("takes a running edit's page id from its input or its arguments, with no page yet", () => {
      expect([PageCardComponent.stepOf({ tool: "teamrun_edit_page", input: { page_id: "p4" } }, "", null),
        PageCardComponent.stepOf({ tool: "teamrun_edit_page", arguments: { page_id: "p5" } }, "MCP tool teamrun/teamrun_edit_page", null)])
        .toEqual([{ pageId: "p4", page: null }, { pageId: "p5", page: null }]);
    });

    it.each([
      { name: "another tool", payload: { tool: "teamrun_list_pages", input: { page_id: "p1" } }, result: JSON.stringify(shown.toJson()) },
      { name: "a tool named like one", payload: { tool: "teamrun_show_pages" }, result: JSON.stringify(shown.toJson()) },
      { name: "no payload", payload: null, result: JSON.stringify(shown.toJson()) },
      { name: "a failed show", payload: { tool: "teamrun_show_page", input: { page_id: "p1" } }, result: "The page is too large." },
      { name: "an edit with no page id", payload: { tool: "teamrun_edit_page", input: { page_id: " " } }, result: null },
      { name: "a result that isn't a page", payload: { tool: "teamrun_show_page" }, result: "{\"id\":\"p1\"}" }
    ])("finds no card in $name", ({ payload, result }) => {
      expect(PageCardComponent.stepOf(payload, "", result)).toBeNull();
    });
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

    it("moves the focus to the card, ringed one border inside its edge, when Enter presses its focused Open", async () => {
      await create();
      open().focus();

      await userEvent.keyboard("{Enter}");
      await fixture.whenStable();

      const unit = FocusRing.borderWidthOf(element());
      const ring = new FocusRing(element());
      expect([document.activeElement === element(), element().querySelector(".open"), ring.style, ring.width, ring.color, ring.offset])
        .toEqual([true, null, "solid", (forcedColors === "active" ? 2 : 1) * unit,
          FocusRing.colorOf(element(), forcedColors === "active" ? "Highlight" : "var(--nol-accent)"), -unit]);
      expect(context.openedDocuments.map(t => t.instance)).toEqual(["p1"]);
    });

    it("moves the focus to the card with no ring and keeps its border when the pointer clicks Open", async () => {
      await create();
      const border = getComputedStyle(element()).borderTopColor;

      try {
        await userEvent.click(open());
        await fixture.whenStable();

        const style = getComputedStyle(element());
        expect([document.activeElement === element(), element().querySelector(".open"), style.outlineStyle, style.borderTopColor])
          .toEqual([true, null, "none", border]);
        expect(context.openedDocuments.map(t => t.instance)).toEqual(["p1"]);
      }
      finally {
        await userEvent.unhover(element());
      }
    });

    it("draws Open with no fill or border, keeps its border while the page is open in a tab, with no Open, and runs its text to the card's end inset, then shows Open again once the tab closes",
      async () => {
        await create();
        element().style.width = "20rem";
        await fixture.whenStable();
        const border = (): string => getComputedStyle(element()).borderTopColor;
        const closed = border();
        const inset = AppearanceFixture.measureLook("space-3") + AppearanceFixture.measureLook("border-width");
        const button = getComputedStyle(open());
        const look = [button.borderTopWidth, button.backgroundColor];

        open().click();
        await fixture.whenStable();
        const opened = [border(), element().querySelector(".open")];
        AppearanceFixture.expectPixels(element().getBoundingClientRect().right - box(".text").right, inset);
        for (const listener of context.documentClosedListeners)
          listener("p1");
        await fixture.whenStable();

        expect([opened, border(), open().textContent?.trim()]).toEqual([[closed, null], closed, "Open"]);
        if (forcedColors === "none")
          expect([closed === AppearanceFixture.readColor(FixtureTheme.theme, mode, "card-border"), closed === AppearanceFixture.readColor(FixtureTheme.theme, mode, "accent"), look])
            .toEqual([true, false, ["0px", "rgba(0, 0, 0, 0)"]]);
      });

    it("in a 20rem reply, insets its icon, text and Open by the same space, centers them, and cuts a long title and meta with an ellipsis", async () => {
      await create({}, [SamplePages.page("p1", `Onboarding options ${"a".repeat(80)}`, 2, 0, new PageAuthor("t3", `Sol ${"b".repeat(80)}`))]);
      fixture.componentRef.setInput("page", null);
      element().style.width = "20rem";
      await fixture.whenStable();

      const host = element().getBoundingClientRect();
      const inset = AppearanceFixture.measureLook("space-3");
      const border = AppearanceFixture.measureLook("border-width");
      const title = element().querySelector(".title") as HTMLElement;

      AppearanceFixture.expectPixels(host.width, AppearanceFixture.toPixels(20));
      AppearanceFixture.expectPixels(box(".glyph").left - host.left, inset + border);
      AppearanceFixture.expectPixels(host.right - box(".open").right, inset + border);
      AppearanceFixture.expectPixels(box(".text").left - box(".glyph").right, inset);
      AppearanceFixture.expectPixels(box(".open").left - box(".text").right, inset);
      for (const part of [".glyph", ".text", ".open"])
        AppearanceFixture.expectPixels(box(part).top + box(part).height / 2, host.top + host.height / 2);
      AppearanceFixture.expectTruncates(title);
      AppearanceFixture.expectTruncates(element().querySelector(".meta-text") as HTMLElement);
    });

    it("in a 40rem reply, stops at 26.25rem, pads its 2.5rem icon tile 0.625rem by 0.75rem inside its border, and lines its text 18 px apart", async () => {
      await create();
      element().style.width = "40rem";
      await fixture.whenStable();

      const host = element().getBoundingClientRect();
      const border = AppearanceFixture.measureLook("border-width");

      AppearanceFixture.expectPixels(host.width, AppearanceFixture.toPixels(26.25));
      AppearanceFixture.expectPixels(host.height, AppearanceFixture.toPixels(2.5 + 2 * 0.625) + 2 * border);
      AppearanceFixture.expectPixels(box(".glyph").left - host.left, AppearanceFixture.measureLook("space-3") + border);
      AppearanceFixture.expectPixels(box(".glyph").top - host.top, AppearanceFixture.toPixels(0.625) + border);
      AppearanceFixture.expectPixels(host.bottom - box(".glyph").bottom, AppearanceFixture.toPixels(0.625) + border);
      expect([box(".glyph").width, box(".glyph").height]).toEqual([AppearanceFixture.toPixels(2.5), AppearanceFixture.toPixels(2.5)]);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(element().querySelector(".glyph") as HTMLElement).fontSize), AppearanceFixture.toPixels(1.375));
      AppearanceFixture.expectPixels(box(".meta").top - box(".title").top, AppearanceFixture.measureLook("line-panel"));
    });

    it("keeps its controls reachable and ringed, and fits a 200% zoom", async () => {
      await create();

      expect(await AccessibilityFixture.expectKeyboardAsync(element())).toBe(1);
      await AccessibilityFixture.expectFitsZoomedAsync(element(), () => fixture.whenStable());
    });
  });

  it("names each control for a screen reader, and marks the card current while its page is open in a tab", async () => {
    await create();
    const named = AccessibilityFixture.expectNamed(element());
    const before = element().getAttribute("aria-current");

    open().click();
    await fixture.whenStable();
    const opened = element().getAttribute("aria-current");
    for (const listener of context.documentClosedListeners)
      listener("p1");
    await fixture.whenStable();

    expect([named > 0, before, opened, element().getAttribute("aria-current")]).toEqual([true, null, "true", null]);
  });

  it("keeps its border, its Open and its focus ring visible under forced colours, and keeps the border in the text colour, never the highlight, while the page is open",
    async () => {
      await create();

      expect(await AccessibilityFixture.expectVisibleForcedAsync(element())).toBe(1);
      const { closed, opened, canvasText, highlight } = await AccessibilityFixture.forcedAsync(async () => {
        const resolve = (color: string): string => {
          const probe = document.body.appendChild(document.createElement("span"));
          probe.style.cssText = `forced-color-adjust: none; color: ${color}`;
          const resolved = getComputedStyle(probe).color;
          probe.remove();
          return resolved;
        };
        const read = (): readonly [string, string, number] => {
          const style = getComputedStyle(element());
          return [style.borderTopColor, style.borderTopWidth, element().getBoundingClientRect().height];
        };
        const before = read();
        open().click();
        await fixture.whenStable();
        return { closed: before, opened: read(), canvasText: resolve("CanvasText"), highlight: resolve("Highlight") };
      });

      expect([closed[0], opened[0], opened[1], opened[2]]).toEqual([canvasText, canvasText, closed[1], closed[2]]);
      expect(canvasText).not.toBe(highlight);
    });

  describe.each([ThemeMode.Light, ThemeMode.Dark])("in the fixture theme's %s mode", mode => {
    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    it("fills the card with the raised colour, its icon tile with the selected one under a text-coloured icon, and sets its title in the strong colour at the emphasis weight", async () => {
      await create();
      const glyph = getComputedStyle(element().querySelector(".glyph") as HTMLElement);
      const title = getComputedStyle(element().querySelector(".title") as HTMLElement);

      expect([getComputedStyle(element()).backgroundColor, glyph.backgroundColor, glyph.color, title.color, title.fontWeight]).toEqual([
        AppearanceFixture.readColor(FixtureTheme.theme, mode, "raised"), AppearanceFixture.readColor(FixtureTheme.theme, mode, "selected"),
        AppearanceFixture.readColor(FixtureTheme.theme, mode, "text"), AppearanceFixture.readColor(FixtureTheme.theme, mode, "text-strong"), "500"]);
    });
  });
});
