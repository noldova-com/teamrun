/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import {
  Conversation, Department, EventName, Harness, Message, MessageAuthor, MessageStatus, MethodName, NodeType, Organization, OrganizationChat, OrganizationLayoutSaveParams,
  OrganizationParent, Teammate, TeammatePlacement
} from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { OrganizationFocusComponent } from "../../../../src/app/components/organization-focus/organization-focus.component";
import { OrganizationLayout } from "../../../../src/app/models/organization-layout";
import { OrganizationNode } from "../../../../src/app/models/organization.node";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
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

describe("OrganizationFocusComponent", () => {
  const started = "2026-09-10T08:00:00.000Z";
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationFocusComponent>;
  let saves: OrganizationLayout[];

  const carol = new Teammate("carol", "Carol", null, "a1", Harness.Provider, null, null, "t", "t");
  const sample = SampleData.organizationOf([
    new Department("design", "Design", "department", OrganizationParent.person, "alice", 0, "c", "u"),
    new Department("build", "Build", "department", OrganizationParent.person, null, 1, "c", "u"),
    new Department("ui", "UI", "department", OrganizationParent.department("design"), "reviewer", 0, "c", "u")
  ], [new TeammatePlacement("alice", OrganizationParent.department("design"), 0), new TeammatePlacement("bob", OrganizationParent.department("design"), 1),
    new TeammatePlacement("offline", OrganizationParent.department("build"), 0),
    new TeammatePlacement("carol", OrganizationParent.department("build"), 1), new TeammatePlacement("reviewer", OrganizationParent.department("ui"), 0)]);
  const waiting = new Message("r1", "c9", 1, MessageAuthor.Provider, null, MessageStatus.AwaitingApproval, [], SampleData.provenance, started, started, null, [],
    "bob", "bob");
  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The fixture has no element.");
    return native;
  };
  const all = (selector: string, root: ParentNode = element()): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];
  const one = (selector: string, root: ParentNode = element()): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const text = (view: Element): string => view.textContent?.replace(/\s+/gu, " ").trim() ?? "";
  const texts = (selector: string, root: ParentNode = element()): string[] => all(selector, root).map(text);
  const row = (label: string): HTMLElement => {
    const found = all(".orow").find(t => t.querySelector(".label")?.textContent?.trim() === label);
    if (Object.isUndefined(found))
      throw new Error(`No outline row reads ${label}.`);
    return found;
  };
  const unit = (): unknown[] => [texts(".crumb"), texts(".crumb.here"), texts(".unit-name"), texts(".unit-summary"), texts(".grid nol-teamrun-organization-card .name"),
    one(".grid").classList.contains("one"), texts(".orow.selected .label")];
  const box = (view: Element): DOMRect => view.getBoundingClientRect();
  const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
  const rem = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (focus: string | null = null): Promise<void> => {
    saves = [];
    context = SampleData.createContext()
      .answer(MethodName.MessageListOpen, () => [waiting.toJson()])
      .answer(MethodName.OrganizationLayoutRead, () => ({ focus }))
      .answer(MethodName.OrganizationList, () => [sample.toJson()])
      .answer(MethodName.OrganizationChatOpen, t => {
        const teammateId = OrganizationChat.fromJson(t).teammateId;
        return new Conversation(`org-${teammateId}`, null, teammateId, SampleData.timestamp, SampleData.timestamp, false, null, null, false, null, false, [], false, false,
          null, new OrganizationChat("my-organization", teammateId)).toJson();
      })
      .answer(MethodName.OrganizationLayoutSave, t => {
        saves.push(OrganizationLayout.fromJson(OrganizationLayoutSaveParams.fromJson(t).layout));
        return null;
      });
    for (const method of [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentMemberSet, MethodName.DepartmentDelete, MethodName.TeammatePlace])
      context.answer(method, () => null);
    const data = new TeammateFixture(context);
    data.teammates = [...data.teammates, data.reviewer, carol];
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context },
      { provide: WindowPartTokens.shown, useValue: signal(true).asReadonly() }, OrganizationLayoutService.provider,
      ChatStoreService.provider, OrganizationStoreService.provider] });
    fixture = TestBed.createComponent(OrganizationFocusComponent);
    fixture.componentRef.setInput("tree", OrganizationNode.treeOf(sample, [data.alice, data.bob, data.unavailable, data.reviewer, carol]).subDepartments);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await Wait.until(() => expect(texts(".orow .short")).toContain("Waiting for you"));
    await settle();
  };
  const click = async (view: HTMLElement): Promise<void> => {
    view.click();
    await settle();
  };

  afterEach(() => {
    TeammateStatusStoreService.release(context);
    OrganizationStoreService.release(context);
    OrganizationLayoutService.release(context);
    ChatStoreService.release(context);
  });

  it("outlines the organization: every department, nested ones indented, with its count, who needs you, and its people under it", async () => {
    await create();
    const indent = (label: string): number => Number.parseFloat(row(label).style.paddingInlineStart);

    expect([texts(".outline-head"), texts(".orow.root .label"), texts(".orow.root nol-chip"), all(".orow.department").map(t => [text(one(".label", t)), texts(".asks", t), texts("nol-chip", t)])]).toEqual([
      ["Structure"], ["Organization"], ["5"], [["Design", ["1 need you"], ["2"]], ["UI", [], ["1"]], ["Build", ["1 need you"], ["2"]]]
    ]);
    expect(all(".orow.person").map(t => [text(one(".label", t)), texts(".tag", t), texts(".short", t), one(".dot", t).className])).toEqual([
      ["Alice", ["leads"], ["Idle"], "dot idle"], ["Bob", [], ["Waiting for you"], "dot waiting"], ["Code Reviewer", ["leads"], ["Idle"], "dot idle"],
      ["Carol", [], ["Idle"], "dot idle"], ["Offline", [], ["Stopped"], "dot stopped"]
    ]);
    expect([indent("Design"), indent("UI"), indent("Build"), indent("Alice"), indent("Code Reviewer")]).toEqual([0.25, 1.75, 0.25, 2.25, 3.75]);
  });

  it("outlines a teammate in no department as a top-level row of its own, first, counted under Organization, which focuses it under Organization alone", async () => {
    await create();
    fixture.componentRef.setInput("reports", [carol]);
    fixture.componentRef.setInput("tree", OrganizationNode.treeOf(SampleData.organizationOf(sample.departments, sample.placements.filter(t => t.teammateId !== "carol")),
      ChatStoreService.of(context).teammates()).subDepartments);
    await settle();

    expect([texts(".orow.root nol-chip"), all(".orow.department").map(t => text(one(".label", t))), texts(".orow.report .label"), all(".orow")[1] === row("Carol"),
      all(".orow").filter(t => text(t).includes("No department")).length]).toEqual([["5"], ["Design", "UI", "Build"], ["Carol"], true, 0]);

    await click(one(".obtn", row("Carol")));
    const focused = unit();
    expect([focused.slice(0, 3), texts(".unit-summary")[0]?.includes("Reports to you"), focused.slice(4)]).toEqual([[["My organization", "Carol"], ["Carol"], ["Carol"]], true,
      [["Carol"], true, ["Carol"]]]);
    fixture.componentRef.setInput("editing", true);
    await settle();
    expect([all(".unit-rename").length, texts(".unit-name"), all(".remove-teammate").length, all(".orow.department .add-member").length]).toEqual([0, ["Carol"], 0, 3]);
    fixture.componentRef.setInput("editing", false);
    await settle();

    await click(one(".obtn", one(".orow.root")));
    expect([texts(".grid nol-teamrun-organization-card .name"), texts(".unit-summary")[0]?.startsWith("Your 3 direct reports")]).toEqual([["Alice", "Code Reviewer", "Carol"], true]);
  });

  it("outlines a teammate who reports to your direct report outside a department as a top-level row, saying whom it reports to there and when focused", async () => {
    await create();
    const root = OrganizationNode.treeOf(SampleData.organizationOf(sample.departments, [...sample.placements.filter(t => t.teammateId !== "carol" && t.teammateId !== "offline"),
      new TeammatePlacement("carol", OrganizationParent.person, 0), new TeammatePlacement("offline", OrganizationParent.teammate("carol"), 0)]),
      ChatStoreService.of(context).teammates());
    fixture.componentRef.setInput("reports", root.members);
    fixture.componentRef.setInput("managers", root.managers);
    fixture.componentRef.setInput("tree", root.subDepartments);
    await settle();

    expect([texts(".orow.report .label"), all(".orow.report").map(t => texts(".reports-to", t)), texts(".grid nol-teamrun-organization-card .name"),
      texts(".unit-summary")[0]?.startsWith("Your 3 direct reports and 1 under them · ")])
      .toEqual([["Carol", "Offline"], [[], ["Reports to Carol"]], ["Alice", "Code Reviewer", "Carol", "Offline"], true]);
    const button = one(".obtn", row("Offline")).getBoundingClientRect();
    const note = one(".reports-to", row("Offline")).getBoundingClientRect();
    const label = one(".label", row("Offline")).getBoundingClientRect();
    expect([note.left >= label.right, note.right <= button.right, note.top >= button.top, note.bottom <= button.bottom]).toEqual([true, true, true, true]);

    await click(one(".obtn", row("Offline")));
    expect([texts(".unit-name"), texts(".unit-summary")[0]?.includes("Reports to Carol")]).toEqual([["Offline"], true]);
  });

  it("outlines a three-level chain outside departments as top-level rows by name, each saying whom it reports to there and when focused", async () => {
    await create();
    const root = OrganizationNode.treeOf(SampleData.organizationOf(sample.departments, [...sample.placements.filter(t => !["bob", "carol", "offline"].includes(t.teammateId)),
      new TeammatePlacement("carol", OrganizationParent.person, 0), new TeammatePlacement("offline", OrganizationParent.teammate("carol"), 0),
      new TeammatePlacement("bob", OrganizationParent.teammate("offline"), 0)]), ChatStoreService.of(context).teammates());
    fixture.componentRef.setInput("reports", root.members);
    fixture.componentRef.setInput("managers", root.managers);
    fixture.componentRef.setInput("tree", root.subDepartments);
    await settle();

    expect([texts(".orow.report .label"), all(".orow.report").map(t => texts(".reports-to", t)), texts(".grid nol-teamrun-organization-card .name"),
      texts(".unit-summary")[0]?.startsWith("Your 3 direct reports and 2 under them · ")])
      .toEqual([["Bob", "Carol", "Offline"], [["Reports to Offline"], [], ["Reports to Carol"]], ["Alice", "Code Reviewer", "Bob", "Carol", "Offline"], true]);

    await click(one(".obtn", row("Bob")));
    expect([texts(".unit-name"), texts(".unit-summary")[0]?.includes("Reports to Offline")]).toEqual([["Bob"], true]);
  });

  it("opens on the leaders when nothing is focused", async () => {
    await create();
    expect(unit()).toEqual([["My organization"], ["My organization"], ["Organization"], ["Your 2 direct reports · 2 idle"], ["Alice", "Code Reviewer"], false, ["Organization"]]);
    expect(saves).toEqual([]);
  });

  it("opens on the leaders when the focus kept is gone or can't be read", async () => {
    await create("Department:gone");
    expect(unit()).toEqual([["My organization"], ["My organization"], ["Organization"], ["Your 2 direct reports · 2 idle"], ["Alice", "Code Reviewer"], false, ["Organization"]]);
    expect(saves).toEqual([]);
  });

  it("opens on the leaders when the focus kept names no kind it knows", async () => {
    await create("alice");
    expect(unit()).toEqual([["My organization"], ["My organization"], ["Organization"], ["Your 2 direct reports · 2 idle"], ["Alice", "Code Reviewer"], false, ["Organization"]]);
  });

  it("names the organization in the root crumb, and follows a rename", async () => {
    await create("Teammate:alice");
    const named = texts(".crumb");

    context.emit(EventName.OrganizationChanged, new Organization(sample.id, "Studio", null, 0, SampleData.timestamp, SampleData.timestamp,
      [SampleData.departmentType], sample.departments, sample.placements).toJson());
    await settle();

    expect([named, texts(".crumb")]).toEqual([["My organization", "Design", "Alice"], ["Studio", "Design", "Alice"]]);
  });

  it("opens on the focus kept", async () => {
    await create("Teammate:alice");

    expect(unit()).toEqual([["My organization", "Design", "Alice"], ["Alice"], ["Alice"], ["Review in Design · gpt-5"], ["Alice"], true, ["Alice"]]);
  });

  it("focuses a department, nested ones through their parents, a teammate and the organization again, and keeps each on the server", async () => {
    await create();

    await click(one(".obtn", row("UI")));
    expect(unit()).toEqual([["My organization", "Design", "UI"], ["UI"], ["UI"], ["1 teammate · 1 idle"], ["Code Reviewer"], true, ["UI"]]);
    await click(one(".obtn", row("Build")));
    expect(unit()).toEqual([["My organization", "Build"], ["Build"], ["Build"], ["2 teammates · 1 idle · 1 stopped"], ["Carol", "Offline"], false, ["Build"]]);
    await click(one(".obtn", row("Bob")));
    expect(unit()).toEqual([["My organization", "Design", "Bob"], ["Bob"], ["Bob"], ["Design"], ["Bob"], true, ["Bob"]]);
    await click(one(".crumbs button:nth-of-type(2)"));
    expect(texts(".unit-name")).toEqual(["Design"]);
    await click(one(".crumb"));
    expect(texts(".unit-name")).toEqual(["Organization"]);

    await Wait.until(() => expect(saves.map(t => t.focus)).toEqual(["Department:ui", "Department:build", "Teammate:bob", "Department:design",
      "Leaders:"]));
    expect(all(".crumb[aria-current=true]").map(text)).toEqual(["My organization"]);
    expect(all("[nolCanvasItem]").map(t => [t.tagName.toLowerCase(), texts(".name", t).join()])).toEqual([["nol-teamrun-organization-card", "Alice"],
      ["nol-teamrun-organization-card", "Code Reviewer"]]);
  });

  it("hides and shows a department's people from its arrow, and keeps that on the server", async () => {
    await create();
    const twist = (): HTMLElement => one("button.twist", row("Design"));

    expect([twist().getAttribute("aria-expanded"), twist().getAttribute("aria-label")]).toEqual(["true", "Hide Design's teammates"]);
    await click(twist());
    expect([twist().getAttribute("aria-expanded"), twist().getAttribute("aria-label"), texts(".orow.person .label")])
      .toEqual(["false", "Show Design's teammates", ["Code Reviewer", "Carol", "Offline"]]);
    await click(twist());
    expect(texts(".orow.person .label")).toEqual(["Alice", "Bob", "Code Reviewer", "Carol", "Offline"]);
    await Wait.until(() => expect(saves).toHaveLength(2));
  });

  it("edits the structure in edit mode: renames the focused department, adds a member from outside a department and a department, and lets its members' cards move or remove them", async () => {
    const at = <T>(items: readonly T[], index: number): T => {
      const found = items[index];
      if (Object.isUndefined(found))
        throw new Error(`Nothing at ${index}.`);
      return found;
    };
    const edits = (): unknown[] => context.requests.filter(t => t.method.startsWith("teamrun.department") || t.method === "teamrun.teammatePlace").map(t => [t.method, t.parameters]);
    const offered = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>("nol-teamrun-organization-teammate-search .nol-quick-input-option")];
    const cardEdits = (): unknown[] => all(".grid nol-teamrun-organization-card").map(t => [texts(".name", t), all(".head input", t).length, all(".move-choice, .remove", t).length]);
    await create("Department:design");
    expect([all(".unit-rename").length, all(".grid .move-choice").length, all(".add-member").length, all(".add-department").length]).toEqual([0, 0, 0, 0]);

    fixture.componentRef.setInput("editing", true);
    await settle();
    expect([all(".add-member").map(t => t.getAttribute("aria-label")), texts(".unit-name"), one(".unit-rename").getAttribute("aria-label"), cardEdits()]).toEqual([
      ["Add teammate", "Add a member to Design", "Add a member to UI", "Add a member to Build"], [], "Department name", [[["Alice"], 0, 1], [["Bob"], 0, 2]]
    ]);
    const field = one(".unit-rename");
    if (!(field instanceof HTMLInputElement))
      throw new Error("The rename field is no input.");
    const typed: string[] = [];
    for (const value of ["   ", "Design", "  Craft  "]) {
      field.value = value;
      field.dispatchEvent(new Event("change"));
      typed.push(field.value);
    }
    expect(typed).toEqual(["Design", "Design", "  Craft  "]);
    await userEvent.click(one(".add-member", row("Design")));
    await Wait.until(() => expect(document.querySelector("nol-teamrun-organization-teammate-search .nol-quick-input-field")).not.toBeNull());
    await userEvent.type(one("nol-teamrun-organization-teammate-search .nol-quick-input-field", document), "car");
    await Wait.until(() => expect(offered().map(t => t.querySelector(".nol-quick-input-title")?.textContent?.trim())).toEqual(["Carol", "New teammate…"]));
    await userEvent.click(at(offered(), 0));
    one(".add-department").click();
    await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-department-name")).not.toBeNull());
    const name = one("nol-dialog .nol-teamrun-department-name", document.body);
    if (!(name instanceof HTMLInputElement))
      throw new Error("The dialog has no name field.");
    name.value = "Lab";
    name.dispatchEvent(new Event("input"));
    await fixture.whenStable();
    one("nol-dialog .nol-teamrun-save", document.body).click();

    await Wait.until(() => expect(edits()).toEqual([
      ["teamrun.departmentUpdate", { organizationId: "my-organization", departmentId: "design", name: "Craft" }],
      ["teamrun.teammatePlace", { organizationId: "my-organization", teammateId: "carol", parent: { kind: "Department", id: "design" }, order: Resources.organizationLastOrder }],
      ["teamrun.departmentCreate", { organizationId: "my-organization", name: "Lab", typeId: "department", parent: { kind: "Person", id: null }, leaderId: null }]
    ]));
  });

  it("asks before deleting the focused department, and deletes nothing when the question is closed", async () => {
    const edits = (): unknown[] => context.requests.filter(t => t.method.startsWith("teamrun.department")).map(t => [t.method, t.parameters]);
    const dialog = (): string[] => [...document.querySelectorAll("nol-teamrun-confirm-dialog .nol-dialog-title, nol-teamrun-confirm-dialog p, nol-teamrun-confirm-dialog .nol-dialog-actions button")]
      .map(t => t.textContent?.trim() ?? "");
    const answer = async (button: string): Promise<void> => {
      const found = document.querySelector<HTMLButtonElement>(`nol-teamrun-confirm-dialog ${button}`);
      if (Object.isNull(found))
        throw new Error(`No ${button} in the dialog.`);
      found.click();
      await settle();
    };
    await create("Department:ui");
    fixture.componentRef.setInput("editing", true);
    await settle();

    expect([texts(".edit-row .delete-department"), one(".delete-department").classList.contains("nol-button-outlined")]).toEqual([["deleteRemove Department"], true]);
    await click(one(".delete-department"));
    expect(dialog()).toEqual(["Delete Department", "Delete UI? Its units and members move to Design.", "Close", "Delete"]);
    await answer(".nol-teamrun-cancel");
    await click(one(".obtn", row("Design")));
    await click(one(".delete-department"));
    expect(dialog()).toContain("Delete Design? Its units move up to report to you, and its members leave every unit.");
    await answer(".nol-teamrun-confirm");

    await Wait.until(() => expect(edits()).toEqual([["teamrun.departmentDelete", { organizationId: "my-organization", departmentId: "design" }]]));
  });

  it("talks under the canvas with whoever is focused: a teammate in their Organization chat, a group through a send to each", async () => {
    const panel = (): unknown[] => [texts(".focus > nol-teamrun-organization-chat .nol-teamrun-organization-chat-title"),
      all(".focus > nol-teamrun-organization-chat nol-teamrun-history").length, all(".focus > nol-teamrun-organization-chat .nol-teamrun-organization-recipient").length > 0];
    await create("Department:design");

    expect(panel()).toEqual([["Chat with Design"], 0, true]);
    await click(one(".obtn", row("Bob")));
    await Wait.until(() => expect(panel()).toEqual([["Chat with Bob"], 1, false]));
    await click(one(".crumb"));
    expect(panel()).toEqual([["Chat with all leaders and your direct reports"], 0, true]);
  });

  it("names a focused teammate as its heading, in no field, names nothing for the leaders, and lets a focused member's card and each leader's move it", async () => {
    await create("Teammate:bob");
    fixture.componentRef.setInput("editing", true);
    await settle();
    expect([all(".unit-rename").length, texts(".unit-name"), all(".grid .move-choice").length]).toEqual([0, ["Bob"], 1]);
    await click(one(".crumb"));
    expect([all(".unit-rename").length, texts(".unit-name"), all(".grid .move-choice").length]).toEqual([0, ["Organization"], 2]);
  });

  it("shows each card in full, every activity with its time and the role with its department, and focuses its teammate from the name or the chat button", async () => {
    const clock = new FakeClock(Date.parse("2026-09-10T08:05:00.000Z"));
    TestBed.overrideProvider(ClockService, { useValue: clock });
    const running = (id: string, chatId: string, at: string): Message =>
      new Message(id, chatId, 1, MessageAuthor.Provider, null, MessageStatus.Running, [], SampleData.provenance, at, at, null, [], "alice", "alice");
    const alice = (): HTMLElement => one(".grid nol-teamrun-organization-card");
    await create("Department:design");
    context.emit(EventName.MessageCreated, running("r1", "c9", "2026-09-10T08:04:30.000Z").toJson());
    context.emit(EventName.MessageCreated, running("r2", "c1", "2026-09-10T08:04:20.000Z").toJson());
    await Wait.until(() => expect(texts(".act", alice())).toHaveLength(2));

    expect([texts(".act", alice()), one(".acts", alice()).getAttribute("aria-label"), all(".now", alice()).length, texts(".role", alice()),
      texts(".grid nol-teamrun-organization-card .chat").length, one(".chat", alice()).getAttribute("aria-label")]).toEqual([
      ["progress_activityFirst40 s", "progress_activityReplying30 s"], "What Alice is doing now", 0, ["Review · Design"], 2, "Message Alice"]);
    await click(one(".chat", alice()));
    expect(texts(".unit-name")).toEqual(["Alice"]);
    await click(one(".crumbs button:nth-of-type(2)"));
    await click(one(".grid nol-teamrun-organization-card:nth-child(2) .name"));
    expect(texts(".unit-name")).toEqual(["Bob"]);
    await Wait.until(() => expect(saves.map(t => t.focus)).toEqual(["Teammate:alice", "Department:design", "Teammate:bob"]));
  });

  it("names a focused teammate as its heading, in no field, while editing, and removes a member from its department after asking, but no leader", async () => {
    const answer = async (button: string): Promise<void> => {
      const found = document.querySelector<HTMLButtonElement>(`nol-teamrun-confirm-dialog ${button}`);
      if (Object.isNull(found))
        throw new Error(`No ${button} in the dialog.`);
      found.click();
      await settle();
    };
    const edits = (): unknown[] => context.requests.filter(t => t.method.startsWith("teamrun.department")).map(t => [t.method, t.parameters]);
    const head = (): unknown[] => [all(".unit-head input").length, texts(".unit-name"), texts(".remove-teammate")];
    await create("Teammate:alice");
    fixture.componentRef.setInput("editing", true);
    await settle();
    const leader = head();
    await click(one(".obtn", row("Bob")));
    const member = head();

    await click(one(".remove-teammate"));
    await answer(".nol-teamrun-cancel");
    await click(one(".remove-teammate"));
    await answer(".nol-teamrun-confirm");
    await Wait.until(() => expect(edits()).toEqual([["teamrun.departmentMemberSet", { organizationId: "my-organization", teammateId: "bob", departmentId: null }]]));
    expect([leader, member, context.count(MethodName.TeammateUpdate)]).toEqual([[0, ["Alice"], []], [0, ["Bob"], ["group_removeMove out of unit"]], 0]);
    expect(all(".unit-rename").map(t => t.getAttribute("aria-label"))).toEqual(["Department name"]);
  });

  it("chooses the focused unit's type under its name only while editing, among the organization's types, and sends the type chosen", async () => {
    const team = new NodeType("team", "Team", null, null, SampleData.timestamp, SampleData.timestamp);
    await create("Department:ui");
    const hidden = all(".unit-type").length;
    fixture.componentRef.setInput("editing", true);
    context.emit(EventName.OrganizationChanged, new Organization(sample.id, sample.name, null, 0, SampleData.timestamp, SampleData.timestamp,
      [SampleData.departmentType, team], sample.departments, sample.placements).toJson());
    await settle();
    const choice = one(".unit-type");
    const shown = one(".nol-select-value", choice).textContent?.trim();
    const geometry = [box(choice).left - box(one(".unit-rename")).left, box(choice).top >= box(one(".edit-row")).bottom];
    one(".nol-select-button", choice).click();
    await Wait.until(() => expect(document.querySelector(".nol-select-option")).not.toBeNull());
    const offered = [...document.querySelectorAll(".nol-select-option")].map(t => t.textContent?.trim());
    await userEvent.click(one(".nol-select-option[data-value='team']", document));
    await Wait.until(() => expect(context.count(MethodName.DepartmentUpdate)).toBe(1));

    expect([hidden, shown, offered, geometry]).toEqual([0, "Department", ["Department", "Team", "New type…"], [0, true]]);
    expect(context.requests.filter(t => t.method === FakeWindowPartContext.qualify(MethodName.DepartmentUpdate)).map(t => t.parameters))
      .toEqual([{ organizationId: "my-organization", departmentId: "ui", typeId: "team" }]);
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

    it("sets a direct report's row right under Organization, its dot where a top-level department's icon sits, at a person's row height and spacing", async () => {
      await create();
      fixture.componentRef.setInput("reports", [carol]);
      fixture.componentRef.setInput("tree", OrganizationNode.treeOf(SampleData.organizationOf(sample.departments, sample.placements.filter(t => t.teammateId !== "carol")),
        ChatStoreService.of(context).teammates()).subDepartments);
      await settle();
      const dot = box(one(".dot", row("Carol")));
      const icon = box(one(".obtn .icon", row("Design")));

      expect(all(".orow")[1]).toBe(row("Carol"));
      AppearanceFixture.expectPixels(dot.left + dot.width / 2, icon.left + icon.width / 2);
      AppearanceFixture.expectPixels(box(row("Carol")).height, box(row("Bob")).height);
      AppearanceFixture.expectPixels(box(row("Carol")).left, box(row("Design")).left);
      AppearanceFixture.expectPixels(box(row("Carol")).right, box(row("Design")).right);
      AppearanceFixture.expectPixels(box(row("Carol")).top - box(one(".orow.root")).bottom, box(row("UI")).top - box(row("Bob")).bottom);
      AppearanceFixture.expectPixels(box(row("Design")).top - box(row("Carol")).bottom, box(row("UI")).top - box(row("Bob")).bottom);
    });

    it("sets the 16rem outline beside the focus, whose canvas holds the 60rem unit above the 17rem conversation: its cards in columns of at least 18rem, one card at up to 36rem", async () => {
      await create();
      element().style.width = "90rem";
      element().style.height = "40rem";
      await settle();
      await Wait.until(async () => {
        await click(one(".focus .nol-canvas-actual"));
        await settle();
        expect(texts(".focus .nol-canvas-zoom")).toEqual(["100%"]);
      });
      const host = box(element());
      const outline = box(one(".outline"));
      const focus = box(one(".focus"));
      const canvas = box(one(".focus > nol-canvas"));
      const conversation = box(one(".focus > nol-teamrun-organization-chat"));
      const plane = box(one(".focus-plane"));
      const cards = all(".grid nol-teamrun-organization-card").map(box);
      const columns = Math.floor((plane.width + space(3)) / (18 * rem() + space(3)));
      const width = (plane.width - (columns - 1) * space(3)) / columns;

      expect(texts(".focus .nol-canvas-zoom")).toEqual(["100%"]);
      if (forcedColors === "none")
        expect(getComputedStyle(one(".asks")).color).toBe(AppearanceFixture.readColor(FixtureTheme.theme, mode, "warning"));
      AppearanceFixture.expectPixels(outline.left, host.left);
      AppearanceFixture.expectPixels(outline.height, host.height);
      AppearanceFixture.expectPixels(outline.width, 16 * rem() + (host.width - 51 * rem() - space(4)) / 1000);
      AppearanceFixture.expectPixels(focus.left - outline.right, space(4));
      AppearanceFixture.expectPixels(focus.right, host.right);
      AppearanceFixture.expectPixels(canvas.left, focus.left);
      AppearanceFixture.expectPixels(canvas.top, focus.top);
      AppearanceFixture.expectPixels(canvas.right, focus.right);
      AppearanceFixture.expectPixels(conversation.top - canvas.bottom, space(4));
      AppearanceFixture.expectPixels(conversation.height, 17 * rem());
      AppearanceFixture.expectPixels(conversation.left, focus.left);
      AppearanceFixture.expectPixels(conversation.right, focus.right);
      AppearanceFixture.expectPixels(conversation.bottom, focus.bottom);
      AppearanceFixture.expectPixels(plane.width, 60 * rem());
      expect(getComputedStyle(one(".outline")).borderTopWidth).toBe("1px");
      AppearanceFixture.expectPixels(box(one(".orow.root")).left - outline.left, space(1) + 1);
      AppearanceFixture.expectPixels(box(one(".orow.root")).height, 1.625 * rem());
      for (const [index, card] of cards.entries()) {
        AppearanceFixture.expectPixels(card.width, width);
        AppearanceFixture.expectPixels(card.left - plane.left, index * (width + space(3)));
      }
      AppearanceFixture.expectPixels(box(one(".unit-head")).top - box(one(".crumbs")).bottom, space(4));
      AppearanceFixture.expectPixels(box(one(".grid")).top - box(one(".unit-head")).bottom, space(4));

      await click(one(".obtn", row("Bob")));
      AppearanceFixture.expectPixels(box(one(".grid nol-teamrun-organization-card")).width, 36 * rem());
    });
  });
});
