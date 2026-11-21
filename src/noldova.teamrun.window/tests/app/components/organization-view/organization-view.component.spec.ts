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
import { WindowPartTokens } from "@noldova/desktop.window";
import { Department, DepartmentMember, EventName, MethodName, Organization, OrganizationLayoutSaveParams, PlanUsage, PlanWindow, PlanWindowName }
  from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { OrganizationViewComponent } from "../../../../src/app/components/organization-view/organization-view.component";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { OrganizationStoreService } from "../../../../src/app/services/organization-store.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("OrganizationViewComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationViewComponent>;
  let organization: Organization;
  let saves: JsonValue[];

  const sample = new Organization([
    new Department("design", "Design", null, "alice", 0, "c", "u"),
    new Department("build", "Build", null, null, 1, "c", "u"),
    new Department("ui", "UI", "design", "reviewer", 0, "c", "u")
  ], [new DepartmentMember("alice", "design"), new DepartmentMember("bob", "design"), new DepartmentMember("offline", "build"),
    new DepartmentMember("reviewer", "ui")]);
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
    const found = all("nol-teamrun-organization-department").find(t => t.querySelector(".department-name")?.textContent?.trim() === name);
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
    own(view, ".reports").flatMap(t => texts(":scope > nol-teamrun-organization-card .name", t)),
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
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
  };
  const create = async (configure: (context: FakeWindowPartContext) => void = () => undefined, showsDepartments: boolean = true): Promise<void> => {
    organization = sample;
    saves = [];
    context = SampleData.createContext()
      .answer(MethodName.OrganizationList, () => organization.toJson())
      .answer(MethodName.OrganizationLayoutSave, t => {
        saves.push(OrganizationLayoutSaveParams.fromJson(t).layout);
        return null;
      });
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(OrganizationViewComponent);
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await Wait.until(() => expect(context.count(MethodName.OrganizationList)).toBe(1));
    if (showsDepartments)
      await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await settle();
  };

  afterEach(() => {
    TeammateStatusStoreService.release(context);
    OrganizationLayoutService.release(context);
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("shows you at the root, then each department in order with its count, leader, members in name order and the departments nested in it", async () => {
    await create();

    expect([texts(".top .title"), texts(".top .headcount"), texts(".owner .name"), texts(".owner .role"), one(".chart > nol-canvas").getAttribute("aria-label"),
      all(".chart [nolCanvasItem]").filter(t => t.matches(".owner, .department, nol-teamrun-organization-card")).length])
      .toEqual([["Organization"], ["4 teammates"], ["You"], ["Owner · 1 leader reports to you"], "Organization structure", 8]);
    expect(tree()).toEqual([
      ["Design", "2", "Led by Alice · 1 member", ["Alice"], ["Bob"], [["UI", "1", "Led by Code Reviewer · 0 members", ["Code Reviewer"], [], [], []]], []],
      ["Build", "1", "1 member", [], ["Offline"], [], []]
    ]);
    expect(texts(".role", department("Design"))).toEqual(["Review"]);
  });

  it("follows each change to the organization as it comes, and says when it has no departments", async () => {
    await create();
    context.emit(EventName.OrganizationChanged, new Organization([new Department("build", "Build", null, "offline", 0, "c", "u")],
      [new DepartmentMember("offline", "build")]).toJson());
    await settle();

    expect([tree(), texts(".owner .role")]).toEqual([[["Build", "1", "Led by Offline · 0 members", ["Offline"], [], [], []]], ["Owner · 1 leader reports to you"]]);

    context.emit(EventName.OrganizationChanged, Organization.empty.toJson());
    await settle();

    expect([tree(), texts(".empty"), texts(".owner .role")]).toEqual([[], ["No departments yet."], ["Owner · 0 leaders report to you"]]);
  });

  it("collapses a department to a count of who it hides, keeps that on the server, and opens it again", async () => {
    await create();
    const toggle = (): HTMLButtonElement => one(":scope > .department .department-toggle", department("Design")) as HTMLButtonElement;

    expect([toggle().getAttribute("aria-expanded"), toggle().getAttribute("aria-label")]).toEqual(["true", "Collapse Design"]);

    toggle().click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    expect([toggle().getAttribute("aria-expanded"), toggle().getAttribute("aria-label"), shape(department("Design"))])
      .toEqual(["false", "Expand Design", ["Design", "2", "Led by Alice · 1 member", ["Alice"], [], [], ["2 teammates hidden"]]]);
    expect(saves[0]).toEqual(expect.objectContaining({ collapsedDepartments: ["design"] }));

    toggle().click();
    await Wait.until(() => expect(saves).toHaveLength(2));
    await settle();

    expect(shape(department("Design"))[4]).toEqual(["Bob"]);
  });

  it("says how many a collapsed department hides, and nothing when it holds no one", async () => {
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ collapsedDepartments: ["ui"] })));

    expect(shape(department("UI"))).toEqual(["UI", "1", "Led by Code Reviewer · 0 members", ["Code Reviewer"], [], [], ["1 teammate hidden"]]);

    organization = new Organization([new Department("ui", "UI", null, null, 0, "c", "u")], []);
    context.emit(EventName.OrganizationChanged, organization.toJson());
    await settle();

    expect(shape(department("UI"))).toEqual(["UI", "0", "0 members", [], [], [], []]);
  });

  it("says when the organization can't be read, and reads it again on Retry", async () => {
    let fails = true;
    await create(context => context.answer(MethodName.OrganizationList, () => {
      if (fails)
        throw new Error("The database is locked.");
      return sample.toJson();
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
    expect(checks()).toEqual([["Status", "true"], ["Current activity", "true"], ["Usage today", "false"], ["Model and effort", "false"],
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

    expect([shows("Alice"), shows("Bob")]).toEqual([["Idle", "60% left", "gpt-5 · high"], ["Idle", "60% left"]]);
    expect([one(".usage", card("Alice")).getAttribute("role"), one(".usage", card("Alice")).getAttribute("aria-valuenow")]).toEqual(["meter", "0.4"]);
    expect(saves[1]).toEqual(expect.objectContaining({ cardsShow: { Status: true, Now: true, Usage: true, Last: false, Model: true } }));
  });

  it("lets a card choose its own fields over every card's, until it or every card's choice is cleared", async () => {
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ cardsShow: { Model: true } })));
    const tune = (name: string): HTMLElement => one(".tune", card(name));

    expect([shows("Alice"), tune("Alice").getAttribute("aria-label")]).toEqual([["gpt-5 · high"], "Choose what Alice's card shows"]);

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
    expect(element().querySelectorAll(".chart .tree")).toHaveLength(1);

    one(".top .views [role=radio]:last-of-type").click();
    await Wait.until(() => expect(saves).toHaveLength(1));
    await settle();

    expect([pills()[2], saves[0]]).toEqual([["Focus", "true"], expect.objectContaining({ view: "Focus", focus: null })]);
  });

  it("switches the structure into editing and back from the header, without keeping it on the server", async () => {
    await create();
    const edit = (): HTMLElement => one(".top .edit");
    const looks = (): unknown[] => [edit().textContent?.trim(), edit().classList.contains("nol-button-secondary")];
    const before = looks();

    edit().click();
    await settle();
    const editing = looks();
    edit().click();
    await settle();

    expect([before, editing, looks(), saves]).toEqual([["editEdit structure", true], ["checkDone editing", false], ["editEdit structure", true], []]);
  });

  describe("while its structure is edited", () => {
    const changes = [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentDelete, MethodName.DepartmentMemberSet];
    let asked: [string, JsonValue][];

    const editAsync = async (answer: () => unknown = () => null): Promise<void> => {
      asked = [];
      await create(context => {
        for (const method of changes)
          context.answer(method, t => {
            asked.push([method, t]);
            return answer();
          });
      });
      one(".top .edit").click();
      await settle();
    };
    const inDialog = (selector: string): HTMLElement => {
      const found = document.querySelector<HTMLElement>(`nol-dialog ${selector}`);
      if (Object.isNull(found))
        throw new Error(`No dialog shows ${selector}.`);
      return found;
    };
    const dialogAsync = async (): Promise<string[]> => {
      await Wait.until(() => expect(document.querySelector("nol-dialog .nol-teamrun-confirm")).not.toBeNull());
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
      field(name).value = value;
      field(name).dispatchEvent(new Event("change"));
      await settle();
    };

    it("names a department in a field in place of its toggle, renames it once the field changes, and puts back a blank or unchanged name", async () => {
      await editAsync();
      const shown = [own(department("Design"), ".department .department-toggle").length, field("Design").value, field("Design").getAttribute("aria-label")];

      await rename("Design", "  ");
      const blank = field("Design").value;
      await rename("Design", "Design");
      await rename("Design", " Craft ");

      expect([shown, blank, asked]).toEqual([[0, "Design", "Department name"], "Design", [[MethodName.DepartmentUpdate, { departmentId: "design", name: "Craft" }]]]);
    });

    it("chooses a department's leader among its members in name order, or none", async () => {
      await editAsync();
      const leader = (): HTMLElement => one(":scope > .department .leader-choice", department("Design"));

      const options = await optionsAsync(leader());
      await closeOptionsAsync();
      await chooseAsync(leader(), "Bob");
      await chooseAsync(leader(), "No leader");

      expect([options, asked]).toEqual([["No leader", "Alice", "Bob"], [
        [MethodName.DepartmentUpdate, { departmentId: "design", leaderId: "bob" }],
        [MethodName.DepartmentUpdate, { departmentId: "design", leaderId: null }]
      ]]);
    });

    it("deletes a department only once you confirm, saying where what it held goes", async () => {
      await editAsync();
      const remove = (name: string): HTMLElement => one(":scope > .department .delete", department(name));

      remove("UI").click();
      const nested = await dialogAsync();
      await answerAsync(".nol-teamrun-cancel");
      const cancelled = asked.length;
      remove("Build").click();
      const top = await dialogAsync();
      await answerAsync(".nol-teamrun-confirm");

      expect([remove("Build").getAttribute("aria-label"), nested, cancelled, top, asked]).toEqual(["Delete Build",
        ["Delete department", "Delete UI? Its departments and members move to Design.", "Delete"], 0,
        ["Delete department", "Delete Build? Its departments move up to report to you, and its members leave every department.", "Delete"],
        [[MethodName.DepartmentDelete, { departmentId: "build" }]]]);
    });

    it("removes a member from its card once you confirm, moves it to another department, and shows neither once editing is done", async () => {
      await editAsync();

      one(".remove", card("Bob")).click();
      const asking = await dialogAsync();
      await answerAsync(".nol-teamrun-confirm");
      const departments = await optionsAsync(one(".move-choice", card("Bob")));
      await closeOptionsAsync();
      await chooseAsync(one(".move-choice", card("Bob")), "Build");
      const label = one(".remove", card("Bob")).getAttribute("aria-label");
      one(".top .edit").click();
      await settle();

      expect([asking, label, departments, all(".remove, .move", card("Bob")).length]).toEqual([
        ["Remove member", "Remove Bob from Design? Bob stays on the team, in no department.", "Remove"], "Remove Bob", ["Design", "UI", "Build"], 0]);
      expect(asked).toEqual([[MethodName.DepartmentMemberSet, { teammateId: "bob", departmentId: null }],
        [MethodName.DepartmentMemberSet, { teammateId: "bob", departmentId: "build" }]]);
    });

    it("adds a member from the teammates not yet in the department, in name order", async () => {
      await editAsync();

      await openMenu(one(":scope > .reports > .add-member", department("Build")));
      const offered = menuItems().map(t => t.querySelector(".nol-menu-item-label")?.textContent?.trim());
      menuItem("Alice").click();
      await Wait.until(() => expect(asked).toHaveLength(1));

      expect([offered, asked]).toEqual([["Alice", "Bob", "Code Reviewer"], [[MethodName.DepartmentMemberSet, { teammateId: "alice", departmentId: "build" }]]]);
    });

    it("adds a department under you, even when there is none yet", async () => {
      await editAsync();
      context.emit(EventName.OrganizationChanged, Organization.empty.toJson());
      await settle();

      const empty = texts(".empty");
      one(".chart .add-department").click();
      await Wait.until(() => expect(asked).toHaveLength(1));

      expect([empty, asked]).toEqual([[], [[MethodName.DepartmentCreate, { name: "New department", parentId: null }]]]);
    });

    it("says why a change failed until it is dismissed", async () => {
      await editAsync(() => Promise.reject(new Error("The runtime is busy.")));

      one(".chart .add-department").click();
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

    it("sizes the cards, hangs each leader under its department, the members off one line, and joins the departments to you through one bar", async () => {
      await create();
      element().style.width = "60rem";
      element().style.height = "60rem";
      await settle();
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
      const member = one(":scope > nol-teamrun-organization-card", reports);
      const owner = one(".owner");
      const kids = one(".chart .tree > .kids");

      for (const view of [owner, card, leader, one(":scope > .department", build)])
        AppearanceFixture.expectPixels(box(view).width, 15 * rem);
      AppearanceFixture.expectPixels(box(member).width, 13.25 * rem);
      AppearanceFixture.expectPixels(box(stem).height, space(3));
      AppearanceFixture.expectPixels(box(stem).left - box(card).left, 7.5 * rem);
      AppearanceFixture.expectPixels(box(leader).top - box(card).bottom, space(3));
      AppearanceFixture.expectPixels(box(leader).left, box(card).left);
      AppearanceFixture.expectPixels(box(reports).left - box(leader).left, space(4));
      AppearanceFixture.expectPixels(box(member).left - box(reports).left, space(3) + 1);
      AppearanceFixture.expectPixels(box(member).top - box(leader).bottom, space(2));
      expect([line(reports, "").borderLeftStyle, line(member, "::before").borderTopStyle]).toEqual(["solid", "solid"]);
      AppearanceFixture.expectPixels(Number.parseFloat(line(member, "::before").width), space(3));
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

    it("fills the space under the header with one canvas, and fits the chart at 100% to its top, under the canvas's tools", async () => {
      await create();
      element().style.width = "60rem";
      element().style.height = "60rem";
      await settle();
      const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
      const [host, top, canvas] = [element().getBoundingClientRect(), box(".top"), box(".chart > nol-canvas")];
      const [tools, tree] = [box(".chart .nol-canvas-tools"), box(".chart .tree")];

      for (const [actual, expected] of [[canvas.top, top.bottom], [canvas.left, host.left], [canvas.right, host.right], [canvas.bottom, host.bottom]] as const)
        AppearanceFixture.expectPixels(actual, expected);
      expect([texts(".chart .nol-canvas-zoom"), tree.top >= tools.bottom, tree.top - tools.bottom < box(".owner").height]).toEqual([["100%"], true, true]);
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
      const [unit, name, remove, leader] = [":scope > .department", ":scope > .department .department-field", ":scope > .department .delete",
        ":scope > .department .leader-choice"].map(t => box(one(t, design)));
      const bob = box(card("Bob"));
      const [move, drop, tune] = [".move", ".remove", ".tune"].map(t => box(one(t, card("Bob"))));

      for (const [actual, expected] of [[unit.width, 15 * rem], [bob.width, 13.25 * rem], [name.left, unit.left + inset], [remove.right, unit.right - inset],
        [leader.left, unit.left + inset], [leader.right, unit.right - inset], [move.left, bob.left + inset], [move.right, bob.right - inset],
        [tune.right, bob.right - inset]] as const)
        AppearanceFixture.expectPixels(actual, expected);
      expect([name.right <= remove.left, drop.right <= tune.left, texts(".chart .nol-canvas-zoom")]).toEqual([true, true, ["100%"]]);
    });

    it("puts the view pills on the right of the header, then Cards show and Edit structure, all centred on one line", async () => {
      await create();
      element().style.width = "72rem";
      await settle();
      const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
      const [top, views, cards, edit] = [box(".top"), box(".top .views"), box(".top .cards-show"), box(".top .edit")];

      AppearanceFixture.expectPixels(cards.left - views.right, AppearanceFixture.measureLook("space-4"));
      AppearanceFixture.expectPixels(edit.left - cards.right, AppearanceFixture.measureLook("space-4"));
      AppearanceFixture.expectPixels(top.right - edit.right, AppearanceFixture.measureLook("space-6"));
      AppearanceFixture.expectPixels(views.top + views.height / 2, cards.top + cards.height / 2);
      AppearanceFixture.expectPixels(edit.top + edit.height / 2, cards.top + cards.height / 2);
      expect(views.left).toBeGreaterThan(box(".top .headcount").right);
    });
  });
});
