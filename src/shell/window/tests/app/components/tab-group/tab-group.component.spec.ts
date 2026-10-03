/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { TooltipDirective } from "@noldova/teamrun-shell-ui";

import { TabGroupComponent } from "../../../../src/app/components/tab-group/tab-group.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { TabDragService } from "../../../../src/app/services/tab-drag.service";
import { TabStripService } from "../../../../src/app/services/tab-strip.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";

@Component({
  imports: [TabGroupComponent],
  template: `
    <div class="workspace">
      @for (frame of frames(); track frame.group.id) {
        <tr-tab-group [frame]="frame" />
      }
    </div>
  `,
  styles: [".workspace { position: relative; width: 1920px; height: 960px; }"]
})
class TabGroupHostComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  public readonly frames: Signal<readonly GroupFrame[]> = computed(() => this.layout.geometry().frames);
}


async function expectTooltipAsync(button: HTMLElement | null | undefined, text: string): Promise<void> {
  const tooltip = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>(".cdk-overlay-container tr-tooltip")].find(t => t.textContent?.trim() === text);
  button?.dispatchEvent(new PointerEvent("pointerenter"));
  await vi.waitFor(() => expect(tooltip()).toBeDefined());
  button?.dispatchEvent(new PointerEvent("pointerleave"));
  await vi.waitFor(() => expect(tooltip()).toBeUndefined());
  expect(button?.hasAttribute("title")).toBe(false);
}

describe("TabGroupComponent", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(LayoutFixture.search, registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  let fixture: ComponentFixture<TabGroupHostComponent>;
  let layout: LayoutService;
  let host: HTMLElement;

  async function renderAsync(initial: Layout = prepared, width: number = 120): Promise<void> {
    layout = await LayoutServiceFixture.prepareAsync(registry, initial, width);
    fixture = TestBed.createComponent(TabGroupHostComponent);
    host = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function group(id: number): HTMLElement {
    const found = host.querySelector<HTMLElement>(`tr-tab-group[data-group="${id}"]`);
    if (Object.isNull(found))
      throw new Error(`No group ${id} is shown.`);
    return found;
  }

  function tabs(id: number): HTMLElement[] {
    return [...group(id).querySelectorAll<HTMLElement>("tr-tab")];
  }

  function tab(id: number, index: number): HTMLElement {
    const found = tabs(id)[index];
    if (Object.isUndefined(found))
      throw new Error(`Group ${id} has no tab ${index}.`);
    return found;
  }

  function update(): void {
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.restoreAllMocks();
    document.querySelector(".cdk-overlay-container")?.replaceChildren();
  });

  it("shows each group as a card at its frame with its tabs, the selected one and the right surface", async () => {
    await renderAsync();
    const left = layout.geometry().frameOf(1);

    expect(group(1).style.left).toBe(`${left?.bounds.x}rem`);
    expect(group(1).style.width).toBe(`${left?.bounds.width}rem`);
    expect(group(1).dataset["side"]).toBe(DockSide.Left);
    expect(group(1).querySelector("tr-panel-card")?.classList.contains("tr-panel-card-shell")).toBe(true);
    expect(group(0).querySelector("tr-panel-card")?.classList.contains("tr-panel-card-shell")).toBe(false);
    expect(group(0).querySelector<HTMLElement>("tr-panel-card")?.dataset["dropGroup"]).toBe("0");
    expect(tabs(1).map(t => t.textContent?.trim())).toEqual(["files.treeclose", "files.searchclose"].map(t => `${Resources.viewGlyph}${t}`));
    expect(tabs(1).map(t => t.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(tabs(1).map(t => t.getAttribute("aria-label"))).toEqual(["files.tree", "files.search"]);
    expect(group(1).querySelector(".tr-tab-group-actions")?.classList.contains("tr-tab-group-actions-shell")).toBe(true);
    expect(group(0).querySelector(".tr-tab-group-actions")?.classList.contains("tr-tab-group-actions-shell")).toBe(false);
    expect(tabs(0).map(t => t.dataset["tabKey"])).toEqual([LayoutFixture.plan.key, LayoutFixture.todo.key]);
    const panel = group(1).querySelector<HTMLElement>("[role=tabpanel]");
    expect(tabs(1).map(t => t.id)).toEqual(["tr-tab-1-0", "tr-tab-1-1"]);
    expect([panel?.id, panel?.getAttribute("aria-labelledby")]).toEqual(["tr-tab-panel-1", "tr-tab-1-1"]);
    layout.closeTabs(layout.layout().documents.tabs);
    update();
    expect(group(0).querySelector("[role=tabpanel]")?.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("shows a tab's title below it only while its label is cut short", async () => {
    await renderAsync();
    const target = tab(1, 1);
    const tooltip = (): HTMLElement | null => document.querySelector<HTMLElement>(".cdk-overlay-container tr-tooltip");

    const decided = vi.spyOn(TooltipDirective.prototype, "show");
    target.dispatchEvent(new PointerEvent("pointerenter"));
    await vi.waitFor(() => expect(decided).toHaveBeenCalled());
    const isShownWhenFitting = !Object.isNull(tooltip());
    target.dispatchEvent(new PointerEvent("pointerleave"));
    target.style.maxWidth = "3rem";
    target.dispatchEvent(new PointerEvent("pointerenter"));
    await vi.waitFor(() => expect(tooltip()?.textContent?.trim()).toBe("files.search"));

    expect(isShownWhenFitting).toBe(false);
    expect(tooltip()?.getBoundingClientRect().top).toBeGreaterThan(target.getBoundingClientRect().bottom);
  });

  it("shows a preview in italics with its description and keeps it on a double-click", async () => {
    await renderAsync(prepared.openDocument(LayoutFixture.settings, true));
    const preview = tabs(0)[2];

    expect(preview?.classList.contains("tr-tab-preview")).toBe(true);
    expect(preview?.getAttribute("aria-description")).toBe("Preview");
    expect(tab(0, 0).hasAttribute("aria-description")).toBe(false);
    preview?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    update();

    expect(layout.layout().documents.preview).toBeNull();
    expect(preview?.classList.contains("tr-tab-preview")).toBe(false);
  });

  it("activates a clicked tab, closes a tab with its close button and starts a drag from a tab", async () => {
    await renderAsync();
    const begin = vi.spyOn(TestBed.inject(TabDragService), "begin");

    tab(1, 0).click();
    update();
    expect(layout.layout().group(1)?.active).toEqual(LayoutFixture.files);

    tab(0, 1).querySelector<HTMLElement>(".tr-tab-close")?.click();
    update();
    expect(layout.layout().documents.tabs).toEqual([LayoutFixture.plan]);

    tab(1, 1).dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));
    expect(begin).toHaveBeenCalledWith(LayoutFixture.search, expect.any(PointerEvent));
  });

  it("moves focus to the tab that becomes active when the focused tab closes, and leaves focus in another group alone", async () => {
    await renderAsync();
    const key = (element: Element | null): string | undefined => (element as HTMLElement | null)?.dataset["tabKey"];
    const focused = tabs(0).find(t => t.getAttribute("aria-selected") === "true");
    focused?.focus();

    focused?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    update();
    await fixture.whenStable();

    expect(key(document.activeElement)).toBe(layout.layout().documents.active?.key);
    tab(1, 1).focus();
    tab(0, 0).querySelector<HTMLElement>(".tr-tab-close")?.click();
    update();
    await fixture.whenStable();
    expect(key(document.activeElement)).toBe(LayoutFixture.search.key);
  });

  it("moves focus to the current group's active tab when the focused tab was the last of its group", async () => {
    await renderAsync(prepared.splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    const alone = [...document.querySelectorAll<HTMLElement>(`tr-tab[data-tab-key="${LayoutFixture.search.key}"]`)][0];
    alone?.focus();

    alone?.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    update();
    await fixture.whenStable();

    expect((document.activeElement as HTMLElement | null)?.dataset["tabKey"]).toBe(layout.currentGroup().active?.key);
  });

  it("marks where a dragged tab would land and dims the dragged tab", async () => {
    await renderAsync();
    let under: Element | null = null;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() => under);
    tab(1, 0).dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 0, clientY: 0, bubbles: true }));
    under = tab(0, 1);
    const bounds = under.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: bounds.left + 1, clientY: bounds.top + 1 }));
    update();

    expect(tab(0, 1).classList.contains("tr-tab-drop-before")).toBe(true);
    expect(tab(1, 0).classList.contains("tr-tab-dragged")).toBe(true);

    under = group(0).querySelector(".tr-tab-group-end");
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: bounds.right + 40, clientY: bounds.top + 1 }));
    update();
    expect(group(0).querySelector(".tr-tab-group-end")?.classList.contains("tr-tab-drop-before")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });

  it("hides its dock from the top-right group only", async () => {
    await renderAsync(prepared.splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    const groups = layout.layout().dock(DockSide.Left).root?.groups.map(t => t.id) ?? [];
    const corner = layout.layout().dock(DockSide.Left).root?.cornerGroup.id;
    const other = groups.find(t => t !== corner) ?? -1;

    expect(group(other).querySelector(".tr-tab-group-hide")).toBeNull();
    expect(group(0).querySelector(".tr-tab-group-hide")).toBeNull();
    const hide = group(corner ?? -1).querySelector<HTMLButtonElement>(".tr-tab-group-hide");
    expect(hide?.getAttribute("aria-label")).toBe(Resources.hideDockLabels[DockSide.Left]);
    await expectTooltipAsync(hide, Resources.hideDockLabels[DockSide.Left]);
    hide?.click();
    update();

    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(true);
  });

  it("opens the active tab's menu from the panel actions and a tab's menu from the keyboard", async () => {
    await renderAsync();
    const actions = group(0).querySelector<HTMLButtonElement>(".tr-tab-group-menu");
    expect(actions?.getAttribute("aria-label")).toBe(Resources.panelActionsLabel);
    await expectTooltipAsync(actions, Resources.panelActionsLabel);
    actions?.click();
    update();
    await fixture.whenStable();
    const menu = document.querySelector<HTMLElement>(".cdk-overlay-container tr-menu[data-place='shell.tab']");
    expect(menu).not.toBeNull();
    expect(menu?.getBoundingClientRect().right).toBeCloseTo(actions?.getBoundingClientRect().right ?? 0, 0);
    expect(menu?.getBoundingClientRect().top).toBeGreaterThanOrEqual(actions?.getBoundingClientRect().bottom ?? Infinity);
    actions?.click();
    update();
    await fixture.whenStable();
    expect(document.querySelector(".cdk-overlay-container tr-menu[data-place='shell.tab']")).toBeNull();

    const key = new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true });
    tab(0, 0).dispatchEvent(key);
    update();
    await fixture.whenStable();
    const opened = document.querySelector<HTMLElement>(".cdk-overlay-container tr-menu[data-place='shell.tab']");

    expect(key.defaultPrevented).toBe(true);
    expect(opened?.getBoundingClientRect().top).toBeGreaterThanOrEqual(tab(0, 0).getBoundingClientRect().bottom);
    expect(opened?.getBoundingClientRect().left).toBeCloseTo(tab(0, 0).getBoundingClientRect().left, 0);
    expect(document.activeElement?.getAttribute("data-command")).toBe("shell.moveTabLeft");
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
    update();
    await fixture.whenStable();
    expect(document.querySelector(".cdk-overlay-container tr-menu[data-place='shell.tab']")).toBeNull();
    expect(document.activeElement).toBe(tab(0, 0));
  });

  it("moves a view's tab to the documents from its menu's Move to and focuses it there", async () => {
    await renderAsync();
    const search = tabs(1).find(t => t.getAttribute("data-tab-key") === LayoutFixture.search.key);

    search?.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true }));
    update();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>(".cdk-overlay-container tr-menu[data-place='shell.tab'] button[data-submenu='shell.tabMoveTo']")?.click();
    update();
    await fixture.whenStable();
    const destinations = [...document.querySelectorAll<HTMLButtonElement>(".cdk-overlay-container tr-menu[data-place='shell.tabMoveTo'] button[tr-menu-item]")];
    destinations.at(-1)?.click();
    update();
    await fixture.whenStable();

    expect(destinations.map(t => t.querySelector(".tr-menu-item-label")?.textContent)).toEqual([LayoutFixture.changes.name, Resources.documentsGroupLabel]);
    expect(layout.layout().groupOf(LayoutFixture.search)?.isDocuments).toBe(true);
    expect(document.activeElement?.getAttribute("data-tab-key")).toBe(LayoutFixture.search.key);
  });

  it("moves between tabs with the arrow keys, Home and End, and leaves an arrow with Ctrl, Cmd or Option to the commands", async () => {
    await renderAsync(prepared.openDocument(LayoutFixture.settings));
    const press = (key: string, modifiers: KeyboardEventInit = {}): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...modifiers });
      tab(0, 0).dispatchEvent(event);
      update();
      return event;
    };

    expect(press("ArrowRight").defaultPrevented).toBe(true);
    expect(layout.layout().documents.active).toEqual(LayoutFixture.plan);
    press("ArrowLeft");
    expect(layout.layout().documents.active).toEqual(LayoutFixture.settings);
    expect(document.activeElement).toBe(tab(0, 2));
    press("Home");
    expect(layout.layout().documents.active).toEqual(LayoutFixture.plan);
    press("End");
    expect(layout.layout().documents.active).toEqual(LayoutFixture.settings);
    expect(press("a").defaultPrevented).toBe(false);
    expect([{ ctrlKey: true }, { metaKey: true, altKey: true }, { altKey: true }].map(t => press("ArrowRight", t).defaultPrevented)).toEqual([false, false, false]);
    expect(layout.layout().documents.active).toEqual(LayoutFixture.settings);
  });

  it("reveals the active tab and offers the overflow list when the tabs do not fit", async () => {
    const reveal = vi.spyOn(Element.prototype, "scrollIntoView");
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();

    expect(reveal).toHaveBeenCalled();
    expect(group(1).querySelector(".tr-tab-group-overflow")).toBeNull();
    const overflow = group(0).querySelector<HTMLButtonElement>(".tr-tab-group-overflow");
    expect(overflow?.getAttribute("aria-label")).toBe(Resources.overflowLabel);
    await expectTooltipAsync(overflow, Resources.overflowLabel);
    overflow?.click();
    update();
    await fixture.whenStable();
    const choices = [...document.querySelectorAll<HTMLButtonElement>(".cdk-overlay-container .tr-tab-group-overflow-tab")];
    const list = document.querySelector<HTMLElement>(".cdk-overlay-container .tr-tab-group-overflow-menu");
    expect(choices.map(t => t.querySelector(".tr-menu-item-label")?.textContent)).toEqual(many.map(t => t.instance));
    expect(choices.map(t => t.getAttribute("aria-current"))).toEqual(many.map((_, index) => index === many.length - 1 ? "true" : null));
    expect(list?.children[0]?.classList.contains("tr-tab-group-overflow-close-all")).toBe(true);
    expect(list?.children[1]?.tagName).toBe("TR-MENU-SEPARATOR");

    choices[0]?.click();
    update();
    await fixture.whenStable();

    expect(layout.layout().documents.active).toEqual(many[0]);
    expect(document.activeElement).toBe(tab(0, 0));
  });

  it("pins the actions at the strip's end and keeps the revealed tab clear of them", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    const scroller = group(0).querySelector<HTMLElement>(".tr-tab-group-scroller") ?? host;
    const actions = group(0).querySelector<HTMLElement>(".tr-tab-group-actions") ?? host;

    expect(getComputedStyle(actions).position).toBe("sticky");
    expect(scroller.style.scrollPaddingInlineEnd).toBe(`${actions.offsetWidth}px`);
  });

  it("closes every tab of the group from the overflow list's Close all", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    group(0).querySelector<HTMLButtonElement>(".tr-tab-group-overflow")?.click();
    update();
    await fixture.whenStable();
    const closeAll = document.querySelector<HTMLButtonElement>(".cdk-overlay-container .tr-tab-group-overflow-close-all");
    expect(closeAll?.querySelector(".tr-menu-item-label")?.textContent).toBe(Resources.closeAllLabel);

    closeAll?.click();
    update();
    await fixture.whenStable();

    expect(layout.layout().documents.tabs).toEqual([]);
    expect(document.querySelector(".cdk-overlay-container tr-menu")).toBeNull();
  });

  it("reports that its tabs overflow, opens its overflow list on request with the first row focused, and stops reporting once gone", async () => {
    const strips = TestBed.inject(TabStripService);
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    expect([strips.isOverflowing(0), strips.isOverflowing(1)]).toEqual([true, false]);

    strips.showList(0);
    update();
    await fixture.whenStable();

    expect(document.querySelector(".cdk-overlay-container .tr-tab-group-overflow-menu")).not.toBeNull();
    expect(document.activeElement?.classList.contains("tr-tab-group-overflow-close-all")).toBe(true);
    expect(strips.listRequest()).toBeNull();
    fixture.destroy();
    expect(strips.isOverflowing(0)).toBe(false);
  });

  it("drops the overflow list once the group is wide enough", async () => {
    const many = Array.from({ length: 6 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    expect(group(0).querySelector(".tr-tab-group-overflow")).not.toBeNull();

    layout.setViewport(240, 60);
    update();
    await fixture.whenStable();
    update();

    expect(group(0).querySelector(".tr-tab-group-overflow")).toBeNull();
  });
});
