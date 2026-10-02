/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { TabGroupComponent } from "../../../../src/app/components/tab-group/tab-group.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { DocumentTab } from "../../../../src/app/models/layout/document-tab";
import type { GroupFrame } from "../../../../src/app/models/layout/group-frame";
import { Layout } from "../../../../src/app/models/layout/layout";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { TabDragService } from "../../../../src/app/services/tab-drag.service";
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
    expect(group(0).querySelector("[role=tabpanel]")).not.toBeNull();
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
    hide?.click();
    update();

    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(true);
  });

  it("opens the active tab's menu from the panel actions and a tab's menu from the keyboard", async () => {
    await renderAsync();
    const actions = group(1).querySelector<HTMLButtonElement>(".tr-tab-group-menu");
    expect(actions?.getAttribute("aria-label")).toBe(Resources.panelActionsLabel);
    actions?.click();
    update();
    await fixture.whenStable();
    expect(document.querySelector(".cdk-overlay-container .tr-tab-menu")).not.toBeNull();
    document.querySelector(".cdk-overlay-container")?.replaceChildren();

    const key = new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true });
    tab(0, 0).dispatchEvent(key);
    update();
    await fixture.whenStable();

    expect(key.defaultPrevented).toBe(true);
    expect(document.querySelector(".cdk-overlay-container .tr-tab-menu")).not.toBeNull();
  });

  it("moves between tabs with the arrow keys, Home and End", async () => {
    await renderAsync(prepared.openDocument(LayoutFixture.settings));
    const press = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
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
    overflow?.click();
    update();
    await fixture.whenStable();
    const choices = [...document.querySelectorAll<HTMLButtonElement>(".cdk-overlay-container .tr-tab-group-overflow-tab")];
    expect(choices.map(t => t.textContent?.trim())).toEqual(many.map(t => t.instance));

    choices[0]?.click();
    update();
    await fixture.whenStable();

    expect(layout.layout().documents.active).toEqual(many[0]);
    expect(document.activeElement).toBe(tab(0, 0));
  });

  it("pins the actions at the strip's end, keeps the revealed tab clear of them and scrolls the strip sideways with a vertical wheel", async () => {
    const many = Array.from({ length: 12 }, (_, index) => new DocumentTab("notes.note", `note ${index}`));
    await renderAsync(many.reduce((current, t) => current.openDocument(t), Layout.createDefault(registry)), 60);
    update();
    await fixture.whenStable();
    update();
    const scroller = group(0).querySelector<HTMLElement>(".tr-tab-group-scroller") ?? host;
    const actions = group(0).querySelector<HTMLElement>(".tr-tab-group-actions") ?? host;
    const wheel = (init: WheelEventInit, target: HTMLElement = scroller): WheelEvent => {
      const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      return event;
    };
    scroller.scrollLeft = 0;

    expect(getComputedStyle(actions).position).toBe("sticky");
    expect(scroller.style.scrollPaddingInlineEnd).toBe(`${actions.offsetWidth}px`);
    expect(wheel({ deltaX: 40, deltaY: 40 }).defaultPrevented).toBe(false);
    expect(wheel({ deltaY: 0 }).defaultPrevented).toBe(false);
    expect(scroller.scrollLeft).toBe(0);
    expect(wheel({ deltaY: 80 }).defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBeGreaterThan(0);
    const quiet = group(1).querySelector<HTMLElement>(".tr-tab-group-scroller") ?? host;
    expect(wheel({ deltaY: 80 }, quiet).defaultPrevented).toBe(false);
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
