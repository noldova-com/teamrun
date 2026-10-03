/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ModuleState } from "@noldova/teamrun-shell-protocol";

import { DockSide } from "../../../src/app/enums/dock-side";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import type { IWindowPartContext } from "../../../src/app/interfaces/i-window-part-context";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../src/app/models/layout/view-type";
import { ViewContribution } from "../../../src/app/models/view-contribution";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

@Component({ template: "" })
class ContentComponent {
}

class FakeWindowPart implements IWindowPart {
  private readonly log: string[];
  private readonly onActivate: (context: IWindowPartContext) => void;

  public readonly moduleId: string;
  public isDeactivationFailing: boolean = false;

  public constructor(moduleId: string, log: string[], onActivate: (context: IWindowPartContext) => void = () => undefined) {
    this.moduleId = moduleId;
    this.log = log;
    this.onActivate = onActivate;
  }

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    this.log.push(`activate ${this.moduleId}`);
    await Promise.resolve();
    this.onActivate(context);
  }

  public deactivateAsync(): Promise<void> {
    this.log.push(`deactivate ${this.moduleId}`);
    return this.isDeactivationFailing ? Promise.reject(new Error(`${this.moduleId} did not stop`)) : Promise.resolve();
  }
}

describe("WindowPartHostService", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(ContentComponent);
  const status = (id: string, state: ModuleState = ModuleState.Active, cause: string | null = null): object => ({ id, state, ...(cause === null ? {} : { cause }) });
  const source = (moduleId: string, part: IWindowPart | Error, dependencies: readonly string[] = [], views: readonly string[] = []): WindowPartSource =>
    new WindowPartSource(moduleId, `${moduleId[0]?.toUpperCase()}${moduleId.slice(1)}`, dependencies, views, () => part instanceof Error ? Promise.reject(part) : Promise.resolve(part));
  const notesPart = (log: string[]): FakeWindowPart => new FakeWindowPart("notes", log, t => {
    t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
    t.registerDocument(new DocumentContribution("notes.note", load));
    t.openDocument("notes.note", "1", "Note 1");
  });
  let bridge: DesktopBridgeFixture;
  let errors: unknown[];
  let log: string[];

  beforeEach(() => {
    bridge = DesktopBridgeFixture.install();
    errors = [];
    log = [];
  });

  afterEach(() => DesktopBridgeFixture.remove());

  function start(sources: readonly WindowPartSource[], modules: readonly object[]): { host: WindowPartHostService; layout: LayoutService; loads: string[] } {
    bridge.responses.set("shell.modules", { payload: { modules } });
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: WindowPartTokens.sources, useValue: sources }
      ]
    });
    const layout = TestBed.inject(LayoutService);
    const loads: string[] = [];
    const loadAsync = layout.loadAsync.bind(layout);
    vi.spyOn(layout, "loadAsync").mockImplementation(async () => {
      loads.push(layout.registry().views.map(t => t.name).join(","));
      await loadAsync();
    });
    return { host: TestBed.inject(WindowPartHostService), layout, loads };
  }

  it("asks the runtime for its modules once it is ready and loads the layout even with none", async () => {
    const { host, layout, loads } = start([], []);

    await vi.waitFor(() => expect(loads).toEqual([""]));

    expect(bridge.requests).toEqual([["shell.modules", null]]);
    expect(host.failures()).toEqual([]);
    expect(host.generation()).toBe(1);
    expect(layout.layout().documents.tabs).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("activates the active modules' window parts before loading the layout and finds their contributions", async () => {

    const { host, layout, loads } = start([source("notes", notesPart(log), ["tasks"])], [status("tasks"), status("notes")]);
    const labels = TestBed.inject(TabLabelService);

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]));

    expect(log).toEqual(["activate notes"]);
    expect(loads).toEqual(["notes.list"]);
    expect(layout.registry().view("notes.list")).toEqual(new ViewType("notes.list", DockSide.Left, true));
    expect(layout.registry().hasDocument("notes.note")).toBe(true);
    expect(labels.of(new ViewTab("notes.list")).title).toBe("Notes");
    expect(labels.of(new DocumentTab("notes.note", "1")).title).toBe("Note 1");
    expect(host.findContribution(new ViewTab("notes.list"))?.context.moduleId).toBe("notes");
    expect(await host.findContribution(new DocumentTab("notes.note", "2"))?.loadComponent()).toBe(ContentComponent);
    expect(host.findContribution(new ViewTab("notes.outline"))).toBeNull();
    expect(host.findFailure(new ViewTab("notes.list"))).toBeNull();
    expect(errors).toEqual([]);
  });

  it("keeps a failed module's views in their saved places with its name and an error icon, and finds its failure", async () => {

    const { host, layout } = start(
      [source("clock", new Error("unused"), [], ["clock.face"])],
      [status("clock", ModuleState.Failed, "Its runtime part failed to activate."), status("weather", ModuleState.Failed, "Its runtime part failed to activate.")]);
    void TestBed.inject(LayoutStoreService).writeAsync(Layout.createDefault(new ViewRegistry([new ViewType("clock.face", DockSide.Right, true)], [])).toJson());
    const labels = TestBed.inject(TabLabelService);
    const face = new ViewTab("clock.face");

    await vi.waitFor(() => expect(host.failures().length).toBe(2));
    await vi.waitFor(() => expect(layout.layout().groupOf(face)).not.toBeNull());

    expect(host.failures().map(t => [t.moduleId, t.displayName, t.state, t.cause, t.viewNames])).toEqual([
      ["clock", "Clock", ModuleState.Failed, "Its runtime part failed to activate.", ["clock.face"]],
      ["weather", "weather", ModuleState.Failed, "Its runtime part failed to activate.", []]
    ]);
    expect(layout.layout().sideOf(layout.layout().groupOf(face)?.id ?? -1)).toBe(DockSide.Right);
    expect(layout.registry().view("clock.face")).toEqual(new ViewType("clock.face", DockSide.Left, false));
    expect([labels.of(face).title, labels.of(face).icon]).toEqual(["Clock", "error"]);
    expect(host.findFailure(face)?.moduleId).toBe("clock");
    expect(host.findFailure(new DocumentTab("clock.page", "1"))).toBeNull();
    expect(host.findContribution(face)).toBeNull();
    expect(log).toEqual([]);
  });

  it("reports a window part that cannot load or activate as failed, withdraws what it registered and blocks its dependents", async () => {
    const failing = new FakeWindowPart("clock", log, t => {
      t.registerView(new ViewContribution("clock.face", "Clock", "schedule", DockSide.Right, true, load));
      throw new Error("The clock broke.");
    });
    const { host, layout } = start(
      [source("tasks", new Error("No chunk.")), source("clock", failing, [], ["clock.face"]), source("notes", notesPart(log), ["clock"]), source("weather", notesPart(log), ["tasks"])],
      [status("tasks"), status("clock"), status("notes"), status("weather")]);

    await vi.waitFor(() => expect(host.failures().length).toBe(4));

    expect(host.failures().map(t => [t.moduleId, t.state, t.cause])).toEqual([
      ["tasks", ModuleState.Failed, "Its window part could not be loaded."],
      ["clock", ModuleState.Failed, "Its window part failed to activate."],
      ["notes", ModuleState.Blocked, "It depends on clock, which is not active."],
      ["weather", ModuleState.Blocked, "It depends on tasks, which is not active."]
    ]);
    expect(log).toEqual(["activate clock"]);
    expect(host.findContribution(new ViewTab("clock.face"))).toBeNull();
    expect(layout.registry().view("clock.face").isShownByDefault).toBe(false);
    expect(errors.map(t => (t as Error).message)).toEqual(["No chunk.", "The clock broke."]);
  });

  it("still loads the layout when the runtime does not answer with its modules", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    bridge.responses.set("shell.modules", { failure: { code: "Unavailable", message: "TeamRun is not connected to its runtime." } });
    const layout = TestBed.inject(LayoutService);
    const loaded = vi.spyOn(layout, "loadAsync");
    const host = TestBed.inject(WindowPartHostService);

    await vi.waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));

    expect([host.generation(), host.failures()]).toEqual([1, []]);
    expect(errors.map(t => (t as Error).message)).toEqual(["TeamRun is not connected to its runtime."]);
  });

  it("opens documents asked for during activation after the layout loads, reports refused ones, and opens later ones at once", async () => {
    const part = new FakeWindowPart("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      t.openDocument("notes.note", "2", " ");
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);

    await vi.waitFor(() => expect(errors.length).toBe(1));
    host.openDocument("notes", "notes.note", "3", "Note 3", false);

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1"), new DocumentTab("notes.note", "3")]);
  });

  it("keeps a preview asked to be kept before the layout loads, and keeps one at once afterwards", async () => {
    const part = new FakeWindowPart("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "0", "Note 0");
      t.openDocument("notes.note", "1", "Note 1", { preview: true });
      t.keepDocument("notes.note", "1");
      t.openDocument("notes.note", "2", "Note 2", { preview: true });
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(layout.layout().documents.tabs.length).toBe(3));
    const preview = layout.layout().documents.preview;

    host.keepDocument("notes", "notes.note", "2");

    expect(preview).toEqual(new DocumentTab("notes.note", "2"));
    expect(layout.layout().documents.preview).toBeNull();
  });

  it("reports a layout that cannot load and still opens the documents asked for", async () => {
    const { layout } = start([source("notes", notesPart(log))], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockRejectedValue(new Error("The layout could not be read."));

    await vi.waitFor(() => expect(errors.map(t => (t as Error).message)).toEqual(["The layout could not be read."]));

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]);
  });

  it("deactivates its parts in reverse when the runtime is ready again, reactivates them and loads the layout only once", async () => {
    const tasks = new FakeWindowPart("tasks", log);
    const notes = notesPart(log);
    tasks.isDeactivationFailing = true;
    const { host, loads } = start([source("tasks", tasks), source("notes", notes, ["tasks"])], [status("tasks"), status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Ready", details: [] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate tasks", "activate notes", "deactivate notes", "deactivate tasks", "activate tasks", "activate notes"]);
    expect(loads.length).toBe(1);
    expect(errors.map(t => (t as Error).message)).toEqual(["tasks did not stop"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context.moduleId).toBe("notes");
  });

  it("passes requests and events to and from the runtime", async () => {
    const { host } = start([], []);
    const heard: [string, unknown][] = [];
    bridge.responses.set("notes.read", { payload: { title: "Note 1" } });

    const stop = host.onEvent((name, payload) => heard.push([name, payload]));
    bridge.publishEvent("notes.changed", { id: 1 });
    stop();
    bridge.publishEvent("notes.changed", { id: 2 });

    expect(await host.requestAsync("notes.read", { id: 1 })).toEqual({ title: "Note 1" });
    expect(heard).toEqual([["notes.changed", { id: 1 }]]);
  });

  it("does nothing before the runtime is ready", async () => {
    bridge.startup = { kind: "Connecting", details: [] };
    const { host, loads } = start([], []);
    await Promise.resolve();

    bridge.publishStartup({ kind: "WorkInProgress", details: ["Saving"] });

    expect([host.generation(), loads.length, bridge.requests.length]).toEqual([0, 0, 0]);
  });
});
