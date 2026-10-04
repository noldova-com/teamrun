/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { BottomDockSpan } from "../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../src/app/enums/dock-side";
import { PanelEdge } from "../../../src/app/enums/panel-edge";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { LayoutReader } from "../../../src/app/models/layout/layout.reader";
import { ToolbarLayout } from "../../../src/app/models/layout/toolbar-layout";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { SideDropTarget } from "../../../src/app/models/layout/side-drop-target";
import { SplitDropTarget } from "../../../src/app/models/layout/split-drop-target";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { Resources } from "../../../src/resources";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";

describe("LayoutService", () => {
  let bridge: DesktopBridgeFixture;

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
  });

  afterEach(() => {
    DesktopBridgeFixture.remove();
  });

  const registry = LayoutFixture.createRegistry();
  let service: LayoutService;
  let store: LayoutStoreService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(LayoutService);
    store = TestBed.inject(LayoutStoreService);
    service.setRegistry(registry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function prepared(): Layout {
    return Layout.createDefault(registry).openView(LayoutFixture.terminal, registry).openDocument(LayoutFixture.plan).openDocument(LayoutFixture.todo);
  }

  async function loadAsync(layout: Layout): Promise<void> {
    await store.writeAsync(layout.toJson());
    await service.loadAsync();
  }

  it("starts empty and computes the geometry from the registry and the viewport", () => {
    expect(service.registry()).toBe(registry);
    expect(service.layout().groups.map(t => t.id)).toEqual([0]);
    service.setViewport(120, 60);

    expect(service.geometry().middle.width).toBeGreaterThan(0);
    expect(service.geometry().frames.map(t => t.group.id)).toEqual([0]);
  });

  it("loads the saved layout, the default when nothing is saved and the default for an unreadable one", async () => {
    await service.loadAsync();
    expect(service.layout().toJson()).toEqual(Layout.createDefault(registry).toJson());

    await loadAsync(prepared());
    expect(service.layout().toJson()).toEqual(prepared().toJson());

    await store.writeAsync({ version: 99 });
    await service.loadAsync();
    expect(service.layout().toJson()).toEqual(Layout.createDefault(registry).toJson());
  });

  it("passes on a failure other than an unreadable layout", async () => {
    const failure = new Error("read failed");
    vi.spyOn(LayoutReader, "read").mockImplementation(() => {
      throw failure;
    });
    await store.writeAsync({ version: 1 });

    await expect(service.loadAsync()).rejects.toBe(failure);
  });

  it("changes the layout through the model and saves it after a pause", async () => {
    await loadAsync(prepared());
    const terminal = LayoutFixture.terminal;

    service.place(terminal, new SideDropTarget(DockSide.Right));
    expect(service.layout().sideOf(service.layout().groupOf(terminal)?.id ?? -1)).toBe(DockSide.Right);
    service.activate(LayoutFixture.plan);
    expect(service.layout().documents.active).toEqual(LayoutFixture.plan);
    service.close(LayoutFixture.todo);
    expect(service.layout().isOpen(LayoutFixture.todo)).toBe(false);
    service.openDocument(LayoutFixture.settings);
    expect(service.layout().documents.active).toEqual(LayoutFixture.settings);
    service.toggleDock(DockSide.Left);
    expect(service.layout().dock(DockSide.Left).isCollapsed).toBe(true);
    service.resizeDock(DockSide.Left, 30);
    expect(service.layout().dock(DockSide.Left).size).toBe(30);
    expect(await store.readAsync()).toEqual(prepared().toJson());

    vi.advanceTimersByTime(Resources.layoutSaveDelay - 1);
    expect(await store.readAsync()).toEqual(prepared().toJson());
    vi.advanceTimersByTime(1);
    await vi.waitFor(async () => expect(await store.readAsync()).toEqual(service.layout().toJson()));
  });

  it("keeps the toolbar arrangement it is given and returns to the declared one on a reset", async () => {
    await loadAsync(prepared());

    service.setToolbars(new ToolbarLayout([["notes.main"]], ["notes.spare"]));

    expect(service.layout().toolbars.rows).toEqual([["notes.main"]]);
    expect(service.layout().toolbars.hidden).toEqual(["notes.spare"]);
    service.reset();
    expect(service.layout().toolbars.isEmpty).toBe(true);
  });

  it("closes several tabs at once, passing over a tab that is not open", async () => {
    await loadAsync(prepared());

    service.closeTabs([LayoutFixture.plan, LayoutFixture.settings, LayoutFixture.todo]);

    expect(service.layout().documents.tabs).toEqual([]);
    expect(service.layout().isOpen(LayoutFixture.files)).toBe(true);
  });

  it("makes the group of an activated or focused tab the current group, keeping it when an absent tab is activated", async () => {
    await loadAsync(prepared());
    expect(service.currentGroup()).toBe(service.layout().documents);

    service.activate(LayoutFixture.files);
    const left = service.layout().groupOf(LayoutFixture.files);
    service.activate(new ViewTab("gone.view"));

    expect(service.currentGroup()).toBe(left);
    service.focusGroup(service.layout().documents.id);
    expect(service.currentGroup()).toBe(service.layout().documents);
  });

  it("numbers each tab it reveals by opening or activating it", async () => {
    expect(service.revealed()).toBeNull();
    await loadAsync(prepared());
    const start = service.revealed()?.sequence ?? 0;

    service.openDocument(LayoutFixture.plan);
    const opened = service.revealed();
    service.activate(LayoutFixture.files);

    expect([opened?.tab.key, opened?.sequence]).toEqual([LayoutFixture.plan.key, start + 1]);
    expect([service.revealed()?.tab.key, service.revealed()?.sequence]).toEqual([LayoutFixture.files.key, start + 2]);
  });

  it("resizes a split through its handle", async () => {
    await loadAsync(prepared());
    service.setViewport(160, 80);
    service.place(LayoutFixture.terminal, new SplitDropTarget(0, PanelEdge.Right));
    const handle = service.geometry().handles[0];
    if (handle === undefined)
      throw new Error("The split has no handle.");

    service.resizeSplit(handle, handle.leadingLength + 4);

    expect(service.geometry().handles[0]?.leadingLength).toBeCloseTo(handle.leadingLength + 4);
  });

  it("opens a document as a preview only while Preview tabs is on, even when a module asks for one, and turning it off keeps the open preview", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    const third = new DocumentTab("notes.note", "third");
    const fourth = new DocumentTab("notes.note", "fourth");
    const setPreviewTabs = (value: boolean): void => {
      bridge.publishEvent("shell.settingsChanged", { name: "shell.previewTabs", value, isSet: true });
      TestBed.tick();
    };
    await loadAsync(prepared());

    service.openDocument(LayoutFixture.settings, true);
    expect([service.previewTabs(), service.layout().documents.preview]).toEqual([true, LayoutFixture.settings]);
    setPreviewTabs(false);
    expect([service.previewTabs(), service.layout().documents.preview, service.layout().isOpen(LayoutFixture.settings)]).toEqual([false, null, true]);
    service.openDocument(readme, true);
    expect([service.layout().documents.preview, service.layout().documents.tabs.at(-1)]).toEqual([null, readme]);
    service.openDocument(LayoutFixture.settings);
    expect(service.layout().documents.preview).toBeNull();
    setPreviewTabs(true);
    service.openDocument(third, true);
    service.openDocument(fourth, true);
    expect([service.previewTabs(), service.layout().documents.preview, service.layout().isOpen(third), service.layout().isOpen(readme)]).toEqual([true, fourth, false, true]);
  });

  it("keeps the preview of a layout loaded while Preview tabs is off", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    bridge.publishEvent("shell.settingsChanged", { name: "shell.previewTabs", value: false, isSet: true });
    TestBed.tick();

    await loadAsync(prepared().openDocument(readme, true));
    TestBed.tick();

    expect([service.layout().isOpen(readme), service.layout().documents.preview]).toEqual([true, null]);
  });

  it("restores which documents group is active, so a document opens there", async () => {
    const readme = new DocumentTab("notes.note", "readme");
    const split = prepared().splitGroup(LayoutFixture.todo, 0, PanelEdge.Right);
    const first = split.documentGroups[0];
    await loadAsync(split.focusDocuments(first?.id ?? -1));

    expect([service.layout().documents.id, service.layout().documentGroups.length]).toEqual([first?.id, 2]);
    service.openDocument(readme);
    expect(service.layout().groupOf(readme)?.id).toBe(first?.id);
  });

  it("spans the bottom dock across the window or keeps it between the side docks", async () => {
    await loadAsync(prepared().openView(LayoutFixture.terminal, LayoutFixture.createRegistry()));
    service.setViewport(160, 80);
    const full = service.geometry().dock(DockSide.Bottom).width;

    service.setBottomSpan(BottomDockSpan.Between);

    expect(service.layout().bottomSpan).toBe(BottomDockSpan.Between);
    expect(service.geometry().dock(DockSide.Bottom).width).toBeLessThan(full);
  });

  it("resets the layout to the default and keeps open documents", async () => {
    await loadAsync(prepared().dockOnSide(LayoutFixture.files, DockSide.Right));

    service.reset();

    expect(service.layout().dock(DockSide.Left).root?.groups.flatMap(t => t.tabs)).toEqual([LayoutFixture.files]);
    expect(service.layout().documents.tabs).toEqual([LayoutFixture.plan, LayoutFixture.todo]);
  });

  it("saves at once on request, ignores changes that change nothing and stops its timer when destroyed", async () => {
    await loadAsync(prepared());
    service.activate(LayoutFixture.plan);
    await service.saveAsync();
    expect(await store.readAsync()).toEqual(service.layout().toJson());

    const before = service.layout();
    service.activate(LayoutFixture.plan);
    expect(service.layout()).toBe(before);

    service.close(LayoutFixture.todo);
    const saved = await store.readAsync();
    TestBed.resetTestingModule();
    vi.advanceTimersByTime(Resources.layoutSaveDelay);
    expect(await store.readAsync()).toEqual(saved);
  });

  it("saves nothing before a layout was loaded, so a window that never loaded cannot replace the kept layout", async () => {
    const write = vi.spyOn(store, "writeAsync");

    service.toggleDock(DockSide.Left);
    vi.advanceTimersByTime(Resources.layoutSaveDelay);
    await service.saveAsync();

    expect(write).not.toHaveBeenCalled();
  });

  it("stays unloaded when the kept layout cannot be read, and passes the failure on", async () => {
    const failure = new Error("The runtime is not connected.");
    vi.spyOn(store, "readAsync").mockRejectedValue(failure);
    const write = vi.spyOn(store, "writeAsync");

    await expect(service.loadAsync()).rejects.toBe(failure);
    service.toggleDock(DockSide.Left);
    vi.advanceTimersByTime(Resources.layoutSaveDelay);
    await service.saveAsync();

    expect(write).not.toHaveBeenCalled();
  });

  it("writes only a layout that changed since it was loaded or last saved", async () => {
    await loadAsync(prepared());
    const write = vi.spyOn(store, "writeAsync");

    await service.saveAsync();
    service.activate(LayoutFixture.plan);
    await service.saveAsync();
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(1);
  });

  it("reports a save after a pause that fails, and the next change saves again", async () => {
    await loadAsync(prepared());
    const failure = new Error("The runtime refused the layout.");
    const handled = vi.spyOn(TestBed.inject(ErrorHandler), "handleError").mockImplementation(() => undefined);
    const write = vi.spyOn(store, "writeAsync").mockRejectedValueOnce(failure);

    service.activate(LayoutFixture.plan);
    vi.advanceTimersByTime(Resources.layoutSaveDelay);
    await vi.waitFor(() => expect(handled).toHaveBeenCalledWith(failure));
    service.close(LayoutFixture.todo);
    vi.advanceTimersByTime(Resources.layoutSaveDelay);

    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(write.mock.calls[1]?.[0]).toEqual(service.layout().toJson());
  });

  it("writes one layout at a time, so the newest layout is always the last one written", async () => {
    await loadAsync(prepared());
    let finishFirst: () => void = () => undefined;
    const written: unknown[] = [];
    vi.spyOn(store, "writeAsync").mockImplementation(layout => {
      written.push(layout);
      return written.length === 1 ? new Promise<boolean>(resolve => {
        finishFirst = (): void => resolve(true);
      }) : Promise.resolve(true);
    });

    service.activate(LayoutFixture.plan);
    const first = service.saveAsync();
    await vi.waitFor(() => expect(written.length).toBe(1));
    service.toggleDock(DockSide.Left);
    const second = service.saveAsync();
    await Promise.resolve();
    expect(written.length).toBe(1);
    finishFirst();
    await Promise.all([first, second]);

    expect(written.length).toBe(2);
    expect(written[1]).toEqual(service.layout().toJson());
  });

  it("keeps saving after a failed write", async () => {
    await loadAsync(prepared());
    const failure = new Error("The runtime refused the layout.");
    const write = vi.spyOn(store, "writeAsync").mockRejectedValueOnce(failure);

    service.activate(LayoutFixture.plan);
    await expect(service.saveAsync()).rejects.toBe(failure);
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(2);
  });

  it("waits while the runtime is not ready and writes the newest layout once when it is ready again", async () => {
    await loadAsync(prepared());
    const write = vi.spyOn(store, "writeAsync");
    bridge.publishStartup({ kind: "Connecting", details: [] });
    TestBed.tick();

    service.activate(LayoutFixture.plan);
    await vi.advanceTimersByTimeAsync(Resources.layoutSaveDelay);
    service.toggleDock(DockSide.Left);
    await service.saveAsync();
    expect(write).not.toHaveBeenCalled();

    bridge.publishStartup({ kind: "Ready", details: [] });
    TestBed.tick();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    bridge.publishStartup({ kind: "Ready", details: [] });
    TestBed.tick();
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toEqual(service.layout().toJson());
  });

  it("keeps a layout the runtime was not there to take and writes it when the runtime is ready again", async () => {
    await loadAsync(prepared());
    const write = vi.spyOn(store, "writeAsync").mockResolvedValueOnce(false);

    service.activate(LayoutFixture.plan);
    await service.saveAsync();
    bridge.publishStartup({ kind: "Connecting", details: [] });
    TestBed.tick();
    bridge.publishStartup({ kind: "Ready", details: [] });
    TestBed.tick();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    await service.saveAsync();

    expect(write).toHaveBeenCalledTimes(2);
    expect(await store.readAsync()).toEqual(service.layout().toJson());
  });
});
