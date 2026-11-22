/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import {
  Conversation, ConversationListParams, Department, DetailKind, EventName, Harness, Message, MessageAuthor, MessageSender, MessageSendingPayload, MessageStatus,
  MethodName, Organization, OrganizationChat, OrganizationLayoutSaveParams, OrganizationParent, PlanUsage, PlanWindow, PlanWindowName, Teammate,
  TeammateIdParams, TeammateLastReply, TeammatePlacement, TeammateWork
} from "@noldova/teamrun.protocol";
import { DefaultTheme, SelectComponent, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { page, userEvent } from "vitest/browser";

import { OrganizationViewComponent } from "../../../../src/app/components/organization-view/organization-view.component";
import { FlowPoint } from "../../../../src/app/models/flow-point";
import { TreeFlowLines } from "../../../../src/app/models/tree-flow-lines";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { OrganizationFlowService } from "../../../../src/app/services/organization-flow.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { Resources } from "../../../../src/resources";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationViewComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationViewComponent>;
  let organization: Organization;
  let saves: JsonValue[];

  const sample = SampleData.organizationOf([
    new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u"),
    new Department("build", "Build", "department", OrganizationParent.person, null, 1, "c", "u"),
    new Department("ui", "UI", "department", OrganizationParent.department("design"), "reviewer", 0, "c", "u")
  ], [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("design"), 1),
    new TeammatePlacement("offline", OrganizationParent.department("build"), 0),
    new TeammatePlacement("reviewer", OrganizationParent.department("ui"), 0)]);
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const all = (selector: string, root: ParentNode = element()): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];
  const one = (selector: string, root: ParentNode = element()): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => all(selector, root).map(t => t.textContent?.trim() ?? "");
  const department = (name: string): HTMLElement => {
    const found = all("nol-teamrun-organization-department").find(t => t.querySelector(":scope > .department .department-name")?.textContent?.trim() === name
      || t.querySelector<HTMLInputElement>(":scope > .department .department-field")?.value === name);
    if (Object.isUndefined(found))
      throw new Error(`No department is named ${name}.`);
    return found;
  };
  const own = (view: HTMLElement, selector: string): HTMLElement[] => all(`:scope > ${selector}`, view);
  const shape = (view: HTMLElement): unknown[] => [
    texts(":scope > .department .department-name", view)[0],
    texts(":scope > .department .department-count", view)[0],
    texts(":scope > .department .department-summary", view)[0],
    own(view, ".leader").map(t => t.querySelector(".name")?.textContent?.trim()),
    own(view, ".reports").flatMap(t => texts(":scope > .report > .self .name", t)),
    own(view, ".kids").flatMap(t => all(":scope > nol-teamrun-organization-department", t).map(shape)),
    texts(":scope > .hidden", view)
  ];
  const menuItems = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
  const menuItem = (label: string): HTMLButtonElement => {
    const found = menuItems().find(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() === label);
    if (Object.isUndefined(found))
      throw new Error(`No menu item reads ${label}.`);
    return found;
  };
  const openMenu = async (trigger: HTMLElement): Promise<void> => {
    trigger.click();
    await settle();
    await Wait.until(() => expect(menuItems().length).toBeGreaterThan(0));
  };
  const closeMenu = async (): Promise<void> => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await Wait.until(() => expect(menuItems()).toEqual([]));
  };
  const card = (name: string): HTMLElement => {
    const found = all("nol-teamrun-organization-card").find(t => t.querySelector(".name")?.textContent?.trim() === name);
    if (Object.isUndefined(found))
      throw new Error(`No card is named ${name}.`);
    return found;
  };
  const shows = (name: string): string[] => [...texts(".status", card(name)), ...texts(".usage", card(name)), ...texts(".model", card(name))];
  const checks = (): (string | null)[][] => menuItems().map(t => [t.querySelector(".nol-menu-item-label")?.textContent?.trim() ?? null, t.getAttribute("aria-checked")]);
  const tree = (): unknown[] => all(".chart .tree > .kids > nol-teamrun-organization-department").map(shape);
  const reports = (): string[] => texts(".chart .tree > .reports > .report > .self .name");
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined, showsDepartments: boolean = true): Promise<void> => {
    organization = sample;
    saves = [];
    context = SampleData.createContext()
      .answer(MethodName.OrganizationList, () => [organization.toJson()])
      .answer(MethodName.OrganizationChatOpen, t => {
        const teammateId = OrganizationChat.fromJson(t).teammateId;
        return new Conversation(`org-${teammateId}`, null, teammateId, SampleData.timestamp, SampleData.timestamp, false, null, null, false, null, false, [], false, false,
          null, new OrganizationChat("my-organization", teammateId)).toJson();
      })
      .answer(MethodName.OrganizationLayoutSave, t => {
        saves.push(OrganizationLayoutSaveParams.fromJson(t).layout);
        return null;
      });
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context },
      { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() }] });
    fixture = TestBed.createComponent(OrganizationViewComponent);
    element().style.width = "100rem";
    element().style.height = "76rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await Wait.until(() => expect(context.count(MethodName.OrganizationList)).toBe(1));
    if (showsDepartments)
      await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await settle();
  };
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const asked = new Message("q1", "c9", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp);
  const forwarded = new Message("q2", "c9", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null, SampleData.timestamp, null, SampleData.timestamp, [],
    null, null, [], new MessageSender("c8", "reviewer", "Code Reviewer"));
  const answer = (id: string, to: Message, teammateId: string, status: MessageStatus): Message => {
    const at = SampleData.timestamp;
    const open = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval].includes(status);
    return new Message(id, "c9", 1, MessageAuthor.Provider, to.id, status, [], SampleData.provenance, at, status === MessageStatus.Pending ? null : at,
      open ? null : at, [], teammateId, teammateId);
  };
  const flow = async (...messages: readonly Message[]): Promise<void> => {
    for (const message of messages)
      context.emit(EventName.MessageUpdated, message.toJson());
    await settle();
  };
  const routes = (): string[] => all(".nol-teamrun-flow-overlay path").map(t => t.getAttribute("class") ?? "");
  const pickView = async (label: string): Promise<void> => {
    all(".top .views [role=radio]").find(t => t.textContent?.trim() === label)?.click();
    await settle();
  };
  const end = async (selector: string): Promise<void> => {
    one(`.nol-teamrun-flow-overlay ${selector}`).dispatchEvent(new AnimationEvent("animationend"));
    await settle();
  };

  beforeEach(() => page.viewport(1600, 1300));

  afterEach(async () => {
    await page.viewport(viewportWidth, viewportHeight);
    AppearanceFixture.reset();
    TeammateStatusStoreService.release(context);
    OrganizationFlowService.release(context);
    OrganizationLayoutService.release(context);
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("shows you at the root, then each department in order with its count, leader, members in name order and the departments nested in it", async () => {
    await create();

    expect([texts(".top .title"), texts(".top .headcount"), texts(".owner .name"), texts(".owner .role"), one(".chart > nol-canvas").getAttribute("aria-label"),
      all(".chart [nolCanvasItem]").filter(t => t.matches(".owner, .department, nol-teamrun-organization-card")).length])
      .toEqual([["Organization"], ["4 teammates in 3 departments"], ["You"], ["Owner · 1 direct report"], "Organization structure", 8]);
    expect(tree()).toEqual([
      ["Design", "2", "2 idle", ["Alice"], ["Bob"], [["UI", "1", "1 idle", ["Code Reviewer"], [], [], []]], []],
      ["Build", "1", "1 stopped", [], ["Offline"], [], []]
    ]);
    expect(texts(".role", department("Design"))).toEqual(["Review"]);
  });

  it("shows the organization its document instance names, with its own layout, and only that organization's changes", async () => {
    const second = new Organization("o2", "Second", null, 1, "c", "u", [SampleData.departmentType], [new Department("ops", "Ops", "department", OrganizationParent.person, null, 0, "c", "u")],
      [new TeammatePlacement("alice", OrganizationParent.department("ops"), 0)]);
    const names = (): (string | undefined)[] => all(".chart .tree > .kids > nol-teamrun-organization-department").map(t => texts(":scope > .department .department-name", t)[0]);
    await create(context => context.answer(MethodName.OrganizationList, () => [organization.toJson(), second.toJson()]));
    const mine = names();

    fixture.componentRef.setInput("instance", "o2");
    await Wait.until(() => expect(names()).toContain("Ops"));
    await Wait.until(() => expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.OrganizationLayoutRead)).map(t => t.parameters))
      .toEqual([{ organizationId: "my-organization" }, { organizationId: "o2" }]));
    context.emit(EventName.OrganizationChanged, SampleData.organizationOf([], []).toJson());
    await settle();

    expect([mine, names()]).toEqual([["Design", "Build"], ["Ops"]]);
  });

  it("follows each change to the organization as it comes, the teammates placed under you as your direct reports, and none once no one is placed", async () => {
    await create();
    const underYou = (ids: readonly string[]): TeammatePlacement[] => ids.map((t, i) => new TeammatePlacement(t, OrganizationParent.person, i));
    context.emit(EventName.OrganizationChanged, SampleData.organizationOf([new Department("build", "Build", "department", OrganizationParent.person, "offline", 0, "c", "u")],
      [new TeammatePlacement("offline", OrganizationParent.department("build"), 0), ...underYou(["alice", "bob", "reviewer"])]).toJson());
    await settle();

    expect([tree(), reports(), texts(".owner .role")]).toEqual([[["Build", "1", "1 stopped", ["Offline"], [], [], []]], ["Alice", "Bob", "Code Reviewer"],
      ["Owner · 4 direct reports"]]);

    context.emit(EventName.OrganizationChanged, SampleData.organizationOf([new Department("build", "Build", "department", OrganizationParent.person, "offline", 0, "c", "u"),
      new Department("lab", "Lab", "department", OrganizationParent.teammate("bob"), "reviewer", 0, "c", "u")], [new TeammatePlacement("offline", OrganizationParent.department("build"), 0),
      ...underYou(["bob"]), new TeammatePlacement("reviewer", OrganizationParent.department("lab"), 0)]).toJson());
    await settle();
    const nested = texts(".owner .role");
    context.emit(EventName.OrganizationChanged, SampleData.organizationOf([], []).toJson());
    await settle();

    expect([nested, tree(), reports(), texts(".top .headcount"), texts(".owner .role")]).toEqual([["Owner · 2 direct reports"], [], [], ["0 teammates in 0 departments"],
      ["Owner · 0 direct reports"]]);
  });

  it("leaves a teammate with no placement out of the organization: no card, no direct report and no place in the headcount", async () => {
    await create(() => {
      organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u")],
        [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("design"), 1),
          new TeammatePlacement("reviewer", OrganizationParent.person, 0)]);
    });

    expect([texts(".top .headcount"), reports(), texts(".chart nol-teamrun-organization-card .name").includes("Offline"), texts(".owner .role")])
      .toEqual([["3 teammates in 1 department"], ["Code Reviewer"], false, ["Owner · 2 direct reports"]]);
  });

  it("shows the teammates placed in no department under you as your direct reports, first, with no group of their own, and no teammate the organization doesn't hold, so the headcount and the To choices count what the tree shows", async () => {
    await create(() => {
      organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u"),
        new Department("build", "Build", "department", OrganizationParent.person, null, 1, "c", "u")],
        [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("design"), 1),
          new TeammatePlacement("reviewer", OrganizationParent.person, 0)]);
    });

    expect([texts(".top .headcount"), reports(), tree(), all(".chart nol-teamrun-organization-card").length, texts(".owner .role"),
      all(".chart *").filter(t => t.children.length === 0 && t.textContent?.includes("No department")).length]).toEqual([
      ["3 teammates in 2 departments"], ["Code Reviewer"],
      [["Design", "2", "2 idle", ["Alice"], ["Bob"], [], []], ["Build", "0", undefined, [], [], [], []]],
      3, ["Owner · 2 direct reports"], 0
    ]);
    await userEvent.click(one("aside.messages .to-choice .nol-select-button"));
    await Wait.until(() => expect(document.querySelectorAll(".nol-select-option").length).toBeGreaterThan(0));
    const offered = [...document.querySelectorAll<HTMLElement>(".nol-select-option")].map(t => t.textContent?.trim() ?? "");
    await userEvent.keyboard("{Escape}");
    await settle();
    expect(offered).toEqual(expect.arrayContaining(["Code Reviewer"]));
    expect([offered.some(t => t.includes("No department")), offered.includes("Offline")]).toEqual([false, false]);

    one(".top .edit").click();
    await settle();

    expect([all(".chart .tree > .reports > .report > .self").length, [all(".move-choice", card("Code Reviewer")).length, all(".remove", card("Code Reviewer")).length]])
      .toEqual([1, [1, 0]]);
  });

  it("shows the teammates in no department under you in the Tree, after the leaders on the Board and right under Organization in Focus, with no group for them in any view, and its message to everyone who reports to you reaches them", async () => {
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    await create(context => {
      organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u"),
        new Department("build", "Build", "department", OrganizationParent.person, null, 1, "c", "u")],
        [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("design"), 1),
          new TeammatePlacement("reviewer", OrganizationParent.person, 0), new TeammatePlacement("offline", OrganizationParent.person, 1)]);
      context.answer(MethodName.OrganizationLayoutRead, () => ({ view: "Board" }));
    });

    expect([texts(".chart nol-teamrun-organization-board .leaders > nol-teamrun-organization-card .name"),
      texts(".chart nol-teamrun-organization-board .leaders > .report .name")]).toEqual([["Alice", "Code Reviewer", "Offline"], ["Code Reviewer", "Offline"]]);
    const board = element().textContent ?? "";
    await Wait.until(() => expect(texts("aside.messages .nol-teamrun-organization-chat-title")).toEqual(["Chat with Design"]));
    await userEvent.click(one(".message-leaders"));
    await Wait.until(() => expect(texts("aside.messages .nol-teamrun-organization-chat-title")).toEqual([Resources.organizationLeadersChat]));
    expect(texts("aside.messages .nol-teamrun-organization-recipient-name").sort()).toEqual(["Alice", "Code Reviewer", "Offline"]);

    one(".top .views [role=radio]:last-of-type").click();
    await settle();
    expect([texts(".chart nol-teamrun-organization-focus .orow .label").slice(0, 4), texts(".chart nol-teamrun-organization-focus .orow.report .label")])
      .toEqual([["Organization", "Code Reviewer", "Offline", "Design"], ["Code Reviewer", "Offline"]]);
    const focus = element().textContent ?? "";
    await pickView("Tree");
    const tree = element().textContent ?? "";

    expect([reports(), [board, focus, tree].map(t => /no department/iu.test(t))]).toEqual([["Code Reviewer", "Offline"], [false, false, false]]);
  });

  it("collapses a department to a count of the members and nested departments' people it hides, keeps that on the server, and opens it again", async () => {
    await create();
    const toggle = (): HTMLElement => one(":scope > .department .department-toggle", department("Design"));

    expect([toggle().getAttribute("aria-expanded"), toggle().getAttribute("aria-label")]).toEqual(["true", "Hide Design's members"]);

    toggle().click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    expect([toggle().getAttribute("aria-expanded"), toggle().getAttribute("aria-label"), shape(department("Design"))])
      .toEqual(["false", "Show Design's members", ["Design", "2", "2 idle", ["Alice"], [], [], ["2 members hidden"]]]);
    expect(saves[0]).toEqual(expect.objectContaining({ collapsedDepartments: ["design"] }));

    toggle().click();
    await Wait.until(() => expect(saves).toHaveLength(2));
    await settle();

    expect(shape(department("Design"))[4]).toEqual(["Bob"]);
  });

  it("says how many a collapsed department hides: its members, or its nested departments' people, and nothing when only its leader or no one is there", async () => {
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ collapsedDepartments: ["ui", "build", "top"] })));

    expect([shape(department("UI")), shape(department("Build"))])
      .toEqual([["UI", "1", "1 idle", ["Code Reviewer"], [], [], []], ["Build", "1", "1 stopped", [], [], [], ["1 member hidden"]]]);

    organization = SampleData.organizationOf([new Department("top", "Top", "department", OrganizationParent.person, null, 0, "c", "u"),
      new Department("ui", "UI", "department", OrganizationParent.department("top"), "reviewer", 0, "c", "u")],
      [new TeammatePlacement("reviewer", OrganizationParent.department("ui"), 0)]);
    context.emit(EventName.OrganizationChanged, organization.toJson());
    await settle();

    expect(shape(department("Top"))).toEqual(["Top", "0", undefined, [], [], [], ["1 member hidden"]]);

    organization = SampleData.organizationOf([new Department("ui", "UI", "department", OrganizationParent.person, null, 0, "c", "u")], []);
    context.emit(EventName.OrganizationChanged, organization.toJson());
    await settle();

    expect(shape(department("UI"))).toEqual(["UI", "0", undefined, [], [], [], []]);
  });

  it("says when the organization can't be read, and reads it again on Retry", async () => {
    let fails = true;
    await create(context => context.answer(MethodName.OrganizationList, () => {
      if (fails)
        throw new RuntimeRequestException(FailureCode.Internal, "The database is locked.");
      return [sample.toJson()];
    }), false);
    await Wait.until(() => expect(texts(".failure .error")).toHaveLength(1));

    expect(one(".failure .error").getAttribute("role")).toBe("alert");

    fails = false;
    one(".failure button").click();
    await Wait.until(() => expect(texts(".failure .error")).toEqual([]));
    await settle();

    expect(tree()).toHaveLength(2);
  });

  it("switches what every card shows from Cards show, and keeps it on the server", async () => {
    await create(context => context.answer(MethodName.PlanUsageList, () =>
      [new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, 40, null)], "2026-10-22T09:00:00.000Z").toJson()]));

    expect([shows("Alice"), shows("Bob")]).toEqual([["Idle"], ["Idle"]]);

    await openMenu(one(".top .cards-show"));
    expect(checks()).toEqual([["Status", "true"], ["Current activity", "true"], ["Usage today", "false"], ["Last message", "false"],
      ["Model and effort", "false"], ["Git branch", "false"], ["Pull requests", "false"], ["Documents", "false"], ["Artifacts", "false"],
      ["Clear every card's own choice", null]]);
    expect(menuItem("Clear every card's own choice").getAttribute("aria-disabled")).toBe("true");
    menuItem("Usage today").click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();
    await closeMenu();
    await openMenu(one(".top .cards-show"));
    menuItem("Model and effort").click();
    await Wait.until(() => expect(saves).toHaveLength(2));
    await settle();

    expect([shows("Alice"), shows("Bob")]).toEqual([["Idle", "40%", "gpt-5 · high"], ["Idle", "40%"]]);
    expect([one(".usage", card("Alice")).getAttribute("role"), one(".usage", card("Alice")).getAttribute("aria-valuenow")]).toEqual(["meter", "0.4"]);
    expect(saves[1]).toEqual(expect.objectContaining({ cardsShow: { Status: true, Now: true, Usage: true, Last: false, Model: true, Git: false, PullRequests: false, Documents: false,
      Artifacts: false } }));
  });

  it("shows a teammate's work on its card only while a work field is on, and reads it only then", async () => {
    await create();

    expect([all("nol-teamrun-teammate-work"), context.count(MethodName.TeammateWorkRead)]).toEqual([[], 0]);

    context.answer(MethodName.TeammateWorkRead, t => new TeammateWork(TeammateIdParams.fromJson(t).teammateId, null, [], []).toJson());
    await openMenu(one(".top .cards-show"));
    menuItem("Git branch").click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    await Wait.until(() => expect(texts("[data-field=Git] .work-muted", card("Alice"))).toEqual(["The Git module isn't installed"]));
    const cards = all("nol-teamrun-organization-card").length;
    expect([cards, all("nol-teamrun-teammate-work").length, context.count(MethodName.TeammateWorkRead), saves[0]])
      .toEqual([4, cards, cards, expect.objectContaining({ cardsShow: expect.objectContaining({ Git: true }) })]);
  });

  it("shows no usage on a card whose provider's plan has no window with a percent, such as an unlimited one", async () => {
    await create(context => context.answer(MethodName.PlanUsageList, () =>
      [new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, null, null, null, null, true)], "2026-10-22T09:00:00.000Z").toJson()]));

    await openMenu(one(".top .cards-show"));
    menuItem("Usage today").click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    expect([shows("Alice"), shows("Bob"), all(".usage")]).toEqual([["Idle"], ["Idle"], []]);
  });

  it("says on each card what its teammate runs now, the earliest first with for how long and how many more, ticking each second", async () => {
    const clock = new FakeClock(Date.parse("2026-09-10T08:05:00.000Z"));
    TestBed.overrideProvider(ClockService, { useValue: clock });
    const reply = (id: string, chatId: string, started: string, status: MessageStatus): Message =>
      new Message(id, chatId, 1, MessageAuthor.Provider, null, status, [], SampleData.provenance, started, started,
        status === MessageStatus.Running ? null : started, [], "alice", "alice");
    const now = (name: string): string[] => [...texts(".now-icon", card(name)), ...texts(".now-text", card(name)), ...texts(".now-for", card(name))];
    await create();
    const idle = [now("Alice"), now("Offline"), clock.running];
    context.emit(EventName.MessageCreated, reply("r1", "c9", "2026-09-10T08:04:30.000Z", MessageStatus.Running).toJson());
    await settle();
    const single = now("Alice");
    context.emit(EventName.MessageCreated, reply("r2", "c1", "2026-09-10T08:04:20.000Z", MessageStatus.Running).toJson());
    await settle();
    const two = now("Alice");
    clock.advance(Resources.clockIntervalMilliseconds);
    await settle();
    const ticked = [now("Alice"), clock.intervals];
    context.emit(EventName.MessageUpdated, reply("r1", "c9", "2026-09-10T08:04:30.000Z", MessageStatus.Completed).toJson());
    context.emit(EventName.MessageUpdated, reply("r2", "c1", "2026-09-10T08:04:20.000Z", MessageStatus.Completed).toJson());
    await settle();

    expect(idle).toEqual([["pause_circle", "Nothing running"], ["pause_circle", "Stopped"], 0]);
    expect([single, two, ticked]).toEqual([["progress_activity", "Replying", "30 s"], ["progress_activity", "First", "40 s +1"],
      [["progress_activity", "First", "41 s +1"], [Resources.clockIntervalMilliseconds]]]);
    expect([now("Alice"), clock.running]).toEqual([["pause_circle", "Nothing running"], 0]);
    expect(card("Alice").querySelector(".now-icon")?.getAttribute("aria-hidden")).toBe("true");

    context.emit(EventName.MessageCreated, reply("r3", "c1", "2026-09-10T08:04:00.000Z", MessageStatus.Running).toJson());
    await openMenu(one(".tune", card("Alice")));
    menuItem("Current activity").click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    expect([all(".now", card("Alice")), now("Bob"), clock.running]).toEqual([[], ["pause_circle", "Nothing running"], 0]);
  });

  it("says on a card the last thing its teammate said, in at most two lines, and follows each reply it finishes", async () => {
    const said = "Linux passes; macOS and Windows are still running, and the review waits on both of them before it starts again tonight.";
    await create(context => context
      .answer(MethodName.OrganizationLayoutRead, () => ({ cardsShow: { Last: true } }))
      .answer(MethodName.TeammateLastReplyList, () => [new TeammateLastReply("alice", "c1", "r0", said, SampleData.timestamp).toJson()]));
    card("Alice").style.width = "12rem";
    await Wait.until(() => expect(texts(".last", card("Alice"))).toEqual([said]));
    const before = texts(".last", card("Bob"));
    context.emit(EventName.MessageUpdated, new Message("r1", "c1", 1, MessageAuthor.Provider, null, MessageStatus.Completed,
      [SampleData.detail(0, DetailKind.Text, "Done: the header.")], SampleData.provenance, SampleData.timestamp, SampleData.timestamp, SampleData.timestamp, [],
      "bob", "bob").toJson());
    await settle();
    const last = one(".last", card("Alice"));
    const height = AppearanceFixture.measureLook("line-label");

    expect([before, texts(".last", card("Bob"))]).toEqual([[], ["Done: the header."]]);
    AppearanceFixture.expectPixels(last.getBoundingClientRect().height, 2 * height);
    expect([getComputedStyle(last).webkitLineClamp, last.scrollHeight > last.clientHeight]).toEqual(["2", true]);
  });

  it("lets a card choose its own fields over every card's, until it or every card's choice is cleared", async () => {
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ cardsShow: { Model: true } })));
    const tune = (name: string): HTMLElement => one(".tune", card(name));

    expect([shows("Alice"), tune("Alice").getAttribute("aria-label")]).toEqual([["gpt-5 · high"], "Choose what Alice's card shows and where Alice works"]);

    await openMenu(tune("Alice"));
    expect(menuItem("Use what every card shows").getAttribute("aria-disabled")).toBe("true");
    menuItem("Model and effort").click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();
    await closeMenu();

    expect([shows("Alice"), shows("Code Reviewer")]).toEqual([[], []]);

    await openMenu(tune("Alice"));
    menuItem("Use what every card shows").click();
    await Wait.until(() => expect(saves).toHaveLength(2));
    await settle();
    await closeMenu();

    expect(shows("Alice")).toEqual(["gpt-5 · high"]);

    await openMenu(tune("Alice"));
    menuItem("Model and effort").click();
    await Wait.until(() => expect(saves).toHaveLength(3));
    await closeMenu();
    await openMenu(one(".top .cards-show"));
    menuItem("Clear every card's own choice").click();
    await Wait.until(() => expect(saves).toHaveLength(4));
    await settle();

    expect([shows("Alice"), saves[3]]).toEqual([["gpt-5 · high"], expect.objectContaining({ cards: {} })]);
  });

  it("shows the kept view checked among Tree, Board and Focus, and keeps the one chosen on the server", async () => {
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ view: "Board" })));
    const pills = (): string[][] => all(".top .views [role=radio]").map(t => [t.textContent?.trim() ?? "", t.getAttribute("aria-checked") ?? ""]);

    expect([one(".top .views [role=radiogroup]").getAttribute("aria-label"), pills()])
      .toEqual(["View", [["Tree", "false"], ["Board", "true"], ["Focus", "false"]]]);
    expect([all(".chart .tree").length, texts(".chart nol-canvas nol-teamrun-organization-board .lane-name")]).toEqual([0, ["Design", "UI", "Build"]]);

    one(".top .views [role=radio]:last-of-type").click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    expect([pills()[2], saves[0], texts(".chart > nol-teamrun-organization-focus .unit-name"), all("aside.messages").length])
      .toEqual([["Focus", "true"], expect.objectContaining({ view: "Focus", focus: null }), ["Organization"], 0]);
  });

  it("talks in the Organization chat panel beside the Tree under To, and beside the Board under its chat list, whose leaders and department buttons choose whom", async () => {
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ view: "Board" })));
    const panel = (): unknown[] => [all("aside.messages > nol-teamrun-organization-chats").length,
      texts("aside.messages > nol-teamrun-organization-chat .nol-teamrun-organization-chat-title"), all("aside.messages nol-teamrun-organization-chat > .to").length];

    expect(panel()).toEqual([1, ["Chat with Design"], 0]);
    await userEvent.click(one(".message-leaders"));
    await settle();
    expect(panel()).toEqual([1, ["Chat with all leaders and your direct reports"], 0]);
    await userEvent.click(one(".lane:nth-child(1) .message-department"));
    await settle();
    expect(panel()).toEqual([1, ["Chat with Design"], 0]);

    one(".top .views [role=radio]:first-of-type").click();
    await settle();
    expect(panel()).toEqual([0, ["Chat with Design"], 1]);
  });

  it("talks with the teammate whose Organization chat is chosen in the Board's chat list", async () => {
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ view: "Board" }))
      .answer(MethodName.ConversationList, t => Object.isNull(ConversationListParams.fromJson(t).projectId) ? [new Conversation("org-alice", null, "alice", SampleData.timestamp,
        SampleData.timestamp, false, null, null, false, null, false, [], false, false, null, new OrganizationChat("my-organization", "alice")).toJson()] : []));
    await Wait.until(() => expect(texts("aside.messages .nol-teamrun-organization-conversation-title")).toEqual(["Alice"]));

    await userEvent.click(one("aside.messages .nol-teamrun-organization-conversation"));
    await settle();

    expect(texts("aside.messages > nol-teamrun-organization-chat .nol-teamrun-organization-chat-title")).toEqual(["Chat with Alice"]);
  });

  it("talks with the kept focus until another conversation is chosen, and keeps that one when the organization changes", async () => {
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ focus: "Department:build" })));
    await Wait.until(() => expect(texts("aside.messages .nol-teamrun-organization-chat-title")).toEqual(["Chat with Build"]));
    const kept = texts("aside.messages .nol-teamrun-organization-chat-title");
    await userEvent.click(one(":scope > .department .message", department("Design")));
    await settle();
    const chosen = texts("aside.messages .nol-teamrun-organization-chat-title");

    context.emit(EventName.OrganizationChanged, organization.toJson());
    await settle();

    expect([kept, chosen, texts("aside.messages .nol-teamrun-organization-chat-title")]).toEqual([["Chat with Build"], ["Chat with Design"], ["Chat with Design"]]);
  });

  it("switches the structure into editing and back from the header, without keeping it on the server", async () => {
    await create();
    const edit = (): HTMLElement => one(".top .edit");
    const looks = (): unknown[] => [edit().textContent?.trim(), edit().classList.contains("nol-button-secondary"), edit().getAttribute("aria-pressed")];
    const before = looks();

    edit().click();
    await settle();
    const editing = looks();
    edit().click();
    await settle();

    expect([before, editing, looks(), saves]).toEqual([["account_treeEdit structure", true, "false"], ["account_treeDone editing", false, "true"],
      ["account_treeEdit structure", true, "false"], []]);
  });

  it("draws a message on the Tree while it is written, a pulse once sent, then a glow on its receiver, and fades an answer that stops", async () => {
    await create();
    await flow(asked, answer("r0", asked, "nobody", MessageStatus.Pending), answer("r1", asked, "bob", MessageStatus.Pending));
    const writing = routes();
    const faint = getComputedStyle(one(".nol-teamrun-flow-overlay path"));
    const look = [Number.parseFloat(faint.opacity) < 1, faint.strokeLinecap, faint.animationIterationCount];
    await flow(answer("r1", asked, "bob", MessageStatus.Running));
    const sent = [routes(), all(".nol-teamrun-flow-overlay .pulse").length];
    await end(".pulse");
    const arrived = [routes(), all(".nol-teamrun-flow-overlay .glow").length];
    await end(".glow");
    await flow(answer("r1", asked, "bob", MessageStatus.Failed));
    const faded = routes();
    await end("path.abandoned");

    expect([writing, sent, arrived, faded]).toEqual([["route writing"], [["route sent", "route writing"], 1], [["route writing"], 1], ["route abandoned"]]);
    expect(look).toEqual([true, "round", "infinite"]);
    expect([routes(), all(".nol-teamrun-flow-overlay span")]).toEqual([[], []]);
  });

  it.each([ThemeMode.Light, ThemeMode.Dark])("draws a message being written in the default theme's %s mode at 3:1 or more against the Tree's background", async mode => {
    AppearanceFixture.apply(DefaultTheme.theme, mode);
    await create();
    await flow(asked, answer("r1", asked, "bob", MessageStatus.Pending));
    const dots = getComputedStyle(one(".nol-teamrun-flow-overlay .writing"));
    const opaque = (view: Element | null): string => {
      const paint = Object.isNull(view) ? "rgb(0, 0, 0)" : getComputedStyle(view).backgroundColor;
      return Object.isNull(view) || !/^rgba\(.*, 0\)$|^transparent$/u.test(paint) ? paint : opaque(view.parentElement);
    };
    const background = opaque(one(".chart .tree"));
    const channels = (color: string): number[] => (color.match(/\d+(\.\d+)?/gu) ?? []).slice(0, 3).map(t => Number(t));
    const opacity = Number.parseFloat(dots.opacity);
    const seen = channels(dots.stroke).map((t, i) => Math.round(t * opacity + (channels(background).at(i) ?? 0) * (1 - opacity)));

    expect(dots.stroke).toBe(AppearanceFixture.readColor(DefaultTheme.theme, mode, "accent"));
    expect(AppearanceFixture.contrast(`rgb(${seen.join(", ")})`, background)).toBeGreaterThanOrEqual(3);
  });

  it("draws a teammate's send from its start to the teammate of the Organization chat it goes to, from its card up to the middle of its head's edge above it, and none to a chat with no Organization teammate or one the window doesn't know", async () => {
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    const organizationChat = new Conversation("org-alice", null, "alice", SampleData.timestamp, SampleData.timestamp, false, null, null, false, null, false, [], false, false,
      null, new OrganizationChat("my-organization", "alice"));
    const plain = new Conversation("plain", null, "Plain", SampleData.timestamp, SampleData.timestamp);
    await create(t => t.answer(MethodName.ConversationList, u => Object.isNull(ConversationListParams.fromJson(u).projectId) ? [organizationChat.toJson(), plain.toJson()] : []));
    await Wait.until(() => expect(ChatStoreService.of(context).conversation("plain")).not.toBeNull());
    const sending = async (sendId: string, toChatId: string): Promise<void> => {
      context.emit(EventName.MessageSending, new MessageSendingPayload(sendId, "c7", "bob", toChatId).toJson());
      await settle();
    };
    await sending("s1", "plain");
    await sending("s2", "nowhere");
    const none = routes();
    await sending("s3", "org-alice");
    const tree = one(".tree");
    const area = tree.getBoundingClientRect();
    const scale = area.width / TreeFlowLines.layoutWidthOf(tree);
    const local = (box: DOMRect): DOMRect => new DOMRect((box.left - area.left) / scale, (box.top - area.top) / scale, box.width / scale, box.height / scale);
    const bob = local(one("[data-flow-node=bob]").getBoundingClientRect());
    const alice = local(one("[data-flow-node=alice]").getBoundingClientRect());
    const points = (one(".nol-teamrun-flow-overlay path").getAttribute("d") ?? "").split(/[ML]/u).map(t => t.trim()).filter(t => t !== "")
      .map(t => t.split(" ").map(Number));
    const start = points.at(0) ?? [];
    const end = points.at(-1) ?? [];
    const round = (value: number): number => Math.round(value * 100) / 100;

    expect([none, routes(), start.join(" "), end.join(" "), bob.top - alice.bottom > 0])
      .toEqual([[], ["route writing"], `${round(bob.left + bob.width / 2)} ${round(bob.top)}`,
        `${round(alice.left + alice.width / 2)} ${round(alice.bottom)}`, true]);
  });

  it("draws a send from a card that renders after it starts, and draws it again from where the card moves while the tree keeps its size", async () => {
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    const organizationChat = new Conversation("org-reviewer", null, "reviewer", SampleData.timestamp, SampleData.timestamp, false, null, null, false, null, false, [], false,
      false, null, new OrganizationChat("my-organization", "reviewer"));
    await create(t => t.answer(MethodName.ConversationList, u => Object.isNull(ConversationListParams.fromJson(u).projectId) ? [organizationChat.toJson()] : []));
    await Wait.until(() => expect(ChatStoreService.of(context).conversation("org-reviewer")).not.toBeNull());
    const placed = (bob: boolean, designIndex: number): Organization => SampleData.organizationOf([
      new Department("design", "Design", "department", OrganizationParent.person, "alice", designIndex, "c", "u"),
      new Department("build", "Build", "department", OrganizationParent.person, null, 1 - designIndex, "c", "u"),
      new Department("ui", "UI", "department", OrganizationParent.department("design"), "reviewer", 0, "c", "u")
    ], [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("offline", OrganizationParent.department("build"), 0),
      new TeammatePlacement("reviewer", OrganizationParent.department("ui"), 0), ...bob ? [new TeammatePlacement("bob", OrganizationParent.department("design"), 1)] : []]);
    const change = async (next: Organization): Promise<void> => {
      context.emit(EventName.OrganizationChanged, next.toJson());
      await settle();
    };
    const round = (value: number): number => Math.round(value * 100) / 100;
    const fromBob = (): boolean => {
      const tree = one(".tree");
      const area = tree.getBoundingClientRect();
      const scale = area.width / TreeFlowLines.layoutWidthOf(tree);
      const bob = one("[data-flow-node=bob]").getBoundingClientRect();
      const start = `M ${round((bob.left - area.left + bob.width / 2) / scale)} ${round((bob.top - area.top) / scale)} `;
      return one(".nol-teamrun-flow-overlay path").getAttribute("d")?.startsWith(start) ?? false;
    };
    await change(placed(false, 0));
    context.emit(EventName.MessageSending, new MessageSendingPayload("s1", "c7", "bob", "org-reviewer").toJson());
    await settle();
    const before = routes();
    await change(placed(true, 0));
    const rendered = [routes(), fromBob()];
    const size = one(".tree").getBoundingClientRect();
    await change(placed(true, 1));
    const moved = one(".tree").getBoundingClientRect();

    expect([before, rendered, [moved.width, moved.height], fromBob()]).toEqual([[], [["route writing"], true], [size.width, size.height], true]);
  });

  it("draws no message on the Board, none while its setting is off, and none while motion is reduced", async () => {
    await create(t => t.changeSetting(Resources.organizationMessageFlowSetting, false));
    await flow(asked, answer("r1", asked, "bob", MessageStatus.Running));
    const off = routes();
    context.changeSetting(Resources.organizationMessageFlowSetting, true);
    await flow(answer("r2", asked, "alice", MessageStatus.Running));
    const on = routes();
    await pickView("Board");
    const board = all(".nol-teamrun-flow-overlay").length;
    await pickView("Tree");
    let reduced: string[] = [];
    try {
      await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
      await flow(answer("r3", asked, "bob", MessageStatus.Running));
      reduced = routes();
    }
    finally {
      await EmulatedMediaFixture.resetAsync();
    }

    expect([off, on, board, reduced]).toEqual([[], ["route sent", "route writing"], 0, []]);
  });

  it("ends the messages it can't draw, sent on the Board, in Focus or to a collapsed department's member, so the Tree shows none of them later", async () => {
    const clock = new FakeClock(Date.parse("2026-09-10T08:05:00.000Z"));
    TestBed.overrideProvider(ClockService, { useValue: clock });
    await create();
    const flows = OrganizationFlowService.of(context, signal(false), clock, () => null);
    const drawn = (): number => all(".nol-teamrun-flow-overlay path, .nol-teamrun-flow-overlay span").length;
    const sendAndEnd = async (id: string): Promise<number[]> => {
      await flow(asked, answer(id, asked, "bob", MessageStatus.Running), answer(id, asked, "bob", MessageStatus.Completed));
      const shown = [drawn(), flows.flows().length];
      clock.advance(Resources.organizationFlowPulseDuration + Resources.organizationFlowGlowDuration);
      await settle();
      return [...shown, flows.flows().length];
    };
    const toggle = (): HTMLElement => one(":scope > .department .department-toggle", department("Design"));
    toggle().click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await pickView("Board");
    await flow(asked, answer("r1", asked, "bob", MessageStatus.Running), answer("r1", asked, "bob", MessageStatus.Completed));
    await pickView("Focus");
    const focus = await sendAndEnd("r2");
    await pickView("Tree");
    const back = drawn();
    const collapsed = await sendAndEnd("r3");
    toggle().click();
    await Wait.until(() => expect(toggle().getAttribute("aria-expanded")).toBe("true"));
    await settle();

    expect([focus, back, collapsed, card("Bob").isConnected, drawn()]).toEqual([[0, 4, 0], 0, [0, 2, 0], true, 0]);
  });

  describe("with its messages beside the tree", () => {
    const heading = (): string[] => texts("aside.messages .nol-teamrun-organization-chat-title");

    afterEach(() => AppearanceFixture.reset());

    const select = (): HTMLElement => one("aside.messages .to-choice");
    const optionTexts = (): string[] => [...document.querySelectorAll<HTMLElement>(".nol-select-option")].map(t => t.textContent?.trim() ?? "");
    const pickAsync = async (label: string): Promise<string[]> => {
      await userEvent.click(one(".nol-select-button", select()));
      await Wait.until(() => expect(optionTexts().length).toBeGreaterThan(0));
      const shown = optionTexts();
      const option = [...document.querySelectorAll<HTMLElement>(".nol-select-option")].find(t => t.textContent?.trim() === label);
      if (Object.isUndefined(option))
        throw new Error(`No option reads ${label}.`);
      await userEvent.click(option);
      await settle();
      return shown;
    };
    const chosenLabel = (): string => one(".nol-select-value", select()).textContent?.trim() ?? "";

    it("talks to the first department until a teammate's name or a department's Message is chosen, also while editing, but not by the rest of a card, Enter on it or its own buttons", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
      await create();
      const first = [one("aside.messages").getAttribute("aria-label"), heading()];
      const names = ["Alice", "Bob"].map(t => [one(".name", card(t)).tagName, one(".name", card(t)).getAttribute("aria-label")]);

      await userEvent.click(one(".name", card("Bob")));
      await settle();
      const clicked = heading();
      one(".status", card("Alice")).click();
      card("Alice").focus();
      await userEvent.keyboard("{Enter}");
      await settle();
      const rest = heading();
      one(".name", card("Alice")).focus();
      await userEvent.keyboard("{Enter}");
      await settle();
      const entered = heading();
      await userEvent.click(one(":scope > .department .message", department("Build")));
      await settle();
      const build = [one(":scope > .department .message", department("Build")).getAttribute("aria-label"), heading()];
      await userEvent.keyboard("{Escape}");
      one(".tune", card("Bob")).click();
      await settle();
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(menuItems()).toEqual([]));
      const tuned = heading();
      one(".top .edit").click();
      await settle();
      card("Code Reviewer").click();
      await settle();
      const editing = [heading(), all(".message").length, all("button.name").length];
      one(":scope > .department .message", department("UI")).focus();
      await settle();
      await userEvent.click(one(":scope > .department .message", department("UI")));
      await settle();

      expect([first, names, clicked, rest, entered, build, tuned, editing, heading()]).toEqual([
        ["Messages", ["Chat with Design"]], [["BUTTON", "Message Alice"], ["BUTTON", "Message Bob"]], ["Chat with Bob"], ["Chat with Bob"], ["Chat with Alice"],
        ["Message Build", ["Chat with Build"]], ["Chat with Build"], [["Chat with Build"], 3, 0], ["Chat with UI"]]);
    });

    it("chooses a teammate in a nested department too", async () => {
      await create();

      one(".name", card("Code Reviewer")).click();
      await settle();

      expect(heading()).toEqual(["Chat with Code Reviewer"]);
    });

    it("pans the canvas when a card is dragged", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
      await create();
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const before = box(card("Bob"));
      const from = box(one(".status", card("Bob")));
      const to = box(card("Offline"));

      await userEvent.dragAndDrop(one(".status", card("Bob")), card("Offline"));
      await settle();
      const after = box(card("Bob"));

      AppearanceFixture.expectPixels(after.left - before.left, to.left + to.width / 2 - (from.left + from.width / 2));
      AppearanceFixture.expectPixels(after.top - before.top, to.top + to.height / 2 - (from.top + from.height / 2));
      expect(heading()).toEqual(["Chat with Design"]);
    });

    it("offers whom to talk to under To: all leaders, everyone, then each department with its leader and members in the tree's order, and follows the choice", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
      await create();
      const shown = [one("aside.messages .to-label").textContent?.trim(), select().querySelector(".nol-select-button")?.getAttribute("aria-label"), chosenLabel()];

      const offered = await pickAsync("UI (Department)");
      const ui = [heading(), chosenLabel()];
      await pickAsync("All leaders and your direct reports");
      const leaders = [heading(), chosenLabel()];
      await pickAsync("Everyone");
      const everyone = [heading(), chosenLabel()];
      await userEvent.click(one(".name", card("Offline")));
      await settle();

      expect([shown, offered, ui, leaders, everyone, [heading(), chosenLabel()]]).toEqual([["To", "To, Design (Department)", "Design (Department)"],
        ["All leaders and your direct reports", "Everyone", "Design (Department)", "Alice (leads Design)", "Bob", "UI (Department)", "Code Reviewer (leads UI)", "Build (Department)", "Offline"],
        [["Chat with UI"], "UI (Department)"], [["Chat with all leaders and your direct reports"], "All leaders and your direct reports"], [["Chat with Everyone"], "Everyone"], [["Chat with Offline"], "Offline"]]);
    });

    it("keeps whom it talks to when To answers with a choice no longer offered", async () => {
      await create();
      await pickAsync("Bob");

      fixture.debugElement.query(By.directive(SelectComponent)).injector.get(SelectComponent).valueChange.emit("teammate:gone");
      await settle();

      expect([heading(), chosenLabel()]).toEqual([["Chat with Bob"], "Bob"]);
    });

    it("asks whom to message while there is no department to talk to", async () => {
      await create(context => context.answer(MethodName.OrganizationList, () => [SampleData.organizationOf([], []).toJson()]), false);

      expect([heading(), texts("aside.messages .nol-teamrun-organization-empty")]).toEqual([[], ["Choose whom to message."]]);
    });

    it("sets the messages beside the canvas, a gap apart, as wide as their basis while the canvas takes the rest, and under it in a narrow view", async () => {
      await create();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      element().style.width = "80rem";
      element().style.height = "50rem";
      await settle();
      const chart = one(".chart");
      const messages = one("aside.messages");
      const body = one(".body");
      const inner = box(body).width - space(6) * 2;
      const free = inner - space(4) - 57 * rem;
      const wideChart = box(chart);
      const wideMessages = box(messages);
      const wideBody = box(body);
      element().style.width = "40rem";
      await settle();
      const narrowChart = box(chart);
      const narrowMessages = box(messages);

      AppearanceFixture.expectPixels(wideMessages.left - wideChart.right, space(4));
      AppearanceFixture.expectPixels(wideMessages.width, 22 * rem + free / 1000);
      AppearanceFixture.expectPixels(wideMessages.right, wideBody.right - space(6));
      AppearanceFixture.expectPixels(wideMessages.top, wideChart.top);
      AppearanceFixture.expectPixels(wideMessages.bottom, wideBody.bottom - space(6));
      AppearanceFixture.expectPixels(narrowChart.height, 32 * rem);
      AppearanceFixture.expectPixels(narrowMessages.height, 30 * rem);
      AppearanceFixture.expectPixels(narrowMessages.top - narrowChart.bottom, space(4));
      AppearanceFixture.expectPixels(narrowMessages.left, narrowChart.left);
      AppearanceFixture.expectPixels(narrowMessages.width, narrowChart.width);
      expect(getComputedStyle(body).overflowY).toBe("auto");
    });
  });

  describe("while its structure is edited", () => {
    const changes = [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentMove, MethodName.DepartmentDelete, MethodName.DepartmentMemberSet,
      MethodName.TeammatePlace];
    let asked: [string, JsonValue][];

    const editAsync = async (answer: () => JsonValue | Promise<JsonValue> = () => null): Promise<void> => {
      asked = [];
      await create(context => {
        for (const method of changes)
          context.answer(method, t => {
            asked.push([method, t]);
            return answer();
          });
      });
      element().style.width = "72rem";
      element().style.height = "60rem";
      one(".top .edit").click();
      await settle();
      one(".chart .nol-canvas-map-toggle").click();
      await settle();
      one(".chart .nol-canvas-fit").click();
      await settle();
    };
    const inDialog = (selector: string): HTMLElement => {
      const found = document.querySelector<HTMLElement>(`nol-dialog ${selector}`);
      if (Object.isNull(found))
        throw new Error(`No dialog shows ${selector}.`);
      return found;
    };
    const dialogAsync = async (): Promise<string[]> => {
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-confirm")?.textContent?.trim()).toBeTruthy());
      return [inDialog(".nol-dialog-title").textContent?.trim() ?? "", inDialog("[nolDialogDescription]").textContent?.trim() ?? "",
        inDialog(".nol-teamrun-confirm").textContent?.trim() ?? ""];
    };
    const answerAsync = async (selector: string): Promise<void> => {
      inDialog(selector).click();
      await Wait.until(() => expect(document.querySelector("nol-dialog")).toBeNull());
      await settle();
    };
    const optionsAsync = async (select: HTMLElement): Promise<string[]> => {
      await userEvent.click(one(".nol-select-button", select));
      await Wait.until(() => expect(document.querySelector(".nol-select-option")).not.toBeNull());
      return [...document.querySelectorAll<HTMLElement>(".nol-select-option")].map(t => t.textContent?.trim() ?? "");
    };
    const closeOptionsAsync = async (): Promise<void> => {
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.querySelector(".nol-select-option")).toBeNull());
    };
    const chooseAsync = async (select: HTMLElement, label: string): Promise<void> => {
      await optionsAsync(select);
      const option = [...document.querySelectorAll<HTMLElement>(".nol-select-option")].find(t => t.textContent?.trim() === label);
      if (Object.isUndefined(option))
        throw new Error(`No option reads ${label}.`);
      await userEvent.click(option);
      await settle();
    };
    const field = (name: string): HTMLInputElement => {
      const found = department(name).querySelector<HTMLInputElement>(":scope > .department .department-field");
      if (Object.isNull(found))
        throw new Error(`${name} has no name field.`);
      return found;
    };
    const rename = async (name: string, value: string): Promise<void> => {
      const named = field(name);
      named.value = value;
      named.dispatchEvent(new Event("change"));
      await settle();
    };

    it("names a department in a field in place of its toggle, renames it once the field changes, and puts back a blank or unchanged name", async () => {
      await editAsync();
      const shown = [own(department("Design"), ".department .department-toggle").length, field("Design").value, field("Design").getAttribute("aria-label")];

      await rename("Design", "  ");
      const blank = field("Design").value;
      await rename("Design", "Design");
      await rename("Design", " Craft ");

      expect([shown, blank, asked]).toEqual([[0, "Design", "Department name"], "Design", [[MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", name: "Craft" }]]]);
    });

    it("chooses a department's leader among its members in name order, then any other teammate, who joins it, or none", async () => {
      await editAsync();
      const leader = (): HTMLElement => one(":scope > .department .leader-choice", department("Design"));

      const options = await optionsAsync(leader());
      await closeOptionsAsync();
      await chooseAsync(leader(), "Bob");
      await chooseAsync(leader(), "Offline");
      await chooseAsync(leader(), "No leader");

      expect([options, asked]).toEqual([["No leader", "Alice", "Bob", "Code Reviewer", "Offline"], [
        [MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", leaderId: "bob" }],
        [MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", leaderId: "offline" }],
        [MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", leaderId: null }]
      ]]);
    });

    it("deletes a department only once you confirm, saying where what it held goes", async () => {
      await editAsync();
      const remove = (name: string): HTMLElement => one(":scope > .department .delete", department(name));

      remove("UI").click();
      const nested = await dialogAsync();
      await answerAsync(".nol-teamrun-cancel");
      const cancelled = asked.length;
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf([...organization.departments,
        new Department("lab", "Lab", "department", OrganizationParent.teammate("offline"), null, 0, "c", "u")], organization.placements).toJson());
      await settle();
      remove("Lab").click();
      const underTeammate = await dialogAsync();
      await answerAsync(".nol-teamrun-cancel");
      remove("Build").click();
      const top = await dialogAsync();
      await answerAsync(".nol-teamrun-confirm");

      expect([remove("Build").getAttribute("aria-label"), nested, cancelled, underTeammate, top, asked]).toEqual(["Delete Build",
        ["Delete department", "Delete UI? Its departments and members move to Design.", "Delete"], 0,
        ["Delete department", "Delete Lab? Its departments and members move to Offline.", "Delete"],
        ["Delete department", "Delete Build? Its departments move up to report to you, and its members leave every department.", "Delete"],
        [[MethodName.DepartmentDelete, { organizationId: "my-organization", departmentId: "build" }]]]);
    });

    it("removes a member from its card once you confirm, moves it under any place in the tree, and shows neither once editing is done", async () => {
      await editAsync();

      one(".remove", card("Bob")).click();
      await dialogAsync();
      await answerAsync(".nol-teamrun-cancel");
      const cancelled = asked.length;
      one(".remove", card("Bob")).click();
      const asking = await dialogAsync();
      await answerAsync(".nol-teamrun-confirm");
      const departments = await optionsAsync(one(".move-choice", card("Bob")));
      await closeOptionsAsync();
      await chooseAsync(one(".move-choice", card("Bob")), "Build (Department)");
      const label = one(".remove", card("Bob")).getAttribute("aria-label");
      one(".top .edit").click();
      await settle();

      expect(all(".remove, .move", card("Alice"))).toEqual([]);
      expect([cancelled, asking, label, departments, all(".remove, .move", card("Bob")).length]).toEqual([0,
        ["Remove member", "Remove Bob from Design? Bob stays on the team, in no department.", "Remove"], "Remove Bob",
        ["You", "Design (Department)", "Alice", "UI (Department)", "Code Reviewer", "Build (Department)", "Offline"], 0]);
      expect(asked).toEqual([[MethodName.DepartmentMemberSet, { organizationId: "my-organization", teammateId: "bob", departmentId: null }],
        [MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Department", id: "build" }, order: Resources.organizationLastOrder }]]);
    });

    it("shows each teammate's name on its card as text, in no field, where it shows outside editing, and renames no teammate", async () => {
      const at = (name: string): DOMRect => {
        const box = card(name).getBoundingClientRect();
        const shown = one(".name", card(name)).getBoundingClientRect();
        return new DOMRect(shown.left - box.left, shown.top - box.top);
      };
      await editAsync();
      const named = all("nol-teamrun-organization-card .name").map(t => t.textContent?.trim());
      const fields = all("nol-teamrun-organization-card .head input").length;
      const editingOnly = [all("nol-teamrun-organization-card .name.plain").length, all(".move-choice").length];
      const alice = at("Alice");
      const bob = at("Bob");
      one(".top .edit").click();
      await settle();

      expect([named.includes("Alice"), named.includes("Bob"), fields, editingOnly.every(t => t > 0)]).toEqual([true, true, 0, true]);
      expect([all("nol-teamrun-organization-card .name.plain").length, all(".move-choice").length]).toEqual([0, 0]);
      AppearanceFixture.expectPixels(alice.x, at("Alice").x);
      AppearanceFixture.expectPixels(alice.y, at("Alice").y);
      AppearanceFixture.expectPixels(bob.x, at("Bob").x);
      AppearanceFixture.expectPixels(bob.y, at("Bob").y);
      expect(context.count(MethodName.TeammateUpdate)).toBe(0);
    });

    const nodeOf = (name: string): HTMLElement => {
      const found = card(name).closest<HTMLElement>("nol-teamrun-organization-department");
      if (Object.isNull(found))
        throw new Error(`${name} is drawn in no node.`);
      return found;
    };
    const searchField = (): HTMLElement => one("nol-teamrun-organization-teammate-search .nol-quick-input-field", document);
    const searchTexts = (selector: string): string[] => [...document.querySelectorAll<HTMLElement>(`nol-teamrun-organization-teammate-search ${selector}`)]
      .map(t => t.textContent?.trim() ?? "");
    const searchAsync = async (trigger: HTMLElement, query: string): Promise<string[]> => {
      await userEvent.click(trigger);
      await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-teammate-search .nol-quick-input-field")).not.toBeNull());
      if (query.length > 0)
        await userEvent.type(searchField(), query);
      await settle();
      return searchTexts(".nol-quick-input-option .nol-quick-input-title");
    };
    const pickAsync = async (name: string): Promise<void> => {
      const option = [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-teammate-search .nol-quick-input-option")]
        .find(t => t.querySelector(".nol-quick-input-title")?.textContent?.trim() === name);
      if (Object.isUndefined(option))
        throw new Error(`The search offers no ${name}.`);
      await userEvent.click(option);
      await settle();
    };
    const dragData = (key: string): DataTransfer => {
      const data = new DataTransfer();
      data.setData(Resources.organizationDragType, key);
      return data;
    };
    const dragAsync = async (from: HTMLElement, to: HTMLElement, data: DataTransfer = new DataTransfer()): Promise<boolean> => {
      from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: data }));
      const over = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data });
      to.dispatchEvent(over);
      await settle();
      to.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
      await settle();
      return over.defaultPrevented;
    };
    const lastDialog = (): ParentNode => [...document.querySelectorAll("nol-dialog")].at(-1) ?? document;

    it("adds a teammate under a department from a search of the team that lists no one until a name is typed, moving one already placed", async () => {
      await editAsync();

      const before = await searchAsync(one(":scope > .adds > .add-member", department("Build")), "");
      const hint = searchTexts(".nol-quick-input-empty");
      await userEvent.type(searchField(), "zz");
      await settle();
      const none = searchTexts(".nol-quick-input-empty");
      await userEvent.clear(searchField());
      await userEvent.type(searchField(), "al");
      await settle();
      const found = searchTexts(".nol-quick-input-option .nol-quick-input-title");
      await pickAsync("Alice");
      await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-teammate-search")).toBeNull());

      expect([before, hint, none, found, asked]).toEqual([[], ["Type a teammate's name."], ["No teammate has that name."], ["Alice"],
        [[MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "alice", parent: { kind: "Department", id: "build" }, order: Resources.organizationLastOrder }]]]);
    });

    it("adds a teammate under a teammate and under you, closes the search on Escape, and refuses one above the node in the server's words, sending nothing", async () => {
      await editAsync();
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf([], [new TeammatePlacement("alice", OrganizationParent.person, 0),
        new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0)]).toJson());
      await settle();

      const offered = await searchAsync(one(":scope > .adds > .add-member", nodeOf("Bob")), "e");
      await pickAsync("Alice");
      const refused = searchTexts(".error");
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-teammate-search")).toBeNull());
      await searchAsync(one(".chart .kids .adds .add-member"), "off");
      await pickAsync("Offline");

      expect([offered.includes("Bob"), refused, asked]).toEqual([false, ["A teammate or department can't be under itself."],
        [[MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "offline", parent: { kind: "Person", id: null }, order: Resources.organizationLastOrder }]]]);
    });

    it("creates a department under a teammate from a dialog asking its name and a leader among the whole team, and nothing for a blank name", async () => {
      await editAsync();

      one(":scope > .adds > .add-sub-department", nodeOf("Bob")).click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-department-name")).not.toBeNull());
      await Wait.until(() => expect(inDialog(".nol-dialog-title").textContent?.trim()).toBe("New department"));
      const leaders = await optionsAsync(inDialog(".nol-teamrun-department-leader"));
      await closeOptionsAsync();
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "{Enter}");
      await settle();
      const blank = [asked.length, inDialog(".nol-teamrun-save").hasAttribute("disabled")];
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      await chooseAsync(inDialog(".nol-teamrun-department-leader"), "Offline");
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog")).toBeNull());

      expect([leaders, blank, asked]).toEqual([["No leader", "Alice", "Bob", "Code Reviewer", "Offline", "New teammate…"], [0, true],
        [[MethodName.DepartmentCreate, { organizationId: "my-organization", name: "Craft", typeId: "department", parent: { kind: "Teammate", id: "bob" }, leaderId: "offline" }]]]);
    });

    it("leads a new department with a new teammate made from the dialog, keeps the leader chosen before when that is closed, and stays open when it fails", async () => {
      await editAsync();
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf([], [new TeammatePlacement("alice", OrganizationParent.person, 0)]).toJson());
      await settle();

      one(".chart .add-department").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-department-name")).not.toBeNull());
      await chooseAsync(inDialog(".nol-teamrun-department-leader"), "Bob");
      await chooseAsync(inDialog(".nol-teamrun-department-leader"), "New teammate…");
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).not.toBeNull());
      one(".nol-teamrun-cancel", lastDialog()).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
      await settle();
      const kept = inDialog(".nol-teamrun-department-leader .nol-select-value").textContent?.trim();
      await chooseAsync(inDialog(".nol-teamrun-department-leader"), "New teammate…");
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).not.toBeNull());
      await userEvent.type(one("input.nol-teamrun-teammate-name", document), "Dana");
      one("button[form='nol-teamrun-teammate-form']", document).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(asked).toHaveLength(1));
      const dana = ChatStoreService.of(context).teammates().find(t => t.name === "Dana");

      expect([kept, dana?.name, asked]).toEqual(["Bob", "Dana",
        [[MethodName.DepartmentCreate, { organizationId: "my-organization", name: "Craft", typeId: "department", parent: { kind: "Person", id: null }, leaderId: dana?.id }]]]);
    });

    it("keeps the department dialog open, saying why, when the department can't be made", async () => {
      await editAsync(() => Promise.reject(new Error("The runtime is busy.")));

      one(".chart .add-department").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-department-name")).not.toBeNull());
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-dialog-error")?.textContent?.trim()).toBe("The runtime is busy."));
      inDialog(".nol-teamrun-cancel").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog")).toBeNull());
    });

    it("moves a nested department anywhere from its place choice, refusing one under itself in the server's words before it is sent", async () => {
      await editAsync();

      const offered = await optionsAsync(one(":scope > .department .place-choice", department("UI")));
      await closeOptionsAsync();
      await chooseAsync(one(":scope > .department .place-choice", department("UI")), "Offline");
      await chooseAsync(one(":scope > .department .place-choice", department("Design")), "UI (Department)");
      const refused = texts(".action-error");

      expect([offered, refused, asked]).toEqual([["You", "Design (Department)", "Alice", "Code Reviewer", "Bob", "Build (Department)", "Offline"],
        ["A teammate or department can't be under itself."],
        [[MethodName.DepartmentMove, { organizationId: "my-organization", departmentId: "ui", parent: { kind: "Teammate", id: "offline" }, order: Resources.organizationLastOrder }]]]);
    });

    it("drags a teammate or a department onto any node while editing, you included, refusing one dropped under itself, and drags nothing outside editing", async () => {
      await editAsync();

      const own = card("Offline");
      own.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() }));
      const ownOver = new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dragData("Teammate:offline") });
      own.dispatchEvent(ownOver);
      await settle();
      const marks = [ownOver.defaultPrevented, own.classList.contains("nol-teamrun-organization-drop-over"),
        one(":scope > .department", department("Design")).classList.contains("nol-teamrun-organization-drop-over")];
      own.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dragData("Teammate:offline") }));
      own.dispatchEvent(new DragEvent("dragend", { bubbles: true }));
      await settle();
      const self = [marks, texts(".action-error"), asked.length];
      const accepted = await dragAsync(card("Offline"), one(":scope > .department", department("Design")));
      await dragAsync(one(":scope > .department", department("UI")), card("Offline"));
      await dragAsync(card("Bob"), one(".owner"));
      await dragAsync(one(":scope > .department", department("Design")), one(":scope > .department", department("UI")));
      const refused = texts(".action-error");
      const foreign = new DataTransfer();
      foreign.setData("text/plain", "Offline");
      const otherData = await dragAsync(one(".owner"), card("Bob"), foreign);
      const owner = one(".owner").getAttribute("draggable");
      const target = one(":scope > .department", department("Build"));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dragData("Teammate:bob") }));
      await settle();
      const marked = target.classList.contains("nol-teamrun-organization-drop-over");
      target.dispatchEvent(new DragEvent("dragleave", { bubbles: true }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dragData("Teammate:") }));
      card("Bob").dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true }));
      await settle();
      const left = target.classList.contains("nol-teamrun-organization-drop-over");
      const sent = asked.length;
      one(".top .edit").click();
      await settle();
      const draggable = card("Bob").getAttribute("draggable");
      await dragAsync(card("Bob"), one(":scope > .department", department("Build")), dragData("Teammate:bob"));

      expect([self, accepted, refused, otherData, owner, marked, left, draggable, asked.length - sent]).toEqual([[[false, false, false], [], 0], true,
        ["A teammate or department can't be under itself."], false, null, true, false, null, 0]);
      expect(asked).toEqual([[MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "offline", parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder }],
        [MethodName.DepartmentMove, { organizationId: "my-organization", departmentId: "ui", parent: { kind: "Teammate", id: "offline" }, order: Resources.organizationLastOrder }],
        [MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Person", id: null }, order: Resources.organizationLastOrder }]]);
    });

    it("lands two drops made within one round trip in the order they were made, each sent once the one before it is answered", async () => {
      let release: () => void = () => undefined;
      const held = new Promise<JsonValue>(resolve => release = () => resolve(null));
      await editAsync(() => asked.length === 1 ? held : null);

      await dragAsync(card("Offline"), one(":scope > .department", department("Design")));
      await dragAsync(card("Bob"), one(":scope > .department", department("Design")));
      const whileHeld = asked.length;
      release();
      await Wait.until(() => expect(asked.length).toBe(2));

      expect([whileHeld, asked]).toEqual([1, [
        [MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "offline", parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder }],
        [MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder }]]]);
    });

    it("says why a change failed until it is dismissed", async () => {
      await editAsync(() => Promise.reject(new Error("The runtime is busy.")));

      await chooseAsync(one(".move-choice", card("Bob")), "Build (Department)");
      await Wait.until(() => expect(texts(".action-error")).toEqual(["The runtime is busy."]));
      const role = one(".action-error").getAttribute("role");
      one(".dismiss").click();
      await settle();

      expect([role, texts(".action-error")]).toEqual(["alert", []]);
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

    it("lines a card's current activity up inside its padding: the icon, its text a small space after, and the time at the end", async () => {
      await create();
      context.emit(EventName.MessageCreated, new Message("r1", "c9", 1, MessageAuthor.Provider, null, MessageStatus.Running, [], SampleData.provenance,
        SampleData.timestamp, SampleData.timestamp, null, [], "alice", "alice").toJson());
      await settle();
      const alice = card("Alice");
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const [icon, text, lasted] = [one(".now-icon", alice), one(".now-text", alice), one(".now-for", alice)];
      const style = getComputedStyle(alice);
      const inner = alice.getBoundingClientRect();
      const left = inner.left + Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth);
      const right = inner.right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth);

      AppearanceFixture.expectPixels(icon.getBoundingClientRect().left, left);
      AppearanceFixture.expectPixels(icon.getBoundingClientRect().width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(text.getBoundingClientRect().left - icon.getBoundingClientRect().right,
        AppearanceFixture.measureLook("space-1") + AppearanceFixture.measureLook("space-half"));
      AppearanceFixture.expectPixels(lasted.getBoundingClientRect().right, right);
      AppearanceFixture.expectPixels(icon.getBoundingClientRect().top - text.getBoundingClientRect().top, 0.0625 * rem);
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(text).fontSize), AppearanceFixture.measureLook("text-panel"));
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(lasted).fontSize), AppearanceFixture.measureLook("text-code"));
      expect([getComputedStyle(lasted).whiteSpace, getComputedStyle(text).overflowWrap]).toEqual(["nowrap", "break-word"]);
    });

    it("sets To under the chat's head over a select as wide as the panel's padding allows, above the composer, a department's Message under its summary at its start, and a name as plain text", async () => {
      await create();
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const aside = one("aside.messages");
      const border = Number.parseFloat(getComputedStyle(aside).borderTopWidth);
      const [head, label, choice, thread] = [one(".nol-teamrun-organization-chat-title", aside), one(".to-label", aside), one(".to-choice", aside),
        one("nol-teamrun-composer", aside)];
      const design = one(":scope > .department", department("Design"));
      const inset = Number.parseFloat(getComputedStyle(design).borderLeftWidth) + space(3);
      const [summary, message] = [one(".department-summary", design), one(".message", design)];
      const alice = card("Alice");
      const [name, role] = [one(".name", alice), one(".role", alice)];
      const labelStyle = getComputedStyle(label);
      const nameStyle = getComputedStyle(name);

      AppearanceFixture.expectPixels(box(label).left, box(aside).left + border + space(3));
      AppearanceFixture.expectPixels(box(head).top, box(aside).top + border + space(3));
      AppearanceFixture.expectPixels(box(label).top - box(head).bottom, space(3));
      AppearanceFixture.expectPixels(box(thread).top - box(choice).bottom, space(3));
      AppearanceFixture.expectPixels(box(choice).left, box(label).left);
      AppearanceFixture.expectPixels(box(choice).right, box(aside).right - border - space(3));
      AppearanceFixture.expectPixels(box(choice).top - box(label).bottom, space(3));
      AppearanceFixture.expectPixels(Number.parseFloat(labelStyle.fontSize), AppearanceFixture.measureLook("text-small"));
      AppearanceFixture.expectPixels(Number.parseFloat(labelStyle.lineHeight), AppearanceFixture.measureLook("line-label"));
      expect(labelStyle.fontWeight).toBe(getComputedStyle(element()).getPropertyValue("--nol-weight-emphasis").trim());
      AppearanceFixture.expectPixels(box(message).left, box(design).left + inset);
      AppearanceFixture.expectPixels(box(message).top - box(summary).bottom, space(1) + AppearanceFixture.measureLook("space-half"));
      expect(box(message).right).toBeLessThanOrEqual(box(design).right - inset);
      AppearanceFixture.expectPixels(box(name).left, box(role).left);
      AppearanceFixture.expectPixels(box(role).top, box(name).bottom);
      expect([nameStyle.paddingLeft, nameStyle.paddingTop, nameStyle.borderTopWidth, nameStyle.fontWeight]).toEqual(["0px", "0px", "0px",
        getComputedStyle(element()).getPropertyValue("--nol-weight-emphasis").trim()]);
    });

    it("sizes the cards, hangs each leader under its department, the members off one line, and joins the departments to you through one bar", async () => {
      await create();
      element().style.width = "100rem";
      element().style.height = "76rem";
      await settle();
      await Wait.until(async () => {
        one(".chart .nol-canvas-actual").click();
        await settle();
        await settle();
        expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const line = (view: Element, pseudo: string): CSSStyleDeclaration => getComputedStyle(view, pseudo);
      const design = department("Design");
      const build = department("Build");
      const card = one(":scope > .department", design);
      const leader = one(":scope > .leader", design);
      const stem = one(":scope > .stem", design);
      const reports = one(":scope > .reports", design);
      const report = one(":scope > .report", reports);
      const member = one(":scope > .self", report);
      const owner = one(".owner");
      const kids = one(".chart .tree > .kids");

      for (const view of [owner, card, leader, one(":scope > .department", build)])
        AppearanceFixture.expectPixels(box(view).width, 15 * rem);
      AppearanceFixture.expectPixels(box(member).width, 13.25 * rem);
      AppearanceFixture.expectPixels(box(stem).height, space(3));
      AppearanceFixture.expectPixels(box(stem).left + box(stem).width / 2, box(card).left + box(card).width / 2);
      AppearanceFixture.expectPixels(box(leader).top - box(card).bottom, space(3));
      AppearanceFixture.expectPixels(box(leader).left, box(card).left);
      AppearanceFixture.expectPixels(box(member).left + box(member).width / 2, box(leader).left + box(leader).width / 2);
      AppearanceFixture.expectPixels(box(member).top - box(leader).bottom, space(3) * 2);
      expect([line(reports, "::before").borderLeftStyle, line(reports, "::after").borderTopStyle, line(report, "::before").borderLeftStyle])
        .toEqual(["solid", "solid", "solid"]);
      for (const length of [line(reports, "::before").height, line(reports, "::after").top, line(report, "::before").height])
        AppearanceFixture.expectPixels(Number.parseFloat(length), space(3));
      AppearanceFixture.expectPixels(box(kids).top - box(owner).bottom, 0);
      AppearanceFixture.expectPixels(box(card).top - box(kids).top, space(3) * 2);
      AppearanceFixture.expectPixels(box(owner).left + box(owner).width / 2, box(kids).left + box(kids).width / 2);
      AppearanceFixture.expectPixels(box(build).left - box(design).right, 0);
      for (const [length, expected] of [[line(design, "::before").left, box(design).width / 2], [line(build, "::before").right, box(build).width / 2],
        [line(design, "::after").height, space(3)]] as const)
        AppearanceFixture.expectPixels(Number.parseFloat(length), expected);
      expect(getComputedStyle(one(":scope > .department .department-name", design)).fontWeight)
        .toBe(getComputedStyle(element()).getPropertyValue("--nol-weight-emphasis").trim());
    });

    it("routes a message along the lines from you down the bar, a department's stem and its report grid's bus to a member, and from a nested leader to that member past one side of the grid, a space-2 gap from the cards, into the head over it, with the pulse drawn over the cards", async () => {
      await create();
      await Wait.until(async () => {
        one(".chart .nol-canvas-actual").click();
        await settle();
        expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const tree = one(".chart .tree");
      const scale = box(tree).width / TreeFlowLines.layoutWidthOf(tree);
      const at = (x: number, y: number): FlowPoint => new FlowPoint(x, y);
      const points = (): FlowPoint[] => (one(".nol-teamrun-flow-overlay path:last-of-type").getAttribute("d") ?? "").split(/[ML]/u).filter(t => t.trim().length > 0)
        .map(t => t.trim().split(" ").map(u => Number.parseFloat(u)))
        .map(t => at(box(tree).left + (t.at(0) ?? Number.NaN) * scale, box(tree).top + (t.at(1) ?? Number.NaN) * scale));
      const expectRoute = (shown: readonly FlowPoint[], listed: readonly FlowPoint[]): void => {
        const expected = listed.filter((point, i) => i === 0 || Math.hypot(point.x - (listed.at(i - 1)?.x ?? 0), point.y - (listed.at(i - 1)?.y ?? 0)) > 0.01);
        expect(shown.length).toBe(expected.length);
        expected.forEach((point, i) => {
          AppearanceFixture.expectPixels(shown.at(i)?.x ?? Number.NaN, point.x);
          AppearanceFixture.expectPixels(shown.at(i)?.y ?? Number.NaN, point.y);
        });
      };
      const middle = (view: Element): number => box(view).left + box(view).width / 2;
      const design = department("Design");
      const ui = department("UI");
      const kids = one(".chart .tree > .kids");
      const stem = one(":scope > .stem", design);
      const uiStem = one(":scope > .stem", ui);
      const reports = one(":scope > .reports", design);
      const bob = card("Bob");
      const bus = box(reports).top + Number.parseFloat(getComputedStyle(reports, "::after").top) * scale;
      const uiCard = one(":scope > .department", ui);
      const alice = card("Alice");
      const gap = AppearanceFixture.measureLook("space-2");
      const cards = all(".chart nol-teamrun-organization-card, .chart .department").filter(t => t !== uiCard && t !== alice);
      const crosses = (from: FlowPoint, to: FlowPoint, view: Element): boolean => {
        const inside = box(view);
        const across = Math.max(Math.min(from.x, to.x), inside.left + 1) < Math.min(Math.max(from.x, to.x), inside.right - 1)
          || (from.x === to.x && from.x > inside.left + 1 && from.x < inside.right - 1);
        const down = Math.max(Math.min(from.y, to.y), inside.top + 1) < Math.min(Math.max(from.y, to.y), inside.bottom - 1)
          || (from.y === to.y && from.y > inside.top + 1 && from.y < inside.bottom - 1);
        return across && down;
      };
      const toBob = [at(middle(reports), box(reports).top), at(middle(reports), bus), at(middle(bob), bus), at(middle(bob), box(bob).top)];

      await flow(asked, answer("r1", asked, "bob", MessageStatus.Pending));
      const fromYou = points();
      await flow(forwarded, answer("r2", forwarded, "bob", MessageStatus.Pending));
      const fromReviewer = points();
      const pulse = one(".nol-teamrun-flow-overlay .pulse");
      const motion = pulse.getAnimations().at(0);
      if (Object.isUndefined(motion))
        throw new Error("The pulse doesn't move.");
      motion.pause();
      const layers = [".lines", ".pulse"].map(t => getComputedStyle(one(`.nol-teamrun-flow-overlay ${t}`)).zIndex);
      const centreAt = (time: number): FlowPoint => {
        motion.currentTime = time;
        return at(box(pulse).left + box(pulse).width / 2, box(pulse).top + box(pulse).height / 2);
      };
      const pulseEnds = [centreAt(0), centreAt(Resources.organizationFlowPulseDuration)];
      await end(".pulse");
      const overlay = getComputedStyle(one(".nol-teamrun-flow-overlay"));

      expectRoute(fromYou, [at(middle(kids), box(kids).top), at(middle(kids), box(design).top), at(middle(design), box(design).top),
        at(middle(design), box(one(":scope > .department", design)).top), at(middle(stem), box(stem).top), at(middle(stem), box(card("Alice")).top), ...toBob]);
      expectRoute(pulseEnds, [fromReviewer.at(0) ?? at(Number.NaN, Number.NaN), fromReviewer.at(-1) ?? at(Number.NaN, Number.NaN)]);
      expectRoute(fromReviewer, [at(middle(uiStem), box(card("Code Reviewer")).top), at(middle(uiStem), box(uiStem).top),
        at(middle(uiCard), box(uiCard).top + gap), at(box(bob).left - gap, box(uiCard).top + gap), at(box(bob).left - gap, box(reports).top - gap),
        at(middle(reports), box(reports).top - gap), ...toBob]);
      const head = box(alice);
      const joins = [box(bob).left - gap, middle(reports)];
      expect([box(bob).left - gap > box(uiCard).left, box(reports).top - gap > head.top, box(reports).top - gap < head.bottom,
        joins.every(t => t > head.left && t < head.right)]).toEqual([true, true, true, true]);
      expect(fromReviewer.slice(1).flatMap((point, i) => cards.filter(t => crosses(fromReviewer.at(i) ?? point, point, t)).map(t => (t.textContent ?? "").trim().slice(0, 12))))
        .toEqual([]);
      await Wait.until(() => {
        const glow = box(one(".nol-teamrun-flow-overlay .glow"));
        AppearanceFixture.expectPixels(glow.left, box(bob).left);
        AppearanceFixture.expectPixels(glow.top, box(bob).top);
        AppearanceFixture.expectPixels(glow.width, box(bob).width);
        AppearanceFixture.expectPixels(glow.height, box(bob).height);
      });
      expect([overlay.pointerEvents, getComputedStyle(tree).isolation, layers]).toEqual(["none", "isolate", ["-1", "1"]]);
    });

    it("lays your direct reports in a grid centred under you, above the departments, each card in a column of a member's width", async () => {
      await create(() => {
        organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u"),
          new Department("build", "Build", "department", OrganizationParent.person, null, 1, "c", "u")],
          [new TeammatePlacement("alice", OrganizationParent.department("design"), 0),
            new TeammatePlacement("bob", OrganizationParent.department("design"), 1),
            new TeammatePlacement("reviewer", OrganizationParent.person, 0), new TeammatePlacement("offline", OrganizationParent.person, 1)]);
      });
      await Wait.until(async () => {
        one(".chart .nol-canvas-actual").click();
        await settle();
        await settle();
        expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const owner = one(".owner");
      const reports = one(".chart .tree > .reports");
      const kids = one(".chart .tree > .kids");
      const reviewer = card("Code Reviewer");
      const offline = card("Offline");

      expect([reports.nextElementSibling, texts(":scope > .report > .self .name", reports)]).toEqual([kids, ["Code Reviewer", "Offline"]]);
      for (const view of [reviewer, offline])
        AppearanceFixture.expectPixels(box(view).width, 13.25 * rem);
      AppearanceFixture.expectPixels(box(reports).left + box(reports).width / 2, box(owner).left + box(owner).width / 2);
      AppearanceFixture.expectPixels(box(reviewer).top - box(owner).bottom, space(3) * 2);
      AppearanceFixture.expectPixels(box(offline).top, box(reviewer).top);
      AppearanceFixture.expectPixels(box(offline).left - box(reviewer).right, space(4));
      AppearanceFixture.expectPixels(box(kids).top, box(reports).bottom);
    });

    it.each([24, 47.75, 48, 120])("lays the chat panel out across the messages in a %drem view, beside the Tree for a group and a teammate and under the Board's chat list", async width => {
      await create();
      element().style.width = `${width}rem`;
      await settle();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const inner = box(one(".body")).width - 2 * space(6);
      const across = (basis: number): number => {
        if (width < 48)
          return inner;
        const free = inner - space(4) - (35 + basis) * rem;
        if (free >= 0)
          return basis * rem + free / 1000;
        const shrinks = basis * rem - 2 * Number.parseFloat(getComputedStyle(one("aside.messages")).borderLeftWidth);
        return basis * rem + free * shrinks / (35 * rem + shrinks);
      };
      const laidOut = (basis: number): HTMLElement => {
        const aside = one("aside.messages");
        const border = Number.parseFloat(getComputedStyle(aside).borderLeftWidth);
        const panel = one(":scope > nol-teamrun-organization-chat", aside);
        const [title, composer] = [box(one(".nol-teamrun-organization-chat-title", panel)), box(one("nol-teamrun-composer", panel))];
        AppearanceFixture.expectPixels(box(aside).width, across(basis));
        AppearanceFixture.expectPixels(box(panel).left, box(aside).left + border);
        AppearanceFixture.expectPixels(box(panel).right, box(aside).right - border);
        AppearanceFixture.expectPixels(title.right, box(panel).right - space(3));
        AppearanceFixture.expectPixels(composer.left, box(panel).left);
        AppearanceFixture.expectPixels(composer.right, box(panel).right);
        expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
        return panel;
      };

      const group = laidOut(22);
      const [icon, title, choice] = [box(one(".nol-teamrun-organization-chat-icon", group)), box(one(".nol-teamrun-organization-chat-title", group)), box(one(".to-choice", group))];
      AppearanceFixture.expectPixels(icon.left, box(group).left + space(3));
      AppearanceFixture.expectPixels(title.left, icon.right + space(2));
      AppearanceFixture.expectPixels(choice.right, box(group).right - space(3));
      for (const row of all(".nol-teamrun-organization-recipient", group)) {
        AppearanceFixture.expectPixels(box(row).left, box(group).left + space(1));
        AppearanceFixture.expectPixels(box(row).right, box(group).right - space(1));
        AppearanceFixture.expectPixels(box(one(".nol-teamrun-organization-recipient-status", row)).right, box(row).right - space(2));
      }
      one(".name", card("Alice")).click();
      await Wait.until(() => expect(texts("aside.messages .nol-teamrun-organization-chat-title")).toEqual(["Chat with Alice"]));
      await settle();
      const teammate = laidOut(22);
      AppearanceFixture.expectPixels(box(one(".nol-teamrun-organization-chat-title", teammate)).left, box(teammate).left + space(3));
      AppearanceFixture.expectPixels(box(one(".history", teammate)).bottom, box(one("nol-teamrun-composer", teammate)).top);
      one(".top .views [role=radio]:nth-of-type(2)").click();
      await settle();
      const board = laidOut(24);
      expect([texts(".nol-teamrun-organization-chat-title", board), box(board).top >= box(one("aside.messages > nol-teamrun-organization-chats")).bottom]).toEqual([["Chat with Alice"], true]);
    });

    it("fills the space under the header, inside the view's padding, with the canvas and the messages beside it, 22rem wide for the Tree's thread and 24rem for the Board's inbox as the chart takes the rest, and fits the chart at 100% to its top, under the canvas's tools", async () => {
      await create();
      element().style.width = "100rem";
      element().style.height = "76rem";
      await settle();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
      const [host, top, canvas, messages] = [element().getBoundingClientRect(), box(".top"), box(".chart > nol-canvas"), box("aside.messages")];
      const [tools, tree] = [box(".chart .nol-canvas-tools"), box(".chart .tree")];
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const panelWidth = (basis: number): number => basis * rem + (host.width - 2 * space(6) - space(4) - (35 + basis) * rem) / 1000;

      for (const [actual, expected] of [[canvas.top, top.bottom + space(4)], [canvas.left, host.left + space(6)], [canvas.right, messages.left - space(4)],
        [messages.right, host.right - space(6)], [canvas.bottom, host.bottom - space(6)], [messages.top, canvas.top], [messages.bottom, canvas.bottom],
        [messages.width, panelWidth(22)]] as const)
        AppearanceFixture.expectPixels(actual, expected);
      one(".top .views [role=radio]:nth-of-type(2)").click();
      await settle();
      AppearanceFixture.expectPixels(box("aside.messages").width, panelWidth(24));
      one(".top .views [role=radio]:first-of-type").click();
      await settle();
      expect([texts(".chart .nol-canvas-zoom"), tree.top >= tools.bottom, tree.top - tools.bottom < box(".owner").height]).toEqual([["100%"], true, true]);
    });

    it("stacks each view below 48rem: the Board's 32rem canvas over its 34rem inbox, and Focus's outline, at most 20rem, over its 32rem canvas and conversation", async () => {
      await create();
      element().style.width = "40rem";
      element().style.height = "50rem";
      await settle();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
      one(".top .views [role=radio]:nth-of-type(2)").click();
      await settle();
      const [board, inbox] = [box(".chart"), box("aside.messages")];
      for (const [actual, expected] of [[board.height, 32 * rem], [inbox.height, 34 * rem], [inbox.top - board.bottom, space(4)], [inbox.left, board.left],
        [inbox.width, board.width]] as const)
        AppearanceFixture.expectPixels(actual, expected);

      one(".top .views [role=radio]:nth-of-type(3)").click();
      await settle();
      const [chart, outline, focus, canvas, conversation] = [box(".chart"), box(".chart .outline"), box(".chart section.focus"), box(".chart section.focus > nol-canvas"),
        box(".chart section.focus > nol-teamrun-organization-chat")];
      for (const [actual, expected] of [[outline.left, chart.left], [outline.width, chart.width], [focus.top - outline.bottom, space(4)], [focus.left, chart.left],
        [focus.width, chart.width], [canvas.height, 32 * rem], [conversation.top - canvas.bottom, space(4)], [conversation.height, 17 * rem]] as const)
        AppearanceFixture.expectPixels(actual, expected);
      expect([all("aside.messages").length, getComputedStyle(one(".chart .outline")).maxHeight, outline.height <= 20 * rem + 1]).toEqual([0, `${20 * rem}px`, true]);
    });

    it("keeps the cards at their widths while editing, with their fields, choices and buttons inside the cards' padding", async () => {
      await create();
      element().style.width = "72rem";
      element().style.height = "60rem";
      one(".top .edit").click();
      await settle();
      one(".chart .nol-canvas-actual").click();
      await settle();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const inset = AppearanceFixture.measureLook("space-3") + 1;
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const design = department("Design");
      const unit = box(one(":scope > .department", design));
      const name = box(one(":scope > .department .department-field", design));
      const remove = box(one(":scope > .department .delete", design));
      const leader = box(one(":scope > .department .leader-choice", design));
      const bob = box(card("Bob"));
      const move = box(one(".move", card("Bob")));
      const drop = box(one(".remove", card("Bob")));
      const tune = box(one(".tune", card("Bob")));

      for (const [actual, expected] of [[unit.width, 15 * rem], [bob.width, 13.25 * rem], [name.left, unit.left + inset], [remove.right, unit.right - inset],
        [leader.left, unit.left + inset], [leader.right, unit.right - inset], [move.left, bob.left + inset], [move.right, bob.right - inset],
        [tune.right, bob.right - inset]] as const)
        AppearanceFixture.expectPixels(actual, expected);
      expect([name.right <= remove.left, drop.right <= tune.left, texts(".chart .nol-canvas-zoom")]).toEqual([true, true, ["100%"]]);
    });


    it("wraps your direct reports after four columns, filling each row in name order before the next", async () => {
      const named = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
      const team = [named("fay", "Fay"), named("ada", "Ada"), named("eve", "Eve"), named("bea", "Bea"), named("dee", "Dee"), named("cy", "Cy")];
      await create(t => {
        organization = SampleData.organizationOf([], team.map((u, i) => new TeammatePlacement(u.id, OrganizationParent.person, i)));
        t.answer(MethodName.TeammateList, () => team.map(u => u.toJson()));
      });
      await Wait.until(async () => {
        one(".chart .nol-canvas-actual").click();
        await settle();
        await settle();
        expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const reports = one(".chart .tree > .reports");
      const ada = box(card("Ada"));
      const bea = box(card("Bea"));
      const dee = box(card("Dee"));
      const eve = box(card("Eve"));
      const fay = box(card("Fay"));

      expect(texts(":scope > .report > .self .name", reports)).toEqual(["Ada", "Bea", "Cy", "Dee", "Eve", "Fay"]);
      for (const [view, top] of [[bea, ada.top], [box(card("Cy")), ada.top], [dee, ada.top], [fay, eve.top]] as const)
        AppearanceFixture.expectPixels(view.top, top);
      AppearanceFixture.expectPixels(eve.left, ada.left);
      AppearanceFixture.expectPixels(fay.left, bea.left);
      AppearanceFixture.expectPixels(eve.top - ada.bottom, space(3));
      AppearanceFixture.expectPixels(dee.right - ada.left, box(reports).width);
    });

    it("routes a message to a report below the grid's first row along the bus and down the column gap beside it, a space-2 gap from the cards on either side", async () => {
      const named = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
      const team = [named("fay", "Fay"), named("ada", "Ada"), named("eve", "Eve"), named("bea", "Bea"), named("dee", "Dee"), named("cy", "Cy")];
      await create(t => {
        organization = SampleData.organizationOf([], team.map((u, i) => new TeammatePlacement(u.id, OrganizationParent.person, i)));
        t.answer(MethodName.TeammateList, () => team.map(u => u.toJson()));
      });
      await Wait.until(async () => {
        one(".chart .nol-canvas-actual").click();
        await settle();
        await settle();
        expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const tree = one(".chart .tree");
      const scale = box(tree).width / TreeFlowLines.layoutWidthOf(tree);
      const reports = one(".chart .tree > .reports");
      const middle = box(reports).left + box(reports).width / 2;
      const bus = box(reports).top + Number.parseFloat(getComputedStyle(reports, "::after").top) * scale;
      const gap = AppearanceFixture.measureLook("space-2");
      const eve = box(card("Eve"));
      const fay = box(card("Fay"));
      const bea = box(card("Bea"));

      await flow(asked, answer("r1", asked, "fay", MessageStatus.Pending));
      const shown = (one(".nol-teamrun-flow-overlay path").getAttribute("d") ?? "").split(/[ML]/u).filter(t => t.trim().length > 0)
        .map(t => t.trim().split(" ").map(u => Number.parseFloat(u)))
        .map(t => new FlowPoint(box(tree).left + (t.at(0) ?? Number.NaN) * scale, box(tree).top + (t.at(1) ?? Number.NaN) * scale));
      const expected = [new FlowPoint(middle, box(reports).top), new FlowPoint(middle, bus), new FlowPoint(bea.left - gap, bus),
        new FlowPoint(bea.left - gap, fay.top + gap), new FlowPoint(fay.left + fay.width / 2, fay.top + gap)];

      expect(shown.length).toBe(expected.length);
      expected.forEach((point, i) => {
        AppearanceFixture.expectPixels(shown.at(i)?.x ?? Number.NaN, point.x);
        AppearanceFixture.expectPixels(shown.at(i)?.y ?? Number.NaN, point.y);
      });
      AppearanceFixture.expectPixels(fay.left - (bea.left - gap), gap);
      AppearanceFixture.expectPixels(bea.left - gap - eve.right, gap);
    });

    it("hangs a teammate's reports and departments under its card at any depth, each card centred over its own, a department in a row below", async () => {
      await create(() => {
        organization = SampleData.organizationOf([new Department("ui", "UI", "department", OrganizationParent.teammate("bob"), null, 0, "c", "u")],
          [new TeammatePlacement("alice", OrganizationParent.person, 0), new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0),
            new TeammatePlacement("reviewer", OrganizationParent.teammate("alice"), 1), new TeammatePlacement("offline", OrganizationParent.teammate("bob"), 0)]);
      });
      await Wait.until(async () => {
        one(".chart .nol-canvas-actual").click();
        await settle();
        await settle();
        expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const centre = (view: Element): number => box(view).left + box(view).width / 2;
      const alice = card("Alice");
      const bob = card("Bob");
      const reviewer = card("Code Reviewer");
      const offline = card("Offline");
      const ui = one(":scope > .department", department("UI"));
      const bobNode = one(":scope > .reports > .report:nth-child(1)", one(".chart .tree > .reports > .report"));
      const reviewerNode = one(":scope > .reports > .report:nth-child(2)", one(".chart .tree > .reports > .report"));

      for (const view of [alice, bob, reviewer, offline])
        AppearanceFixture.expectPixels(box(view).width, 13.25 * rem);
      AppearanceFixture.expectPixels(box(bob).top - box(alice).bottom, space(3) * 2);
      AppearanceFixture.expectPixels(box(reviewer).top, box(bob).top);
      AppearanceFixture.expectPixels(box(reviewerNode).left - box(bobNode).right, space(4));
      AppearanceFixture.expectPixels((box(bobNode).left + box(reviewerNode).right) / 2, centre(alice));
      AppearanceFixture.expectPixels(centre(bob), centre(bobNode));
      AppearanceFixture.expectPixels(centre(reviewer), centre(reviewerNode));
      AppearanceFixture.expectPixels(box(offline).top - box(bob).bottom, space(3) * 2);
      AppearanceFixture.expectPixels(centre(offline), centre(bob));
      expect(box(ui).top).toBeGreaterThan(box(offline).bottom);
      expect(box(ui).left).toBeGreaterThanOrEqual(box(bobNode).left);
      expect(box(ui).right).toBeLessThanOrEqual(box(bobNode).right);
    });

    it("joins the add buttons to the bar over the departments while editing, as it joins a department, the line meeting the pair's middle", async () => {
      await create();
      element().style.width = "72rem";
      element().style.height = "60rem";
      one(".top .edit").click();
      await settle();
      one(".chart .nol-canvas-actual").click();
      await settle();
      const kid = one(".chart .tree > .kids > .kid:last-child");
      const [box, member, button] = [kid.getBoundingClientRect(), one(".add-member", kid).getBoundingClientRect(), one(".add-department", kid).getBoundingClientRect()];
      const [bar, drop] = [getComputedStyle(kid, "::before"), getComputedStyle(kid, "::after")];

      expect([getComputedStyle(kid).position, bar.borderTopStyle, drop.borderLeftStyle]).toEqual(["relative", "solid", "solid"]);
      AppearanceFixture.expectPixels(Number.parseFloat(bar.right), box.width / 2);
      AppearanceFixture.expectPixels(box.left + Number.parseFloat(drop.left), box.left + box.width / 2);
      AppearanceFixture.expectPixels(box.top + Number.parseFloat(drop.height), button.top);
      AppearanceFixture.expectPixels(box.left + box.width / 2, (member.left + button.right) / 2);
      AppearanceFixture.expectPixels(member.top, button.top);
    });

    describe.each([
      { size: "the narrowest a document gets", width: 13.75, wraps: true },
      { size: "a wide window", width: 72, wraps: false }
    ])("at $size", ({ width, wraps }) => {
      it("heads the view with its title over its headcount on the left, then the status key, Cards show and Edit structure half a step apart, wrapping under it when narrow, and fits the tree on the canvas under its tools", async () => {
        await create();
        element().style.width = `${width}rem`;
        element().style.height = "40rem";
        await settle();
        one(".chart .nol-canvas-fit").click();
        await settle();
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
        const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
        const [top, title, headcount, tools, key, cards, edit] = [box(".top"), box(".top .title"), box(".top .headcount"), box(".top .tools"),
          box(".top .status-key"), box(".top .cards-show"), box(".top .edit")];
        const [canvas, bar, owner] = [box(".chart > nol-canvas"), box(".chart .nol-canvas-tools"), box(".owner")];
        const heading = getComputedStyle(one(".top .title"));

        AppearanceFixture.expectPixels(title.left, top.left + space(6));
        AppearanceFixture.expectPixels(headcount.left, title.left);
        AppearanceFixture.expectPixels(headcount.top, title.bottom);
        AppearanceFixture.expectPixels(Number.parseFloat(heading.fontSize), AppearanceFixture.measureLook("text-heading"));
        AppearanceFixture.expectPixels(Number.parseFloat(heading.lineHeight), 2 * rem);
        expect(tools.right).toBeLessThanOrEqual(top.right - space(6) + 0.5);
        AppearanceFixture.expectPixels(canvas.top, top.bottom + space(4));
        AppearanceFixture.expectPixels(canvas.left, top.left + space(6));
        expect([owner.top >= bar.bottom, owner.left >= canvas.left, all(".top .status-key nol-teamrun-teammate-status").length]).toEqual([true, true, 4]);
        if (wraps) {
          AppearanceFixture.expectPixels(tools.left, title.left);
          expect(tools.top).toBeGreaterThanOrEqual(headcount.bottom);
          return;
        }
        AppearanceFixture.expectPixels(edit.right, tools.right);
        AppearanceFixture.expectPixels(cards.left - key.right, space(2));
        AppearanceFixture.expectPixels(edit.left - cards.right, space(2));
        AppearanceFixture.expectPixels(tools.right, top.right - space(6));
        for (const view of [key, cards, edit])
          expect(Math.abs(view.top + view.height / 2 - (top.top + top.height / 2))).toBeLessThanOrEqual(0.5);
        expect(tools.left).toBeGreaterThan(headcount.right);
      });
    });
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, surface: "panel" },
    { look: "dark", mode: ThemeMode.Dark, surface: "raised" }
  ])("in $look's colours", ({ mode, surface }) => {
    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    it("draws the messages on the panel's colour in a rounded card's border, in light and dark", async () => {
      await create();
      const messages = one("aside.messages");
      const probe = document.createElement("span");
      element().append(probe);
      const colour = (name: string): string => {
        probe.style.color = `var(--nol-${name})`;
        return getComputedStyle(probe).color;
      };
      const expected = [colour("panel"), colour("card-border")];
      probe.remove();
      const style = getComputedStyle(messages);

      expect([style.backgroundColor, style.borderTopColor, style.borderTopStyle]).toEqual([...expected, "solid"]);
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopWidth), AppearanceFixture.measureLook("border-width"));
      AppearanceFixture.expectPixels(Number.parseFloat(style.borderTopLeftRadius), AppearanceFixture.measureLook("radius-large"));
    });

    it("draws the cards, departments and you on the panel's colour in light and the raised colour in dark, off the canvas's, a department's count on a filled badge, and a status's word in its colour", async () => {
      await create();
      const colour = (name: string): string => {
        const probe = document.createElement("span");
        probe.style.color = `var(--nol-${name})`;
        element().append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      const count = one(":scope > .department .department-count", department("Design"));
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);

      expect([one(".owner"), one(":scope > .department", department("Design")), card("Alice")].map(t => getComputedStyle(t).backgroundColor))
        .toEqual(Array.from({ length: 3 }, () => colour(surface)));
      expect([getComputedStyle(count).backgroundColor, getComputedStyle(count).color]).toEqual([colour("badge"), colour("badge-text")]);
      AppearanceFixture.expectPixels(count.getBoundingClientRect().height, 1.25 * rem);
      expect(all(".top .status-key nol-teamrun-teammate-status").map(t => [t.textContent?.trim(), getComputedStyle(t).color])).toEqual([
        ["Working", colour("text")], ["Waiting for you", colour("warning")], ["Idle", colour("text")], ["Stopped", colour("status-failed")]]);
    });

    it.each([
      { used: 79, fill: "text-muted" },
      { used: 80, fill: "warning" }
    ])("draws a card's usage at $used% used as a bar across the card a step high, filled in $fill, half a step before its figure", async ({ used, fill }) => {
      await create(context => context
        .answer(MethodName.OrganizationLayoutRead, () => ({ cardsShow: { Usage: true } }))
        .answer(MethodName.PlanUsageList, () => [new PlanUsage("codex", "a1", [new PlanWindow(PlanWindowName.FiveHour, used, null)], "2026-10-22T09:00:00.000Z").toJson()]));
      const probe = document.createElement("span");
      probe.style.color = `var(--nol-${fill})`;
      element().append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const meter = one(".usage", card("Alice"));
      const [box, track, text] = [card("Alice").getBoundingClientRect(), one(".nol-meter-track", meter).getBoundingClientRect(),
        one(".nol-meter-text", meter).getBoundingClientRect()];
      const inset = Number.parseFloat(getComputedStyle(card("Alice")).borderLeftWidth) + space(3);

      expect([meter.textContent?.trim(), getComputedStyle(one(".nol-meter-fill", meter)).backgroundColor]).toEqual([`${used}%`, expected]);
      AppearanceFixture.expectPixels(track.left, box.left + inset);
      AppearanceFixture.expectPixels(track.height, space(1));
      AppearanceFixture.expectPixels(text.left - track.right, space(2));
      expect(text.right).toBeLessThanOrEqual(box.right - inset + 0.5);
      expect(track.width).toBeGreaterThan(box.width - 2 * inset - 2 * space(6));
    });
  });
});
