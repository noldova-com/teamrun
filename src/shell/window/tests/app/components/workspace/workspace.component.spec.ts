/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { AppearanceService, DefaultTheme, ThemeMode, Typography } from "@noldova/teamrun-shell-ui";

import { WorkspaceComponent } from "../../../../src/app/components/workspace/workspace.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { SplitAxis } from "../../../../src/app/enums/split-axis";
import { Layout } from "../../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { ViewDialogService } from "../../../../src/app/services/view-dialog.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
import { FixtureTheme } from "../../../../../ui/tests/fixtures/fixture-theme";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { WindowPartHostFixture } from "../../../fixtures/window-part-host.fixture";

@Component({
  imports: [WorkspaceComponent],
  template: `<tr-workspace [style.width.px]="width()" [style.height.px]="height()" />`
})
class WorkspaceHostComponent {
  public readonly width = signal(1000);
  public readonly height = signal(600);
}

describe("WorkspaceComponent", () => {
  let bridge: DesktopBridgeFixture;
  let parts: WindowPartHostFixture;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  beforeEach(() => {
    parts = new WindowPartHostFixture();
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartHostService, useValue: parts }] });
  });

  afterEach(() => AppearanceFixture.reset());

  async function renderAsync(registry: ViewRegistry, layout: Layout = Layout.createDefault(registry)): Promise<ComponentFixture<WorkspaceHostComponent>> {
    AppearanceFixture.apply();
    await LayoutServiceFixture.prepareAsync(registry, layout, 0, 0, null);
    const fixture = TestBed.createComponent(WorkspaceHostComponent);
    await settleAsync(fixture);
    return fixture;
  }

  async function settleAsync(fixture: ComponentFixture<WorkspaceHostComponent>): Promise<void> {
    fixture.detectChanges();
    await new Promise(t => requestAnimationFrame(() => requestAnimationFrame(t)));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function groupsOf(fixture: ComponentFixture<WorkspaceHostComponent>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>("tr-panel-card")];
  }

  function boundsOf(element: HTMLElement): readonly number[] {
    const workspace = element.closest("tr-workspace")?.getBoundingClientRect() ?? new DOMRect();
    const bounds = element.getBoundingClientRect();
    return [bounds.x - workspace.x, bounds.y - workspace.y, bounds.width, bounds.height];
  }

  it("is inert while the runtime starts again and gives the focus back where it was once it is ready", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const workspace = (fixture.nativeElement as HTMLElement).querySelector("tr-workspace") as HTMLElement;
    const focused = workspace.appendChild(document.createElement("button"));
    focused.focus();

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    const whileStarting = [workspace.hasAttribute("inert"), document.activeElement === focused];
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);

    expect(whileStarting).toEqual([true, false]);
    expect(workspace.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(focused);
  });

  it("remembers the focus only from an HTML element, so a focus that moves in an SVG element does not take its place", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const workspace = (fixture.nativeElement as HTMLElement).querySelector("tr-workspace") as HTMLElement;
    const focused = workspace.appendChild(document.createElement("button"));
    focused.focus();
    const graphic = workspace.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));

    graphic.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);

    expect(document.activeElement).toBe(focused);
  });

  it("focuses the active tab of the group that held the focus when its place is gone once the parts load again", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    const host = fixture.nativeElement as HTMLElement;
    const tab = host.querySelector<HTMLElement>(`[data-tab-key="${LayoutFixture.plan.key}"]`) as HTMLElement;
    const focused = (tab.closest("tr-tab-group") as HTMLElement).appendChild(document.createElement("button"));
    focused.focus();

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);
    const whileLoading = document.activeElement === focused;
    focused.remove();
    parts.generation.update(t => t + 1);
    await settleAsync(fixture);

    expect(whileLoading).toBe(true);
    expect(document.activeElement).toBe(tab);
  });

  it("moves the focus to the dock's strip when a narrower window closes the dock that holds it", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry);
    const host = fixture.nativeElement as HTMLElement;
    const group = host.querySelector<HTMLElement>(`[data-tab-key="${LayoutFixture.files.key}"]`)?.closest("tr-tab-group") as HTMLElement;
    const focused = group.appendChild(document.createElement("button"));
    focused.focus();
    fixture.componentInstance.height.set(590);
    await settleAsync(fixture);
    const whileFocused = document.activeElement === focused;
    focused.blur();
    fixture.componentInstance.height.set(600);
    await settleAsync(fixture);
    const whileOpen = document.activeElement;
    focused.focus();

    fixture.componentInstance.width.set(AppearanceFixture.toPixels(40));
    await settleAsync(fixture);

    expect([whileFocused, whileOpen === document.body]).toEqual([true, true]);
    expect(document.activeElement).toBe(host.querySelector(`tr-dock[data-side="Left"] .tr-dock-strip-view[data-view="${LayoutFixture.files.key}"]`));
  });

  it("keeps a dock opened from its strip open beside a dock the person hid while the window resizes", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry, Layout.createDefault(registry).toggleDock(DockSide.Right));
    const host = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.width.set(AppearanceFixture.toPixels(40));
    await settleAsync(fixture);
    const layout = TestBed.inject(LayoutService);
    const closed = layout.geometry().isCollapsed(DockSide.Left);

    host.querySelector<HTMLElement>("tr-dock[data-side=\"Left\"] .tr-dock-strip-view")?.click();
    await settleAsync(fixture);
    fixture.componentInstance.width.set(AppearanceFixture.toPixels(40) + 1);
    await settleAsync(fixture);

    expect(closed).toBe(true);
    expect(layout.geometry().isCollapsed(DockSide.Left)).toBe(false);
    expect(host.querySelector("tr-dock[data-side=\"Left\"] tr-sash")).not.toBeNull();
  });

  it("leaves the focus where it is when the person moved it while the runtime started again", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const workspace = (fixture.nativeElement as HTMLElement).querySelector("tr-workspace") as HTMLElement;
    workspace.appendChild(document.createElement("button")).focus();
    const outside = document.body.appendChild(document.createElement("input"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    await settleAsync(fixture);
    outside.focus();
    bridge.publishStartup({ kind: "Ready", details: [] });
    await settleAsync(fixture);
    const active = document.activeElement;
    outside.remove();

    expect(active).toBe(outside);
  });

  it("shows only the middle, with the empty-window card, when there are no modules", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());
    const groups = groupsOf(fixture);
    const margin = AppearanceFixture.toPixels(0.25);

    expect(groups.length).toBe(1);
    expect(groups[0]?.classList.contains("tr-panel-card-shell")).toBe(false);
    expect(groups[0]?.querySelector("tr-empty-window")).not.toBeNull();
    const [x, y, width, height] = boundsOf(groups[0] ?? fixture.nativeElement);
    AppearanceFixture.expectPixels(x ?? 0, margin);
    AppearanceFixture.expectPixels(y ?? 0, 0);
    AppearanceFixture.expectPixels(width ?? 0, 1000 - 2 * margin);
    AppearanceFixture.expectPixels(height ?? 0, 600 - margin);
  });

  it("follows the size of its region", async () => {
    const fixture = await renderAsync(ViewRegistry.createEmpty());

    fixture.componentInstance.width.set(800);
    fixture.componentInstance.height.set(500);
    await settleAsync(fixture);

    const [, , width, height] = boundsOf(groupsOf(fixture)[0] ?? fixture.nativeElement);
    AppearanceFixture.expectPixels(width ?? 0, 800 - 2 * AppearanceFixture.toPixels(0.25));
    AppearanceFixture.expectPixels(height ?? 0, 500 - AppearanceFixture.toPixels(0.25));
  });

  it("lays out nothing until the appearance is painted, and then lays out with the painted looks", async () => {
    const painted = signal(0);
    TestBed.overrideProvider(AppearanceService, { useValue: { painted, typography: signal(new Typography()), theme: signal(DefaultTheme.theme) } });
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const layout = TestBed.inject(LayoutService);
    const before = [layout.isMeasured(), groupsOf(fixture).length];

    painted.set(1);
    await settleAsync(fixture);

    expect(before).toEqual([false, 0]);
    expect(layout.isMeasured()).toBe(true);
    expect(groupsOf(fixture).length).toBeGreaterThan(1);
    expect(layout.geometry().dock(DockSide.Left).x).toBe(0.25);
  });

  it("takes its dock sizes, minimums, strip and gaps from the theme's look and lays out again in the same turn as the theme changes", async () => {
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const appearance = TestBed.inject(AppearanceService);
    const layout = TestBed.inject(LayoutService);
    fixture.componentInstance.width.set(2000);
    await settleAsync(fixture);
    const shown = (): readonly number[] => {
      const geometry = layout.geometry();
      const metrics = geometry.metrics;
      return [geometry.dock(DockSide.Left).x, geometry.dock(DockSide.Left).width, geometry.dock(DockSide.Right).width, metrics.gap, metrics.dockMinimum, metrics.strip,
        metrics.documentMinimum, metrics.groupMinimums[SplitAxis.Horizontal], metrics.groupMinimums[SplitAxis.Vertical], metrics.dockSizes[DockSide.Bottom]];
    };
    const standard = shown();

    appearance.setTheme(FixtureTheme.theme);
    fixture.detectChanges();
    const themed = shown();
    await settleAsync(fixture);
    const [x, , width] = boundsOf(groupsOf(fixture).find(t => t.classList.contains("tr-panel-card-shell")) ?? fixture.nativeElement);
    appearance.setTheme(DefaultTheme.theme);
    await settleAsync(fixture);

    expect(standard).toEqual([0.25, 26, 25, 0.25, 10, 2.75, 13.75, 10, 6.25, 16.25]);
    expect(themed).toEqual([0.375, 20, 18, 0.375, 8, 3, 11, 8.5, 5, 12]);
    AppearanceFixture.expectPixels(x ?? 0, AppearanceFixture.toPixels(0.375));
    AppearanceFixture.expectPixels(width ?? 0, AppearanceFixture.toPixels(20));
    expect(shown()).toEqual(standard);
  });

  it("shows docked groups on the shell surface and leaves the documents without the empty-window card", async () => {
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const groups = groupsOf(fixture);
    const docked = groups.filter(t => t.classList.contains("tr-panel-card-shell"));

    expect(docked.length).toBe(groups.length - 1);
    expect(docked.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector("tr-empty-window")).toBeNull();
    expect(getComputedStyle(docked[0] ?? fixture.nativeElement).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "sideBar.background"));
  });

  it("moves an open tab's view into a dialog that shows it, takes the tab out of its strip for the group's next tab without changing the saved layout, and puts both back once the dialog closes", async () => {
    const registry = LayoutFixture.createRegistry();
    const { plan, todo } = LayoutFixture;
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(todo).openDocument(plan));
    const host: HTMLElement = fixture.nativeElement;
    const layout = TestBed.inject(LayoutService);
    const dialogs = TestBed.inject(ViewDialogService);
    const saved = layout.layout();
    const documents = (): HTMLElement => host.querySelector(`tr-tab-group[data-group="${saved.documents.id}"]`) as HTMLElement;
    const strip = (): readonly (string | null)[] => [...documents().querySelectorAll(".tr-tab")].map(t => t.getAttribute("data-tab-key"));
    const selected = (): string | null => documents().querySelector(".tr-tab-selected")?.getAttribute("data-tab-key") ?? null;
    const shownView = (): Element | null => documents().querySelector("tr-tab-content");
    const before = [...host.querySelectorAll("tr-tab-content")];
    const planView = shownView();

    const shown = dialogs.showAsync(plan);
    await settleAsync(fixture);
    const whileShown = [strip(), selected(), layout.layout() === saved];
    const inDialog = [...document.querySelectorAll("tr-view-dialog tr-tab-content")];
    const nextView = shownView();
    dialogs.close();
    await shown;
    await settleAsync(fixture);

    expect([strip(), selected()]).toEqual([[todo.key, plan.key], plan.key]);
    expect(whileShown).toEqual([[todo.key], todo.key, true]);
    expect([inDialog.length, inDialog[0] === planView, before.includes(nextView as Element)]).toEqual([1, true, false]);
    expect([shownView() === planView, layout.layout() === saved]).toEqual([true, true]);
    expect(new Set(host.querySelectorAll("tr-tab-content"))).toEqual(new Set(before));
  });

  it("renders the docks with their sashes, the groups, the split sashes and the docking guides", async () => {
    const registry = LayoutFixture.createRegistry();
    const layout = Layout.createDefault(registry).openView(LayoutFixture.search, registry).splitGroup(LayoutFixture.search, 1, PanelEdge.Bottom);
    const fixture = await renderAsync(registry, layout);
    const host: HTMLElement = fixture.nativeElement;

    expect([...host.querySelectorAll("tr-tab-group")].map(t => t.getAttribute("data-group"))).toEqual(["2", "3", "4", "0"]);
    expect([...host.querySelectorAll("tr-dock tr-sash")].map(t => t.getAttribute("aria-label"))).toEqual(["Resize the left dock", "Resize the right dock"]);
    expect(host.querySelectorAll("tr-split-sash").length).toBe(1);
    expect(host.querySelector("tr-docking-guides")).not.toBeNull();
  });
});
