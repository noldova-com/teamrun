/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { SampleData } from "../../../fixtures/sample-data";
import { MemoryStorage } from "../../../fixtures/memory-storage";
import { DockSide } from "../../../../src/app/enums/dock-side";
import { PanelId } from "../../../../src/app/enums/panel-id";
import { Resources } from "../../../../src/app/resources";
import { TEAMRUN_BRIDGE } from "../../../../src/app/services/bridge.service";
import { ChatStore } from "../../../../src/app/services/chat-store.service";
import { LayoutService } from "../../../../src/app/services/layout.service";
import { DockComponent } from "../../../../src/app/components/dock/dock.component";

describe("DockComponent", () => {
  it("shows its tabs, activates, closes, collapses to a strip, and expands again", async () => {
    MemoryStorage.install(window);
    TestBed.configureTestingModule({ imports: [DockComponent], providers: [{ provide: TEAMRUN_BRIDGE, useValue: SampleData.createBridge() }] });
    await TestBed.inject(ChatStore).initialize();
    const layout = TestBed.inject(LayoutService);
    layout.movePanel(PanelId.Changes, DockSide.Left);
    layout.activatePanel(PanelId.Explorer);
    const fixture = TestBed.createComponent(DockComponent);
    fixture.componentRef.setInput("side", DockSide.Left);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>(".tr-tab"));

    expect(element.getAttribute("data-side")).toBe(DockSide.Left);
    expect(tabs().map(t => t.querySelector(".tr-tab-label")?.textContent?.trim())).toEqual([
      Resources.panelLabels[PanelId.Explorer],
      Resources.panelLabels[PanelId.Changes]
    ]);
    expect(tabs()[0]!.classList.contains("tr-tab-active")).toBe(true);
    expect(element.querySelector(".tr-tab-active")?.textContent).toContain(Resources.panelLabels[PanelId.Explorer]);
    expect(element.querySelector("tr-sidebar")).not.toBeNull();
    expect(element.querySelector("tr-resize-handle")?.getAttribute("data-edge")).toBe("Right");

    tabs()[1]!.click();
    fixture.detectChanges();
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Changes);
    expect(element.querySelector("tr-sidebar")).toBeNull();
    expect(element.querySelector("tr-changes-panel")).not.toBeNull();

    expect(element.querySelector(".tr-tab-active")?.textContent).toContain(Resources.panelLabels[PanelId.Changes]);
    element.querySelector<HTMLElement>(".tr-tab-active .tr-tab-close")!.click();
    fixture.detectChanges();
    expect(layout.isOpen(PanelId.Changes)).toBe(false);
    expect(tabs()).toHaveLength(1);
    expect(element.querySelector(".tr-tabs")).not.toBeNull();
    expect(element.querySelector(".tr-tab-active")?.textContent).toContain(Resources.panelLabels[PanelId.Explorer]);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Explorer);

    element.querySelector<HTMLButtonElement>(".tr-dock-collapse")!.click();
    fixture.detectChanges();
    expect(layout.dock(DockSide.Left).collapsed).toBe(true);
    expect(element.querySelector(".tr-dock-strip")).not.toBeNull();
    expect(element.querySelector(".tr-tabs")).toBeNull();

    element.querySelector<HTMLButtonElement>(".tr-dock-strip-button")!.click();
    fixture.detectChanges();
    expect(layout.dock(DockSide.Left).collapsed).toBe(false);
    expect(element.querySelector(".tr-tabs")).not.toBeNull();

    layout.movePanel(PanelId.Changes, DockSide.Left);
    fixture.detectChanges();
    expect(tabs()[0]!.dataset["tabIndex"]).toBe("0");
    expect(element.querySelector<HTMLElement>(".tr-tabs")?.dataset["dropSide"]).toBe(DockSide.Left);
    tabs()[1]!.dispatchEvent(new MouseEvent("auxclick", { button: 2, bubbles: true }));
    expect(layout.isOpen(PanelId.Changes)).toBe(true);
    const down = new MouseEvent("mousedown", { button: 1, bubbles: true, cancelable: true });
    tabs()[1]!.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    tabs()[1]!.querySelector(".tr-tab-label")!.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(layout.isOpen(PanelId.Changes)).toBe(false);
    expect(layout.dock(DockSide.Left).activePanel).toBe(PanelId.Explorer);

    layout.closePanel(PanelId.Explorer);
    fixture.detectChanges();
    expect(element.classList.contains("hidden")).toBe(true);
  });
});
