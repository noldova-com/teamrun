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
import { Department, DepartmentMember, DetailKind, EventName, Message, MessageAuthor, MessageStatus, MethodName, Organization, OrganizationLayoutSaveParams,
  PlanUsage, PlanWindow, PlanWindowName, TeammateLastReply } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

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
    const found = all("nol-teamrun-organization-department").find(t => t.querySelector(".department-name")?.textContent?.trim() === name
      || t.querySelector<HTMLInputElement>(".department-field")?.value === name);
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
    const found = all("nol-teamrun-organization-card").find(t => t.querySelector(".name")?.textContent?.trim() === name
      || t.querySelector<HTMLInputElement>(".name-field")?.value === name);
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
      .answer(MethodName.OrganizationMessageList, () => [])
      .answer(MethodName.OrganizationLayoutSave, t => {
        saves.push(OrganizationLayoutSaveParams.fromJson(t).layout);
        return null;
      });
    const data = new TeammateFixture(context);
    data.teammates.push(data.reviewer);
    configure(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(OrganizationViewComponent);
    element().style.width = "100rem";
    element().style.height = "70rem";
    fixture.autoDetectChanges();
    await Wait.until(() => expect(ChatStoreService.of(context).loaded()).toBe(true));
    await Wait.until(() => expect(context.count(MethodName.OrganizationList)).toBe(1));
    if (showsDepartments)
      await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await settle();
  };

  afterEach(() => {
    OrganizationMessagesStoreService.release(context);
    TeammateStatusStoreService.release(context);
    OrganizationLayoutService.release(context);
    OrganizationStoreService.release(context);
    ChatStoreService.release(context);
  });

  it("shows you at the root, then each department in order with its count, leader, members in name order and the departments nested in it", async () => {
    await create();

    expect([texts(".top .title"), texts(".top .headcount"), texts(".owner .name"), texts(".owner .role"), one(".chart > nol-canvas").getAttribute("aria-label"),
      all(".chart [nolCanvasItem]").filter(t => t.matches(".owner, .department, nol-teamrun-organization-card")).length])
      .toEqual([["Organization"], ["4 teammates in 3 departments"], ["You"], ["Owner · 1 leader reports to you"], "Organization structure", 8]);
    expect(tree()).toEqual([
      ["Design", "2", "2 idle", ["Alice"], ["Bob"], [["UI", "1", "1 idle", ["Code Reviewer"], [], [], []]], []],
      ["Build", "1", "1 stopped", [], ["Offline"], [], []]
    ]);
    expect(texts(".role", department("Design"))).toEqual(["Review"]);
  });

  it("follows each change to the organization as it comes, and says when it has no departments", async () => {
    await create();
    context.emit(EventName.OrganizationChanged, new Organization([new Department("build", "Build", null, "offline", 0, "c", "u")],
      [new DepartmentMember("offline", "build")]).toJson());
    await settle();

    expect([tree(), texts(".owner .role")]).toEqual([[["Build", "1", "1 stopped", ["Offline"], [], [], []]], ["Owner · 1 leader reports to you"]]);

    context.emit(EventName.OrganizationChanged, Organization.empty.toJson());
    await settle();

    expect([tree(), texts(".empty"), texts(".owner .role")]).toEqual([[], ["No departments yet."], ["Owner · 0 leaders report to you"]]);
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

    organization = new Organization([new Department("top", "Top", null, null, 0, "c", "u"), new Department("ui", "UI", "top", "reviewer", 0, "c", "u")],
      [new DepartmentMember("reviewer", "ui")]);
    context.emit(EventName.OrganizationChanged, organization.toJson());
    await settle();

    expect(shape(department("Top"))).toEqual(["Top", "0", undefined, [], [], [], ["1 member hidden"]]);

    organization = new Organization([new Department("ui", "UI", null, null, 0, "c", "u")], []);
    context.emit(EventName.OrganizationChanged, organization.toJson());
    await settle();

    expect(shape(department("UI"))).toEqual(["UI", "0", undefined, [], [], [], []]);
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
    expect(checks()).toEqual([["Status", "true"], ["Current activity", "true"], ["Usage today", "false"], ["Last message", "false"],
      ["Model and effort", "false"], ["Clear every card's own choice", null]]);
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
    expect(saves[1]).toEqual(expect.objectContaining({ cardsShow: { Status: true, Now: true, Usage: true, Last: false, Model: true } }));
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

  it("offers no Board or Focus before they are built, and draws the tree whatever view is kept", async () => {
    await create(context => context.answer(MethodName.OrganizationLayoutRead, () => ({ view: "Board" })));

    expect([all(".top [role=radio]"), all(".chart .tree")]).toEqual([[], [one(".chart .tree")]]);
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

  describe("with its messages beside the tree", () => {
    const heading = (): string[] => texts("aside.messages .nol-teamrun-organization-thread-title");

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, ThemeMode.Light));

    afterEach(() => AppearanceFixture.reset());

    it("talks to the first department until a card is chosen, by a click on the card or Enter on it, but not by its own buttons or while editing", async () => {
      await create();
      const first = [one("aside.messages").getAttribute("aria-label"), heading()];

      await userEvent.click(one(".name", card("Bob")));
      await settle();
      const clicked = heading();
      card("Alice").focus();
      await userEvent.keyboard("{Enter}");
      await settle();
      const entered = heading();
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

      expect([first, clicked, entered, tuned, heading()]).toEqual([["Messages", ["Chat with Design"]], ["Chat with Bob"], ["Chat with Alice"],
        ["Chat with Alice"], ["Chat with Alice"]]);
    });

    it("chooses a teammate in a nested department too", async () => {
      await create();

      card("Code Reviewer").click();
      await settle();

      expect(heading()).toEqual(["Chat with Code Reviewer"]);
    });

    it("asks whom to message while there is no department to talk to", async () => {
      await create(context => context.answer(MethodName.OrganizationList, () => Organization.empty.toJson()), false);

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
    const changes = [MethodName.DepartmentCreate, MethodName.DepartmentUpdate, MethodName.DepartmentDelete, MethodName.DepartmentMemberSet];
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
      await dialogAsync();
      await answerAsync(".nol-teamrun-cancel");
      const cancelled = asked.length;
      one(".remove", card("Bob")).click();
      const asking = await dialogAsync();
      await answerAsync(".nol-teamrun-confirm");
      const departments = await optionsAsync(one(".move-choice", card("Bob")));
      await closeOptionsAsync();
      await chooseAsync(one(".move-choice", card("Bob")), "Build");
      const label = one(".remove", card("Bob")).getAttribute("aria-label");
      one(".top .edit").click();
      await settle();

      expect(all(".remove, .move", card("Alice"))).toEqual([]);
      expect([cancelled, asking, label, departments, all(".remove, .move", card("Bob")).length]).toEqual([0,
        ["Remove member", "Remove Bob from Design? Bob stays on the team, in no department.", "Remove"], "Remove Bob", ["Design", "UI", "Build"], 0]);
      expect(asked).toEqual([[MethodName.DepartmentMemberSet, { teammateId: "bob", departmentId: null }],
        [MethodName.DepartmentMemberSet, { teammateId: "bob", departmentId: "build" }]]);
    });

    it("renames a teammate from its card's field, and puts the name back with why when the name can't be taken", async () => {
      await editAsync();
      const field = card("Bob").querySelector<HTMLInputElement>(".name-field");
      if (Object.isNull(field))
        throw new Error("Bob's card has no name field.");
      const named = (): HTMLInputElement => field;
      const renameAsync = async (value: string): Promise<void> => {
        named().value = value;
        named().dispatchEvent(new Event("change"));
        await settle();
      };
      const label = named().getAttribute("aria-label");

      await renameAsync("Bob!!");
      const refused = [named().value, texts(".action-error"), context.count(MethodName.TeammateUpdate)];
      await renameAsync(" Robert ");
      await Wait.until(() => expect(named().value).toBe("Robert"));
      const renamed = [texts(".name, .name-field", card("Robert")).length, texts(".action-error"), all(".name-field", card("Alice")).length];
      context.fail(MethodName.TeammateUpdate, "That name is taken.");
      await renameAsync("Alice");
      await Wait.until(() => expect(texts(".action-error")).toHaveLength(1));

      expect([label, refused, renamed, named().value, texts(".action-error")[0]?.includes("That name is taken."), texts(".name", card("Robert"))]).toEqual([
        "Rename Bob", ["Bob", [Resources.organizationTeammateNameRule], 0], [1, [], 1], "Robert", true, []]);
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
      expect([getComputedStyle(lasted).whiteSpace, getComputedStyle(text).overflowWrap]).toEqual(["nowrap", "anywhere"]);
    });

    it("sizes the cards, hangs each leader under its department, the members off one line, and joins the departments to you through one bar", async () => {
      await create();
      element().style.width = "100rem";
      element().style.height = "70rem";
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

    it("fills the space under the header with one canvas inside the view's padding, and fits the chart at 100% to its top, under the canvas's tools", async () => {
      await create();
      element().style.width = "100rem";
      element().style.height = "70rem";
      await settle();
      const box = (selector: string): DOMRect => one(selector).getBoundingClientRect();
      const [host, top, canvas, messages] = [element().getBoundingClientRect(), box(".top"), box(".chart > nol-canvas"), box("aside.messages")];
      const [tools, tree] = [box(".chart .nol-canvas-tools"), box(".chart .tree")];

      const space = (n: number): number => AppearanceFixture.measureLook(`space-${n}`);
      for (const [actual, expected] of [[canvas.top, top.bottom + space(4)], [canvas.left, host.left + space(6)], [canvas.right, messages.left - space(4)], [messages.right, host.right - space(6)],
        [canvas.bottom, host.bottom - space(6)]] as const)
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

    it("joins Add department to the bar over the departments while editing, as it joins a department", async () => {
      await create();
      element().style.width = "72rem";
      element().style.height = "60rem";
      one(".top .edit").click();
      await settle();
      one(".chart .nol-canvas-actual").click();
      await settle();
      const kid = one(".chart .tree > .kids > .kid:last-child");
      const [box, button] = [kid.getBoundingClientRect(), one(".add-department", kid).getBoundingClientRect()];
      const [bar, drop] = [getComputedStyle(kid, "::before"), getComputedStyle(kid, "::after")];

      expect([getComputedStyle(kid).position, bar.borderTopStyle, drop.borderLeftStyle]).toEqual(["relative", "solid", "solid"]);
      AppearanceFixture.expectPixels(Number.parseFloat(bar.right), box.width / 2);
      AppearanceFixture.expectPixels(box.left + Number.parseFloat(drop.left), box.left + box.width / 2);
      AppearanceFixture.expectPixels(box.top + Number.parseFloat(drop.height), button.top);
      expect(button.left <= box.left + box.width / 2 && box.left + box.width / 2 <= button.right).toBe(true);
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
