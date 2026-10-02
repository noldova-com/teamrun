/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DockingGuidesComponent } from "../../../../src/app/components/docking-guides/docking-guides.component";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { DockingOverlay } from "../../../../src/app/models/layout/docking-overlay";
import { Layout } from "../../../../src/app/models/layout/layout";
import type { Tab } from "../../../../src/app/models/layout/tab";
import type { LayoutService } from "../../../../src/app/services/layout.service";
import { TabDragService } from "../../../../src/app/services/tab-drag.service";
import { Resources } from "../../../../src/resources";
import { DesktopBridgeFixture } from "../../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../../fixtures/layout-service.fixture";

@Component({
  imports: [DockingGuidesComponent],
  template: `
    <div class="workspace">
      <div class="group" data-drop-group="0"></div>
      <div class="group" data-drop-group="1"></div>
      <div class="group" data-drop-group="2"></div>
      <tr-docking-guides />
    </div>
  `,
  styles: [".workspace { position: relative; width: 1920px; height: 960px; }"]
})
class DockingGuidesHostComponent {
}

describe("DockingGuidesComponent", () => {
  beforeEach(() => {
    DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(LayoutFixture.search, registry).openDocument(LayoutFixture.plan);
  let fixture: ComponentFixture<DockingGuidesHostComponent>;
  let layout: LayoutService;
  let host: HTMLElement;
  let under: Element | null;

  beforeEach(async () => {
    layout = await LayoutServiceFixture.prepareAsync(registry, prepared);
    fixture = TestBed.createComponent(DockingGuidesHostComponent);
    host = fixture.nativeElement;
    under = null;
    vi.spyOn(document, "elementFromPoint").mockImplementation(() => under);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    vi.restoreAllMocks();
  });

  function find(selector: string): HTMLElement | null {
    return host.querySelector<HTMLElement>(selector);
  }

  function start(tab: Tab): void {
    TestBed.inject(TabDragService).begin(tab, new PointerEvent("pointerdown", { button: 0, clientX: 0, clientY: 0 }));
  }

  function moveOver(selector: string): void {
    under = find(selector);
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 300, clientY: 200 }));
    fixture.detectChanges();
  }

  function expectRem(value: string | undefined, rem: number): void {
    expect(value?.endsWith("rem")).toBe(true);
    expect(Number.parseFloat(value ?? "")).toBeCloseTo(rem, 2);
  }

  function expectBox(element: HTMLElement | null, x: number, y: number): void {
    expectRem(element?.style.left, x);
    expectRem(element?.style.top, y);
  }

  it("shows nothing until a tab is dragged", () => {
    expect(find("tr-docking-guide")).toBeNull();
    expect(find(".tr-drag-label")).toBeNull();
  });

  it("shows the side guides, the label at the pointer and a plate over another group while a view is dragged", () => {
    const overlay = new DockingOverlay(layout.geometry());
    start(LayoutFixture.files);
    moveOver(".group[data-drop-group=\"0\"]");

    const sides = [...host.querySelectorAll<HTMLElement>(".tr-docking-side")];
    expect(sides.map(t => [t.dataset["dropSide"], t.dataset["direction"]])).toEqual([["Left", "Left"], ["Right", "Right"], ["Bottom", "Bottom"]]);
    for (const side of Object.values(DockSide))
      expectBox(find(`.tr-docking-side[data-drop-side="${side}"]`), overlay.guide(side).x, overlay.guide(side).y);
    const plate = find("tr-docking-plate");
    expect(plate?.dataset["dropGroup"]).toBe("0");
    expect(plate?.hasAttribute("data-drop-plate")).toBe(true);
    const frame = layout.geometry().frameOf(0);
    if (Object.isNull(frame))
      throw new Error("The documents group has no frame.");
    expectBox(plate, overlay.plate(frame).x, overlay.plate(frame).y);
    expect(find(".tr-docking-preview")).toBeNull();

    const label = find(".tr-drag-label");
    expect(label?.getAttribute("role")).toBe("status");
    expect(label?.textContent).toContain(Resources.formatDraggedTab("files.tree"));
    expect(label?.style.left).toBe("300px");
    expect(label?.style.top).toBe("200px");
  });

  it("chooses the guide under the pointer and previews where the tab lands", () => {
    start(LayoutFixture.files);
    moveOver(".group[data-drop-group=\"0\"]");
    moveOver(".tr-docking-side[data-drop-side=\"Right\"]");

    expect(find(".tr-docking-side[data-drop-side=\"Right\"]")?.classList.contains("tr-docking-guide-chosen")).toBe(true);
    const preview = layout.geometry().sidePreview(DockSide.Right);
    expectBox(find(".tr-docking-preview"), preview.x, preview.y);
    expectRem(find(".tr-docking-preview")?.style.width, preview.width);

    moveOver(".group[data-drop-group=\"2\"]");
    moveOver("tr-docking-plate [data-direction=\"Top\"]");
    expect(find("tr-docking-plate [data-direction=\"Top\"]")?.classList.contains("tr-docking-guide-chosen")).toBe(true);
    moveOver("tr-docking-plate [data-direction=\"Center\"]");
    expect(find("tr-docking-plate [data-direction=\"Center\"]")?.classList.contains("tr-docking-guide-chosen")).toBe(true);
    moveOver("tr-docking-plate");
    expect(host.querySelectorAll(".tr-docking-guide-chosen").length).toBe(0);
  });

  it("shows no plate over the dragged view's own group when it is the only tab there", () => {
    start(LayoutFixture.changes);
    moveOver(".group[data-drop-group=\"2\"]");

    expect(find("tr-docking-plate")).toBeNull();
    moveOver(".group[data-drop-group=\"1\"]");
    expect(find("tr-docking-plate")).not.toBeNull();
  });

  it("shows only the label while a document is dragged", () => {
    start(LayoutFixture.plan);
    moveOver(".group[data-drop-group=\"0\"]");

    expect(find("tr-docking-guide")).toBeNull();
    expect(find(".tr-docking-preview")).toBeNull();
    expect(find(".tr-drag-label")?.textContent).toContain(Resources.formatDraggedTab("plan"));
  });
});
