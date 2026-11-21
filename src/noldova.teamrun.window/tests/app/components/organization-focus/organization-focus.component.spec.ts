/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { Department, DepartmentMember, Harness, Message, MessageAuthor, MessageStatus, MethodName, Organization, OrganizationLayoutSaveParams,
  Teammate } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OrganizationFocusComponent } from "../../../../src/app/components/organization-focus/organization-focus.component";
import { OrganizationLayout } from "../../../../src/app/models/organization-layout";
import { OrganizationNode } from "../../../../src/app/models/organization-node";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { TeammateStatusStoreService } from "../../../../src/app/services/teammate-status-store.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
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
  const sample = new Organization([
    new Department("design", "Design", null, "alice", 0, "c", "u"),
    new Department("build", "Build", null, null, 1, "c", "u"),
    new Department("ui", "UI", "design", "reviewer", 0, "c", "u")
  ], [new DepartmentMember("alice", "design"), new DepartmentMember("bob", "design"), new DepartmentMember("offline", "build"),
    new DepartmentMember("carol", "build"), new DepartmentMember("reviewer", "ui")]);
  const waiting = new Message("r1", "c9", 1, MessageAuthor.Provider, null, MessageStatus.AwaitingApproval, [], SampleData.provenance, started, started, null, [],
    "bob", "bob");
  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
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
      .answer(MethodName.OrganizationLayoutSave, t => {
        saves.push(OrganizationLayout.fromJson(OrganizationLayoutSaveParams.fromJson(t).layout));
        return null;
      });
    const data = new TeammateFixture(context);
    data.teammates = [...data.teammates, data.reviewer, carol];
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }, OrganizationLayoutService.provider] });
    fixture = TestBed.createComponent(OrganizationFocusComponent);
    fixture.componentRef.setInput("tree", OrganizationNode.treeOf(sample, [data.alice, data.bob, data.unavailable, data.reviewer, carol]));
    fixture.autoDetectChanges();
    await Wait.until(() => expect(context.count(MethodName.OrganizationLayoutRead)).toBe(1));
    await Wait.until(() => expect(texts(".orow .short")).toContain("Waiting"));
    await settle();
  };
  const click = async (view: HTMLElement): Promise<void> => {
    view.click();
    await settle();
  };

  afterEach(() => {
    TeammateStatusStoreService.release(context);
    OrganizationLayoutService.release(context);
    ChatStoreService.release(context);
  });

  it("outlines the organization: every department, nested ones indented, with its count, who needs you, and its people under it", async () => {
    await create();
    const indent = (label: string): number => Number.parseFloat(row(label).style.paddingInlineStart);

    expect([texts(".outline-head"), texts(".orow.root .label"), texts(".orow.root nol-chip"), all(".orow.department").map(t => [text(one(".label", t)), texts(".asks", t), texts("nol-chip", t)])]).toEqual([
      ["Structure"], ["Organization"], ["5"], [["Design", ["1 need you"], ["2"]], ["UI", [], ["1"]], ["Build", ["1 need you"], ["2"]]]
    ]);
    expect(all(".orow.person").map(t => [text(one(".label", t)), texts(".tag", t), texts(".short", t), one(".dot", t).getAttribute("data-status")])).toEqual([
      ["Alice", ["leads"], ["Idle"], "Idle"], ["Bob", [], ["Waiting"], "WaitingForYou"], ["Code Reviewer", ["leads"], ["Idle"], "Idle"],
      ["Carol", [], ["Idle"], "Idle"], ["Offline", [], ["Stopped"], "Stopped"]
    ]);
    expect([indent("Design"), indent("UI"), indent("Build"), indent("Alice"), indent("Code Reviewer")]).toEqual([0.25, 1.75, 0.25, 2.25, 3.75]);
  });

  it("opens on the leaders when nothing is focused", async () => {
    await create();
    expect(unit()).toEqual([["Organization"], ["Organization"], ["Organization"], ["Your 2 leaders · 2 idle"], ["Alice", "Code Reviewer"], false, ["Organization"]]);
    expect(saves).toEqual([]);
  });

  it("opens on the leaders when the focus kept is gone or can't be read", async () => {
    await create("Department:gone");
    expect(unit()).toEqual([["Organization"], ["Organization"], ["Organization"], ["Your 2 leaders · 2 idle"], ["Alice", "Code Reviewer"], false, ["Organization"]]);
    expect(saves).toEqual([]);
  });

  it("opens on the leaders when the focus kept names no kind it knows", async () => {
    await create("alice");
    expect(unit()).toEqual([["Organization"], ["Organization"], ["Organization"], ["Your 2 leaders · 2 idle"], ["Alice", "Code Reviewer"], false, ["Organization"]]);
  });

  it("opens on the focus kept", async () => {
    await create("Teammate:alice");

    expect(unit()).toEqual([["Organization", "Design", "Alice"], ["Alice"], ["Alice"], ["Review in Design · gpt-5"], ["Alice"], true, ["Alice"]]);
  });

  it("focuses a department, nested ones through their parents, a teammate and the organization again, and keeps each on the server", async () => {
    await create();

    await click(one(".obtn", row("UI")));
    expect(unit()).toEqual([["Organization", "Design", "UI"], ["UI"], ["UI"], ["1 teammate · 1 idle"], ["Code Reviewer"], true, ["UI"]]);
    await click(one(".obtn", row("Build")));
    expect(unit()).toEqual([["Organization", "Build"], ["Build"], ["Build"], ["2 teammates · 1 idle · 1 stopped"], ["Carol", "Offline"], false, ["Build"]]);
    await click(one(".obtn", row("Bob")));
    expect(unit()).toEqual([["Organization", "Design", "Bob"], ["Bob"], ["Bob"], ["Design"], ["Bob"], true, ["Bob"]]);
    await click(one(".crumbs button:nth-of-type(2)"));
    expect(texts(".unit-name")).toEqual(["Design"]);
    await click(one(".crumb"));
    expect(texts(".unit-name")).toEqual(["Organization"]);

    await Wait.until(() => expect(saves.map(t => t.focus)).toEqual(["Department:ui", "Department:build", "Teammate:bob", "Department:design",
      "Leaders"]));
    expect(all(".crumb[aria-current=true]").map(text)).toEqual(["Organization"]);
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

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("sets the outline beside the focus, the unit's cards in columns of at least 18rem, and one card at up to 36rem", async () => {
      await create();
      element().style.width = "90rem";
      element().style.height = "40rem";
      await settle();
      const host = box(element());
      const outline = box(one(".outline"));
      const focus = box(one(".focus"));
      const plane = box(one(".focus-plane"));
      const cards = all(".grid nol-teamrun-organization-card").map(box);
      const columns = Math.floor((plane.width + space(3)) / (18 * rem() + space(3)));
      const width = (plane.width - (columns - 1) * space(3)) / columns;

      AppearanceFixture.expectPixels(outline.left, host.left);
      AppearanceFixture.expectPixels(outline.height, host.height);
      AppearanceFixture.expectPixels(focus.left - outline.right, space(4));
      AppearanceFixture.expectPixels(focus.right, host.right);
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
