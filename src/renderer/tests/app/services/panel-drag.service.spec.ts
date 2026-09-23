/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelId } from "../../../src/app/enums/panel-id";
import { LayoutService } from "../../../src/app/services/layout.service";
import { PanelDragService } from "../../../src/app/services/panel-drag.service";

describe("PanelDragService", () => {
  const pointer = (document: Document, type: string, x: number, y: number, button: number = 0): void => {
    document.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true }));
  };

  it("moves a panel to the dock under the pointer, before or after a tab, and ignores short or aimless drags", () => {
    MemoryStorage.install(window);
    const document = TestBed.inject(DOCUMENT);
    const layout = TestBed.inject(LayoutService);
    const drag = TestBed.inject(PanelDragService);
    const strip = document.createElement("div");
    strip.dataset["dropSide"] = DockSide.Right;
    const tab = document.createElement("button");
    tab.dataset["tabIndex"] = "0";
    tab.getBoundingClientRect = (): DOMRect => new DOMRect(100, 0, 100, 20);
    strip.append(tab);
    const zone = document.createElement("div");
    zone.dataset["dropSide"] = DockSide.Bottom;
    const nothing = document.createElement("div");
    document.body.append(strip, zone, nothing);
    let under: Element | null = null;
    document.elementFromPoint = (): Element | null => under;
    const down = (panel: PanelId): void => drag.begin(panel, new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button: 0 }));

    down(PanelId.Explorer);
    pointer(document, "pointermove", 12, 12);
    expect(drag.dragging()).toBeNull();
    pointer(document, "pointerup", 12, 12);
    expect(layout.dock(DockSide.Left).panels).toEqual([PanelId.Explorer]);

    down(PanelId.Explorer);
    under = tab;
    pointer(document, "pointermove", 120, 10);
    expect(drag.dragging()).toBe(PanelId.Explorer);
    expect(drag.point()).toEqual([120, 10]);
    expect(document.body.classList.contains("tr-dragging-body")).toBe(true);
    expect(drag.isDropBefore(DockSide.Right, 0)).toBe(true);
    expect(drag.isDropBefore(DockSide.Right, 1)).toBe(false);
    pointer(document, "pointermove", 121, 10);
    pointer(document, "pointerup", 121, 10);
    expect(drag.dragging()).toBeNull();
    expect(drag.target()).toBeNull();
    expect(document.body.classList.contains("tr-dragging-body")).toBe(false);
    expect(layout.dock(DockSide.Right).panels).toEqual([PanelId.Explorer, PanelId.Changes]);
    expect(layout.dock(DockSide.Left).panels).toEqual([]);

    down(PanelId.Explorer);
    under = tab;
    pointer(document, "pointermove", 180, 10);
    expect(drag.target()?.index).toBe(1);
    under = strip;
    pointer(document, "pointermove", 300, 10);
    expect(drag.target()?.index).toBe(2);
    under = nothing;
    pointer(document, "pointermove", 400, 10);
    expect(drag.target()).toBeNull();
    under = null;
    pointer(document, "pointermove", 500, 10);
    pointer(document, "pointercancel", 500, 10);
    expect(layout.dock(DockSide.Right).panels).toEqual([PanelId.Explorer, PanelId.Changes]);

    layout.toggleDock(DockSide.Bottom);
    down(PanelId.Changes);
    under = zone;
    pointer(document, "pointermove", 50, 500);
    pointer(document, "pointerup", 50, 500);
    expect(layout.dock(DockSide.Bottom).panels).toEqual([PanelId.Activity, PanelId.Changes]);
    expect(layout.dock(DockSide.Bottom).collapsed).toBe(false);
    drag.begin(PanelId.Activity, new PointerEvent("pointerdown", { clientX: 10, clientY: 10, button: 2 }));
    pointer(document, "pointermove", 300, 10);
    expect(drag.dragging()).toBeNull();
    strip.remove();
    zone.remove();
    nothing.remove();
  });
});
