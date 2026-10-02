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
import { Layout } from "../../../../src/app/models/layout/layout";
import { ViewTab } from "../../../../src/app/models/layout/view-tab";
import type { LayoutService } from "../../../../src/app/services/layout.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";

@Component({
  imports: [DockComponent],
  template: `<tr-dock [side]="side()" />`
})
class DockHostComponent {
  public readonly side = signal(DockSide.Left);
}

describe("DockComponent", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
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

    buttons[1]?.click();
    fixture.detectChanges();

    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(false);
    expect(layout.layout().group(1)?.active).toEqual(LayoutFixture.search);
    expect(query("tr-sash")).not.toBeNull();
  });

  it("lays the bottom strip out in a row", async () => {
    await renderAsync(DockSide.Bottom, Layout.createDefault(registry).openView(LayoutFixture.terminal, registry).toggleDock(DockSide.Bottom));

    expect(query("tr-panel-card")?.classList.contains("tr-dock-strip-vertical")).toBe(false);
  });
});
