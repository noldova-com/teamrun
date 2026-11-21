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
import { Department, DepartmentMember, Organization } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { OrganizationBoardComponent } from "../../../../src/app/components/organization-board/organization-board.component";
import { OrganizationNode } from "../../../../src/app/models/organization-node";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { OrganizationLayoutService } from "../../../../src/app/services/organization-layout.service";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { TeammateFixture } from "../../../fixtures/teammate.fixture";

describe("OrganizationBoardComponent", () => {
  let context: FakeWindowPartContext;
  let fixture: ComponentFixture<OrganizationBoardComponent>;

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
  const box = (view: Element): DOMRect => view.getBoundingClientRect();
  const nth = (boxes: readonly DOMRect[], index: number): DOMRect => {
    const found = boxes[index];
    if (found === undefined)
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
    context = SampleData.createContext();
    const data = new TeammateFixture(context);
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    fixture = TestBed.createComponent(OrganizationBoardComponent);
    fixture.componentRef.setInput("tree", OrganizationNode.treeOf(sample, [data.alice, data.bob, data.unavailable, data.reviewer]));
    fixture.autoDetectChanges();
    await settle();
  };

  afterEach(() => {
    OrganizationLayoutService.release(context);
    ChatStoreService.release(context);
  });

  it("strips the leaders across the top, then gives every department, nested ones too, a column of its members", async () => {
    await create();

    expect([texts(".leaders-section .title"), texts(".leaders-section .note"), texts(".message-leaders"), texts(".leaders > .leader .name")]).toEqual([
      ["Leaders"], ["They talk across departments; you lead them."], ["forumMessage all leaders"], ["Alice", "Code Reviewer"]
    ]);
    expect([texts(".departments-section > .section-head .title"), texts(".departments-section > .section-head .note")])
      .toEqual([["Departments"], ["Each column's members, sorted by who needs you first."]]);
    expect(all(".lane").map(t => [texts(".lane-name", t), texts(".lane-count", t), texts(".lane-summary", t),
      texts("nol-teamrun-organization-card .name", t), texts(".lane-empty", t), one(".message-department", t).getAttribute("aria-label")])).toEqual([
      [["Design"], ["2"], ["Led by Alice · 1 member"], ["Bob"], [], "Message Design"],
      [["UI"], ["1"], ["Led by Code Reviewer · 0 members"], [], ["No members yet."], "Message UI"],
      [["Build"], ["1"], ["1 member"], ["Offline"], [], "Message Build"]
    ]);
    expect(all("nol-teamrun-organization-card").every(t => t.classList.contains("row"))).toBe(true);
  });

  it("asks to message all leaders, or one department by its id", async () => {
    await create();
    const asked: string[] = [];
    fixture.componentInstance.messageLeaders.subscribe(() => asked.push("leaders"));
    fixture.componentInstance.messageDepartment.subscribe(t => asked.push(t));

    one(".message-leaders").click();
    for (const lane of all(".lane"))
      one(".message-department", lane).click();

    expect(asked).toEqual(["leaders", "design", "ui", "build"]);
  });

  it("follows a new tree", async () => {
    await create();
    fixture.componentRef.setInput("tree", []);
    await settle();

    expect([all(".leaders > .leader").length, all(".lane").length]).toEqual([0, 0]);
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

    it("lays the board out at 76rem, the leaders at up to 20rem on one line, and the departments in columns of at least 16rem", async () => {
      await create();
      const host = box(element());
      const leaders = all(".leaders > .leader").map(box);
      const strip = one(".leaders");
      const lanes = all(".lane").map(box);
      const lane = one(".lane");
      const head = box(one(".lane-head", lane));
      const summary = box(one(".lane-summary", lane));
      const member = box(one("nol-teamrun-organization-card", lane));
      const columns = Math.floor((host.width + space(4)) / (16 * rem() + space(4)));
      const width = (host.width - (columns - 1) * space(4)) / columns;

      AppearanceFixture.expectPixels(host.width, 76 * rem());
      AppearanceFixture.expectPixels(box(one(".departments-section")).top - box(one(".leaders-section")).bottom, space(6));
      AppearanceFixture.expectPixels(box(strip).top - box(one(".leaders-section > .section-head")).bottom, space(3));
      for (const leader of leaders)
        AppearanceFixture.expectPixels(leader.width, 20 * rem());
      AppearanceFixture.expectPixels(nth(leaders, 1).left - nth(leaders, 0).right, space(3));
      AppearanceFixture.expectPixels(nth(leaders, 1).top, nth(leaders, 0).top);
      expect(getComputedStyle(one(".leaders > .leader")).borderTopWidth).toBe("1px");
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(strip, "::before").top), 1.625 * rem());
      AppearanceFixture.expectPixels(Number.parseFloat(getComputedStyle(strip, "::before").left), space(4));
      for (const [index, column] of lanes.entries()) {
        AppearanceFixture.expectPixels(column.width, width);
        AppearanceFixture.expectPixels(column.left - host.left, index * (width + space(4)));
      }
      const first = nth(lanes, 0);
      AppearanceFixture.expectPixels(head.left - first.left, space(3) + 1);
      AppearanceFixture.expectPixels(head.top - first.top, space(3) + 1);
      AppearanceFixture.expectPixels(summary.top - head.bottom, space(1) * 2);
      AppearanceFixture.expectPixels(member.top - summary.bottom, space(1));
      AppearanceFixture.expectPixels(member.left - first.left, space(3) + 1);
      AppearanceFixture.expectPixels(first.right - member.right, space(3) + 1);
      AppearanceFixture.expectPixels(first.bottom - member.bottom, space(3) + 1);
    });
  });
});
