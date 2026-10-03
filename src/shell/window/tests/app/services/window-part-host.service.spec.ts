/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ModuleState, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { DockSide } from "../../../src/app/enums/dock-side";
import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import type { IWindowPartContext } from "../../../src/app/interfaces/i-window-part-context";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../src/app/models/layout/view-type";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";
import { ViewContribution } from "../../../src/app/models/view-contribution";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { BarItemsService } from "../../../src/app/services/bar-items.service";
import { CommandService } from "../../../src/app/services/command.service";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { SettingsService } from "../../../src/app/services/settings.service";
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
  const source = (
    moduleId: string,
    part: IWindowPart | Error,
    dependencies: readonly string[] = [],
    views: readonly string[] = [`${moduleId}.list`],
    commands: readonly string[] = [],
    statusBarItems: readonly string[] = [],
    topBarActions: readonly string[] = [],
    notifications: readonly string[] = [],
    documents: readonly string[] = [`${moduleId}.note`]): WindowPartSource =>
    new WindowPartSource(moduleId, `${moduleId[0]?.toUpperCase()}${moduleId.slice(1)}`, dependencies, views, documents, commands, statusBarItems, topBarActions, notifications,
      () => part instanceof Error ? Promise.reject(part) : Promise.resolve(part));
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

    expect(bridge.requests).toEqual([["shell.settings", {}], ["shell.modules", null], ["shell.commands", null]]);
    expect(host.failures()).toEqual([]);
    expect(host.generation()).toBe(1);
    expect(layout.layout().documents.tabs).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("reads, sets, resets and follows settings through the settings service", async () => {
    bridge.responses.set("shell.settings", { payload: { definitions: [], entries: [] } });
    const { host, loads } = start([], []);
    const settings = TestBed.inject(SettingsService);
    const heard: string[] = [];
    await vi.waitFor(() => expect(loads).toEqual([""]));
    const stop = host.onSettingChanged(t => heard.push(t.key.name.text));

    await host.writeSettingAsync("shell.mode", "Dark", null);
    await host.resetSettingAsync("shell.mode", null);
    bridge.publishEvent("shell.settingsChanged", { name: "shell.mode", value: "Dark", isSet: true });
    stop();
    bridge.publishEvent("shell.settingsChanged", { name: "shell.mode", value: "Light", isSet: true });

    expect([host.readSetting("shell.mode"), settings.read("shell.mode")]).toEqual(["Light", "Light"]);
    expect(heard).toEqual(["shell.mode"]);
    expect(bridge.requests.slice(-2)).toEqual([["shell.setSetting", { name: "shell.mode", value: "Dark" }], ["shell.resetSetting", { name: "shell.mode" }]]);
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

  it("posts, updates and dismisses notifications through the runtime and reports a dismissal that fails", async () => {
    const post = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    bridge.responses.set("shell.postNotification", { payload: { id: 4 } });
    bridge.responses.set("shell.updateNotification", { payload: null });
    bridge.responses.set("shell.dismissNotification", { failure: { code: "Unavailable", message: "Not connected." } });
    const { host } = start([], []);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    const id = await host.postNotificationAsync(post);
    await host.updateNotificationAsync(id, post);
    host.dismissNotification(id);
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect(id).toBe(4);
    expect(bridge.requests.slice(-3).map(t => [t[0], JSON.stringify(t[1])])).toEqual([
      ["shell.postNotification", JSON.stringify(post.toJson())],
      ["shell.updateNotification", JSON.stringify({ id: 4, post: post.toJson() })],
      ["shell.dismissNotification", JSON.stringify({ id: 4 })]
    ]);
    expect((errors[0] as Error).message).toContain("Not connected.");
  });

  it("advances its generation only once every post its parts made while activating is answered, even one not awaited or refused", async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.responses.set("shell.postNotification", new Promise(resolve => {
      answer = resolve;
    }));
    const refusals: unknown[] = [];
    const post = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    const notes = new FakeWindowPart("notes", log, t => {
      t.postNotificationAsync(post).catch((error: unknown) => refusals.push(error));
    });
    const { host, loads } = start([source("notes", notes, [], [], [], [], [], ["notes.saved"])], [status("notes")]);
    await vi.waitFor(() => expect(bridge.requests.some(t => t[0] === "shell.postNotification")).toBe(true));
    await Promise.resolve();
    const waiting = [host.generation(), loads.length];

    answer({ failure: { code: "Refused", message: "The kind is not declared." } });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(waiting).toEqual([0, 0]);
    expect((refusals[0] as Error).message).toContain("The kind is not declared.");
    expect(errors).toEqual([]);
  });

  it("lists the runtime's and the window parts' commands in module order and runs both", async () => {
    const runs: string[] = [];
    const notes = new FakeWindowPart("notes", log, t => {
      t.registerCommand(new CommandContribution("notes.newNote", "New note", "note_add", "Mod+Alt+N", async u => {
        runs.push(`notes.newNote ${JSON.stringify(u)}`);
        return "opened";
      }));
    });
    bridge.responses.set("shell.commands", { payload: { commands: [{ name: "notes.sync", title: "Sync" }, { name: "clock.tick", title: "Tick", icon: "timer", defaultKey: "Mod+Alt+T" }] } });
    bridge.responses.set("shell.runCommand", { payload: 3 });
    const { host } = start([source("notes", notes, [], [], ["notes.newNote"])], [status("clock"), status("notes")]);
    const commands = TestBed.inject(CommandService);

    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(commands.commands().filter(t => !t.name.startsWith("shell.")).map(t => [t.name, t.title, t.icon, t.defaultKey?.text ?? null])).toEqual([
      ["clock.tick", "Tick", "timer", "Mod+Alt+T"],
      ["notes.sync", "Sync", null, null],
      ["notes.newNote", "New note", "note_add", "Mod+Alt+N"]
    ]);
    expect(await commands.runAsync("clock.tick", { by: 2 })).toBe(3);
    expect(await host.runCommandAsync("notes.newNote", { folder: "inbox" })).toBe("opened");
    expect(bridge.requests.at(-1)).toEqual(["shell.runCommand", { name: "clock.tick", arguments: { by: 2 } }]);
    expect(runs).toEqual(["notes.newNote {\"folder\":\"inbox\"}"]);
    expect([host.isCommandRegistered("clock.tick"), host.isCommandRegistered("notes.newNote"), host.isCommandRegistered("notes.open")]).toEqual([true, true, false]);
  });

  it("shows the window parts' bar items in module order and withdraws a module's items when it no longer activates", async () => {
    const notes = new FakeWindowPart("notes", log, t => {
      t.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));
      t.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));
    });
    const clock = new FakeWindowPart("clock", log, t => {
      t.registerStatusBarItem(new StatusBarItemContribution("clock.ticks", StatusBarSide.Right, new StatusBarItemState("No ticks")));
      t.registerStatusBarItem(new StatusBarItemContribution("clock.zone", StatusBarSide.Left, new StatusBarItemState("UTC")));
      t.registerTopBarAction(new TopBarActionContribution("clock.reset", new TopBarActionState("restart_alt", "Reset", "clock.tick")));
    });
    const { host } = start([
      source("notes", notes, [], [], [], ["notes.count"], ["notes.compose"]),
      source("clock", clock, [], [], [], ["clock.ticks", "clock.zone"], ["clock.reset"])
    ], [status("clock"), status("notes")]);
    const bars = TestBed.inject(BarItemsService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = [bars.leftItems().map(t => t.name), bars.rightItems().map(t => t.name), bars.topBarActions().map(t => t.name)];

    bridge.responses.set("shell.modules", { payload: { modules: [status("clock", ModuleState.Failed, "It broke."), status("notes")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(shown).toEqual([["clock.zone", "notes.count"], ["clock.ticks"], ["clock.reset", "notes.compose"]]);
    expect([bars.leftItems().map(t => t.name), bars.rightItems(), bars.topBarActions().map(t => t.name)]).toEqual([["notes.count"], [], ["notes.compose"]]);
    expect(errors).toEqual([]);
  });

  it("fails a window part that registers a command the runtime part registered, and replaces the commands when the runtime returns", async () => {
    const notes = new FakeWindowPart("notes", log, t => t.registerCommand(new CommandContribution("notes.sync", "Sync", null, null, () => Promise.resolve(null))));
    bridge.responses.set("shell.commands", { payload: { commands: [{ name: "notes.sync", title: "Sync" }] } });
    const { host } = start([source("notes", notes, [], [], ["notes.sync"])], [status("notes")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(host.failures().length).toBe(1));

    bridge.responses.set("shell.commands", { payload: { commands: [] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(errors.map(t => (t as Error).message)).toEqual(["The command notes.sync is already registered."]);
    expect(commands.commands().filter(t => !t.name.startsWith("shell.")).map(t => t.title)).toEqual(["Sync"]);
    expect(host.isCommandRegistered("notes.sync")).toBe(true);
    expect(host.failures().length).toBe(0);
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
