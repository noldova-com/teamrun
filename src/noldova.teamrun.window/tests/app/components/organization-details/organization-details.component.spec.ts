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
import { Department, DepartmentMember, EventName, Message, MessageAuthor, MessageStatus, MethodName, Organization, PlanUsage, PlanWindow, PlanWindowName,
  TeammateLastReply } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { page, userEvent } from "vitest/browser";

import { OrganizationViewComponent } from "../../../../src/app/components/organization-view/organization-view.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationMessagesStoreService } from "../../../../src/app/services/organization-messages-store.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { Resources } from "../../../../src/resources";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationDetailsComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationViewComponent>;
  let clock: FakeClock;

  const organization = new Organization([
    new Department("design", "Design", null, "alice", 0, "c", "u"),
    new Department("build", "Build", null, null, 1, "c", "u"),
    new Department("ui", "UI", "design", "reviewer", 0, "c", "u"),
    new Department("tools", "Tools", "ui", null, 0, "c", "u")
  ], [new DepartmentMember("alice", "design"), new DepartmentMember("bob", "tools"), new DepartmentMember("offline", "build"),
    new DepartmentMember("reviewer", "ui")]);
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const all = (selector: string, root: ParentNode = element()): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];
  const one = (selector: string, root: ParentNode = element()): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => all(selector, root).map(t => t.textContent?.replace(/\s+/gu, " ").trim() ?? "");
  const card = (name: string): HTMLElement => {
    const found = all("nol-teamrun-organization-card").find(t => t.querySelector(".name")?.textContent?.trim() === name
      || t.querySelector<HTMLInputElement>(".name-field")?.value === name);
    if (Object.isUndefined(found))
      throw new Error(`No card is named ${name}.`);
    return found;
  };
  const popovers = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-details .nol-popover")];
  const popover = (): HTMLElement => {
    const [found, ...others] = popovers();
    if (Object.isUndefined(found) || others.length > 0)
      throw new Error(`${popovers().length} details are open.`);
    return found;
  };
  const facts = (): string[][] => all("dt", popover()).map(t => [t.textContent?.trim() ?? "", t.nextElementSibling?.textContent?.replace(/\s+/gu, " ").trim() ?? ""]);
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
      .answer(MethodName.OrganizationList, () => organization.toJson())
      .answer(MethodName.OrganizationMessageList, () => [])
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

  const viewport = { width: window.innerWidth, height: window.innerHeight };

  beforeEach(async () => {
    await page.viewport(1600, 1200);
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
  });

  afterEach(async () => {
    await page.viewport(viewport.width, viewport.height);
    AppearanceFixture.reset();
    OrganizationMessagesStoreService.release(context);
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
      [["Status", "Idle"], ["Reports to", "You"], ["Model", "gpt-5 · high"], ["Usage", "40% used · 5h"], ["Last said", "The header is done. 5 min ago"]],
      ["Now"], ["Nothing running"]]);
  });

  it("names as whom a teammate reports to the nearest leader above it, skipping departments without one, and you when none is", async () => {
    await create();
    const reportsTo = async (name: string): Promise<string[]> => {
      await focus(name);
      const shown = [texts(".head .place", popover())[0] ?? "", facts().find(t => t[0] === "Reports to")?.[1] ?? ""];
      await blur();
      return shown;
    };

    expect([await reportsTo("Alice"), await reportsTo("Code Reviewer"), await reportsTo("Bob"), await reportsTo("Offline")])
      .toEqual([["Review · Design", "You"], ["UI", "Alice"], ["Tools", "Code Reviewer"], ["Build", "You"]]);
  });

  it("says when a teammate has no model of its own, no usage with a percent, and nothing said yet, and that a stopped one runs nothing", async () => {
    await create(context => context.answer(MethodName.PlanUsageList, () =>
      [new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, null, null, null, null, true)], SampleData.timestamp).toJson()]));

    await focus("Bob");
    const bob = facts();
    await blur();
    await focus("Offline");

    expect([bob, facts(), texts(".act", popover())]).toEqual([
      [["Status", "Idle"], ["Reports to", "Code Reviewer"], ["Model", "Default model"], ["Usage", "Not reported"], ["Last said", "Nothing yet"]],
      [["Status", "Stopped"], ["Reports to", "You"], ["Model", "Default model"], ["Usage", "Not reported"], ["Last said", "Nothing yet"]],
      ["Stopped"]]);
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

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

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
      const [head, dl, label, list] = [one(".head", details), one(".facts", details), one(".now-label", details), one(".running", details)];
      const [firstTerm, secondTerm] = all("dt", details);
      const [firstValue] = all("dd", details);
      const [text, lasted] = [one(".act-text", details), one(".act-for", details)];
      if (Object.isUndefined(firstTerm) || Object.isUndefined(secondTerm) || Object.isUndefined(firstValue))
        throw new Error("The facts have no rows.");

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
        .toEqual(Array.from({ length: 7 }, () => muted));
    });
  });
});
