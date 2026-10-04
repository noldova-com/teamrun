/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";

import { WorkspaceComponent } from "../../../../src/app/components/workspace/workspace.component";
import { PanelEdge } from "../../../../src/app/enums/panel-edge";
import { Layout } from "../../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../../src/app/models/layout/view-registry";
import { ViewDialogService } from "../../../../src/app/services/view-dialog.service";
import { WindowPartHostService } from "../../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";
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
    await LayoutServiceFixture.prepareAsync(registry, layout, 0, 0);
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

  it("shows docked groups on the shell surface and leaves the documents without the empty-window card", async () => {
    const fixture = await renderAsync(LayoutFixture.createRegistry());
    const groups = groupsOf(fixture);
    const docked = groups.filter(t => t.classList.contains("tr-panel-card-shell"));

    expect(docked.length).toBe(groups.length - 1);
    expect(docked.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelector("tr-empty-window")).toBeNull();
    expect(getComputedStyle(docked[0] ?? fixture.nativeElement).backgroundColor).toBe(AppearanceFixture.readColor(DefaultTheme.theme, ThemeMode.Light, "sideBar.background"));
  });

  it("leaves an open tab's place empty while a dialog shows it and shows it there again once the dialog closes", async () => {
    const registry = LayoutFixture.createRegistry();
    const fixture = await renderAsync(registry, Layout.createDefault(registry).openDocument(LayoutFixture.plan));
    const host: HTMLElement = fixture.nativeElement;
    const dialogs = TestBed.inject(ViewDialogService);
    const before = host.querySelectorAll("tr-tab-content").length;

    const shown = dialogs.showAsync(LayoutFixture.plan);
    await settleAsync(fixture);
    const whileShown = host.querySelectorAll("tr-tab-content").length;
    const inDialog = document.querySelectorAll("tr-view-dialog tr-tab-content").length;
    dialogs.close();
    await shown;
    await settleAsync(fixture);

    expect([whileShown, inDialog, host.querySelectorAll("tr-tab-content").length]).toEqual([before - 1, 1, before]);
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
