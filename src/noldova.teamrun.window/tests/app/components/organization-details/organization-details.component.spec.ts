/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { FocusMonitor } from "@angular/cdk/a11y";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  Conversation, ConversationListParams, Department, EventName, Message, MessageAuthor, MessageStatus, MethodName, OrganizationChat, OrganizationParent, PlanUsage,
  PlanWindow, PlanWindowName, TeammateLastReply, TeammatePlacement
} from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { page, userEvent } from "vitest/browser";

import { OrganizationViewComponent } from "../../../../src/app/components/organization-view/organization-view.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { Resources } from "../../../../src/resources";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { DetailFact } from "../../../fixtures/detail-fact.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { PartReadError } from "../../../fixtures/part-read-error.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { ThemeCase } from "../../../fixtures/theme-case.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationDetailsComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationViewComponent>;
  let clock: FakeClock;

  const organization = SampleData.organizationOf([
    new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u"),
    new Department("build", "Build", "department", OrganizationParent.person, null, 1, "c", "u"),
    new Department("ui", "UI", "department", OrganizationParent.department("design"), "reviewer", 0, "c", "u"),
    new Department("tools", "Tools", "department", OrganizationParent.department("ui"), null, 0, "c", "u")
  ], [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("tools"), 0), new TeammatePlacement("offline", OrganizationParent.department("build"), 0),
    new TeammatePlacement("reviewer", OrganizationParent.department("ui"), 0)]);
  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new PartReadError("The fixture has no element.");
    return native;
  };
  const all = (selector: string, root: ParentNode = element()): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];
  const one = (selector: string, root: ParentNode = element()): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new PartReadError(`Nothing matches ${selector}.`);
    return found;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => all(selector, root).map(t => t.textContent?.replace(/\s+/gu, " ").trim() ?? "");
  const card = (name: string): HTMLElement => {
    const found = all("nol-teamrun-organization-card").find(t => t.querySelector(".name")?.textContent?.trim() === name);
    if (Object.isUndefined(found))
      throw new PartReadError(`No card is named ${name}.`);
    return found;
  };
  const popovers = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-details .nol-popover")];
  const popover = (): HTMLElement => {
    const open = popovers();
    const found = open.at(0);
    if (Object.isUndefined(found) || open.length > 1)
      throw new PartReadError(`${open.length} details are open.`);
    return found;
  };
  const facts = (): DetailFact[] => all("dt", popover()).map(t => new DetailFact(t.textContent?.trim() ?? "",
    t.nextElementSibling instanceof HTMLElement ? t.nextElementSibling.innerText.replace(/\s+/gu, " ").trim() : ""));
  const fact = (term: string): string | undefined => facts().find(t => t.term === term)?.value;
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const reply = (id: string, chatId: string, started: string, status: MessageStatus): Message =>
    new Message(id, chatId, 1, MessageAuthor.Provider, null, status, [], SampleData.provenance, started, started,
      status === MessageStatus.Running ? null : started, [], "alice", "alice");
  const focus = async (name: string): Promise<HTMLElement> => {
    TestBed.inject(FocusMonitor).focusVia(card(name), "keyboard");
    await settle();
    await Wait.until(() => expect(popovers()).toHaveLength(1));
    return popover();
  };
  const blur = async (): Promise<void> => {
    TestBed.inject(FocusMonitor).focusVia(one(".top .cards-show"), "keyboard");
    await Wait.until(() => expect(popovers()).toEqual([]));
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined): Promise<void> => {
    clock = new FakeClock(Date.parse("2026-09-10T08:05:00.000Z"));
    TestBed.overrideProvider(ClockService, { useValue: clock });
    context = SampleData.createContext()
      .answer(MethodName.OrganizationList, () => [organization.toJson()])
      .answer(MethodName.OrganizationLayoutSave, () => null);
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(OrganizationViewComponent);
    element().style.width = "100rem";
    element().style.height = "70rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await userEvent.hover(one(".top"));
    await settle();
  };

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  beforeEach(async () => {
    await page.viewport(1600, 1200);
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
  });

  afterEach(async () => {
    await page.viewport(viewportWidth, viewportHeight);
    AppearanceFixture.reset();
    TeammateStatusStoreService.release(context);
    OrganizationLayoutService.release(context);
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("opens a card's details when the card takes the keyboard focus: its status, whom it reports to, its model, usage and last words, and what runs now", async () => {
    await create(context => context
      .answer(MethodName.PlanUsageList, () => [new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 40, null)], SampleData.timestamp).toJson()])
      .answer(MethodName.TeammateLastReplyList, () => [new TeammateLastReply("alice", "c1", "r0", "The header is done.", SampleData.timestamp).toJson()]));

    const details = await focus("Alice");

    expect([details.getAttribute("role"), details.getAttribute("aria-label"), card("Alice").getAttribute("aria-haspopup"),
      card("Alice").getAttribute("aria-expanded"), card("Alice").getAttribute("role"), card("Alice").getAttribute("aria-label"), document.activeElement === card("Alice")])
      .toEqual(["dialog", "Alice's details", "dialog", "true", "group", "Alice", true]);
    expect([texts(".head .name", details), texts(".head .place", details), facts(), texts(".now-label", details), texts(".act", details)]).toEqual([
      ["Alice"], ["Review · Design"],
      [new DetailFact("Status", "Idle"), new DetailFact("Reports to", "You"), new DetailFact("Model", "gpt-5 · high"), new DetailFact("Usage", "40% used · 5h"),
        new DetailFact("Works in", "Its own folder"), new DetailFact("Last said", "The header is done. 5 min ago")],
      ["Now"], ["Nothing running"]]);
  });

  it("names as whom a teammate reports to the nearest leader above it, skipping departments without one, and you when none is", async () => {
    await create();
    const reportsTo = async (name: string): Promise<string[]> => {
      await focus(name);
      const shown = [texts(".head .place", popover()).at(0) ?? "", fact("Reports to") ?? ""];
      await blur();
      return shown;
    };

    expect([await reportsTo("Alice"), await reportsTo("Code Reviewer"), await reportsTo("Bob"), await reportsTo("Offline")])
      .toEqual([["Review · Design", "You"], ["UI", "Alice"], ["Tools", "Code Reviewer"], ["Build", "You"]]);
  });

  it("says a teammate in no department, a card under you in the tree, reports to you", async () => {
    await create(context => context.answer(MethodName.OrganizationList, () => [SampleData.organizationOf(organization.departments,
      organization.placements.map(t => t.teammateId === "offline" ? new TeammatePlacement("offline", OrganizationParent.person, 0) : t)).toJson()]));

    await focus("Offline");

    expect([texts(".head .place", popover()), fact("Reports to")]).toEqual([["Reports to you"], "You"]);
  });

  it("names the teammate a card under another teammate outside any department reports to, without saying it reports to you", async () => {
    const placed = (t: TeammatePlacement): TeammatePlacement => {
      switch (t.teammateId) {
        case "offline":
          return new TeammatePlacement("offline", OrganizationParent.person, 0);
        case "bob":
          return new TeammatePlacement("bob", OrganizationParent.teammate("offline"), 0);
        default:
          return t;
      }
    };
    await create(context => context.answer(MethodName.OrganizationList, () => [SampleData.organizationOf(organization.departments, organization.placements.map(placed)).toJson()]));

    await focus("Bob");

    expect([texts(".head .place", popover()), fact("Reports to")]).toEqual([[], "Offline"]);
  });

  it("says when a teammate has no model of its own, no usage with a percent, and nothing said yet, and that a stopped one runs nothing", async () => {
    await create(context => context.answer(MethodName.PlanUsageList, () =>
      [new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, null, null, null, null, true)], SampleData.timestamp).toJson()]));

    await focus("Bob");
    const bob = facts();
    await blur();
    await focus("Offline");

    expect([bob, facts(), texts(".act", popover())]).toEqual([
      [new DetailFact("Status", "Idle"), new DetailFact("Reports to", "Code Reviewer"), new DetailFact("Model", "Default model"), new DetailFact("Usage", "Not reported"),
        new DetailFact("Works in", "Its own folder"), new DetailFact("Last said", "Nothing yet")],
      [new DetailFact("Status", "Stopped"), new DetailFact("Reports to", "You"), new DetailFact("Model", "Default model"), new DetailFact("Usage", "Not reported"),
        new DetailFact("Works in", "Its own folder"), new DetailFact("Last said", "Nothing yet")],
      ["Stopped"]]);
  });

  it("says where each teammate's Organization chat works: an attached folder, its project, or its own folder", async () => {
    const chatOf = (teammateId: string): Conversation => new Conversation(`org-${teammateId}`, null, `Organization · ${teammateId}`, SampleData.timestamp,
      SampleData.timestamp, false, null, null, false, null, false, [], false, false, null, new OrganizationChat("my-organization", teammateId));
    await create(context => context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id
      ? [SampleData.conversation.toJson(), chatOf("bob").withProjectId(SampleData.project.id, SampleData.timestamp).toJson()]
      : [chatOf("alice").withAttachedFolder("D:/work/site", SampleData.timestamp).toJson()]));
    const worksIn = async (name: string): Promise<string | undefined> => {
      await focus(name);
      const shown = fact("Works in");
      await blur();
      return shown;
    };

    expect([await worksIn("Alice"), await worksIn("Bob"), await worksIn("Offline")]).toEqual(["site", SampleData.project.name, "Its own folder"]);
  });

  it("lists every reply its teammate runs now with how long each has run, ticking each second while one runs, and follows its last words", async () => {
    await create();
    context.emit(EventName.MessageCreated, reply("r1", "c9", "2026-09-10T08:04:30.000Z", MessageStatus.Running).toJson());
    context.emit(EventName.MessageCreated, reply("r2", "c1", "2026-09-10T08:04:20.000Z", MessageStatus.Running).toJson());
    await settle();
    const details = await focus("Alice");
    const acts = (): string[][] => all(".act", details).map(t => [...texts(".act-text", t), ...texts(".act-for", t)]);
    const running = acts();
    const ticking = clock.running;
    clock.advance(Resources.clockIntervalMilliseconds);
    await settle();
    const ticked = acts();
    context.emit(EventName.MessageUpdated, reply("r1", "c9", "2026-09-10T08:04:30.000Z", MessageStatus.Completed).toJson());
    context.emit(EventName.MessageUpdated, reply("r2", "c1", "2026-09-10T08:04:20.000Z", MessageStatus.Completed).toJson());
    await settle();

    expect([running, ticked, texts(".act-for", details).length]).toEqual([[["First", "40 s"], ["Replying", "30 s"]], [["First", "41 s"], ["Replying", "31 s"]], 0]);
    expect(ticking).toBeGreaterThan(clock.running);
    expect(texts(".act", details)).toEqual(["Nothing running"]);
  });

  it("opens the details once the pointer rests on a card, and closes them when it leaves the card and them", async () => {
    await create();

    await userEvent.hover(card("Bob"));
    await Wait.until(() => expect(popovers()).toHaveLength(1));
    const opened = [texts(".head .name", popover()), document.activeElement === card("Bob")];
    await userEvent.hover(one(".top"));
    await Wait.until(() => expect(popovers()).toEqual([]));

    expect(opened).toEqual([["Bob"], false]);
  });

  it("moves the focus into the details on Space and gives it back to the card on Escape", async () => {
    await create();
    card("Alice").focus();

    await userEvent.keyboard(" ");
    await Wait.until(() => expect(document.activeElement).toBe(popover()));
    await userEvent.keyboard("{Escape}");
    await Wait.until(() => expect(popovers()).toEqual([]));

    expect(document.activeElement).toBe(card("Alice"));
  });

  it("closes a card's details when its own Cards show menu opens, so the menu stands alone", async () => {
    await create();
    await focus("Alice");

    await userEvent.click(one(".tune", card("Alice")));
    await settle();

    await Wait.until(() => expect(document.querySelectorAll("button[nol-menu-item]").length).toBeGreaterThan(0));
    expect(popovers()).toEqual([]);
  });

  it("closes a card's details while its structure is edited once a field in it takes the focus, so Escape closes that field's list", async () => {
    await create();
    one(".top .edit").click();
    await settle();
    await focus("Offline");

    await userEvent.click(one(".move-choice .nol-select-button", card("Offline")));
    await Wait.until(() => expect(document.querySelector(".nol-select-option")).not.toBeNull());
    const closed = popovers();
    await userEvent.keyboard("{Escape}");

    await Wait.until(() => expect(document.querySelector(".nol-select-option")).toBeNull());
    expect(closed).toEqual([]);
  });

  describe.each(["Board", "Focus"])("on the %s", view => {
    const createIn = async (): Promise<void> => {
      await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ view })));
      await Wait.until(() => expect(all("nol-teamrun-organization-card").length).toBeGreaterThan(0));
    };

    it("opens a card's details, the same as the Tree's, when the card takes the keyboard focus, and closes them when it loses it", async () => {
      await createIn();

      const details = await focus("Alice");
      const opened = [details.getAttribute("role"), details.getAttribute("aria-label"), card("Alice").getAttribute("role"), card("Alice").getAttribute("aria-label"),
        card("Alice").getAttribute("aria-expanded"), texts(".head .name", details), fact("Reports to")];
      await blur();
      await Wait.until(() => expect(card("Alice").getAttribute("aria-expanded")).toBe("false"));

      expect(opened).toEqual(["dialog", "Alice's details", "group", "Alice", "true", ["Alice"], "You"]);
    });

    it("opens a card's details once the pointer rests on it, and closes them when it leaves the card and them", async () => {
      await createIn();

      await userEvent.hover(card("Code Reviewer"));
      await Wait.until(() => expect(popovers()).toHaveLength(1));
      const opened = [popover().getAttribute("aria-label"), document.activeElement === card("Code Reviewer")];
      await userEvent.hover(one(".top"));
      await Wait.until(() => expect(popovers()).toEqual([]));

      expect(opened).toEqual(["Code Reviewer's details", false]);
    });
  });

  describe.each(ThemeCase.every)("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it.each(["Board", "Focus"])("keeps every card's details on the %s inside the window", async view => {
      await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ view })));
      await Wait.until(() => expect(all("nol-teamrun-organization-card").length).toBeGreaterThan(0));
      const outside: string[] = [];

      for (const shown of all("nol-teamrun-organization-card")) {
        TestBed.inject(FocusMonitor).focusVia(shown, "keyboard");
        await settle();
        await Wait.until(() => expect(popovers()).toHaveLength(1));
        const box = popover().getBoundingClientRect();
        if (box.left < 0 || box.top < 0 || box.right > window.innerWidth || box.bottom > window.innerHeight)
          outside.push(popover().getAttribute("aria-label") ?? "");
        await blur();
      }

      expect([all("nol-teamrun-organization-card").length > 1, outside]).toEqual([true, []]);
    });

    it("hangs the details under the card at its start, and lays the head, the facts in two columns and what runs now inside its padding", async () => {
      await create(context => context
        .answer(MethodName.TeammateLastReplyList, () => [new TeammateLastReply("alice", "c1", "r0", "The header is done.", SampleData.timestamp).toJson()]));
      context.emit(EventName.MessageCreated, reply("r1", "c1", "2026-09-10T08:04:30.000Z", MessageStatus.Running).toJson());
      await settle();
      const details = await focus("Alice");
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const style = getComputedStyle(details);
      const inner = box(details);
      const left = inner.left + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth);
      const right = inner.right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth);
      const top = inner.top + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth);
      const head = one(".head", details);
      const dl = one(".facts", details);
      const label = one(".now-label", details);
      const list = one(".running", details);
      const firstTerm = one("dt:nth-of-type(1)", details);
      const secondTerm = one("dt:nth-of-type(2)", details);
      const firstValue = one("dd:nth-of-type(1)", details);
      const text = one(".act-text", details);
      const lasted = one(".act-for", details);

      AppearanceFixture.expectPixels(inner.left, box(card("Alice")).left);
      expect(inner.top).toBeGreaterThan(box(card("Alice")).bottom);
      AppearanceFixture.expectPixels(Number.parseFloat(style.paddingLeft), space(3));
      AppearanceFixture.expectPixels(box(head).left, left);
      AppearanceFixture.expectPixels(box(head).top, top);
      AppearanceFixture.expectPixels(box(dl).top - box(head).bottom, space(2));
      AppearanceFixture.expectPixels(box(label).top - box(dl).bottom, space(2));
      AppearanceFixture.expectPixels(box(list).top - box(label).bottom, space(2));
      AppearanceFixture.expectPixels(box(firstTerm).left, left);
      AppearanceFixture.expectPixels(box(firstValue).left - box(firstTerm).right, space(3));
      AppearanceFixture.expectPixels(box(secondTerm).top - box(firstTerm).bottom, space(1));
      AppearanceFixture.expectPixels(box(firstValue).right, right);
      AppearanceFixture.expectPixels(box(text).left, left);
      AppearanceFixture.expectPixels(box(lasted).right, right);
      AppearanceFixture.expectPixels(box(lasted).left - box(text).right, space(2));
      for (const view of [firstTerm, firstValue, label, text])
        AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(view).fontSize), AppearanceFixture.measureLook("text-small"));
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(lasted).fontSize), AppearanceFixture.measureLook("text-code"));
      expect([getComputedStyle(lasted).whiteSpace, getComputedStyle(firstValue).overflowWrap]).toEqual(["nowrap", "anywhere"]);
    });

    it("keeps a running reply's word whole beside a long time, moving the time to its own line under the word, and breaks a word longer than the line at its edge", async () => {
      const word = "Electroencephalographically";
      await create(context => context.answer(MethodName.ConversationList, t => ConversationListParams.fromJson(t).projectId === SampleData.project.id
        ? [new Conversation("c1", SampleData.project.id, word, SampleData.timestamp, SampleData.timestamp).toJson()] : []));
      context.emit(EventName.MessageCreated, reply("r1", "c1", new Date(clock.now() - (1750 * 3600 + 20 * 60) * 1000).toISOString(), MessageStatus.Running).toJson());
      await settle();
      const details = await focus("Alice");
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const lines = (view: Element): number => {
        const range = document.createRange();
        range.selectNodeContents(view);
        return new Set([...range.getClientRects()].filter(t => t.width > 0).map(t => Math.round(t.top))).size;
      };
      const style = getComputedStyle(details);
      const right = box(details).right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth);
      const text = one(".act-text", details);
      const lasted = one(".act-for", details);

      expect([text.textContent, lasted.textContent, lines(text), lines(lasted)]).toEqual([word, "1750 h 20 min", 1, 1]);
      AppearanceFixture.expectPixels(box(lasted).left, box(text).left);
      expect(box(lasted).top).toBeGreaterThanOrEqual(box(text).bottom - 1);
      expect(box(lasted).right).toBeLessThanOrEqual(right);

      text.textContent = word.repeat(3);
      AppearanceFixture.expectPixels(box(text).right, right);
      expect(lines(text)).toBeGreaterThan(1);
    });

    it("draws the details as a hover card: 18rem wide, on the hover surface in its border, in the text's colour", async () => {
      await create();
      const details = await focus("Alice");
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const probe = document.createElement("div");
      probe.style.background = "var(--nol-hover-widget)";
      probe.style.border = "1px solid var(--nol-hover-widget-border)";
      probe.style.color = "var(--nol-text)";
      details.append(probe);
      const surface = getComputedStyle(probe).backgroundColor;
      const border = getComputedStyle(probe).borderTopColor;
      const text = getComputedStyle(probe).color;
      probe.remove();
      const style = getComputedStyle(details);
      const facts = getComputedStyle(one(".facts", details));

      AppearanceFixture.expectPixels(details.getBoundingClientRect().width, 18 * rem);
      expect([style.backgroundColor, style.borderTopColor, style.borderBottomColor, facts.color]).toEqual([surface, border, border, text]);
    });

    it("cuts long last words to three lines, with the time since them on a line of its own under them", async () => {
      const words = Array.from({ length: 40 }, (_, i) => `Step ${i} of the header is done.`).join(" ");
      await create(context => context
        .answer(MethodName.TeammateLastReplyList, () => [new TeammateLastReply("alice", "c1", "r0", words, SampleData.timestamp).toJson()]));
      const details = await focus("Alice");
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const said = one(".said", details);
      const ago = one(".ago", details);
      const line = Number.parseFloat(getComputedStyle(said).lineHeight);

      expect(said.textContent).toBe(words);
      AppearanceFixture.expectPixels(box(said).height, 3 * line);
      expect(said.scrollHeight).toBeGreaterThan(said.clientHeight);
      AppearanceFixture.expectPixels(box(ago).top, box(said).bottom);
      AppearanceFixture.expectPixels(box(ago).height, line);
      expect(box(ago).bottom).toBeLessThanOrEqual(box(details).bottom);
    });

    it("rings a card the keyboard reached in the accent's colour, inside its edge", async () => {
      await create();
      const alice = card("Alice");
      alice.setAttribute("data-nol-state", "Focus");
      await settle();
      const style = getComputedStyle(alice);
      const probe = document.createElement("span");
      probe.style.color = forcedColors === "active" ? "Highlight" : "var(--nol-accent)";
      element().append(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      const width = AppearanceFixture.measureLook("border-width") * (forcedColors === "active" ? 2 : 1);

      expect([style.outlineStyle, style.outlineColor]).toEqual(["solid", accent]);
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineWidth), width);
      AppearanceFixture.expectPixels(Number.parseFloat(style.outlineOffset), -AppearanceFixture.measureLook("border-width"));
    });

    it("draws the facts' names, the time since the last words and how long a reply has run in the muted text's colour", async () => {
      await create(context => context
        .answer(MethodName.TeammateLastReplyList, () => [new TeammateLastReply("alice", "c1", "r0", "The header is done.", SampleData.timestamp).toJson()]));
      context.emit(EventName.MessageCreated, reply("r1", "c1", "2026-09-10T08:04:30.000Z", MessageStatus.Running).toJson());
      await settle();
      const details = await focus("Alice");
      const probe = document.createElement("span");
      probe.style.color = "var(--nol-text-muted)";
      details.append(probe);
      const muted = getComputedStyle(probe).color;
      probe.remove();

      expect([...all("dt", details), one(".ago", details), one(".act-for", details)].map(t => getComputedStyle(t).color))
        .toEqual(Array.from({ length: 8 }, () => muted));
    });
  });
});
