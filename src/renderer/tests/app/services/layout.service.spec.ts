/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { MemoryStorage } from "../../fixtures/memory-storage";
import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelId } from "../../../src/app/enums/panel-id";
import { Layout } from "../../../src/app/models/layout";
import { Resources } from "../../../src/app/resources";
import { LayoutService } from "../../../src/app/services/layout.service";

describe("LayoutService", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = MemoryStorage.install(window);
  });

  it("applies every command, keeps the layout in storage, and resets", () => {
    const service = TestBed.inject(LayoutService);
    const stored = (): Layout => Layout.fromJson(JSON.parse(storage.getItem(Resources.layoutStorageKey) ?? "null"));
    expect(service.dock(DockSide.Left).panels).toEqual([PanelId.Explorer]);
    expect(service.isOpen(PanelId.Activity)).toBe(true);

    service.closePanel(PanelId.Activity);
    expect(service.isOpen(PanelId.Activity)).toBe(false);
    expect(stored().isOpen(PanelId.Activity)).toBe(false);
    service.openPanel(PanelId.Activity);
    service.togglePanel(PanelId.Activity);
    expect(service.isOpen(PanelId.Activity)).toBe(false);
    service.togglePanel(PanelId.Activity);
    service.movePanel(PanelId.Activity, DockSide.Right, 0);
    service.activatePanel(PanelId.Changes);
    expect(stored().dock(DockSide.Right).panels).toEqual([PanelId.Activity, PanelId.Changes]);
    expect(stored().dock(DockSide.Right).activePanel).toBe(PanelId.Changes);
    service.toggleDock(DockSide.Right);
    service.resizeDock(DockSide.Left, 300);
    expect(stored().dock(DockSide.Right).collapsed).toBe(true);
    expect(stored().dock(DockSide.Left).size).toBe(300);

    service.showDocument("c1");
    service.showDocument("c2");
    expect(service.documents()).toEqual(["c1", "c2"]);
    expect(service.activeDocument()).toBe("c2");
    service.closeDocument("c2");
    service.keepDocuments(["c1"]);
    expect(stored().documents.open).toEqual(["c1"]);

    storage.removeItem(Resources.layoutStorageKey);
    service.closeDocument("nope");
    expect(storage.getItem(Resources.layoutStorageKey)).toBeNull();

    service.showDocument("kept");
    service.reset();
    expect(service.layout().docks).toEqual(Layout.createDefault().docks);
    expect(service.documents()).toEqual(["c1", "kept"]);
    expect(stored().dock(DockSide.Left).size).toBeNull();
  });

  it("reads the stored layout and falls back to the default for unreadable storage", () => {
    storage.setItem(Resources.layoutStorageKey, JSON.stringify(Layout.createDefault().resizeDock(DockSide.Bottom, 333).toJson()));
    expect(TestBed.inject(LayoutService).dock(DockSide.Bottom).size).toBe(333);

    TestBed.resetTestingModule();
    storage.setItem(Resources.layoutStorageKey, "{not json");
    expect(TestBed.inject(LayoutService).dock(DockSide.Bottom).size).toBeNull();
  });
});
