/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { By } from "@angular/platform-browser";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Department, DepartmentMember, EventName, Harness, Message, MessageAuthor, MessageStatus, MethodName, Organization, OrganizationTarget,
  Teammate, TeammateLastReply } from "@noldova/teamrun.protocol";
import { ChoicePillsComponent, ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OrganizationBoardComponent } from "../../../../src/app/components/organization-board/organization-board.component";
import { OrganizationConversation } from "../../../../src/app/models/organization-conversation";
import { OrganizationNode } from "../../../../src/app/models/organization.node";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ClockService } from "../../../../src/app/services/clock.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeClock } from "../../../fixtures/fake-clock.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationBoardComponent", () => {
  const started = "2026-09-10T08:00:00.000Z";
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationBoardComponent>;
  let clock: FakeClock;

  const carol = new Teammate("carol", "Carol", null, "a1", Harness.Provider, null, null, "t", "t");
  const sample = new Organization([
    new Department("design", "Design", null, "alice", 0, "c", "u"),
    new Department("build", "Build", null, null, 1, "c", "u"),
    new Department("ui", "UI", "design", "reviewer", 0, "c", "u")
  ], [new DepartmentMember("alice", "design"), new DepartmentMember("bob", "design"), new DepartmentMember("offline", "build"),
    new DepartmentMember("carol", "build"), new DepartmentMember("reviewer", "ui")]);
  const reply = (status: MessageStatus): Message => new Message("r1", "c9", 1, MessageAuthor.Provider, null, status, [], SampleData.provenance, started, started,
    null, [], "bob", "bob");
  const element = (): HTMLElement => {
    const native: unknown = fixture.nativeElement;
    if (!(native instanceof HTMLElement))
      throw new Error("The component has no element.");
    return native;
  };
  const all = (selector: string, root: ParentNode = element()): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(selector)];
  const one = (selector: string, root: ParentNode = element()): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const texts = (selector: string, root: ParentNode = element()): string[] => all(selector, root).map(t => t.textContent?.trim() ?? "");
  const box = (view: Element): DOMRect => view.getBoundingClientRect();
  const nth = (boxes: readonly DOMRect[], index: number): DOMRect => {
    const found = boxes[index];
    if (Object.isUndefined(found))
      throw new Error(`No box at ${index}.`);
    return found;
  };
  const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
  const rem = (): number => Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (): Promise<void> => {
    context = SampleData.createContext().answer(MethodName.MessageListOpen, () => [reply(MessageStatus.AwaitingApproval).toJson()])
      .answer(MethodName.TeammateLastReplyList, () => [new TeammateLastReply("bob", "c9", "r1", "Ship the header now?", started).toJson()]);
    clock = new FakeClock(Date.parse(started) + 5 * 60_000);
    for (const method of [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentMemberSet, MethodName.DepartmentDelete])
      context.answer(method, () => null);
    const data = new TeammateFixture(context);
    data.teammates = [...data.teammates, data.reviewer, carol];
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, ChatStoreService.provider,
      OrganizationStoreService.provider, { provide: ClockService, useValue: clock }] });
    fixture = TestBed.createComponent(OrganizationBoardComponent);
    fixture.componentRef.setInput("tree", OrganizationNode.treeOf(sample, [data.alice, data.bob, data.unavailable, data.reviewer, carol]));
    fixture.autoDetectChanges();
    await Wait.until(() => expect([texts(".ask .name"), texts(".ask-text")]).toEqual([["Bob", "Offline"], ["Ship the header now?"]]));
    await settle();
  };

  afterEach(() => {
    TeammateStatusStoreService.release(context);
    OrganizationStoreService.release(context);
    OrganizationLayoutService.release(context);
    ChatStoreService.release(context);
  });

  it("queues who needs you, waiting first, then strips the leaders across the top and gives every department, nested ones too, a column", async () => {
    await create();

    expect([texts(".needs-section .title"), texts(".needs-count"), all(".ask").map(t => [texts(".name", t), texts(".department", t), texts(".status", t),
      texts(".ask-ago", t), texts(".ask-text", t), texts(".answer", t), one(".answer", t).getAttribute("aria-label")]), texts(".needs-empty")]).toEqual([
      ["Needs you"], ["2"], [[["Bob"], ["Design"], ["Waiting for you"], ["· 5 min ago"], ["Ship the header now?"], ["Answer"], "Answer Bob"],
        [["Offline"], ["Build"], ["Stopped"], [], [], ["Open"], "Open Offline"]], []
    ]);
    clock.advance(60 * 60_000);
    await settle();
    expect(texts(".ask-ago")).toEqual(["· 1 h ago"]);
    expect([texts(".leaders-section .title"), texts(".leaders-section .note"), texts(".message-leaders"), texts(".leaders > .leader .name")]).toEqual([
      ["Leaders"], ["They talk across departments; you lead them."], ["forumMessage all leaders"], ["Alice", "Code Reviewer"]
    ]);
    expect([texts(".departments-section > .section-head .title"), texts(".departments-section > .section-head .note")])
      .toEqual([["Departments"], ["Each column's members, sorted by who needs you first."]]);
    expect(all(".lane").map(t => [texts(".lane-name", t), texts(".lane-count", t), texts(".lane-summary", t), all(".lane-sort", t).length,
      texts("nol-teamrun-organization-card .name", t), texts(".lane-empty", t), one(".message-department", t).getAttribute("aria-label")])).toEqual([
      [["Design"], ["2"], ["Led by Alice · 1 waiting for you · 1 idle"], 1, ["Bob"], [], "Message Design"],
      [["UI"], ["1"], ["Led by Code Reviewer · 1 idle"], 0, [], ["No members yet."], "Message UI"],
      [["Build"], ["2"], ["1 idle · 1 stopped"], 1, ["Offline", "Carol"], [], "Message Build"]
    ]);
    expect(all("nol-teamrun-organization-card").every(t => t.classList.contains("row"))).toBe(true);
    expect(all("[nolCanvasItem]").map(t => [t.tagName.toLowerCase(), texts(".name", t).join()])).toEqual([["nol-teamrun-organization-card", "Alice"],
      ["nol-teamrun-organization-card", "Code Reviewer"], ["nol-teamrun-organization-card", "Bob"], ["nol-teamrun-organization-card", "Offline"],
      ["nol-teamrun-organization-card", "Carol"]]);
  });

  it("gives the teammates in no department a No department column, first, with no message, rename, delete or add, and counts them on its head", async () => {
    await create();
    fixture.componentRef.setInput("tree", OrganizationNode.treeOf(new Organization(sample.departments, sample.members.filter(t => t.teammateId !== "carol")),
      ChatStoreService.of(context).teammates()));
    await settle();
    const none = (): HTMLElement => one(".lane:nth-child(1)");

    expect([all(".lane").length, texts(".lane-name", none()), texts(".lane-count", none()), texts("nol-teamrun-organization-card .name", none()),
      all(".message-department", none()).length, all(".message-department").length]).toEqual([4, ["No department"], ["1"], ["Carol"], 0, 3]);

    fixture.componentRef.setInput("editing", true);
    await settle();

    expect([[...element().querySelectorAll<HTMLInputElement>(".lane-rename")].map(t => t.value), all(".delete-department").length, all(".add-member").length,
      texts(".lane-name", none()), all(".move-choice, .remove", none()).length]).toEqual([["Design", "UI", "Build"], 3, 3, ["No department"], 0]);
  });

  it("sorts a column by name, and by status again, on its own, and by status for a sort it doesn't know", async () => {
    await create();
    const build = (): HTMLElement => one(".lane:nth-child(3)");

    expect([texts(".lane-name", build()), one(".lane-sort [role=radiogroup]", build()).getAttribute("aria-label"), texts(".lane-sort [role=radio]", build()),
      one(".lane-sort [role=radio][aria-checked=true]", build()).textContent?.trim()]).toEqual([["Build"], "Sort Build by", ["Status", "Name"], "Status"]);
    one(".lane-sort [role=radio]:nth-child(2)", build()).click();
    await settle();
    expect([texts("nol-teamrun-organization-card .name", build()), texts("nol-teamrun-organization-card .name", one(".lane"))]).toEqual([["Carol", "Offline"], ["Bob"]]);

    one(".lane-sort [role=radio]:nth-child(1)", build()).click();
    await settle();
    expect(texts("nol-teamrun-organization-card .name", build())).toEqual(["Offline", "Carol"]);

    one(".lane-sort [role=radio]:nth-child(2)", build()).click();
    await settle();
    fixture.debugElement.query(By.css(".lane:nth-child(3) .lane-sort")).injector.get(ChoicePillsComponent).valueChange.emit("unknown");
    await settle();
    expect(texts("nol-teamrun-organization-card .name", build())).toEqual(["Offline", "Carol"]);
  });

  it("follows the statuses: an answered teammate leaves the queue, and an empty queue says nobody is waiting", async () => {
    await create();

    context.emit(EventName.MessageUpdated, reply(MessageStatus.Running).toJson());
    await Wait.until(() => expect(texts(".ask .name")).toEqual(["Offline"]));
    expect([texts(".needs-count"), texts(".lane-summary", one(".lane"))]).toEqual([["1"], ["Led by Alice · 1 working · 1 idle"]]);

    fixture.componentRef.setInput("tree", []);
    await settle();
    expect([all(".ask").length, texts(".needs-count"), texts(".needs-empty"), all(".leaders > .leader").length, all(".lane").length])
      .toEqual([0, ["0"], ["Nobody is waiting for you."], 0, 0]);
  });

  it("opens each conversation in the inbox from its row, and marks the open one", async () => {
    await create();
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe(t => chosen.push(OrganizationConversation.keyOf(t)));
    const selected = (): string[] => all(".ask.selected .name, .leaders > .selected .name, .lane.selected .lane-name, .lane > .selected .name")
      .map(t => t.textContent?.trim() ?? "");

    for (const button of [...all(".answer"), one(".message-leaders"), ...all(".leaders > .leader .name"), ...all(".message-department"), ...all(".lane .name")])
      button.click();
    expect([chosen, selected()]).toEqual([["Teammate:bob", "Teammate:offline", "Leaders:", "Teammate:alice", "Teammate:reviewer", "Department:design",
      "Department:ui", "Department:build", "Teammate:bob", "Teammate:offline", "Teammate:carol"], []]);

    const marked: string[][] = [];
    for (const target of [OrganizationTarget.teammate("bob"), OrganizationTarget.department("build"), OrganizationTarget.teammate("alice")]) {
      fixture.componentRef.setInput("target", target);
      await settle();
      marked.push(selected());
    }
    expect(marked).toEqual([["Bob", "Bob"], ["Build"], ["Alice"]]);
  });

  it("edits the structure in edit mode: renames a department, adds a member from outside it and a department, and lets each member's card move or remove it", async () => {
    const at = <T>(items: readonly T[], index: number): T => {
      const found = items[index];
      if (Object.isUndefined(found))
        throw new Error(`Nothing at ${index}.`);
      return found;
    };
    const edits = (): unknown[] => context.requests.filter(t => t.method.startsWith("teamrun.department")).map(t => [t.method, t.parameters]);
    const menuItems = (): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>("button[nol-menu-item]")];
    await create();
    expect([all(".lane-rename").length, all("nol-teamrun-organization-card .move-choice").length, all(".add-member").length, all(".add-department").length])
      .toEqual([0, 0, 0, 0]);

    fixture.componentRef.setInput("editing", true);
    await settle();
    const fields = (): HTMLInputElement[] => [...element().querySelectorAll<HTMLInputElement>(".lane-rename")];
    expect([fields().map(t => t.value), all(".lane-rename").map(t => t.getAttribute("aria-label")), all(".lane-name").length,
      all(".message-department").length]).toEqual([["Design", "UI", "Build"], ["Department name", "Department name", "Department name"], 0, 0]);
    expect([all(".lanes nol-teamrun-organization-card").map(t => [t.querySelector(".name")?.textContent?.trim(), all(".head input", t).length,
      all(".move-choice, .remove", t).length]),
    all(".leaders nol-teamrun-organization-card").map(t => [t.querySelector(".name")?.textContent?.trim(), all(".head input", t).length]),
    all(".leaders nol-teamrun-organization-card .move-choice, .leaders nol-teamrun-organization-card .remove").length])
      .toEqual([[["Bob", 0, 2], ["Offline", 0, 2], ["Carol", 0, 2]], [["Alice", 0], ["Code Reviewer", 0]], 0]);
    for (const value of ["  Craft  ", "   ", "UI"]) {
      const field = at(fields(), value === "UI" ? 1 : 0);
      field.value = value;
      field.dispatchEvent(new Event("change"));
    }
    one(".lane:nth-child(1) .add-member").click();
    await settle();
    await Wait.until(() => expect(menuItems().map(t => t.textContent?.trim())).toEqual(["Carol", "Code Reviewer", "Offline"]));
    at(menuItems(), 0).click();
    one(".add-department").click();

    await Wait.until(() => expect(edits()).toEqual([
      ["teamrun.departmentUpdate", { departmentId: "design", name: "Craft" }],
      ["teamrun.departmentMemberSet", { teammateId: "carol", departmentId: "design" }],
      ["teamrun.departmentCreate", { name: "New department", parentId: null }]
    ]));
    expect(fields().map(t => t.value)).toEqual(["Design", "UI", "Build"]);
  });

  it("asks before deleting a department, and deletes nothing when the question is closed", async () => {
    const at = <T>(items: readonly T[], index: number): T => {
      const found = items[index];
      if (Object.isUndefined(found))
        throw new Error(`Nothing at ${index}.`);
      return found;
    };
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
    await create();
    fixture.componentRef.setInput("editing", true);
    await settle();
    const deletes = (): HTMLElement[] => all(".delete-department");

    expect(deletes().map(t => t.getAttribute("aria-label"))).toEqual(["Delete Design", "Delete UI", "Delete Build"]);
    at(deletes(), 1).click();
    await settle();
    expect(dialog()).toEqual(["Delete department", "Delete UI? Its departments and members move to Design.", "Close", "Delete"]);
    await answer(".nol-teamrun-cancel");
    at(deletes(), 0).click();
    await settle();
    expect(dialog()).toContain("Delete Design? Its departments move up to report to you, and its members leave every department.");
    await answer(".nol-teamrun-confirm");

    await Wait.until(() => expect(edits()).toEqual([["teamrun.departmentDelete", { departmentId: "design" }]]));
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

    it("draws No department's column first, as wide as the others, with its head, summary, sort and members at a department column's insets", async () => {
      await create();
      fixture.componentRef.setInput("tree", OrganizationNode.treeOf(new Organization(sample.departments, sample.members.filter(t => t.teammateId !== "carol")),
        ChatStoreService.of(context).teammates()));
      await settle();
      const host = box(element());
      const gap = space(4);
      const columns = Math.floor((host.width + gap) / (16 * rem() + gap));
      const width = (host.width - (columns - 1) * gap) / columns;
      const [none, design] = [one(".lane:nth-child(1)"), one(".lane:nth-child(2)")];
      const offsets = (lane: HTMLElement): { head: DOMRect; summary: DOMRect; sort: DOMRect; member: DOMRect; column: DOMRect } => ({ column: box(lane),
        head: box(one(".lane-head", lane)), summary: box(one(".lane-summary", lane)), sort: box(one(".lane-sort", lane)), member: box(one("nol-teamrun-organization-card", lane)) });
      const [ours, theirs] = [offsets(none), offsets(design)];

      expect(texts(".lane-name", none)).toEqual(["No department"]);
      for (const [index, column] of all(".lane").map(box).entries()) {
        AppearanceFixture.expectPixels(column.width, width);
        AppearanceFixture.expectPixels(column.left - host.left, index * (width + gap));
        AppearanceFixture.expectPixels(column.top, ours.column.top);
      }
      AppearanceFixture.expectPixels(ours.head.left - ours.column.left, space(3) + 1);
      AppearanceFixture.expectPixels(ours.head.top - ours.column.top, theirs.head.top - theirs.column.top);
      AppearanceFixture.expectPixels(ours.summary.top - ours.head.bottom, theirs.summary.top - theirs.head.bottom);
      AppearanceFixture.expectPixels(ours.sort.top - ours.summary.bottom, theirs.sort.top - theirs.summary.bottom);
      AppearanceFixture.expectPixels(ours.sort.left - ours.column.left, space(3) + 1);
      AppearanceFixture.expectPixels(ours.member.top - ours.sort.bottom, theirs.member.top - theirs.sort.bottom);
      AppearanceFixture.expectPixels(ours.member.left - ours.column.left, theirs.member.left - theirs.column.left);
      AppearanceFixture.expectPixels(ours.member.width, theirs.member.width);
    });

    it("lays the board out at 76rem: the queue in columns of at least 17rem, the leaders at up to 20rem on one line, the departments in columns of at least 16rem", async () => {
      await create();
      const host = box(element());
      const asks = all(".ask").map(box);
      const ask = one(".ask");
      const leaders = all(".leaders > .leader").map(box);
      const strip = one(".leaders");
      const lanes = all(".lane").map(box);
      const lane = one(".lane");
      const head = box(one(".lane-head", lane));
      const summary = box(one(".lane-summary", lane));
      const sort = box(one(".lane-sort", lane));
      const member = box(one("nol-teamrun-organization-card", lane));
      const columns = (min: number, gap: number): number => Math.floor((host.width + gap) / (min * rem() + gap));
      const width = (min: number, gap: number): number => (host.width - (columns(min, gap) - 1) * gap) / columns(min, gap);
      const first = nth(lanes, 0);

      AppearanceFixture.expectPixels(host.width, 76 * rem());
      AppearanceFixture.expectPixels(box(one(".needs-section")).top, host.top);
      AppearanceFixture.expectPixels(box(one(".leaders-section")).top - box(one(".needs-section")).bottom, space(6));
      AppearanceFixture.expectPixels(box(one(".departments-section")).top - box(one(".leaders-section")).bottom, space(6));
      for (const [index, item] of asks.entries()) {
        AppearanceFixture.expectPixels(item.width, width(17, space(2)));
        AppearanceFixture.expectPixels(item.left - host.left, index * (width(17, space(2)) + space(2)));
      }
      AppearanceFixture.expectPixels(box(one("nol-teamrun-teammate-avatar > *", ask)).left - nth(asks, 0).left, space(3) + 1);
      AppearanceFixture.expectPixels(box(one("nol-teamrun-teammate-avatar > *", ask)).top - nth(asks, 0).top, space(3) + 1);
      AppearanceFixture.expectPixels(nth(asks, 0).right - box(one(".answer", ask)).right, space(3) + 1);
      expect(getComputedStyle(ask).borderTopWidth).toBe("1px");
      AppearanceFixture.expectPixels(box(strip).top - box(one(".leaders-section > .section-head")).bottom, space(3));
      for (const leader of leaders)
        AppearanceFixture.expectPixels(leader.width, 20 * rem());
      AppearanceFixture.expectPixels(nth(leaders, 1).left - nth(leaders, 0).right, space(3));
      AppearanceFixture.expectPixels(nth(leaders, 1).top, nth(leaders, 0).top);
      expect(getComputedStyle(one(".leaders > .leader")).borderTopWidth).toBe("1px");
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(strip, "::before").top), 1.625 * rem());
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(strip, "::before").left), space(4));
      for (const [index, column] of lanes.entries()) {
        AppearanceFixture.expectPixels(column.width, width(16, space(4)));
        AppearanceFixture.expectPixels(column.left - host.left, index * (width(16, space(4)) + space(4)));
      }
      AppearanceFixture.expectPixels(head.left - first.left, space(3) + 1);
      AppearanceFixture.expectPixels(head.top - first.top, space(3) + 1);
      AppearanceFixture.expectPixels(summary.top - head.bottom, space(1) * 2);
      AppearanceFixture.expectPixels(sort.top - summary.bottom, space(1));
      AppearanceFixture.expectPixels(sort.left - first.left, space(3) + 1);
      AppearanceFixture.expectPixels(member.top - sort.bottom, space(1) * 2);
      AppearanceFixture.expectPixels(member.left - first.left, space(3) + 1);
      AppearanceFixture.expectPixels(first.right - member.right, space(3) + 1);
      AppearanceFixture.expectPixels(first.bottom - member.bottom, space(3) + 1);
    });
  });
});
