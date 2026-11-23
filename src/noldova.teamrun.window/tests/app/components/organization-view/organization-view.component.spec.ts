/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { signal, type WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import { RuntimeRequestException, WindowPartTokens } from "@noldova/desktop.window";
import {
  Conversation, ConversationListParams, Department, DetailKind, EventName, Harness, Message, MessageAuthor, MessageSender, MessageSendingPayload, MessageStatus,
  MethodName, NodeType, Organization, OrganizationChat, OrganizationLayoutSaveParams, OrganizationParent, PlanUsage, PlanWindow, PlanWindowName, Teammate,
  TeammateIdParams, TeammateLastReply, TeammatePlacement, TeammateWork
} from "@noldova/teamrun.protocol";
import { DefaultTheme, SelectComponent, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { page, userEvent } from "vitest/browser";

import { OrganizationViewComponent } from "../../../../src/app/components/organization-view/organization-view.component";
import { FlowFrame } from "../../../../src/app/models/flow-frame";
import { FlowPoint } from "../../../../src/app/models/flow-point";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { OrganizationFlowService } from "../../../../src/app/services/organization-flow.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { Resources } from "../../../../src/resources";
import { CheckedLabel } from "../../../fixtures/checked-label.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { PartReadError } from "../../../fixtures/part-read-error.fixture";
import { RecordedRequest } from "../../../fixtures/recorded-request.fixture";
import { Required } from "../../../fixtures/required.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { SurfaceLookCase } from "../../../fixtures/surface-look-case.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { ThemeCase } from "../../../fixtures/theme-case.fixture";
import { UpdatedDocument } from "../../../fixtures/updated-document.fixture";
import { UsageFillCase } from "../../../fixtures/usage-fill-case.fixture";
import { ViewSizeCase } from "../../../fixtures/view-size-case.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationViewComponent", () => {
  let context: FakeWindowPartContext;
  let active: WritableSignal<boolean>;
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
  const texts = (selector: string, root: ParentNode = element()): string[] => all(selector, root).map(t => t.textContent?.trim() ?? "");
  const department = (name: string): HTMLElement => {
    const found = all("nol-teamrun-organization-department").find(t => t.querySelector(":scope > .department .department-name")?.textContent?.trim() === name);
    if (Object.isUndefined(found))
      throw new PartReadError(`No department is named ${name}.`);
    return found;
  };
  const own = (view: HTMLElement, selector: string): HTMLElement[] => all(`:scope > ${selector}`, view);
  const reportsOf = (view: HTMLElement): string[] => [...own(view, ".reports").flatMap(t => texts(":scope > .report > .self .name", t)),
    ...own(view, ".kids").flatMap(t => texts(":scope > .kid > .self .name", t))];
  const unitsOf = (view: HTMLElement): HTMLElement[] => own(view, ".kids").flatMap(t => all(":scope > nol-teamrun-organization-department", t))
    .filter(t => own(t, ".department").length > 0);
  const shape = (view: HTMLElement): unknown[] => [
    texts(":scope > .department .department-name", view)[0],
    texts(":scope > .department .department-count", view)[0],
    texts(":scope > .department .department-summary", view)[0],
    own(view, ".leader").map(t => t.querySelector(".name")?.textContent?.trim()),
    reportsOf(view),
    unitsOf(view).map(shape),
    texts(":scope > .hidden", view)
  ];
  const menuItems = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
  const menuItem = (label: string): HTMLButtonElement => {
    const found = menuItems().find(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim() === label);
    if (Object.isUndefined(found))
      throw new PartReadError(`No menu item reads ${label}.`);
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
      throw new PartReadError(`No card is named ${name}.`);
    return found;
  };
  const shows = (name: string): string[] => [...texts(".status", card(name)), ...texts(".usage", card(name)), ...texts(".model", card(name))];
  const checks = (): CheckedLabel[] => menuItems().map(t => new CheckedLabel(t.querySelector(".nol-menu-item-label")?.textContent?.trim() ?? null, t.getAttribute("aria-checked")));
  const tree = (): unknown[] => unitsOf(one(".chart .tree")).map(shape);
  const reports = (): string[] => reportsOf(one(".chart .tree"));
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
    active = signal(true);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context },
      { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() }, { provide: WindowPartTokens.activeDocument, useValue: active.asReadonly() }] });
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
  const end = async (selector: string): Promise<void> => {
    one(`.nol-teamrun-flow-overlay ${selector}`).dispatchEvent(new AnimationEvent("animationend"));
    await settle();
  };
  const holdFlows = (): void => {
    TestBed.overrideProvider(ClockService, { useValue: new FakeClock(Date.parse("2026-09-10T08:05:00.000Z")) });
    const still = document.createElement("style");
    still.textContent = ".nol-teamrun-flow-overlay path, .nol-teamrun-flow-overlay .pulse, .nol-teamrun-flow-overlay .glow { animation-play-state: paused; }";
    document.head.append(still);
    onTestFinished(() => still.remove());
  };
  const createTeal = async (): Promise<string> => {
    holdFlows();
    AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
    await create(() => {
      organization = new Organization("my-organization", "My organization", null, 0, SampleData.timestamp, SampleData.timestamp,
        [SampleData.departmentType, new NodeType("team", "Team", "groups", "teal", SampleData.timestamp, SampleData.timestamp)],
        sample.departments.map(t => t.id === "design" ? new Department("design", "Design", "team", OrganizationParent.person, "alice", 0, "c", "u") : t), sample.placements);
    });
    const probe = document.createElement("span");
    probe.style.color = "var(--nol-swatch-teal)";
    element().append(probe);
    const teal = getComputedStyle(probe).color;
    probe.remove();
    return teal;
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
      .toEqual([["My organization"], ["4 teammates · 3 units"], ["You"], ["Owner · 1 direct report"], "Organization structure", 8]);
    expect(tree()).toEqual([
      ["Design", "2", "2 idle", ["Alice"], ["Bob"], [["UI", "1", "1 idle", ["Code Reviewer"], [], [], []]], []],
      ["Build", "1", "1 stopped", [], ["Offline"], [], []]
    ]);
    expect(texts(".role", department("Design"))).toEqual(["Review"]);
  });

  it("names the organization its document instance names in its title, and follows a rename", async () => {
    const second = new Organization("o2", "Second", null, 1, "c", "u", [SampleData.departmentType], [], []);
    await create(context => context.answer(MethodName.OrganizationList, () => [organization.toJson(), second.toJson()]));
    const mine = texts(".top .title");

    fixture.componentRef.setInput("instance", "o2");
    await Wait.until(() => expect(texts(".top .title")).toEqual(["Second"]));
    context.emit(EventName.OrganizationChanged, new Organization("o2", "Studio", null, 1, "c", "u2", [SampleData.departmentType], [], []).toJson());
    await settle();

    expect([mine, texts(".top .title")]).toEqual([["My organization"], ["Studio"]]);
  });

  it("names its document after the organization once it is read and after each rename, and never after one it doesn't show", async () => {
    let fails = true;
    await create(context => context.answer(MethodName.OrganizationList, () => {
      if (fails)
        throw new RuntimeRequestException(FailureCode.Internal, "The database is locked.");
      return [organization.toJson()];
    }), false);
    await Wait.until(() => expect(texts(".failure .error")).toHaveLength(1));
    const unread = context.updates.length;

    fails = false;
    one(".failure button").click();
    await Wait.until(() => expect(context.updates).toHaveLength(1));
    context.emit(EventName.OrganizationChanged, new Organization("o2", "Other", null, 1, "c", "u", [SampleData.departmentType], [], []).toJson());
    await settle();
    const other = context.updates.length;
    context.emit(EventName.OrganizationChanged, new Organization("my-organization", "Studio", null, 0, SampleData.timestamp, "u2", [SampleData.departmentType],
      sample.departments, sample.placements).toJson());
    await settle();

    expect([unread, other, context.updates]).toEqual([0, 1, [new UpdatedDocument(Resources.organizationDocumentName, "my-organization", { title: "My organization" }),
      new UpdatedDocument(Resources.organizationDocumentName, "my-organization", { title: "Studio" })]]);
  });

  it("marks its organization in view while its document is the active one or is touched, and gives up only its own mark when another is active or it closes", async () => {
    await create();
    const store = ChatStoreService.of(context);
    const marks: (string | null)[] = [store.organizationInView()];

    active.set(false);
    await settle();
    marks.push(store.organizationInView());
    element().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    marks.push(store.organizationInView());
    store.showOrganization("o2", true);
    active.set(true);
    await settle();
    marks.push(store.organizationInView());
    store.showOrganization("o2", true);
    active.set(false);
    await settle();
    marks.push(store.organizationInView());
    one(".top .edit").dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    marks.push(store.organizationInView());
    fixture.destroy();

    expect([...marks, store.organizationInView()]).toEqual(["my-organization", null, "my-organization", "my-organization", "o2", "my-organization", null]);
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

    expect([nested, tree(), reports(), texts(".top .headcount"), texts(".owner .role")]).toEqual([["Owner · 2 direct reports"], [], [], ["0 teammates · 0 units"],
      ["Owner · 0 direct reports"]]);
  });

  it("leaves a teammate with no placement out of the organization: no card, no direct report and no place in the headcount", async () => {
    await create(() => {
      organization = SampleData.organizationOf([new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u")],
        [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("design"), 1),
          new TeammatePlacement("reviewer", OrganizationParent.person, 0)]);
    });

    expect([texts(".top .headcount"), reports(), texts(".chart nol-teamrun-organization-card .name").includes("Offline"), texts(".owner .role")])
      .toEqual([["3 teammates · 1 unit"], ["Code Reviewer"], false, ["Owner · 2 direct reports"]]);
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
      ["3 teammates · 2 units"], ["Code Reviewer"],
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

    expect([all(".chart .tree > .kids > .kid > .self").length, [all(".move-choice", card("Code Reviewer")).length, all(".remove", card("Code Reviewer")).length]])
      .toEqual([1, [1, 0]]);
  });

  it("collapses a department to a count of the leader, members and nested departments' people it hides, keeps that on the server, and opens it again", async () => {
    await create();
    const toggle = (): HTMLElement => one(":scope > .department .department-toggle", department("Design"));

    expect([toggle().getAttribute("aria-expanded"), toggle().getAttribute("aria-label")]).toEqual(["true", "Hide Design's members"]);

    toggle().click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    expect([toggle().getAttribute("aria-expanded"), toggle().getAttribute("aria-label"), shape(department("Design"))])
      .toEqual(["false", "Show Design's members", ["Design", "2", "2 idle", [], [], [], ["3 members hidden"]]]);
    expect(saves[0]).toEqual(expect.objectContaining({ collapsedDepartments: ["design"] }));

    toggle().click();
    await Wait.until(() => expect(saves).toHaveLength(2));
    await settle();

    expect([shape(department("Design"))[3], shape(department("Design"))[4]]).toEqual([["Alice"], ["Bob"]]);
  });

  it("says how many a collapsed department hides: its leader, its members or its nested departments' people, and nothing when no one is there", async () => {
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ collapsedDepartments: ["ui", "build", "top"] })));

    expect([shape(department("UI")), shape(department("Build"))])
      .toEqual([["UI", "1", "1 idle", [], [], [], ["1 member hidden"]], ["Build", "1", "1 stopped", [], [], [], ["1 member hidden"]]]);

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
    expect(checks()).toEqual([new CheckedLabel("Status", "true"), new CheckedLabel("Current activity", "true"), new CheckedLabel("Usage today", "false"),
      new CheckedLabel("Last message", "false"), new CheckedLabel("Model and effort", "false"), new CheckedLabel("Git branch", "false"),
      new CheckedLabel("Pull requests", "false"), new CheckedLabel("Documents", "false"), new CheckedLabel("Artifacts", "false"),
      new CheckedLabel("Clear every card's own choice", null)]);
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
    holdFlows();
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

  it("draws a message to a unit's people in the unit type's colour, and one to a unit whose type has none in the accent colour", async () => {
    const teal = await createTeal();
    await flow(asked, answer("r1", asked, "bob", MessageStatus.Pending), answer("r2", asked, "alice", MessageStatus.Pending),
      answer("r3", asked, "offline", MessageStatus.Pending));

    expect(all(".nol-teamrun-flow-overlay path").map(t => getComputedStyle(t).stroke))
      .toEqual([teal, teal, AppearanceFixture.readColor(FixtureTheme.theme, ThemeMode.Light, "accent")]);
    expect(teal).not.toBe(AppearanceFixture.readColor(FixtureTheme.theme, ThemeMode.Light, "accent"));
  });

  it("draws a reply from a unit's people back to you in the colour of the unit it comes from, and one from a unit whose type has none in the accent colour", async () => {
    const teal = await createTeal();
    await flow(asked, answer("r1", asked, "bob", MessageStatus.Running), answer("r2", asked, "alice", MessageStatus.Running),
      answer("r3", asked, "offline", MessageStatus.Running));

    expect(all(".nol-teamrun-flow-overlay path.writing").map(t => getComputedStyle(t).stroke))
      .toEqual([teal, teal, AppearanceFixture.readColor(FixtureTheme.theme, ThemeMode.Light, "accent")]);
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
    const scale = area.width / FlowFrame.layoutWidthOf(tree);
    const local = (box: DOMRect): DOMRect => new DOMRect((box.left - area.left) / scale, (box.top - area.top) / scale, box.width / scale, box.height / scale);
    const bob = local(one("[data-flow-node=bob]").getBoundingClientRect());
    const alice = local(one("[data-flow-node=alice]").getBoundingClientRect());
    const points = (one(".nol-teamrun-flow-overlay path").getAttribute("d") ?? "").split(/[ML]/u).map(t => t.trim()).filter(t => !String.isNullOrEmpty(t))
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
      const scale = area.width / FlowFrame.layoutWidthOf(tree);
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

  it("draws no message in the Tree while its setting is off or motion is reduced", async () => {
    const drawn = async (id: string): Promise<string[]> => {
      await flow(asked, answer(id, asked, "alice", MessageStatus.Pending));
      return routes();
    };
    await create(t => t.changeSetting(Resources.organizationMessageFlowSetting, false));
    const off = await drawn("r1");
    context.changeSetting(Resources.organizationMessageFlowSetting, true);
    const on = await drawn("r2");
    let reduced: string[] = [];
    try {
      await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
      reduced = await drawn("r3");
    }
    finally {
      await EmulatedMediaFixture.resetAsync();
    }

    expect([off, on, reduced]).toEqual([[], ["route writing"], []]);
  });

  it("ends the messages it can't draw, sent to a collapsed department's member, so the Tree shows none of them once it opens", async () => {
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
    await settle();
    const collapsed = await sendAndEnd("r3");
    toggle().click();
    await Wait.until(() => expect(toggle().getAttribute("aria-expanded")).toBe("true"));
    await settle();

    expect([collapsed, card("Bob").isConnected, drawn()]).toEqual([[0, 2, 0], true, 0]);
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
        throw new PartReadError(`No option reads ${label}.`);
      await userEvent.click(option);
      await settle();
      return shown;
    };
    const chosenLabel = (): string => one(".nol-select-value", select()).textContent?.trim() ?? "";

    it("says why a send failed once, in the panel, and not in the view's header", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
      await create(context => context.answer(MethodName.OrganizationChatOpen, () => Promise.reject(new Error("The runtime is busy."))));

      await userEvent.fill(one("aside.messages nol-teamrun-composer textarea"), "Status?");
      await settle();
      await userEvent.click(one("aside.messages .nol-teamrun-composer-send"));
      await Wait.until(() => expect(texts("aside.messages nol-teamrun-organization-chat [role=alert]")).toEqual(["The runtime is busy."]));
      await settle();

      expect([texts("[role=alert]"), texts(".action-error")]).toEqual([["The runtime is busy."], []]);
    });

    it("talks to the first department until a teammate's or a unit's name is chosen, but not by the rest of a card, Enter on it or its own buttons, and keeps that through editing", async () => {
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
      const unitName = [one(":scope > .department .department-name", department("Build")).tagName, all(":scope > .department button", department("Build")).length];
      await userEvent.click(one(":scope > .department .department-name", department("Build")));
      await settle();
      const build = [one(":scope > .department .department-name", department("Build")).getAttribute("aria-label"), heading()];
      await userEvent.keyboard("{Escape}");
      one(".tune", card("Bob")).click();
      await settle();
      await userEvent.keyboard("{Escape}");
      await Wait.until(() => expect(menuItems()).toEqual([]));
      const tuned = heading();
      one(".top .edit").click();
      await settle();
      card("Code Reviewer").click();
      await userEvent.click(one(":scope > .department .department-name", department("UI")));
      await settle();
      const editing = [heading(), all(".message").length, all("button.name").length, one(":scope > .department .department-name", department("UI")).tagName];
      one(".top .edit").click();
      await settle();

      expect([first, names, unitName, clicked, rest, entered, build, tuned, editing, heading()]).toEqual([
        ["Messages", ["Chat with Design"]], [["BUTTON", "Message Alice"], ["BUTTON", "Message Bob"]], ["BUTTON", 2], ["Chat with Bob"], ["Chat with Bob"], ["Chat with Alice"],
        ["Message Build", ["Chat with Build"]], ["Chat with Build"], [[], 0, 0, "SPAN"], ["Chat with Build"]]);
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
      const leaders = [heading(), chosenLabel(), all("aside.messages .to-choice").length];
      await pickAsync("Everyone");
      const everyone = [heading(), chosenLabel()];
      await userEvent.click(one(".name", card("Offline")));
      await settle();

      expect([shown, offered, ui, leaders, everyone, [heading(), chosenLabel()]]).toEqual([["To", "To, Design (Department)", "Design (Department)"],
        ["All leaders and your direct reports", "Everyone", "Design (Department)", "Alice (leads Design)", "Bob", "UI (Department)", "Code Reviewer (leads UI)", "Build (Department)", "Offline"],
        [["Chat with UI"], "UI (Department)"], [["Chat with all leaders and your direct reports"], "All leaders and your direct reports", 1], [["Chat with Everyone"], "Everyone"], [["Chat with Offline"], "Offline"]]);
    });

    it("offers a teammate who reports to your direct report outside a department after your direct reports, at any depth", async () => {
      await create(() => {
        organization = SampleData.organizationOf([], [new TeammatePlacement("alice", OrganizationParent.person, 0),
          new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0), new TeammatePlacement("offline", OrganizationParent.teammate("bob"), 0)]);
      });

      expect([await pickAsync("Offline"), heading()]).toEqual([["All leaders and your direct reports", "Everyone", "Alice", "Bob", "Offline"], ["Chat with Offline"]]);
    });

    it("offers your direct reports by name, then the teammates under them by name", async () => {
      await create(() => {
        organization = SampleData.organizationOf([], [new TeammatePlacement("offline", OrganizationParent.person, 0),
          new TeammatePlacement("reviewer", OrganizationParent.person, 1), new TeammatePlacement("alice", OrganizationParent.teammate("reviewer"), 0)]);
      });

      expect(await pickAsync("Alice")).toEqual(["All leaders and your direct reports", "Everyone", "Code Reviewer", "Offline", "Alice"]);
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

    it("sets the messages against the canvas behind a 1px line, as wide as their basis while the canvas takes the rest, and under it in a narrow view", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
      onTestFinished(() => AppearanceFixture.reset());
      await create();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      element().style.width = "80rem";
      element().style.height = "50rem";
      await settle();
      const chart = one(".chart");
      const messages = one("aside.messages");
      const body = one(".body");
      const free = box(body).width - 57 * rem;
      const wideChart = box(chart);
      const wideMessages = box(messages);
      const wideBody = box(body);
      const wide = [getComputedStyle(messages).borderLeftWidth, getComputedStyle(messages).borderTopWidth];
      element().style.width = "40rem";
      await settle();
      const narrowChart = box(chart);
      const narrowMessages = box(messages);

      AppearanceFixture.expectPixels(wideMessages.left, wideChart.right);
      AppearanceFixture.expectPixels(wideMessages.width, 22 * rem + free / 1000);
      AppearanceFixture.expectPixels(wideMessages.right, wideBody.right);
      AppearanceFixture.expectPixels(wideMessages.top, wideChart.top);
      AppearanceFixture.expectPixels(wideMessages.bottom, wideBody.bottom);
      AppearanceFixture.expectPixels(narrowChart.height, 32 * rem);
      AppearanceFixture.expectPixels(narrowMessages.height, 30 * rem);
      AppearanceFixture.expectPixels(narrowMessages.top, narrowChart.bottom);
      AppearanceFixture.expectPixels(narrowMessages.left, narrowChart.left);
      AppearanceFixture.expectPixels(narrowMessages.width, narrowChart.width);
      expect([getComputedStyle(body).overflowY, getComputedStyle(messages).borderLeftWidth, getComputedStyle(messages).borderTopWidth]).toEqual(["auto", "0px", "1px"]);
      expect(wide).toEqual(["1px", "0px"]);
    });
  });

  describe("while its structure is edited", () => {
    const changes = [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentMove, MethodName.DepartmentDelete, MethodName.DepartmentMemberSet,
      MethodName.TeammatePlace];
    let asked: RecordedRequest[];

    const editAsync = async (answer: () => JsonValue | Promise<JsonValue> = () => null): Promise<void> => {
      asked = [];
      await create(context => {
        for (const method of changes)
          context.answer(method, t => {
            asked.push(new RecordedRequest(method, t));
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
        throw new PartReadError(`No dialog shows ${selector}.`);
      return found;
    };
    const dialogAsync = async (): Promise<string[]> => {
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-confirm")?.textContent?.trim()).toBeTruthy());
      return [inDialog(".nol-dialog-title").textContent?.trim() ?? "", inDialog("[nolDialogDescription]").textContent?.trim() ?? "",
        inDialog(".nol-teamrun-confirm").textContent?.trim() ?? ""];
    };
    const fadedAsync = async (): Promise<void> => {
      await Wait.until(() => expect(document.querySelector(".cdk-overlay-backdrop:not(.cdk-overlay-backdrop-showing)")).toBeNull());
    };
    const answerAsync = async (selector: string): Promise<void> => {
      inDialog(selector).click();
      await Wait.until(() => expect(document.querySelector("nol-dialog")).toBeNull());
      await fadedAsync();
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
        throw new PartReadError(`No option reads ${label}.`);
      await userEvent.click(option);
      await settle();
    };
    const editor = (): HTMLElement => one("aside.messages.editor nol-teamrun-organization-unit-editor");
    const editUnitAsync = async (name: string): Promise<HTMLElement> => {
      one(":scope > .department .edit-unit", department(name)).click();
      await settle();
      return editor();
    };
    const field = (): HTMLInputElement => {
      const found = editor().querySelector<HTMLInputElement>("input.name-field");
      if (Object.isNull(found))
        throw new PartReadError("The unit editor has no name field.");
      return found;
    };
    const rename = async (value: string): Promise<void> => {
      field().value = value;
      field().dispatchEvent(new Event("change"));
      await settle();
    };

    it("asks for a unit while editing, opens the unit chosen by its Edit button or a click on it in the editor beside the tree, outlined, and closes it from Close or Done editing", async () => {
      AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light);
      await editAsync();
      const pressed = (name: string): string | null => one(":scope > .department .edit-unit", department(name)).getAttribute("aria-pressed");
      const outlined = (): string[] => all(".department.selected").map(t => t.querySelector(".department-name")?.textContent?.trim() ?? "");
      const asking = [one("aside.messages.editor").getAttribute("aria-label"), texts("aside.messages.editor .nol-teamrun-organization-empty"),
        all("aside.messages nol-teamrun-organization-chat").length, all("nol-teamrun-organization-unit-editor").length,
        one(":scope > .department .edit-unit", department("Build")).getAttribute("aria-label"), pressed("Build")];

      await editUnitAsync("Build");
      const build = [texts(".title", editor()), pressed("Build"), pressed("Design"), outlined(), texts("aside.messages.editor .nol-teamrun-organization-empty")];
      const look = getComputedStyle(one(":scope > .department", department("Build")));
      const outline = [look.outlineStyle, look.outlineColor, look.borderTopColor];
      one(":scope > .department .department-summary", department("Design")).click();
      await settle();
      const design = [texts(".title", editor()), outlined()];
      one(":scope > .department .department-toggle", department("UI")).click();
      await Wait.until(() => expect(saves).toHaveLength(1));
      await settle();
      const toggled = texts(".title", editor());
      one(".close", editor()).click();
      await settle();
      const closed = [all("nol-teamrun-organization-unit-editor").length, outlined(), texts("aside.messages.editor .nol-teamrun-organization-empty")];
      await editUnitAsync("UI");
      one(".top .edit").click();
      await settle();
      one(".top .edit").click();
      await settle();

      expect(asking).toEqual(["Edit unit", ["Select a unit to change its name, type, leader or who it reports to."], 0, 0, "Edit Build", "false"]);
      expect([build, design, toggled, closed, all("nol-teamrun-organization-unit-editor").length, outlined()]).toEqual([
        [["Build"], "true", "false", ["Build"], []], [["Design"], ["Design"]], ["Design"], [0, [], ["Select a unit to change its name, type, leader or who it reports to."]], 0, []]);
      expect(outline).toEqual(["solid", AppearanceFixture.readColor(FixtureTheme.theme, ThemeMode.Light, "accent"),
        AppearanceFixture.readColor(FixtureTheme.theme, ThemeMode.Light, "accent")]);
    });

    it("renames the unit from the editor's Name field once it changes, follows the new name, and puts back a blank or unchanged name", async () => {
      await editAsync();
      await editUnitAsync("Design");
      const shown = [field().value, field().getAttribute("aria-label")];

      await rename("  ");
      const blank = field().value;
      await rename("Design");
      await rename(" Craft ");
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf(sample.departments.map(t => t.id === "design"
        ? new Department("design", "Craft", "department", OrganizationParent.person, "alice", 0, "c", "u") : t), sample.placements).toJson());
      await settle();

      expect([shown, blank, texts(".title", editor()), field().value, asked]).toEqual([["Design", "Name"], "Design", ["Craft"], "Craft",
        [new RecordedRequest(MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", name: "Craft" })]]);
    });

    it("asks for a unit again once the unit open in the editor leaves the organization", async () => {
      await editAsync();
      await editUnitAsync("Build");
      const opened = texts(".title", editor());
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf(sample.departments.filter(t => t.id !== "build"),
        sample.placements.filter(t => t.teammateId !== "offline")).toJson());
      await settle();

      expect([opened, all("nol-teamrun-organization-unit-editor").length, texts("aside.messages.editor .nol-teamrun-organization-empty")])
        .toEqual([["Build"], 0, ["Select a unit to change its name, type, leader or who it reports to."]]);
    });

    it("chooses a unit's leader in the editor among its people in name order, then any other teammate, who joins it, or none", async () => {
      await editAsync();
      await editUnitAsync("Design");
      const leader = (): HTMLElement => one(".leader-field", editor());

      const options = await optionsAsync(leader());
      await closeOptionsAsync();
      await chooseAsync(leader(), "Bob");
      await chooseAsync(leader(), "Offline");
      await chooseAsync(leader(), "No leader");

      expect([options, asked]).toEqual([["No leader", "Alice", "Bob", "Code Reviewer", "Offline"], [
        new RecordedRequest(MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", leaderId: "bob" }),
        new RecordedRequest(MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", leaderId: "offline" }),
        new RecordedRequest(MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "design", leaderId: null })
      ]]);
    });

    it("deletes a unit from the editor only once you confirm, saying where what it held goes", async () => {
      await editAsync();
      const remove = async (name: string): Promise<HTMLElement> => one(".delete", await editUnitAsync(name));

      (await remove("UI")).click();
      const nested = await dialogAsync();
      await answerAsync(".nol-teamrun-cancel");
      const cancelled = asked.length;
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf([...organization.departments,
        new Department("lab", "Lab", "department", OrganizationParent.teammate("offline"), null, 0, "c", "u")], organization.placements).toJson());
      await settle();
      (await remove("Lab")).click();
      const underTeammate = await dialogAsync();
      await answerAsync(".nol-teamrun-cancel");
      const button = await remove("Build");
      const label = button.textContent?.trim();
      button.click();
      const top = await dialogAsync();
      await answerAsync(".nol-teamrun-confirm");

      expect([label, nested, cancelled, underTeammate, top, asked]).toEqual(["deleteDelete Department",
        ["Delete Department", "Delete UI? Its units and members move to Design.", "Delete"], 0,
        ["Delete Department", "Delete Lab? Its units and members move to Offline.", "Delete"],
        ["Delete Department", "Delete Build? Its units move up to report to you, and its members leave every unit.", "Delete"],
        [new RecordedRequest(MethodName.DepartmentDelete, { organizationId: "my-organization", departmentId: "build" })]]);
    });

    it("moves a member out of its unit from its card once you confirm, moves it under any place in the tree, and shows neither once editing is done", async () => {
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
        ["Move out of unit", "Move Bob out of Design? Bob will report to you.", "Move out"], "Move Bob out of Design",
        ["You", "Design (Department)", "Alice", "UI (Department)", "Code Reviewer", "Build (Department)", "Offline"], 0]);
      expect(asked).toEqual([new RecordedRequest(MethodName.DepartmentMemberSet, { organizationId: "my-organization", teammateId: "bob", departmentId: null }),
        new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Department", id: "build" }, order: Resources.organizationLastOrder })]);
    });

    it("says a removed member will report to you, where the organization then places it, among your direct reports", async () => {
      await editAsync();
      const before = reports();

      one(".remove", card("Bob")).click();
      const asking = await dialogAsync();
      await answerAsync(".nol-teamrun-confirm");
      organization = SampleData.organizationOf(sample.departments,
        sample.placements.map(t => t.teammateId === "bob" ? new TeammatePlacement("bob", OrganizationParent.person, 0) : t));
      context.emit(EventName.OrganizationChanged, organization.toJson());
      await settle();
      one(".top .edit").click();
      await settle();

      expect([before, asking[1], reports()]).toEqual([[], "Move Bob out of Design? Bob will report to you.", ["Bob"]]);
      expect(asked).toEqual([new RecordedRequest(MethodName.DepartmentMemberSet, { organizationId: "my-organization", teammateId: "bob", departmentId: null })]);
    });

    it("takes a unit member, a unit leader, a teammate with reports and a direct report out of the organization from their cards once you confirm, saying where the reports go", async () => {
      await editAsync();
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf([...sample.departments,
        new Department("lab", "Lab", "department", OrganizationParent.teammate("offline"), null, 0, "c", "u"),
        new Department("kit", "Kit", "department", OrganizationParent.teammate("reviewer"), null, 0, "c", "u")], [new TeammatePlacement("alice", OrganizationParent.department("design"), 0),
        new TeammatePlacement("bob", OrganizationParent.department("design"), 1), new TeammatePlacement("offline", OrganizationParent.person, 0),
        new TeammatePlacement("reviewer", OrganizationParent.teammate("alice"), 0)]).toJson());
      await settle();
      const removeAsync = async (name: string, answer: string): Promise<string[]> => {
        one(".remove-from-organization", card(name)).click();
        const asking = await dialogAsync();
        await answerAsync(answer);
        return asking;
      };

      const label = one(".remove-from-organization", card("Bob")).getAttribute("aria-label");
      const cancelled = await removeAsync("Bob", ".nol-teamrun-cancel");
      const asked0 = asked.length;
      const member = await removeAsync("Bob", ".nol-teamrun-confirm");
      const leader = await removeAsync("Alice", ".nol-teamrun-confirm");
      const direct = await removeAsync("Offline", ".nol-teamrun-confirm");
      const report = await removeAsync("Code Reviewer", ".nol-teamrun-confirm");
      const placed = (id: string): RecordedRequest => new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: id, parent: null, order: Resources.organizationLastOrder });

      expect([label, cancelled, asked0]).toEqual(["Remove Bob from the organization",
        ["Remove teammate", "Remove Bob from My organization? Bob keeps its chats and can be added back.", "Remove"], 0]);
      expect([member[1], leader[1], direct[1], report[1]]).toEqual(["Remove Bob from My organization? Bob keeps its chats and can be added back.",
        "Remove Alice from My organization? Alice keeps its chats and can be added back. The teammates and units under Alice will report to Design.",
        "Remove Offline from My organization? Offline keeps its chats and can be added back. The teammates and units under Offline will report to you.",
        "Remove Code Reviewer from My organization? Code Reviewer keeps its chats and can be added back. The teammates and units under Code Reviewer will report to Alice."]);
      expect(asked).toEqual([placed("bob"), placed("alice"), placed("offline"), placed("reviewer")]);
    });

    it("leaves a teammate taken out of the organization off the Tree and the To choices, and adds it back from Add teammate", async () => {
      await editAsync();
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf(sample.departments,
        sample.placements.filter(t => t.teammateId !== "bob")).toJson());
      await settle();
      const names = (): string[] => texts("nol-teamrun-organization-card .name");
      const tree = names();
      one(".top .edit").click();
      await settle();
      await userEvent.click(one("aside.messages .to-choice .nol-select-button"));
      await Wait.until(() => expect(document.querySelectorAll(".nol-select-option").length).toBeGreaterThan(0));
      const offered = [...document.querySelectorAll<HTMLElement>(".nol-select-option")].map(t => t.textContent?.trim() ?? "");
      await userEvent.keyboard("{Escape}");
      await settle();
      one(".top .edit").click();
      await settle();
      const adding = await openAddAsync(one(":scope > .adds > .add-member", department("Build")));
      await addAsync("Bob");
      await addClosedAsync();

      expect([tree.includes("Bob"), offered.some(t => t.includes("Bob")), adding.includes("Bob"), tree.includes("Alice")]).toEqual([false, false, true, true]);
      expect(asked).toEqual([new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Department", id: "build" }, order: Resources.organizationLastOrder })]);
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
        throw new PartReadError(`${name} is drawn in no node.`);
      return found;
    };
    const addDialog = (): HTMLElement => one("nol-teamrun-organization-add-teammate-dialog", document);
    const teammateChoice = (): HTMLElement => one(".nol-teamrun-add-teammate-choice", addDialog());
    const openAddAsync = async (trigger: HTMLElement): Promise<string[]> => {
      await userEvent.click(trigger);
      await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-add-teammate-dialog .nol-teamrun-add-teammate-choice")).not.toBeNull());
      await settle();
      const offered = await optionsAsync(teammateChoice());
      await closeOptionsAsync();
      return offered;
    };
    const addAsync = async (name: string): Promise<void> => {
      await chooseAsync(teammateChoice(), name);
      one(".nol-teamrun-save", addDialog()).click();
      await settle();
    };
    const addClosedAsync = async (): Promise<void> => {
      await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-add-teammate-dialog")).toBeNull());
      await fadedAsync();
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

    it("adds a teammate under a unit from a dialog listing the team in name order, then a new teammate, and adds nothing until one is chosen", async () => {
      await editAsync();

      const offered = await openAddAsync(one(":scope > .adds > .add-member", department("Build")));
      const shown = [inDialog(".nol-dialog-title").textContent?.trim(), one(".nol-select-value", teammateChoice()).textContent?.trim(),
        one(".nol-teamrun-save", addDialog()).hasAttribute("disabled")];
      await addAsync("Alice");
      await addClosedAsync();

      expect([offered, shown, asked]).toEqual([["Choose a teammate", "Alice", "Bob", "Code Reviewer", "Offline", "New teammate…"], ["Add teammate", "Choose a teammate", true],
        [new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "alice", parent: { kind: "Department", id: "build" }, order: Resources.organizationLastOrder })]]);
    });

    it("adds a teammate under a teammate, offering every teammate but that one, and under you, and refuses one above the node in the server's words, sending nothing and staying open", async () => {
      await editAsync();
      context.emit(EventName.OrganizationChanged, SampleData.organizationOf([], [new TeammatePlacement("alice", OrganizationParent.person, 0),
        new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0)]).toJson());
      await settle();

      const offered = await openAddAsync(one(":scope > .adds > .add-member", nodeOf("Bob")));
      await addAsync("Alice");
      const refused = [texts("nol-teamrun-organization-add-teammate-dialog .nol-teamrun-dialog-error", document), all("nol-teamrun-organization-add-teammate-dialog", document).length];
      one(".nol-teamrun-cancel", addDialog()).click();
      await addClosedAsync();
      await openAddAsync(one(".chart .tree > .adds > .add-member"));
      await addAsync("Offline");
      await addClosedAsync();

      expect([offered.includes("Bob"), refused, asked]).toEqual([false, [["A teammate or department can't be under itself."], 1],
        [new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "offline", parent: { kind: "Person", id: null }, order: Resources.organizationLastOrder })]]);
    });

    it("creates a teammate from the dialog's New teammate, chooses it and places it once you add it", async () => {
      await editAsync();
      const store = ChatStoreService.of(context);

      await openAddAsync(one(":scope > .adds > .add-member", department("Build")));
      await chooseAsync(teammateChoice(), "New teammate…");
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).not.toBeNull());
      const choosing = [one(".nol-teamrun-save", addDialog()).hasAttribute("disabled"), asked.length];
      await userEvent.type(one("input.nol-teamrun-teammate-name", document), "Dana");
      one("button[form='nol-teamrun-teammate-form']", document).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
      await fadedAsync();
      await settle();
      const chosen = [one(".nol-select-value", teammateChoice()).textContent?.trim(), asked.length];
      one(".nol-teamrun-save", addDialog()).click();
      await addClosedAsync();
      const dana = Required.of(store.teammates().find(t => t.name === "Dana"));

      expect([choosing, chosen, asked]).toEqual([[true, 0], ["Dana", 0], [new RecordedRequest(MethodName.TeammatePlace,
        { organizationId: "my-organization", teammateId: dana.id, parent: { kind: "Department", id: "build" }, order: Resources.organizationLastOrder })]]);
    });

    it("keeps the teammate chosen before, and places no one, when the new teammate's dialog is closed", async () => {
      await editAsync();
      const before = ChatStoreService.of(context).teammates().length;

      await openAddAsync(one(":scope > .adds > .add-member", department("Build")));
      await chooseAsync(teammateChoice(), "Bob");
      await chooseAsync(teammateChoice(), "New teammate…");
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).not.toBeNull());
      one(".nol-teamrun-cancel", lastDialog()).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
      await fadedAsync();
      await settle();
      const kept = [one(".nol-select-value", teammateChoice()).textContent?.trim(), one(".nol-teamrun-save", addDialog()).hasAttribute("disabled")];
      await chooseAsync(teammateChoice(), "New teammate…");
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).not.toBeNull());
      one(".nol-teamrun-cancel", lastDialog()).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
      await fadedAsync();
      one(".nol-teamrun-cancel", addDialog()).click();
      await addClosedAsync();

      expect([kept, ChatStoreService.of(context).teammates().length, asked]).toEqual([["Bob", false], before, []]);
    });

    it("says why in the dialog and the organization when a teammate can't be placed, and keeps the dialog open", async () => {
      await editAsync(() => Promise.reject(new RuntimeRequestException(FailureCode.Unavailable, "The runtime is busy.")));

      await openAddAsync(one(":scope > .adds > .add-member", department("Build")));
      await addAsync("Bob");
      await Wait.until(() => expect(texts(".action-error")).toEqual(["The runtime is busy."]));
      const shown = [texts("nol-teamrun-organization-add-teammate-dialog .nol-teamrun-dialog-error", document), one(".nol-teamrun-save", addDialog()).hasAttribute("disabled")];
      one(".nol-teamrun-cancel", addDialog()).click();
      await addClosedAsync();

      expect([shown, asked.map(t => t.method)]).toEqual([[["The runtime is busy."], false], [MethodName.TeammatePlace]]);
    });

    it("creates a department under a teammate from a dialog asking its name and a leader among the whole team, and nothing for a blank name", async () => {
      await editAsync();

      one(":scope > .adds > .add-sub-department", nodeOf("Bob")).click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-department-name")).not.toBeNull());
      await Wait.until(() => expect(inDialog(".nol-dialog-title").textContent?.trim()).toBe("New unit"));
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
        [new RecordedRequest(MethodName.DepartmentCreate, { organizationId: "my-organization", name: "Craft", typeId: "department", parent: { kind: "Teammate", id: "bob" }, leaderId: "offline" })]]);
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
      await fadedAsync();
      await settle();
      const kept = inDialog(".nol-teamrun-department-leader .nol-select-value").textContent?.trim();
      await chooseAsync(inDialog(".nol-teamrun-department-leader"), "New teammate…");
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).not.toBeNull());
      await userEvent.type(one("input.nol-teamrun-teammate-name", document), "Dana");
      one("button[form='nol-teamrun-teammate-form']", document).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-teammate-name")).toBeNull());
      await fadedAsync();
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(asked).toHaveLength(1));
      const dana = Required.of(ChatStoreService.of(context).teammates().find(t => t.name === "Dana"));

      expect([kept, dana.name, asked]).toEqual(["Bob", "Dana",
        [new RecordedRequest(MethodName.DepartmentCreate, { organizationId: "my-organization", name: "Craft", typeId: "department", parent: { kind: "Person", id: null }, leaderId: dana.id })]]);
    });

    it("keeps the department dialog open, saying why, when the department can't be made", async () => {
      await editAsync(() => Promise.reject(new RuntimeRequestException(FailureCode.Unavailable, "The runtime is busy.")));

      one(".chart .add-department").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-department-name")).not.toBeNull());
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-dialog-error")?.textContent?.trim()).toBe("The runtime is busy."));
      inDialog(".nol-teamrun-cancel").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog")).toBeNull());
    });

    const team = new NodeType("team", "Team", "groups", "teal", SampleData.timestamp, SampleData.timestamp);
    const typed = (types: readonly NodeType[], departments: readonly Department[] = organization.departments,
      placements: readonly TeammatePlacement[] = organization.placements): Organization =>
      new Organization("my-organization", "My organization", null, 0, SampleData.timestamp, SampleData.timestamp, types, departments, placements);
    const changeTo = async (changed: Organization): Promise<void> => {
      organization = changed;
      context.emit(EventName.OrganizationChanged, changed.toJson());
      await settle();
    };
    const makesType = (made: NodeType): JsonValue[] => {
      const sent: JsonValue[] = [];
      context.answer(MethodName.NodeTypeCreate, t => {
        sent.push(t);
        organization = typed([...organization.nodeTypes, made]);
        context.emit(EventName.OrganizationChanged, organization.toJson());
        return made.toJson();
      });
      return sent;
    };
    const makeTypeAsync = async (name: string): Promise<void> => {
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-type-name")).not.toBeNull());
      await userEvent.type(one("input.nol-teamrun-type-name", document), name);
      one(".nol-teamrun-save", lastDialog()).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-type-name")).toBeNull());
      await settle();
    };
    const addDepartmentAsync = async (): Promise<void> => {
      one(".chart .add-department").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-department-type .nol-select-value")?.textContent?.trim()).toBeTruthy());
    };
    const typeShown = (): string | undefined => inDialog(".nol-teamrun-department-type .nol-select-value").textContent?.trim();

    it("adds a department of the organization's first type unless another is chosen, and chooses a type made from the dialog's New type", async () => {
      await editAsync();
      const made = makesType(team);

      await addDepartmentAsync();
      const first = typeShown();
      const offered = await optionsAsync(inDialog(".nol-teamrun-department-type"));
      await closeOptionsAsync();
      await chooseAsync(inDialog(".nol-teamrun-department-type"), "New type…");
      await makeTypeAsync("Team");
      const chosen = typeShown();
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(document.querySelector("nol-dialog")).toBeNull());

      expect([first, offered, chosen, made, asked]).toEqual(["Department", ["Department", "New type…"], "Team",
        [{ organizationId: "my-organization", name: "Team", icon: null, color: null }],
        [new RecordedRequest(MethodName.DepartmentCreate, { organizationId: "my-organization", name: "Craft", typeId: "team", parent: { kind: "Person", id: null }, leaderId: null })]]);
    });

    it("puts back the type chosen before when the new type's dialog closes without making one", async () => {
      await editAsync();
      await changeTo(typed([SampleData.departmentType, team]));

      await addDepartmentAsync();
      await chooseAsync(inDialog(".nol-teamrun-department-type"), "Team");
      await chooseAsync(inDialog(".nol-teamrun-department-type"), "New type…");
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-type-name")).not.toBeNull());
      one(".nol-teamrun-cancel", lastDialog()).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-type-name")).toBeNull());
      await settle();
      const kept = typeShown();
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(asked).toHaveLength(1));

      expect([kept, context.count(MethodName.NodeTypeCreate), asked]).toEqual(["Team", 0,
        [new RecordedRequest(MethodName.DepartmentCreate, { organizationId: "my-organization", name: "Craft", typeId: "team", parent: { kind: "Person", id: null }, leaderId: null })]]);
    });

    it("opens New type at once when it adds a department to an organization with no types, asks for a type when that closes with none, and adds it once one is made", async () => {
      await editAsync();
      await changeTo(typed([], [], [new TeammatePlacement("alice", OrganizationParent.person, 0)]));
      const made = makesType(team);

      await addDepartmentAsync();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-type-name")).not.toBeNull());
      one(".nol-teamrun-cancel", lastDialog()).click();
      await Wait.until(() => expect(document.querySelector("input.nol-teamrun-type-name")).toBeNull());
      await settle();
      const first = typeShown();
      await userEvent.type(inDialog(".nol-teamrun-department-name"), "Craft");
      await settle();
      const blocked = inDialog(".nol-teamrun-save").hasAttribute("disabled");
      await chooseAsync(inDialog(".nol-teamrun-department-type"), "New type…");
      await makeTypeAsync("Team");
      const ready = [typeShown(), inDialog(".nol-teamrun-save").hasAttribute("disabled")];
      inDialog(".nol-teamrun-save").click();
      await Wait.until(() => expect(asked).toHaveLength(1));

      expect([first, blocked, ready, made.length, asked]).toEqual(["Choose a type", true, ["Team", false], 1,
        [new RecordedRequest(MethodName.DepartmentCreate, { organizationId: "my-organization", name: "Craft", typeId: "team", parent: { kind: "Person", id: null }, leaderId: null })]]);
    });

    it("sets a unit's type from the editor's Type choice among the organization's types, as wide as the editor's fields", async () => {
      await editAsync();
      await changeTo(typed([SampleData.departmentType, team]));
      await editUnitAsync("Build");
      const choice = (): HTMLElement => one(".type-field .type-choice", editor());
      const width = [choice().getBoundingClientRect().width, one(".leader-field", editor()).getBoundingClientRect().width];

      const offered = await optionsAsync(choice());
      await closeOptionsAsync();
      const shown = one(".nol-select-value", choice()).textContent?.trim();
      await chooseAsync(choice(), "Team");

      AppearanceFixture.expectPixels(width[0] ?? Number.NaN, width[1] ?? Number.NaN);
      expect([offered, shown, asked]).toEqual([["Department", "Team", "New type…"], "Department",
        [new RecordedRequest(MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "build", typeId: "team" })]]);
    });

    it("makes a new type from the editor's Type choice and gives that unit the type", async () => {
      await editAsync();
      const made = makesType(team);

      await chooseAsync(one(".type-field .type-choice", await editUnitAsync("Build")), "New type…");
      await makeTypeAsync("Team");
      await Wait.until(() => expect(asked).toHaveLength(1));

      expect([made.length, asked]).toEqual([1, [new RecordedRequest(MethodName.DepartmentUpdate, { organizationId: "my-organization", departmentId: "build", typeId: "team" })]]);
    });

    it("lists the organization's types from a Types button shown only while its structure is edited", async () => {
      await editAsync();
      await changeTo(typed([SampleData.departmentType, team]));

      one(".top .types").click();
      await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-types-dialog .type-name")).not.toBeNull());
      const listed = [inDialog(".nol-dialog-title").textContent?.trim(), texts("nol-teamrun-organization-types-dialog .type-name", document)];
      await answerAsync(".nol-teamrun-cancel");
      one(".top .edit").click();
      await settle();

      expect([listed, all(".top .types")]).toEqual([["Types", ["Department", "Team"]], []]);
    });

    it("moves a nested unit anywhere from the editor's Reports to choice, refusing one under itself in the server's words before it is sent", async () => {
      await editAsync();

      const offered = await optionsAsync(one(".place-field", await editUnitAsync("UI")));
      await closeOptionsAsync();
      await chooseAsync(one(".place-field", editor()), "Offline");
      await chooseAsync(one(".place-field", await editUnitAsync("Design")), "UI (Department)");
      const refused = texts(".action-error");

      expect([offered, refused, asked]).toEqual([["You", "Design (Department)", "Alice", "Code Reviewer", "Bob", "Build (Department)", "Offline"],
        ["A teammate or department can't be under itself."],
        [new RecordedRequest(MethodName.DepartmentMove, { organizationId: "my-organization", departmentId: "ui", parent: { kind: "Teammate", id: "offline" }, order: Resources.organizationLastOrder })]]);
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
      expect(asked).toEqual([new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "offline", parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder }),
        new RecordedRequest(MethodName.DepartmentMove, { organizationId: "my-organization", departmentId: "ui", parent: { kind: "Teammate", id: "offline" }, order: Resources.organizationLastOrder }),
        new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Person", id: null }, order: Resources.organizationLastOrder })]);
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
        new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "offline", parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder }),
        new RecordedRequest(MethodName.TeammatePlace, { organizationId: "my-organization", teammateId: "bob", parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder })]]);
    });

    it("says why a change failed until it is dismissed", async () => {
      await editAsync(() => Promise.reject(new RuntimeRequestException(FailureCode.Unavailable, "The runtime is busy.")));

      await chooseAsync(one(".move-choice", card("Bob")), "Build (Department)");
      await Wait.until(() => expect(texts(".action-error")).toEqual(["The runtime is busy."]));
      await settle();
      const alerts = all("[role=alert]").map(t => t.matches(".action-error"));
      one(".dismiss").click();
      await settle();

      expect([alerts, texts("[role=alert]")]).toEqual([[true], []]);
    });
  });

  describe.each(ThemeCase.every)("in $look", ({ mode, forcedColors }) => {
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
      const icon = one(".now-icon", alice);
      const text = one(".now-text", alice);
      const lasted = one(".now-for", alice);
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

    it("sets To under the chat's head over a select as wide as the panel's padding allows, above the recipients and then the composer, a unit's name as plain text on its row, and a teammate's name as plain text", async () => {
      await create();
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const aside = one("aside.messages");
      const border = Number.parseFloat(getComputedStyle(aside).borderLeftWidth);
      const head = one(".nol-teamrun-organization-chat-title", aside);
      const label = one(".to-label", aside);
      const choice = one(".to-choice", aside);
      const recipients = one(".nol-teamrun-organization-recipients", aside);
      const thread = one("nol-teamrun-composer", aside);
      const design = one(":scope > .department", department("Design"));
      const toggle = one(".department-toggle", design);
      const message = one(".department-name", design);
      const unitStyle = getComputedStyle(message);
      const alice = card("Alice");
      const name = one(".name", alice);
      const role = one(".role", alice);
      const labelStyle = getComputedStyle(label);
      const nameStyle = getComputedStyle(name);

      AppearanceFixture.expectPixels(box(label).left, box(aside).left + border + space(3));
      AppearanceFixture.expectPixels(box(head).top, box(aside).top + space(3));
      AppearanceFixture.expectPixels(box(label).top - box(head).bottom, space(3));
      AppearanceFixture.expectPixels(box(recipients).top - box(choice).bottom, space(3));
      expect([box(thread).top >= box(recipients).bottom, recipients.nextElementSibling === thread]).toEqual([true, true]);
      AppearanceFixture.expectPixels(box(choice).left, box(label).left);
      AppearanceFixture.expectPixels(box(choice).right, box(aside).right - space(3));
      AppearanceFixture.expectPixels(box(choice).top - box(label).bottom, space(3));
      AppearanceFixture.expectPixels(Number.parseFloat(labelStyle.fontSize), AppearanceFixture.measureLook("text-small"));
      AppearanceFixture.expectPixels(Number.parseFloat(labelStyle.lineHeight), AppearanceFixture.measureLook("line-label"));
      expect(labelStyle.fontWeight).toBe(getComputedStyle(element()).getPropertyValue("--nol-weight-emphasis").trim());
      expect(Math.abs(box(message).top + box(message).height / 2 - (box(toggle).top + box(toggle).height / 2))).toBeLessThanOrEqual(1);
      expect([message.tagName, unitStyle.paddingLeft, unitStyle.paddingTop, unitStyle.borderTopWidth, unitStyle.backgroundColor, unitStyle.cursor, unitStyle.textAlign])
        .toEqual(["BUTTON", "0px", "0px", "0px", expect.stringMatching(/^rgba\(.*, 0\)$/u), "pointer", "start"]);
      AppearanceFixture.expectPixels(box(name).left, box(role).left);
      AppearanceFixture.expectPixels(box(role).top, box(name).bottom);
      expect([nameStyle.paddingLeft, nameStyle.paddingTop, nameStyle.borderTopWidth, nameStyle.fontWeight]).toEqual(["0px", "0px", "0px",
        getComputedStyle(element()).getPropertyValue("--nol-weight-emphasis").trim()]);
    });

    it("sizes the cards, hangs each leader under its department, its members first in a row with its nested departments, as wide as a unit, and joins the departments to you through one bar", async () => {
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
      const designCard = one(":scope > .department", design);
      const leader = one(":scope > .leader", design);
      const stem = one(":scope > .stem", design);
      const members = one(":scope > .kids", design);
      const report = Required.of(card("Bob").closest<HTMLElement>(".kid"));
      const member = one(":scope > .self", report);
      const ui = one(":scope > .department", department("UI"));
      const owner = one(".owner");
      const kids = one(".chart .tree > .kids");

      for (const view of [owner, designCard, leader, one(":scope > .department", build), ui])
        AppearanceFixture.expectPixels(box(view).width, 15 * rem);
      AppearanceFixture.expectPixels(box(member).width, 15 * rem);
      AppearanceFixture.expectPixels(box(stem).height, space(3));
      AppearanceFixture.expectPixels(box(stem).left + box(stem).width / 2, box(designCard).left + box(designCard).width / 2);
      AppearanceFixture.expectPixels(box(leader).top - box(designCard).bottom, space(3));
      AppearanceFixture.expectPixels(box(leader).left, box(designCard).left);
      AppearanceFixture.expectPixels(box(members).left + box(members).width / 2, box(leader).left + box(leader).width / 2);
      AppearanceFixture.expectPixels(box(member).top - box(leader).bottom, space(3) * 2);
      AppearanceFixture.expectPixels(box(ui).top, box(member).top);
      AppearanceFixture.expectPixels(box(ui).left - box(member).right, space(4));
      expect([all(".reports", design).length, report.nextElementSibling, line(members, "::before").borderLeftStyle, line(report, "::after").borderLeftStyle,
        line(report, "::before").borderTopStyle]).toEqual([0, department("UI"), "solid", "solid", "solid"]);
      for (const length of [line(members, "::before").height, line(report, "::after").height])
        AppearanceFixture.expectPixels(Number.parseFloat(length), space(3));
      AppearanceFixture.expectPixels(Number.parseFloat(line(report, "::before").left), box(report).width / 2);
      AppearanceFixture.expectPixels(box(kids).top - box(owner).bottom, 0);
      AppearanceFixture.expectPixels(box(designCard).top - box(kids).top, space(3) * 2);
      AppearanceFixture.expectPixels(box(owner).left + box(owner).width / 2, box(kids).left + box(kids).width / 2);
      AppearanceFixture.expectPixels(box(build).left - box(design).right, 0);
      AppearanceFixture.expectPixels(Number.parseFloat(line(design, "::before").left), box(design).width / 2);
      AppearanceFixture.expectPixels(Number.parseFloat(line(build, "::before").right), box(build).width / 2);
      AppearanceFixture.expectPixels(Number.parseFloat(line(design, "::after").height), space(3));
      expect(getComputedStyle(one(":scope > .department .department-name", design)).fontWeight)
        .toBe(getComputedStyle(element()).getPropertyValue("--nol-weight-emphasis").trim());
    });

    it("routes a message along the lines from you down the bar and a department's stem to a member beside its nested department, and from that department's leader to the member over the bar they share, with the pulse drawn over the cards", async () => {
      holdFlows();
      await create();
      await Wait.until(async () => {
        one(".chart .nol-canvas-actual").click();
        await settle();
        expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const tree = one(".chart .tree");
      const scale = box(tree).width / FlowFrame.layoutWidthOf(tree);
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
      const members = one(":scope > .kids", design);
      const bob = card("Bob");
      const bobKid = Required.of(bob.closest<HTMLElement>(".kid"));
      const uiCard = one(":scope > .department", ui);
      const alice = card("Alice");
      const cards = all(".chart nol-teamrun-organization-card, .chart .department").filter(t => t !== uiCard && t !== alice);
      const crosses = (from: FlowPoint, to: FlowPoint, view: Element): boolean => {
        const inside = box(view);
        const across = Math.max(Math.min(from.x, to.x), inside.left + 1) < Math.min(Math.max(from.x, to.x), inside.right - 1)
          || (from.x === to.x && from.x > inside.left + 1 && from.x < inside.right - 1);
        const down = Math.max(Math.min(from.y, to.y), inside.top + 1) < Math.min(Math.max(from.y, to.y), inside.bottom - 1)
          || (from.y === to.y && from.y > inside.top + 1 && from.y < inside.bottom - 1);
        return across && down;
      };
      const toBob = [at(middle(members), box(members).top), at(middle(members), box(bobKid).top), at(middle(bob), box(bobKid).top), at(middle(bob), box(bob).top)];

      await flow(asked, answer("r1", asked, "bob", MessageStatus.Pending));
      const fromYou = points();
      await flow(forwarded, answer("r2", forwarded, "bob", MessageStatus.Pending));
      const fromReviewer = points();
      const pulse = one(".nol-teamrun-flow-overlay .pulse");
      const motion = pulse.getAnimations().at(0);
      if (Object.isUndefined(motion))
        throw new PartReadError("The pulse doesn't move.");
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
      expectRoute(fromReviewer, [at(middle(uiStem), box(card("Code Reviewer")).top), at(middle(uiStem), box(uiStem).top), at(middle(uiCard), box(uiCard).top),
        at(middle(uiCard), box(ui).top), at(middle(members), box(ui).top), at(middle(bob), box(bobKid).top), at(middle(bob), box(bob).top)]);
      expect([box(ui).top, middle(bob) < middle(members), middle(members) < middle(uiCard)]).toEqual([box(bobKid).top, true, true]);
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

    it("lays your direct reports first in the row of departments under you, each card as wide as a unit's, level with the departments' heads", async () => {
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
      const kids = one(".chart .tree > .kids");
      const reviewer = card("Code Reviewer");
      const offline = card("Offline");
      const design = one(":scope > .department", department("Design"));
      const named = all(":scope > .kid", kids).map(t => t.querySelector(":scope > .self .name, :scope > .department .department-name")?.textContent?.trim());

      expect([all(".chart .tree > .reports").length, named]).toEqual([0, ["Code Reviewer", "Offline", "Design", "Build"]]);
      for (const view of [reviewer, offline, design])
        AppearanceFixture.expectPixels(box(view).width, 15 * rem);
      AppearanceFixture.expectPixels(box(kids).left + box(kids).width / 2, box(owner).left + box(owner).width / 2);
      AppearanceFixture.expectPixels(box(reviewer).top - box(owner).bottom, space(3) * 2);
      AppearanceFixture.expectPixels(box(offline).top, box(reviewer).top);
      AppearanceFixture.expectPixels(box(design).top, box(reviewer).top);
      AppearanceFixture.expectPixels(box(offline).left - box(reviewer).right, space(4));
      AppearanceFixture.expectPixels(box(design).left - box(offline).right, space(4));
    });

    it.each([24, 47.75, 48, 120])("lays the chat panel out across the messages in a %drem view, for a group and a teammate, its composer's card inset as far as the To choice", async width => {
      await create();
      element().style.width = `${width}rem`;
      await settle();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const border = (): number => Number.parseFloat(getComputedStyle(one("aside.messages")).borderLeftWidth);
      const across = (): number => {
        const inner = box(one(".body")).width;
        if (width < 48)
          return inner;
        const free = inner - 57 * rem;
        if (free >= 0)
          return 22 * rem + free / 1000;
        const shrinks = 22 * rem - border();
        return 22 * rem + free * shrinks / (35 * rem + shrinks);
      };
      const laidOut = (): HTMLElement => {
        const aside = one("aside.messages");
        const panel = one(":scope > nol-teamrun-organization-chat", aside);
        const title = box(one(".nol-teamrun-organization-chat-title", panel));
        const composer = box(one("nol-teamrun-composer", panel));
        const composerCard = box(one(".nol-teamrun-composer-card", panel));
        AppearanceFixture.expectPixels(box(aside).width, across());
        AppearanceFixture.expectPixels(box(panel).left, box(aside).left + border());
        AppearanceFixture.expectPixels(box(panel).right, box(aside).right);
        AppearanceFixture.expectPixels(title.right, box(panel).right - space(3));
        AppearanceFixture.expectPixels(composer.left, box(panel).left);
        AppearanceFixture.expectPixels(composer.right, box(panel).right);
        AppearanceFixture.expectPixels(composerCard.left, box(panel).left + space(3));
        AppearanceFixture.expectPixels(composerCard.right, box(panel).right - space(3));
        AppearanceFixture.expectPixels(composer.bottom - composerCard.bottom, space(3));
        expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
        return panel;
      };

      const group = laidOut();
      const icon = box(one(".nol-teamrun-organization-chat-icon", group));
      const title = box(one(".nol-teamrun-organization-chat-title", group));
      const choice = box(one(".to-choice", group));
      const composerCard = box(one(".nol-teamrun-composer-card", group));
      AppearanceFixture.expectPixels(icon.left, box(group).left + space(3));
      AppearanceFixture.expectPixels(title.left, icon.right + space(2));
      AppearanceFixture.expectPixels(choice.left, box(group).left + space(3));
      AppearanceFixture.expectPixels(choice.right, box(group).right - space(3));
      AppearanceFixture.expectPixels(composerCard.left, choice.left);
      AppearanceFixture.expectPixels(composerCard.right, choice.right);
      const rows = all(".nol-teamrun-organization-recipient", group);
      for (const row of rows) {
        AppearanceFixture.expectPixels(box(row).left, box(group).left + space(1));
        AppearanceFixture.expectPixels(box(row).right, box(group).right - space(1));
        AppearanceFixture.expectPixels(box(one(".nol-teamrun-organization-recipient-status", row)).right, box(row).right - space(2));
      }
      expect([rows.length > 0, box(Required.of(rows.at(-1))).bottom <= composerCard.top]).toEqual([true, true]);
      one(".name", card("Alice")).click();
      await Wait.until(() => expect(texts("aside.messages .nol-teamrun-organization-chat-title")).toEqual(["Chat with Alice"]));
      await settle();
      const teammate = laidOut();
      AppearanceFixture.expectPixels(box(one(".nol-teamrun-organization-chat-title", teammate)).left, box(teammate).left + space(3));
      AppearanceFixture.expectPixels(box(one(".history", teammate)).bottom, box(one("nol-teamrun-composer", teammate)).top);
      AppearanceFixture.expectPixels(box(one(".nol-teamrun-composer-card", teammate)).left, box(one(".to-choice", teammate)).left);
      expect(getComputedStyle(one("aside.messages")).borderLeftWidth).toBe(width < 48 ? "0px" : "1px");
    });

    it("fills the space under the header with the canvas and the messages beside it, 22rem wide as the chart takes the rest, and fits the chart at 100% to its top, under the canvas's tools", async () => {
      await create();
      element().style.width = "100rem";
      element().style.height = "76rem";
      await settle();
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
      const host = element().getBoundingClientRect();
      const top = box(".top");
      const canvas = box(".chart > nol-canvas");
      const messages = box("aside.messages");
      const tools = box(".chart .nol-canvas-tools");
      const tree = box(".chart .tree");

      AppearanceFixture.expectPixels(canvas.top, top.bottom);
      AppearanceFixture.expectPixels(canvas.left, host.left);
      AppearanceFixture.expectPixels(canvas.right, messages.left);
      AppearanceFixture.expectPixels(messages.right, host.right);
      AppearanceFixture.expectPixels(canvas.bottom, host.bottom);
      AppearanceFixture.expectPixels(messages.top, canvas.top);
      AppearanceFixture.expectPixels(messages.bottom, canvas.bottom);
      AppearanceFixture.expectPixels(messages.width, 22 * rem + (host.width - 57 * rem) / 1000);
      expect([texts(".chart .nol-canvas-zoom"), tree.top >= tools.bottom, tree.top - tools.bottom < box(".owner").height]).toEqual([["100%"], true, true]);
    });

    it("keeps the cards at their widths while editing, with a unit's Edit button and a card's choices and buttons inside the cards' padding", async () => {
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
      const toggle = box(one(":scope > .department .department-toggle", design));
      const name = box(one(":scope > .department .department-name", design));
      const edit = box(one(":scope > .department .edit-unit", design));
      const bob = box(card("Bob"));
      const move = box(one(".move", card("Bob")));
      const drop = box(one(".remove", card("Bob")));
      const tune = box(one(".tune", card("Bob")));

      AppearanceFixture.expectPixels(unit.width, 15 * rem);
      AppearanceFixture.expectPixels(bob.width, 15 * rem);
      AppearanceFixture.expectPixels(toggle.left, unit.left + inset);
      AppearanceFixture.expectPixels(edit.right, unit.right - inset);
      AppearanceFixture.expectPixels(edit.top + edit.height / 2, name.top + name.height / 2);
      AppearanceFixture.expectPixels(move.left, bob.left + inset);
      AppearanceFixture.expectPixels(move.right, bob.right - inset);
      AppearanceFixture.expectPixels(tune.right, bob.right - inset);
      expect([name.right <= edit.left, drop.right <= tune.left, texts(".chart .nol-canvas-zoom")]).toEqual([true, true, ["100%"]]);
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
      AppearanceFixture.expectPixels(bea.top, ada.top);
      AppearanceFixture.expectPixels(box(card("Cy")).top, ada.top);
      AppearanceFixture.expectPixels(dee.top, ada.top);
      AppearanceFixture.expectPixels(fay.top, eve.top);
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
      const scale = box(tree).width / FlowFrame.layoutWidthOf(tree);
      const reports = one(".chart .tree > .reports");
      const middle = box(reports).left + box(reports).width / 2;
      const bus = box(reports).top + AppearanceFixture.measureLook("space-3") * scale;
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

    it("hangs a teammate's reports and departments under its card at any depth, each card centred over its own, its reports a member wide in a grid and as wide as a unit first in a row with its departments", async () => {
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

      for (const view of [alice, bob, reviewer])
        AppearanceFixture.expectPixels(box(view).width, 13.25 * rem);
      AppearanceFixture.expectPixels(box(offline).width, 15 * rem);
      AppearanceFixture.expectPixels(box(bob).top - box(alice).bottom, space(3) * 2);
      AppearanceFixture.expectPixels(box(reviewer).top, box(bob).top);
      AppearanceFixture.expectPixels(box(reviewerNode).left - box(bobNode).right, space(4));
      AppearanceFixture.expectPixels((box(bobNode).left + box(reviewerNode).right) / 2, centre(alice));
      AppearanceFixture.expectPixels(centre(bob), centre(bobNode));
      AppearanceFixture.expectPixels(centre(reviewer), centre(reviewerNode));
      const under = one(":scope > .kids", bobNode);
      AppearanceFixture.expectPixels(box(offline).top - box(bob).bottom, space(3) * 2);
      AppearanceFixture.expectPixels(centre(under), centre(bob));
      AppearanceFixture.expectPixels(box(ui).top, box(offline).top);
      AppearanceFixture.expectPixels(box(ui).left - box(offline).right, space(4));
      expect([all(":scope > .reports", bobNode).length, box(ui).left >= box(bobNode).left, box(ui).right <= box(bobNode).right]).toEqual([0, true, true]);
    });

    describe("while editing", () => {
      const chain = SampleData.organizationOf([], [new TeammatePlacement("alice", OrganizationParent.person, 0),
        new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0), new TeammatePlacement("offline", OrganizationParent.teammate("bob"), 0)]);
      const wide = SampleData.organizationOf([], [new TeammatePlacement("alice", OrganizationParent.person, 0),
        new TeammatePlacement("bob", OrganizationParent.teammate("alice"), 0), new TeammatePlacement("reviewer", OrganizationParent.teammate("alice"), 1)]);
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const centre = (view: Element): number => box(view).left + box(view).width / 2;
      const nodeOf = (name: string): HTMLElement => Required.of(card(name).closest<HTMLElement>("nol-teamrun-organization-department"));
      const editAsync = async (shown: Organization, team: readonly Teammate[] = []): Promise<void> => {
        await create(t => {
          organization = shown;
          if (team.length > 0)
            t.answer(MethodName.TeammateList, () => team.map(u => u.toJson()));
        });
        element().style.width = "72rem";
        element().style.height = "60rem";
        one(".top .edit").click();
        await settle();
        await Wait.until(async () => {
          one(".chart .nol-canvas-actual").click();
          await settle();
          expect(texts(".chart .nol-canvas-zoom")).toEqual(["100%"]);
        });
      };
      const expectAddsUnder = (owner: HTMLElement, adds: HTMLElement): void => {
        const member = one(":scope > .add-member", adds);
        const other = one(":scope > button:last-child", adds);
        const line = getComputedStyle(adds, "::before");
        const next = adds.nextElementSibling;
        const reaches = !Object.isNull(next) && (next.classList.contains("reports") || next.classList.contains("kids"));
        AppearanceFixture.expectPixels(box(adds).top, box(owner).bottom);
        AppearanceFixture.expectPixels(member.getBoundingClientRect().top - box(owner).bottom, AppearanceFixture.measureLook("space-3"));
        AppearanceFixture.expectPixels((box(member).right + box(other).left) / 2, centre(owner));
        AppearanceFixture.expectPixels(box(other).left - box(member).right, AppearanceFixture.measureLook("space-2"));
        AppearanceFixture.expectPixels(box(adds).left + Number.parseFloat(line.left), centre(owner));
        expect(line.borderLeftStyle).toBe("solid");
        AppearanceFixture.expectPixels(box(adds).top + Number.parseFloat(line.height), reaches && !Object.isNull(next) ? box(next).top : box(member).top);
        if (reaches && !Object.isNull(next))
          expect(box(next).top).toBeGreaterThanOrEqual(box(adds).bottom);
      };

      it("puts each person's add row right under that person's card in a chain, the line from the card running through the row's middle to its reports", async () => {
        await editAsync(chain);

        expect([all(".chart .adds").length, all(".chart .tree > .kids").length]).toEqual([4, 0]);
        expectAddsUnder(one(".chart .tree > .owner"), one(".chart .tree > .adds"));
        for (const name of ["Alice", "Bob", "Offline"])
          expectAddsUnder(one(":scope > .self", nodeOf(name)), one(":scope > .adds", nodeOf(name)));
        expect(box(one(":scope > .adds", nodeOf("Alice"))).bottom).toBeLessThanOrEqual(box(card("Bob")).top);
        expect(box(one(":scope > .adds", nodeOf("Bob"))).bottom).toBeLessThanOrEqual(box(card("Offline")).top);
      });

      it("draws a single report's connector straight down from the line above, with no bar", async () => {
        await editAsync(chain);
        const reports = all(".chart .reports");

        expect(all(".chart .report").map(t => getComputedStyle(t, "::after").display)).toEqual(["none", "none", "none"]);
        for (const view of reports)
          AppearanceFixture.expectPixels(box(view).left + Number.parseFloat(getComputedStyle(view, "::before").left), centre(one(":scope > .report > .self", view)));
      });

      const bar = (view: Element): CSSStyleDeclaration => getComputedStyle(view, "::after");
      const barStart = (view: Element): number => box(view).left + Number.parseFloat(bar(view).left);
      const barEnd = (view: Element): number => box(view).right - Number.parseFloat(bar(view).right);
      const barTop = (view: Element): number => box(view).top + Number.parseFloat(bar(view).top);

      it("draws a wide tree's bar from its first report's middle to its last's, each report drawing its own part without a break", async () => {
        await editAsync(wide);
        const reports = one(":scope > .reports", nodeOf("Alice"));
        const first = one(":scope > .report:first-child", reports);
        const last = one(":scope > .report:last-child", reports);

        expect([first.classList.contains("row-start"), last.classList.contains("row-end"), bar(first).borderTopStyle]).toEqual([true, true, "solid"]);
        AppearanceFixture.expectPixels(barStart(first), centre(card("Bob")));
        AppearanceFixture.expectPixels(barStart(last), barEnd(first));
        AppearanceFixture.expectPixels(barEnd(last), centre(card("Code Reviewer")));
        AppearanceFixture.expectPixels(barTop(first), box(reports).top + AppearanceFixture.measureLook("space-3"));
        AppearanceFixture.expectPixels(barTop(last), barTop(first));
        expectAddsUnder(card("Alice"), one(":scope > .adds", nodeOf("Alice")));
      });

      it("joins only a grid's first row to the bar, drawing no line from the reports below it into the row gap", async () => {
        const named = (id: string, name: string): Teammate => new Teammate(id, name, null, "a1", Harness.Provider, null, null, "t", "t");
        const team = [named("ada", "Ada"), named("bea", "Bea"), named("cy", "Cy"), named("dee", "Dee"), named("eve", "Eve"), named("fay", "Fay")];
        await editAsync(SampleData.organizationOf([], team.map((t, i) => new TeammatePlacement(t.id, OrganizationParent.person, i))), team);
        const reports = one(".chart .tree > .reports");
        const shown = all(":scope > .report", reports);
        const parts = shown.slice(0, 4);
        const drawn = (line: CSSStyleDeclaration): boolean => line.display !== "none" && line.content !== "none";

        expect(shown.map(t => `${drawn(getComputedStyle(t, "::before"))} ${drawn(bar(t))}`))
          .toEqual(["true true", "true true", "true true", "true true", "false false", "false false"]);
        expect(box(card("Eve")).top).toBeGreaterThan(box(card("Ada")).bottom);
        AppearanceFixture.expectPixels(barStart(Required.of(parts.at(0))), centre(card("Ada")));
        AppearanceFixture.expectPixels(barEnd(Required.of(parts.at(-1))), centre(card("Dee")));
        parts.slice(1).forEach((view, i) => AppearanceFixture.expectPixels(barStart(view), barEnd(Required.of(parts.at(i)))));
      });

      it("puts a department's add row under its leader and yours above the departments, each joined to the line below", async () => {
        await editAsync(sample);

        expectAddsUnder(one(".chart .tree > .owner"), one(".chart .tree > .adds"));
        expectAddsUnder(one(":scope > .leader", department("Design")), one(":scope > .adds", department("Design")));
        expectAddsUnder(one(":scope > .department", department("Build")), one(":scope > .adds", department("Build")));
        expect(box(one(":scope > .adds", department("Design"))).bottom).toBeLessThanOrEqual(box(card("Bob")).top);
      });

      it("keeps Reports to on one line on every card", async () => {
        await editAsync(wide);
        const lines = all(".chart nol-teamrun-organization-card .move-label").map(t => {
          const range = document.createRange();
          range.selectNodeContents(t);
          return new Set([...range.getClientRects()].map(u => Math.round(u.top))).size;
        });

        expect(lines).toEqual([1, 1, 1]);
      });
    });

    describe.each([new ViewSizeCase("the narrowest a document gets", 13.75, true), new ViewSizeCase("a wide window", 72, false)])("at $size", ({ width, wraps }) => {
      it("heads the view with its title for screen readers only, the status key on the left, then the headcount, Cards show and Edit structure half a step apart, wrapping under it when narrow, and fits the tree on the canvas under its tools", async () => {
        await create();
        element().style.width = `${width}rem`;
        element().style.height = "40rem";
        await settle();
        one(".chart .nol-canvas-fit").click();
        await settle();
        const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
        const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
        const top = box(".top");
        const title = box(".top .title");
        const headcount = box(".top .headcount");
        const tools = box(".top .tools");
        const key = box(".top .status-key");
        const cards = box(".top .cards-show");
        const edit = box(".top .edit");
        const canvas = box(".chart > nol-canvas");
        const bar = box(".chart .nol-canvas-tools");
        const owner = box(".owner");
        const heading = getComputedStyle(one(".top .title"));

        expect([texts(".top .title"), one(".top .title").tagName, title.width, title.height, heading.position, heading.clipPath, heading.overflow])
          .toEqual([["My organization"], "H1", 1, 1, "absolute", "inset(50%)", "hidden"]);
        AppearanceFixture.expectPixels(key.left, top.left + space(4));
        expect(tools.right).toBeLessThanOrEqual(top.right - space(4) + 0.5);
        AppearanceFixture.expectPixels(canvas.top, top.bottom);
        AppearanceFixture.expectPixels(canvas.left, top.left);
        expect([owner.top >= bar.bottom, owner.left >= canvas.left, all(".top .status-key nol-teamrun-teammate-status").length, texts(".top .tools .headcount")])
          .toEqual([true, true, 4, ["4 teammates · 3 units"]]);
        if (wraps) {
          AppearanceFixture.expectPixels(tools.left, key.left);
          AppearanceFixture.expectPixels(key.top - top.top, space(2));
          expect(tools.top).toBeGreaterThanOrEqual(key.bottom);
          return;
        }
        AppearanceFixture.expectPixels(edit.right, tools.right);
        AppearanceFixture.expectPixels(cards.left - headcount.right, space(2));
        AppearanceFixture.expectPixels(edit.left - cards.right, space(2));
        AppearanceFixture.expectPixels(tools.right, top.right - space(4));
        AppearanceFixture.expectPixels(Math.min(...[key, headcount, cards, edit].map(t => t.top)) - top.top, space(2));
        for (const view of [key, headcount, cards, edit])
          expect(Math.abs(view.top + view.height / 2 - (top.top + (top.height - 1) / 2))).toBeLessThanOrEqual(0.5);
        expect(tools.left).toBeGreaterThan(key.right);
      });
    });
  });

  describe.each([new SurfaceLookCase("the fixture theme", ThemeMode.Light, "panel"), new SurfaceLookCase("dark", ThemeMode.Dark, "raised")])("in $look's colours", ({ mode, surface }) => {
    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    it("draws the view, its canvas and its messages on the panel's colour, the messages behind a 1px line in the border colour, in light and dark", async () => {
      await create();
      const messages = one("aside.messages");
      const probe = document.createElement("span");
      element().append(probe);
      const colour = (name: string): string => {
        probe.style.color = `var(--nol-${name})`;
        return getComputedStyle(probe).color;
      };
      const expected = [colour("panel"), colour("border")];
      probe.remove();
      const style = getComputedStyle(messages);

      expect([getComputedStyle(element()).backgroundColor, getComputedStyle(one(".chart > nol-canvas")).backgroundColor, style.borderLeftColor, style.borderLeftStyle,
        style.borderLeftWidth, style.borderTopWidth, style.borderRightWidth, style.borderTopLeftRadius]).toEqual([...expected.slice(0, 1), ...expected, "solid", "1px", "0px", "0px", "0px"]);
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

    it("draws a department's type icon a step after its toggle and before its name, centred on the name's line in the type's swatch colour, and none for a type without one", async () => {
      await create(() => {
        organization = new Organization("my-organization", "My organization", null, 0, SampleData.timestamp, SampleData.timestamp,
          [SampleData.departmentType, new NodeType("team", "Team", "groups", "teal", SampleData.timestamp, SampleData.timestamp)],
          sample.departments.map(t => t.id === "build" ? new Department("build", "Build", "team", OrganizationParent.person, null, 1, "c", "u") : t), sample.placements);
      });
      const colour = (name: string): string => {
        const probe = document.createElement("span");
        probe.style.color = `var(--nol-${name})`;
        element().append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      };
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const head = (name: string): HTMLElement => one(":scope > .department .department-row", department(name));
      const box = (view: Element): DOMRect => view.getBoundingClientRect();
      const [toggle, icon, name] = [one(".department-toggle", head("Build")), one("nol-teamrun-organization-type-icon .material-symbols-rounded", head("Build")),
        one(".department-name", head("Build"))];

      AppearanceFixture.expectPixels(box(icon).left - box(toggle).right, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(box(name).left - box(icon).right, AppearanceFixture.measureLook("space-1"));
      AppearanceFixture.expectPixels(box(icon).width, 1.25 * rem);
      AppearanceFixture.expectPixels(box(icon).height, 1.25 * rem);
      expect(Math.abs((box(icon).top + box(icon).bottom) / 2 - (box(name).top + box(name).bottom) / 2)).toBeLessThanOrEqual(1);
      expect([icon.textContent?.trim(), getComputedStyle(icon).color, all("nol-teamrun-organization-type-icon .material-symbols-rounded", head("Design"))])
        .toEqual(["groups", colour("swatch-teal"), []]);
      expect(colour("swatch-teal")).not.toBe(getComputedStyle(name).color);
    });

    it.each([new UsageFillCase(79, "text-muted"), new UsageFillCase(80, "warning")])("draws a card's usage at $used% used as a bar across the card a step high, filled in $fill, half a step before its figure", async ({ used, fill }) => {
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
      const box = card("Alice").getBoundingClientRect();
      const track = one(".nol-meter-track", meter).getBoundingClientRect();
      const text = one(".nol-meter-text", meter).getBoundingClientRect();
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
