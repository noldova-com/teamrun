/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DockComponent } from "../../../../src/app/components/dock/dock.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { Layout } from "../../../../src/app/models/layout/layout";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import { ViewBadge } from "../../../../src/app/models/view-badge";
import type { LayoutService } from "../../../../src/app/services/layout.service";
import { TabLabelService } from "../../../../src/app/services/tab-label.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { TooltipFixture } from "../../../fixtures/tooltip.fixture";

@Component({
  imports: [DockComponent],
  template: `<tr-dock [side]="side()" />`
})
class DockHostComponent {
  public readonly side = signal(DockSide.Left);
}

describe("DockComponent", () => {
  let bridge: DesktopBridgeFixture;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  const absent = new ViewTab("absent.view");
  let fixture: ComponentFixture<DockHostComponent>;
  let layout: LayoutService;

  async function renderAsync(side: DockSide, prepared: Layout = Layout.createDefault(registry).openView(LayoutFixture.terminal, registry)): Promise<void> {
    layout = await LayoutServiceFixture.prepareAsync(registry, prepared);
    fixture = TestBed.createComponent(DockHostComponent);
    fixture.componentInstance.side.set(side);
    fixture.detectChanges();
  }

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  function press(key: string, times: number = 1): void {
    for (let index = 0; index < times; index++)
      query("tr-sash")?.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    fixture.detectChanges();
  }

  it("shows nothing for a dock without views", async () => {
    await renderAsync(DockSide.Bottom, Layout.createDefault(registry));

    expect(fixture.nativeElement.querySelector("tr-dock").children.length).toBe(0);
  });

  it("places a sash at the inner edge of an open dock and resizes the dock in rem", async () => {
    await renderAsync(DockSide.Left);
    const bounds = layout.geometry().dock(DockSide.Left);
    const sash = query("tr-sash");

    expect(sash?.style.left).toBe(`${bounds.right}rem`);
    expect(sash?.style.width).toBe(`${Resources.panelGap}rem`);
    expect(sash?.getAttribute("aria-label")).toBe(Resources.resizeDockLabels[DockSide.Left]);
    expect(sash?.getAttribute("aria-valuenow")).toBe(String(26 * 16));
    expect(sash?.getAttribute("aria-valuemin")).toBe(String(10 * 16));

    press("ArrowRight");
    expect(layout.layout().dock(DockSide.Left).size).toBe(26.5);
    press("ArrowLeft", 60);
    expect(layout.layout().dock(DockSide.Left).size).toBe(10);
    press("ArrowRight", 400);
    expect(layout.layout().dock(DockSide.Left).size).toBe(layout.geometry().maximumSize(DockSide.Left));
  });

  it("grows the right and bottom docks towards the middle", async () => {
    await renderAsync(DockSide.Right);
    const right = layout.geometry().dock(DockSide.Right);
    expect(query("tr-sash")?.style.left).toBe(`${right.x - Resources.panelGap}rem`);
    press("ArrowLeft");
    expect(layout.layout().dock(DockSide.Right).size).toBe(25.5);

    fixture.componentInstance.side.set(DockSide.Bottom);
    fixture.detectChanges();
    const bottom = layout.geometry().dock(DockSide.Bottom);
    expect(query("tr-sash")?.style.top).toBe(`${bottom.y - Resources.panelGap}rem`);
    expect(query("tr-sash")?.getAttribute("aria-orientation")).toBe("horizontal");
    press("ArrowUp");
    expect(layout.layout().dock(DockSide.Bottom).size).toBe(16.75);
  });

  it("shows a collapsed dock as a strip of its available views that opens the chosen one", async () => {
    const prepared = Layout.createDefault(registry).openView(LayoutFixture.search, registry).moveTab(absent, 1, 2).toggleDock(DockSide.Left);
    await renderAsync(DockSide.Left, prepared);
    const strip = query("tr-panel-card");
    const host: HTMLElement = fixture.nativeElement;
    const buttons = [...host.querySelectorAll<HTMLButtonElement>(".tr-dock-strip-view")];

    expect(query("tr-sash")).toBeNull();
    expect(strip?.classList.contains("tr-dock-strip-vertical")).toBe(true);
    expect(strip?.dataset["dropGroup"]).toBe("1");
    expect(buttons.map(t => t.getAttribute("aria-label"))).toEqual(["files.tree", "files.search"]);
    await TooltipFixture.expectTooltipAsync(buttons[1], "files.search", tooltip => expect(tooltip.getBoundingClientRect().left).toBeGreaterThan(strip?.getBoundingClientRect().right ?? Infinity));

    buttons[1]?.click();
    fixture.detectChanges();

    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(false);
    expect(layout.layout().group(1)?.active).toEqual(LayoutFixture.search);
    expect(query("tr-sash")).not.toBeNull();
  });

  it("opens a dock the narrow window closed from its strip and closes the other dock instead", async () => {
    await renderAsync(DockSide.Left);
    layout.setViewport(40, 40);
    fixture.detectChanges();
    const closed = [...layout.geometry().closedSides];

    query(".tr-dock-strip-view")?.click();
    fixture.detectChanges();

    expect(closed).toEqual([DockSide.Right, DockSide.Left]);
    expect([...layout.geometry().closedSides]).toEqual([DockSide.Right]);
    expect(query("tr-sash")).not.toBeNull();
  });

  it("shows a side set to icons as a toolbar of its views on the window's edge, group by group, beside the open dock", async () => {
    await renderAsync(DockSide.Left, Layout.createDefault(registry).splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    bridge.publishEvent("shell.settingsChanged", { name: "shell.leftDockStyle", value: "Icons", isSet: true });
    fixture.detectChanges();
    const strip = query("tr-panel-card");
    const rail = layout.geometry().rail(DockSide.Left);
    const host: HTMLElement = fixture.nativeElement;

    expect([strip?.getAttribute("role"), strip?.getAttribute("aria-orientation"), strip?.getAttribute("aria-label")]).toEqual(["toolbar", "vertical", "Left dock views"]);
    expect(strip?.classList.contains("tr-dock-strip-rail")).toBe(true);
    expect([strip?.style.left, strip?.style.width]).toEqual([`${rail?.x}rem`, `${rail?.width}rem`]);
    expect([...host.querySelectorAll(".tr-dock-strip-view")].map(t => [t.getAttribute("data-view"), t.getAttribute("aria-pressed")])).toEqual([
      ["view/files.tree", "true"],
      ["view/files.search", "true"]
    ]);
    expect([...host.querySelectorAll(".tr-dock-strip-separator")].map(t => t.getAttribute("aria-orientation"))).toEqual(["horizontal"]);
    expect(query("tr-sash")).not.toBeNull();
  });

  it("drags an icon like its tab, marking where it lands between icons, at the end of the group above when between two groups", async () => {
    await renderAsync(DockSide.Left, Layout.createDefault(registry).splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom));
    bridge.publishEvent("shell.settingsChanged", { name: "shell.leftDockStyle", value: "Icons", isSet: true });
    fixture.detectChanges();
    const icon = (key: string): HTMLElement => query(`.tr-dock-strip-view[data-view="${key}"]`) as HTMLElement;
    const treeGroup = layout.layout().groupOf(LayoutFixture.files)?.id ?? -1;
    const searchGroup = layout.layout().groupOf(LayoutFixture.search)?.id ?? -1;
    const targets = [icon("view/files.tree"), icon("view/files.search")].map(t => [t.dataset["dropBefore"], t.dataset["dropAfter"], t.dataset["dropAxis"]]);
    const pointAt = (element: HTMLElement, fraction: number): { clientX: number; clientY: number } => {
      const bounds = element.getBoundingClientRect();
      return { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height * fraction };
    };

    icon("view/files.search").dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, ...pointAt(icon("view/files.search"), 0.5) }));
    document.dispatchEvent(new PointerEvent("pointermove", pointAt(icon("view/files.tree"), 0.9)));
    fixture.detectChanges();
    const marked = ["tr-drop-line-before", "tr-drop-line-vertical", "tr-dock-strip-dragged"].map(t => icon("view/files.search").classList.contains(t));
    document.dispatchEvent(new PointerEvent("pointerup"));
    fixture.detectChanges();

    expect(targets).toEqual([[`${treeGroup}:0`, `${treeGroup}:1`, "vertical"], [`${treeGroup}:1`, `${searchGroup}:1`, "vertical"]]);
    expect(marked).toEqual([true, true, true]);
    expect(layout.layout().group(treeGroup)?.tabs).toEqual([LayoutFixture.files, LayoutFixture.search]);
    icon("view/files.tree").dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, ...pointAt(icon("view/files.tree"), 0.5) }));
    document.dispatchEvent(new PointerEvent("pointermove", pointAt(icon("view/files.search"), 0.9)));
    fixture.detectChanges();
    expect(icon("view/files.search").classList.contains("tr-drop-line-after")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });

  it("opens the tab menu of an icon's view from the context menu key or a right click, and returns focus to the icon", async () => {
    await renderAsync(DockSide.Left);
    bridge.publishEvent("shell.settingsChanged", { name: "shell.leftDockStyle", value: "Icons", isSet: true });
    fixture.detectChanges();
    const icon = query(".tr-dock-strip-view[data-view=\"view/files.tree\"]") as HTMLElement;
    const menu = (): HTMLElement | null => document.querySelector<HTMLElement>(".cdk-overlay-container tr-menu[data-place='shell.tab']");
    const closeAsync = async (): Promise<void> => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: 27, bubbles: true, cancelable: true }));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    icon.focus();
    const key = new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true });

    icon.dispatchEvent(key);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(key.defaultPrevented).toBe(true);
    expect(menu()?.querySelector("[data-command='shell.closeTab']")).not.toBeNull();
    expect(menu()?.contains(document.activeElement)).toBe(true);
    await closeAsync();
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(icon);

    const click = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 10, clientY: 10 });
    icon.dispatchEvent(click);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(click.defaultPrevented).toBe(true);
    expect(menu()).not.toBeNull();
    await closeAsync();
    expect(menu()).toBeNull();
  });

  it("closes the dock from the icon of a view it shows, and opens it at the chosen view from any other", async () => {
    await renderAsync(DockSide.Left, Layout.createDefault(registry).openView(LayoutFixture.search, registry));
    bridge.publishEvent("shell.settingsChanged", { name: "shell.leftDockStyle", value: "Icons", isSet: true });
    fixture.detectChanges();
    const button = (key: string): HTMLButtonElement | null => query(`.tr-dock-strip-view[data-view="${key}"]`) as HTMLButtonElement | null;
    const pressed = (): readonly (string | null | undefined)[] => [button("view/files.tree"), button("view/files.search")].map(t => t?.getAttribute("aria-pressed"));
    const first = pressed();

    button("view/files.search")?.click();
    fixture.detectChanges();
    const closed = [layout.layout().dock(DockSide.Left).isCollapsed, query("tr-sash"), pressed()];
    button("view/files.tree")?.click();
    fixture.detectChanges();

    expect(first).toEqual(["false", "true"]);
    expect(closed).toEqual([true, null, ["false", "false"]]);
    expect([layout.layout().dock(DockSide.Left).isCollapsed, layout.layout().group(1)?.active, pressed()]).toEqual([false, LayoutFixture.files, ["true", "false"]]);
    button("view/files.search")?.click();
    fixture.detectChanges();
    expect([layout.layout().dock(DockSide.Left).isCollapsed, pressed()]).toEqual([false, ["false", "true"]]);
  });

  it("shows a view's badge on its icon and adds its description to the icon's name", async () => {
    await renderAsync(DockSide.Left, Layout.createDefault(registry).openView(LayoutFixture.search, registry).toggleDock(DockSide.Left));
    TestBed.inject(TabLabelService).setBadge("files.search", new ViewBadge(120, "120 results"));
    fixture.detectChanges();
    const search = query(".tr-dock-strip-view[data-view=\"view/files.search\"]");
    const tree = query(".tr-dock-strip-view[data-view=\"view/files.tree\"]");

    expect([search?.getAttribute("aria-label"), search?.querySelector("tr-view-badge")?.textContent?.trim()]).toEqual(["files.search, 120 results", "99+"]);
    expect([tree?.getAttribute("aria-label"), tree?.querySelector("tr-view-badge")]).toEqual(["files.tree", null]);
    const icon = search?.getBoundingClientRect();
    const badge = search?.querySelector("tr-view-badge")?.getBoundingClientRect();
    expect([badge?.top, badge?.right]).toEqual([icon?.top, icon?.right]);
  });

  it("lays the bottom strip out in a row", async () => {
    const terminals = Layout.createDefault(registry).openView(LayoutFixture.terminal, registry).openView(LayoutFixture.secondTerminal, registry);
    const split = terminals.splitGroup(LayoutFixture.secondTerminal, terminals.groupOf(LayoutFixture.terminal)?.id ?? -1, PanelEdge.Right);
    await renderAsync(DockSide.Bottom, split.toggleDock(DockSide.Bottom));

    expect(query("tr-panel-card")?.classList.contains("tr-dock-strip-vertical")).toBe(false);
    expect(query(".tr-dock-strip-separator")?.getAttribute("aria-orientation")).toBe("vertical");
    expect(query("tr-panel-card")?.getAttribute("aria-orientation")).toBe("horizontal");
  });
});
