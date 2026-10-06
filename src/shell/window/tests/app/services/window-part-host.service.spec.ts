/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, ErrorHandler, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { ModuleState, type ModuleStatus, NotificationPost, NotificationSeverity, QualifiedName, SettingScope } from "@noldova/teamrun-shell-protocol";

import { ModulesComponent } from "../../../src/app/components/modules/modules.component";
import { SettingsComponent } from "../../../src/app/components/settings/settings.component";
import { ContentPadding } from "../../../src/app/enums/content-padding";
import { DockSide } from "../../../src/app/enums/dock-side";
import { LinkNotOpenedException } from "../../../src/app/exceptions/link-not-opened.exception";
import { RuntimeDisconnectedException } from "../../../src/app/exceptions/runtime-disconnected.exception";
import { WindowPartFailureException } from "../../../src/app/exceptions/window-part-failure.exception";
import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { BuildTokens } from "../../../src/app/models/build-tokens";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import { DocumentHeading } from "../../../src/app/models/document-heading";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { ViewType } from "../../../src/app/models/layout/view-type";
import type { MenuItem } from "../../../src/app/models/menu-item";
import type { NotificationHandle } from "../../../src/app/models/notification-handle";
import { ShellDocuments } from "../../../src/app/models/shell-documents";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";
import { ViewBadge } from "../../../src/app/models/view-badge";
import { ViewContribution } from "../../../src/app/models/view-contribution";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { BarItemsService } from "../../../src/app/services/bar-items.service";
import { CommandService } from "../../../src/app/services/command.service";
import { LayoutStoreService } from "../../../src/app/services/layout-store.service";
import { LayoutService } from "../../../src/app/services/layout.service";
import { MenuService } from "../../../src/app/services/menu.service";
import { ModuleStatusService } from "../../../src/app/services/module-status.service";
import { TabLabelService } from "../../../src/app/services/tab-label.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { SettingsService } from "../../../src/app/services/settings.service";
import { WindowPartHostService } from "../../../src/app/services/window-part-host.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { WindowPartFixture } from "../../fixtures/window-part.fixture";

@Component({ template: "" })
class ContentComponent {
}

describe("WindowPartHostService", () => {
  const load = (): Promise<Type<unknown>> => Promise.resolve(ContentComponent);
  const status = (id: string, state: ModuleState = ModuleState.Active, cause: string | null = null, dependencies: readonly string[] = []): object => ({
    id, version: "0.0.1", displayName: `${id[0]?.toUpperCase()}${id.slice(1)}`, description: "Used by the tests.", dependencies, contributes: {}, state, ...(cause === null ? {} : { cause })
  });
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
    new WindowPartSource(moduleId, dependencies, views, documents, commands, statusBarItems, topBarActions, notifications,
      () => part instanceof Error ? Promise.reject(part) : Promise.resolve(part));
  const notesPart = (log: string[]): WindowPartFixture => new WindowPartFixture("notes", log, t => {
    t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
    t.registerDocument(new DocumentContribution("notes.note", load));
    t.openDocument("notes.note", "1", "Note 1");
  });
  const clockPart = (log: string[]): WindowPartFixture =>
    new WindowPartFixture("clock", log, t => t.registerView(new ViewContribution("clock.list", "Clock", "schedule", DockSide.Right, true, load)));
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
        { provide: BuildTokens.sources, useValue: sources }
      ]
    });
    const layout = TestBed.inject(LayoutService);
    const loads: string[] = [];
    const loadAsync = layout.loadAsync.bind(layout);
    vi.spyOn(layout, "loadAsync").mockImplementation(async () => {
      loads.push(layout.registry().views.map(t => t.name).join(","));
      return loadAsync();
    });
    return { host: TestBed.inject(WindowPartHostService), layout, loads };
  }

  function holdRead(): { read: ReturnType<typeof vi.spyOn>; release: (outcome: JsonValue | null | Error) => void } {
    let settle: (outcome: JsonValue | null | Error) => void = () => undefined;
    const held = new Promise<JsonValue | null>((resolve, reject) => {
      settle = t => t instanceof Error ? reject(t) : resolve(t);
    });
    const read = vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValueOnce(held);
    return { read, release: settle };
  }

  it("asks the runtime for its modules once it is ready and loads the layout even with none", async () => {
    const { host, layout, loads } = start([], []);

    await vi.waitFor(() => expect(loads).toEqual([""]));

    expect(bridge.requests).toEqual([["shell.settings", {}], ["shell.modules", null], ["shell.commands", null]]);
    expect([TestBed.inject(ModuleStatusService).modules(), host.failures()]).toEqual([[], []]);
    expect(host.generation()).toBe(1);
    expect(layout.layout().documents.tabs).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("registers the shell's Settings and Modules documents before any module's, finds them without a part's context and labels them", async () => {
    const { host, layout, loads } = start([], []);
    await vi.waitFor(() => expect(loads).toEqual([""]));
    const labels = TestBed.inject(TabLabelService);

    const settings = host.findContribution(new DocumentTab("shell.settings"));
    const modules = host.findContribution(new DocumentTab("shell.modules"));

    expect(["shell.settings", "shell.modules"].map(t => layout.registry().hasDocument(t))).toEqual([true, true]);
    expect([settings?.context, await settings?.loadComponent(), modules?.context, await modules?.loadComponent()]).toEqual([null, SettingsComponent, null, ModulesComponent]);
    expect(["shell.settings", "shell.modules"].map(t => labels.of(new DocumentTab(t))).map(t => [t.title, t.icon])).toEqual([["Settings", "settings"], ["Modules", "extension"]]);
  });

  it("lists the save steps of the active parts that registered any, by module", async () => {
    const save = (): Promise<void> => Promise.resolve();
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerSave(save);
    });
    const { host } = start([source("notes", notes), source("clock", clockPart(log))], [status("notes"), status("clock")]);

    await vi.waitFor(() => expect(log).toEqual(["activate notes", "activate clock"]));

    await vi.waitFor(() => expect([...host.listSaves()]).toEqual([["notes", [save]]]));
  });

  it("reads, sets, resets and follows settings through the settings service", async () => {
    bridge.responses.set("shell.settings", { payload: { definitions: [], entries: [] } });
    const { host, loads } = start([], []);
    const settings = TestBed.inject(SettingsService);
    const heard: string[] = [];
    await vi.waitFor(() => expect(loads).toEqual([""]));
    const stop = host.onSettingChanged(t => heard.push(t.key.name.text));

    bridge.responses.set("shell.readSetting", { payload: { name: "shell.mode", value: "Dark", isSet: false } });
    const entry = await host.readSettingAsync("shell.mode", new SettingScope(QualifiedName.parse("notes.note"), "n1"));
    await host.writeSettingAsync("shell.mode", "Dark", null);
    await host.resetSettingAsync("shell.mode", null);
    bridge.publishEvent("shell.settingsChanged", { name: "shell.mode", value: "Dark", isSet: true });
    stop();
    bridge.publishEvent("shell.settingsChanged", { name: "shell.mode", value: "Light", isSet: true });

    expect([host.readSetting("shell.mode"), settings.read("shell.mode")]).toEqual(["Light", "Light"]);
    expect(heard).toEqual(["shell.mode"]);
    expect([entry.name.text, entry.value, entry.isSet]).toEqual(["shell.mode", "Dark", false]);
    expect(bridge.requests.slice(-3)).toEqual([
      ["shell.readSetting", { name: "shell.mode", scope: { name: "notes.note", id: "n1" } }],
      ["shell.setSetting", { name: "shell.mode", value: "Dark" }],
      ["shell.resetSetting", { name: "shell.mode" }]
    ]);
  });

  it("activates the active modules' window parts before loading the layout and finds their contributions", async () => {

    const { host, layout, loads } = start([source("notes", notesPart(log), ["tasks"])], [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"])]);
    const labels = TestBed.inject(TabLabelService);

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]));

    expect(log).toEqual(["activate notes"]);
    expect(loads).toEqual(["notes.list"]);
    expect(layout.registry().view("notes.list")).toEqual(new ViewType("notes.list", DockSide.Left, true));
    expect(layout.registry().hasDocument("notes.note")).toBe(true);
    expect(labels.of(new ViewTab("notes.list")).title).toBe("Notes");
    expect(labels.of(new DocumentTab("notes.note", "1")).title).toBe("Note 1");
    expect(host.findContribution(new ViewTab("notes.list"))?.context?.moduleId).toBe("notes");
    expect(await host.findContribution(new DocumentTab("notes.note", "2"))?.loadComponent()).toBe(ContentComponent);
    expect(host.findContribution(new ViewTab("notes.outline"))).toBeNull();
    expect(host.findFailure(new ViewTab("notes.list"))).toBeNull();
    expect(errors).toEqual([]);
  });

  it("pads each contribution as it declares, else as its module chose, else as the shell does, and lays out Settings and Modules edge to edge", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load, ContentPadding.Default));
      t.registerDocument(new DocumentContribution("notes.note", load));
    });
    notes.padding = ContentPadding.None;
    const { host, loads } = start([source("notes", notes), source("clock", clockPart(log))], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(loads).toHaveLength(1));

    expect([new ViewTab("notes.list"), new DocumentTab("notes.note", "1"), new ViewTab("clock.list"), ShellDocuments.settingsTab, ShellDocuments.modulesTab].map(t => host.findContribution(t)?.padding))
      .toEqual([ContentPadding.Default, ContentPadding.None, ContentPadding.Default, ContentPadding.None, ContentPadding.None]);
  });

  it("names the reported modules while their window parts activate and lists them for the Modules document once activation ends", async () => {
    let during: readonly unknown[] = [];
    const part = new WindowPartFixture("notes", log, () => {
      const statuses = TestBed.inject(ModuleStatusService);
      during = [statuses.nameOf("tasks"), statuses.nameOf("notes"), statuses.modules()];
    });
    const { loads } = start([source("notes", part)], [status("tasks"), status("notes")]);

    await vi.waitFor(() => expect(loads).toHaveLength(1));

    expect(log).toEqual(["activate notes"]);
    expect(during).toEqual(["Tasks", "Notes", []]);
    expect(TestBed.inject(ModuleStatusService).modules().map(t => t.id)).toEqual(["tasks", "notes"]);
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
      ["weather", "Weather", ModuleState.Failed, "Its runtime part failed to activate.", []]
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
    const failing = new WindowPartFixture("clock", log, t => {
      t.registerView(new ViewContribution("clock.face", "Clock", "schedule", DockSide.Right, true, load));
      throw new Error("The clock broke.");
    });
    const { host, layout } = start(
      [source("tasks", new Error("No chunk.")), source("clock", failing, [], ["clock.face"]), source("notes", notesPart(log), ["clock"]), source("weather", notesPart(log), ["tasks"])],
      [status("tasks"), status("clock"), status("notes", ModuleState.Active, null, ["clock"]), status("weather", ModuleState.Active, null, ["tasks"]), status("alarm")]);

    await vi.waitFor(() => expect(host.failures().length).toBe(4));

    expect(TestBed.inject(ModuleStatusService).modules().map(t => [t.id, t.state, t.blockedBy, t.description])).toEqual([
      ["tasks", ModuleState.Failed, null, "Used by the tests."],
      ["clock", ModuleState.Failed, null, "Used by the tests."],
      ["notes", ModuleState.Blocked, "clock", "Used by the tests."],
      ["weather", ModuleState.Blocked, "tasks", "Used by the tests."],
      ["alarm", ModuleState.Active, null, "Used by the tests."]
    ]);
    expect(host.failures().map(t => [t.moduleId, t.state, t.cause])).toEqual([
      ["tasks", ModuleState.Failed, "Its window part could not be loaded."],
      ["clock", ModuleState.Failed, "Its window part failed to activate."],
      ["notes", ModuleState.Blocked, "It depends on clock, which is not active."],
      ["weather", ModuleState.Blocked, "It depends on tasks, which is not active."]
    ]);
    expect(log).toEqual(["activate clock"]);
    expect(host.findContribution(new ViewTab("clock.face"))).toBeNull();
    expect(layout.registry().view("clock.face").isShownByDefault).toBe(false);
    expect(errors.map(t => [(t as WindowPartFailureException).moduleId, (t as Error).message, ((t as Error).cause as Error).message])).toEqual([
      ["tasks", "Its window part could not be loaded.", "No chunk."],
      ["clock", "Its window part failed to activate.", "The clock broke."]
    ]);
  });

  it("posts, updates and dismisses notifications through the runtime and reports a dismissal that fails", async () => {
    const post = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    bridge.responses.set("shell.postNotification", { payload: { id: "n4" } });
    bridge.responses.set("shell.updateNotification", { payload: null });
    bridge.responses.set("shell.dismissNotification", { failure: { code: "Unavailable", message: "The runtime did not answer shell.dismissNotification in time." } });
    const { host } = start([], []);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    const id = await host.postNotificationAsync(post);
    const isUpdated = await host.updateNotificationAsync(id, post);
    host.dismissNotification(id);
    await vi.waitFor(() => expect(errors.length).toBe(1));

    expect([id, isUpdated]).toEqual(["n4", true]);
    expect(bridge.requests.slice(-3).map(t => [t[0], JSON.stringify(t[1])])).toEqual([
      ["shell.postNotification", JSON.stringify(post.toJson())],
      ["shell.updateNotification", JSON.stringify({ id: "n4", post: post.toJson() })],
      ["shell.dismissNotification", JSON.stringify({ id: "n4" })]
    ]);
    expect((errors[0] as Error).message).toContain("did not answer");
  });

  it("advances its generation only once every post its parts made while activating is answered, even one not awaited or refused", async () => {
    let answer: (value: unknown) => void = () => undefined;
    bridge.responses.set("shell.postNotification", new Promise(resolve => {
      answer = resolve;
    }));
    const refusals: unknown[] = [];
    const post = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    const notes = new WindowPartFixture("notes", log, t => {
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
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerCommand(new CommandContribution("notes.newNote", "New note", "note_add", "Mod+Alt+N", async u => {
        runs.push(`notes.newNote ${JSON.stringify(u)}`);
        return "opened";
      }));
    });
    bridge.responses.set("shell.commands", { payload: { commands: [{ name: "notes.sync", title: "Sync" }, { name: "clock.tick", title: "Tick", icon: "timer", defaultKey: "Mod+Alt+T" }], sequence: 2 } });
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

  it("follows the runtime commands' enabled and checked state from the first answer and each newer change", async () => {
    const tick = (isEnabled: boolean): object => ({ name: "clock.tick", title: "Tick", ...isEnabled ? {} : { isEnabled } });
    const pause = (isChecked: boolean): object => ({ name: "clock.pause", title: "Pause", isChecked });
    bridge.responses.set("shell.commands", { payload: { commands: [tick(false), pause(false)], sequence: 2 } });
    const { host } = start([], [status("clock")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const state = (): readonly unknown[] => ["clock.tick", "clock.pause"].map(t => [commands.isEnabled(t), commands.commands().find(u => u.name === t)?.isChecked?.(null) ?? null]);
    const first = state();

    bridge.publishEvent("shell.commandsChanged", { commands: [tick(true), pause(true)], sequence: 3 });
    const changed = state();
    bridge.publishEvent("shell.commandsChanged", { commands: [tick(false), pause(false)], sequence: 1 });
    bridge.publishEvent("notes.changed", { commands: [], sequence: 9 });
    bridge.publishEvent("shell.commandsChanged", { commands: [tick(false)] });
    const afterOlder = state();
    bridge.publishEvent("shell.commandsChanged", { commands: [pause(true)], sequence: 4 });

    expect(first).toEqual([[false, null], [true, false]]);
    expect(changed).toEqual([[true, null], [true, true]]);
    expect(afterOlder).toEqual(changed);
    expect(state()).toEqual([[false, null], [true, true]]);
    expect(errors.map(t => (t as Error).name)).toEqual(["JsonException"]);
  });

  it("keeps a change that arrives before the first answer over the older answer", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    const answer = new Promise<unknown>(t => {
      resolve = t;
    });
    bridge.responses.set("shell.commands", answer);
    const { host } = start([], [status("clock")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(bridge.requests.map(t => t[0])).toContain("shell.commands"));

    bridge.publishEvent("shell.commandsChanged", { commands: [{ name: "clock.tick", title: "Tick", isEnabled: false }], sequence: 5 });
    resolve({ payload: { commands: [{ name: "clock.tick", title: "Tick" }], sequence: 4 } });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(commands.isEnabled("clock.tick")).toBe(false);
    expect(errors).toEqual([]);
  });

  it("disables the runtime commands while the runtime is away and takes a new runtime's first answer whatever its sequence", async () => {
    bridge.responses.set("shell.commands", { payload: { commands: [{ name: "clock.tick", title: "Tick" }], sequence: 7 } });
    const { host } = start([], [status("clock")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const before = commands.isEnabled("clock.tick");

    bridge.responses.set("shell.commands", { payload: { commands: [{ name: "clock.tick", title: "Tick" }, { name: "clock.reset", title: "Reset" }], sequence: 1 } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    const away = commands.isEnabled("clock.tick");
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect([before, away]).toEqual([true, false]);
    expect([commands.isEnabled("clock.tick"), commands.isEnabled("clock.reset")]).toEqual([true, true]);
  });

  it("shows the window parts' bar items in module order and withdraws a module's items when it no longer activates", async () => {
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));
      t.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));
    });
    const clock = new WindowPartFixture("clock", log, t => {
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
    const shown = [bars.leftItems().map(t => t.name), bars.rightItems().map(t => t.name), bars.endActions().map(t => t.name)];

    bridge.responses.set("shell.modules", { payload: { modules: [status("clock", ModuleState.Failed, "It broke."), status("notes")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(shown).toEqual([["clock.zone", "notes.count"], ["clock.ticks"], ["clock.reset", "notes.compose"]]);
    expect([bars.leftItems().map(t => t.name), bars.rightItems(), bars.endActions().map(t => t.name)]).toEqual([["notes.count"], [], ["notes.compose"]]);
    expect(errors).toEqual([]);
  });

  it("fails a window part that registers a command the runtime part registered, and replaces the commands when the runtime returns", async () => {
    const notes = new WindowPartFixture("notes", log, t => t.registerCommand(new CommandContribution("notes.sync", "Sync", null, null, () => Promise.resolve(null))));
    bridge.responses.set("shell.commands", { payload: { commands: [{ name: "notes.sync", title: "Sync" }], sequence: 1 } });
    const { host } = start([source("notes", notes, [], [], ["notes.sync"])], [status("notes")]);
    const commands = TestBed.inject(CommandService);
    await vi.waitFor(() => expect(host.failures().length).toBe(1));

    bridge.responses.set("shell.commands", { payload: { commands: [], sequence: 0 } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(errors.map(t => [(t as WindowPartFailureException).moduleId, ((t as Error).cause as Error).message])).toEqual([["notes", "The command notes.sync is already registered."]]);
    expect(commands.commands().filter(t => !t.name.startsWith("shell.")).map(t => t.title)).toEqual(["Sync"]);
    expect(host.isCommandRegistered("notes.sync")).toBe(true);
    expect(host.failures().length).toBe(0);
  });

  it("still loads the layout when the runtime does not answer with its modules", async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    bridge.responses.set("shell.modules", { failure: { code: "Unavailable", message: "The runtime did not answer shell.modules in time." } });
    const layout = TestBed.inject(LayoutService);
    const loaded = vi.spyOn(layout, "loadAsync");
    const host = TestBed.inject(WindowPartHostService);

    await vi.waitFor(() => expect(loaded).toHaveBeenCalledTimes(1));

    expect([host.generation(), host.failures()]).toEqual([1, []]);
    expect(errors.map(t => (t as Error).message)).toEqual(["The runtime did not answer shell.modules in time."]);
  });

  it("opens documents asked for during activation after the layout loads, reports refused ones, and opens later ones at once", async () => {
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      t.openDocument("notes.page", "2", "Page");
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);

    await vi.waitFor(() => expect(errors.length).toBe(1));
    host.openDocument("notes", "notes.note", "3", new DocumentHeading("Note 3"), false);

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1"), new DocumentTab("notes.note", "3")]);
  });

  it("changes the heading of a document opened during activation once it opens, and of an open one at once", async () => {
    const note = new DocumentTab("notes.note", "1");
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      t.openDocument("notes.note", "1", "Note 1");
      t.updateDocument("notes.note", "1", { breadcrumb: ["Notes"] });
      t.updateDocument("notes.note", "2", { title: "Note 2" });
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note]));
    const opened = labels.headingOf(note).text;

    host.updateDocument("notes", "notes.note", "1", "Plan", null);

    expect([opened, labels.headingOf(note).text]).toEqual(["Notes › Note 1", "Notes › Plan"]);
    expect(errors).toEqual([]);
  });

  it("restores the saved documents a part opens during activation with the saved active one, leaves out one the layout lacks, and opens it when asked later", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("1")).openDocument(note("2")).openDocument(note("3")).activate(note("1"));
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "2", "3", "4"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockResolvedValue(saved.toJson());
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toHaveLength(3));
    const restored = [layout.layout().documents.tabs, layout.layout().documents.active];

    host.openDocument("notes", "notes.note", "4", new DocumentHeading("Note 4"), false);

    expect(restored).toEqual([[note("1"), note("2"), note("3")], note("1")]);
    expect(TestBed.inject(TabLabelService).of(note("3")).title).toBe("Note 3");
    expect([layout.layout().documents.tabs, layout.layout().documents.active]).toEqual([[note("1"), note("2"), note("3"), note("4")], note("4")]);
  });

  it("opens a document asked for after activation but before the saved layout is read, and still leaves out a start open the layout lacks", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note("1")).openDocument(note("2"));
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "3"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    let read: (value: JsonValue) => void = () => undefined;
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockReturnValue(new Promise(resolve => read = resolve));
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    host.openDocument("notes", "notes.note", "4", new DocumentHeading("Note 4"), false);
    host.keepDocument("notes", "notes.note", "1");
    host.updateDocument("notes", "notes.note", "1", "First note", ["Notes"]);
    read(saved.toJson());

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note("1"), note("2"), note("4")]));
    expect(layout.layout().documents.active).toEqual(note("4"));
    expect(TestBed.inject(TabLabelService).headingOf(note("1")).text).toBe("Notes › First note");
  });

  it("keeps the active document when the runtime is ready again, and adds a document the parts open while reactivating that is not open", async () => {
    const note = (instance: string): DocumentTab => new DocumentTab("notes.note", instance);
    const part = new WindowPartFixture("notes", log, t => {
      t.registerDocument(new DocumentContribution("notes.note", load));
      ["1", "2"].forEach(u => t.openDocument("notes.note", u, `Note ${u}`));
    });
    const { host, layout } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    expect(layout.layout().documents.active).toEqual(note("2"));
    layout.close(note("2"));
    layout.activate(note("1"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(layout.layout().documents.tabs).toEqual([note("1"), note("2")]);
    expect(layout.layout().documents.active).toEqual(note("1"));
  });

  it("keeps a preview asked to be kept before the layout loads, and keeps one at once afterwards", async () => {
    const part = new WindowPartFixture("notes", log, t => {
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

  it("shows a registered document or else a view by name in a dialog, with its instance and title", async () => {
    const { host } = start([source("notes", notesPart(log))], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = vi.spyOn(TestBed.inject(ViewDialogService), "showAsync").mockResolvedValue();

    await host.showInDialogAsync("notes.note", "2", "Note 2");
    await host.showInDialogAsync("notes.list", null, null);
    await host.showInDialogAsync("notes.list", "3", null);
    await host.showInDialogAsync("shell.settings", null, null);

    await expect(host.showInDialogAsync("Notes", null, null)).rejects.toThrowError(ArgumentException);
    expect(shown.mock.calls).toEqual([[new DocumentTab("notes.note", "2"), "Note 2"], [new ViewTab("notes.list"), null], [new ViewTab("notes.list", "3"), null], [new DocumentTab("shell.settings"), null]]);
  });

  it("writes a window part's log lines through the desktop under its module's id", async () => {
    const part = new WindowPartFixture("notes", log, t => t.log("Opened the list"));
    const { host } = start([source("notes", part)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(bridge.logged).toEqual(["notes: Opened the list"]);
  });

  it("opens a window part's link through the desktop, and rejects when the desktop does not open it", async () => {
    const { host } = start([], []);

    await host.openLinkAsync("https://example.com/help");
    bridge.isLinkOpened = false;
    const refusal = await host.openLinkAsync("file:///etc/passwd").catch((error: unknown) => error);

    expect(bridge.links).toEqual(["https://example.com/help", "file:///etc/passwd"]);
    expect([refusal instanceof LinkNotOpenedException, (refusal as Error).message])
      .toEqual([true, "TeamRun did not open the link: it opens only well-formed http, https and mailto links, in the system's own application."]);
  });

  it("reports a layout that cannot load and still opens the documents asked for", async () => {
    const { layout } = start([source("notes", notesPart(log))], [status("notes")]);
    vi.spyOn(TestBed.inject(LayoutStoreService), "readAsync").mockRejectedValue(new Error("The layout could not be read."));

    await vi.waitFor(() => expect(errors.map(t => (t as Error).message)).toEqual(["The layout could not be read."]));

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]);
  });

  it("opens Settings the person opened before the layout loaded after the documents the parts opened while activating, so Settings is active", async () => {
    const { host, layout } = start([source("notes", notesPart(log))], [status("notes")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));

    layout.openDocument(ShellDocuments.settingsTab);
    release(null);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1"), ShellDocuments.settingsTab]));
    expect(layout.layout().documents.active).toEqual(ShellDocuments.settingsTab);
  });

  it("stops keeping the person's documents when reading the layout fails, so a document closed after that is not opened again once ready again", async () => {
    const { host, layout } = start([source("notes", notesPart(log))], [status("notes")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    layout.openDocument(ShellDocuments.settingsTab);
    release(new Error("The layout could not be read."));
    await vi.waitFor(() => expect(errors.map(t => (t as Error).message)).toEqual(["The layout could not be read."]));

    layout.close(ShellDocuments.settingsTab);
    layout.openDocument(ShellDocuments.modulesTab);
    layout.close(ShellDocuments.modulesTab);
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(layout.layout().documents.tabs).toEqual([new DocumentTab("notes.note", "1")]);
  });

  it("keeps the person's Settings and the parts' start documents for the next read when the connection ends while reading the layout, so only the saved layout decides the start documents", async () => {
    const note = new DocumentTab("notes.note", "1");
    const saved = Layout.createDefault(new ViewRegistry([], [])).openDocument(note);
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host, layout } = start([source("notes", notes)], [status("notes")]);
    const { read, release } = holdRead();
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    layout.openDocument(ShellDocuments.settingsTab);
    read.mockResolvedValueOnce(saved.toJson());
    release(new RuntimeDisconnectedException("TeamRun is not connected to its runtime."));
    await vi.waitFor(() => expect(errors.length).toBe(1));
    const before = layout.layout().documents.tabs;

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(before).toEqual([ShellDocuments.settingsTab]);
    await vi.waitFor(() => expect(layout.layout().documents.tabs).toEqual([note, ShellDocuments.settingsTab]));
    expect(layout.layout().documents.active).toEqual(ShellDocuments.settingsTab);
    expect(TestBed.inject(TabLabelService).of(note).title).toBe("Note 1");
  });

  it("rebuilds the parts that don't continue when the runtime is ready again, deactivating them in reverse, and loads the layout only once", async () => {
    const tasks = new WindowPartFixture("tasks", log);
    const notes = notesPart(log);
    tasks.isDeactivationFailing = true;
    const { host, loads } = start([source("tasks", tasks), source("notes", notes, ["tasks"])], [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"])]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Ready", details: [] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate tasks", "activate notes", "reconnect tasks", "deactivate notes", "deactivate tasks", "activate tasks", "activate notes"]);
    expect(loads.length).toBe(1);
    expect(errors.map(t => (t as Error).message)).toEqual(["tasks did not stop"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context?.moduleId).toBe("notes");
  });

  it("keeps a part that continues when the runtime is ready again, with its context and its tabs' revisions, and moves on only the rebuilt module's tabs", async () => {
    const notes = notesPart(log);
    const clock = clockPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes), source("clock", clock)], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const tabs = [new ViewTab("notes.list"), new DocumentTab("notes.note", "1"), new ViewTab("clock.list"), ShellDocuments.settingsTab];
    const context = host.findContribution(new ViewTab("notes.list"))?.context;
    const revisions = tabs.map(t => host.revisionOf(t));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "activate clock", "reconnect notes", "reconnect clock", "deactivate clock", "activate clock"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context).toBe(context);
    expect(revisions).toEqual([1, 1, 1, 0]);
    expect(tabs.map(t => host.revisionOf(t))).toEqual([1, 1, 2, 0]);
    expect(errors).toEqual([]);
  });

  it("rebuilds a part that asks to be or fails to continue, logging the failure under its module's id, and every part that depends on a rebuilt one", async () => {
    const tasks = new WindowPartFixture("tasks", log);
    const notes = new WindowPartFixture("notes", log);
    const clock = new WindowPartFixture("clock", log);
    tasks.onReconnect = () => {
      throw new Error("tasks lost its state");
    };
    notes.onReconnect = () => true;
    const { host } = start(
      [source("tasks", tasks), source("notes", notes, ["tasks"]), source("clock", clock)],
      [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"]), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual([
      "activate tasks", "activate notes", "activate clock",
      "reconnect tasks", "reconnect clock",
      "deactivate clock", "deactivate notes", "deactivate tasks",
      "activate tasks", "activate notes", "activate clock"
    ]);
    expect(errors.map(t => [(t as WindowPartFailureException).moduleId, (t as Error).message, ((t as Error).cause as Error).message])).toEqual([
      ["tasks", "Its window part failed to continue after the runtime started again.", "tasks lost its state"]
    ]);
  });

  it("withdraws a kept part whose module is no longer active, showing its views' failure, activates a module that became active, keeps the revision of a module that stays failed and moves on one whose failure changed", async () => {
    const tabs = [new ViewTab("notes.list"), new ViewTab("clock.list"), new ViewTab("tasks.list"), new ViewTab("calendar.list")];
    const during: [number[], (string | null)[]][] = [];
    const notes = new WindowPartFixture("notes", log, t => t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load)));
    const clock = new WindowPartFixture("clock", log, t => {
      t.registerView(new ViewContribution("clock.list", "Clock", "schedule", DockSide.Right, true, load));
      const host = TestBed.inject(WindowPartHostService);
      during.push([tabs.map(u => host.revisionOf(u)), tabs.map(u => host.findFailure(u)?.cause ?? null)]);
    });
    notes.onReconnect = () => true;
    const { host } = start(
      [source("notes", notes), source("clock", clock), source("tasks", new WindowPartFixture("tasks", log)), source("calendar", new WindowPartFixture("calendar", log))],
      [status("notes"), status("clock", ModuleState.Failed, "It broke."), status("tasks", ModuleState.Failed, "It is broken."), status("calendar", ModuleState.Failed, "It did not start.")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const revisions = tabs.map(t => host.revisionOf(t));

    bridge.responses.set("shell.modules", { payload: { modules: [
      status("notes", ModuleState.Failed, "It broke too."), status("clock"), status("tasks", ModuleState.Failed, "It is broken."), status("calendar", ModuleState.Failed, "It broke.")
    ] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "deactivate notes", "activate clock"]);
    expect(host.findFailure(new ViewTab("notes.list"))?.cause).toBe("It broke too.");
    expect(host.findContribution(new ViewTab("notes.list"))).toBeNull();
    expect(host.findContribution(new ViewTab("clock.list"))?.context?.moduleId).toBe("clock");
    expect(revisions).toEqual([1, 1, 1, 1]);
    expect(during).toEqual([[[0, 1, 1, 1], [null, null, "It is broken.", "It did not start."]]]);
    expect(tabs.map(t => host.revisionOf(t))).toEqual([2, 2, 1, 2]);
    expect(host.findFailure(new ViewTab("calendar.list"))?.cause).toBe("It broke.");
    expect(errors).toEqual([]);
  });

  it("moves on the revision of a module that stays failed when its state changes and its cause stays the same", async () => {
    const chat = (state: ModuleState): object => ({ ...status("chat", state, "It waits.", ["tasks"]), ...state === ModuleState.Blocked ? { blockedBy: "tasks" } : {} });
    const tab = new ViewTab("chat.list");
    const { host } = start([source("chat", new WindowPartFixture("chat", log), ["tasks"])], [status("tasks", ModuleState.Failed, "It broke."), chat(ModuleState.Blocked)]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const before = [host.revisionOf(tab), host.findFailure(tab)?.state];

    bridge.responses.set("shell.modules", { payload: { modules: [status("tasks", ModuleState.Failed, "It broke."), chat(ModuleState.Failed)] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(before).toEqual([1, ModuleState.Blocked]);
    expect([host.revisionOf(tab), host.findFailure(tab)?.state]).toEqual([2, ModuleState.Failed]);
    expect(log).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("keeps a part whose dependency has no window part, with its context", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes, ["tasks"])], [status("tasks"), status("notes", ModuleState.Active, null, ["tasks"])]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context).toBe(context);
    expect(errors).toEqual([]);
  });

  it("keeps a part's notification handles across a reconnect, so an update reaches a notification the runtime still holds and tells the part when it is gone", async () => {
    const saved = new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null);
    bridge.responses.set("shell.postNotification", { payload: { id: "n1" } });
    bridge.responses.set("shell.updateNotification", { payload: null });
    bridge.responses.set("shell.dismissNotification", { payload: null });
    const handles: NotificationHandle[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      void t.postNotificationAsync(saved).then(u => handles.push(u));
    });
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes, [], [], [], [], [], ["notes.saved"])], [status("notes")]);
    await vi.waitFor(() => expect(handles.length).toBe(1));
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));
    const isHeld = await Promise.all(handles.map(t => t.updateAsync(saved)));
    bridge.responses.set("shell.updateNotification", { failure: { code: "NotFound", message: "Notification n1 is gone; it was dismissed or its module stopped." } });
    const isGone = await Promise.all(handles.map(t => t.updateAsync(saved)));
    bridge.responses.set("shell.updateNotification", { failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });
    const refusal = host.updateNotificationAsync("n2", saved);
    await expect(refusal).rejects.toThrowError("TeamRun is not connected to its runtime.");
    bridge.responses.set("shell.modules", { payload: { modules: [status("notes", ModuleState.Failed, "It broke.")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(3));

    expect([isHeld, isGone]).toEqual([[true], [false]]);
    expect(log).toEqual(["activate notes", "reconnect notes", "deactivate notes"]);
    expect(bridge.requests.filter(t => t[0].includes("Notification")).map(t => t[0]))
      .toEqual(["shell.postNotification", "shell.updateNotification", "shell.updateNotification", "shell.updateNotification"]);
    expect(errors).toEqual([]);
  });

  it("stops activating its parts when the runtime drops while one activates, and activates them for the new runtime", async () => {
    let drops = 1;
    const tasks = new WindowPartFixture("tasks", log, () => {
      if (drops-- === 0)
        return;
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
    });
    const { host } = start([source("tasks", tasks), source("notes", notesPart(log))], [status("tasks"), status("notes")]);

    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(log).toEqual(["activate tasks", "reconnect tasks", "deactivate tasks", "activate tasks", "activate notes"]);
    expect(errors).toEqual([]);
  });

  it("starts over from its parts as they are when the runtime drops while a part is continuing, so no part is rebuilt twice or left half kept", async () => {
    const notes = notesPart(log);
    const clock = clockPart(log);
    let calls = 0;
    notes.onReconnect = () => {
      calls++;
      if (calls > 1)
        return true;
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
      return false;
    };
    const { host } = start([source("notes", notes), source("clock", clock)], [status("notes"), status("clock")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const context = host.findContribution(new ViewTab("notes.list"))?.context;

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "activate clock", "reconnect notes", "reconnect notes", "reconnect clock", "deactivate clock", "activate clock"]);
    expect(host.findContribution(new ViewTab("notes.list"))?.context).toBe(context);
    expect(host.findContribution(new ViewTab("clock.list"))?.context?.moduleId).toBe("clock");
    expect([host.revisionOf(new ViewTab("notes.list")), host.revisionOf(new ViewTab("clock.list"))]).toEqual([1, 2]);
    expect(errors).toEqual([]);
  });

  it("gives a module's tabs its revision only once the reload that changed the module ends", async () => {
    const during: number[] = [];
    const notes = new WindowPartFixture("notes", log, t => {
      t.registerView(new ViewContribution("notes.list", "Notes", "sticky_note_2", DockSide.Left, true, load));
      during.push(TestBed.inject(WindowPartHostService).revisionOf(new ViewTab("notes.list")));
    });
    const { host } = start([source("notes", notes)], [status("notes")]);

    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(during).toEqual([0]);
    expect(host.revisionOf(new ViewTab("notes.list"))).toBe(1);
  });

  it("reloads once for the newest connection when the runtime is ready again more than once before it reloads", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    for (let index = 0; index < 2; index++) {
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
    }
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(errors).toEqual([]);
  });

  it("leaves its parts as they are, reporting nothing, when a request fails because the runtime dropped again", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const request = bridge.request.bind(bridge);
    let drops = 1;
    vi.spyOn(bridge, "request").mockImplementation((method, payload) => {
      if (method !== "shell.modules" || drops-- === 0)
        return request(method, payload);
      bridge.publishStartup({ kind: "Connecting", details: [] });
      bridge.publishStartup({ kind: "Ready", details: [] });
      return Promise.resolve({ failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });
    });

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect(errors).toEqual([]);
  });

  it("keeps a part whose reconnection failed because the connection ended before the window heard so, reports nothing and asks it again once ready", async () => {
    const notes = notesPart(log);
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    let isDropping = true;
    notes.onReconnect = () => {
      if (!isDropping)
        return true;
      isDropping = false;
      throw new Error("Its options were not read.", { cause: new RuntimeDisconnectedException("TeamRun is not connected to its runtime.") });
    };

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(log).toEqual(["activate notes", "reconnect notes"]));
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes", "reconnect notes"]);
    expect([errors, host.failures()]).toEqual([[], []]);
  });

  it("keeps its parts and reports nothing when the runtime's modules are not read because the connection ended before the window heard so", async () => {
    const notes = notesPart(log);
    notes.onReconnect = () => true;
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    bridge.responses.set("shell.modules", { failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(bridge.requests.filter(t => t[0] === "shell.modules").length).toBe(2));
    bridge.responses.set("shell.modules", { payload: { modules: [status("notes")] } });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(log).toEqual(["activate notes", "reconnect notes"]);
    expect([errors, host.failures()]).toEqual([[], []]);
  });

  it("activates a part again once ready when its activation failed because the connection ended, without counting it failed", async () => {
    let isDropping = true;
    const notes = new WindowPartFixture("notes", log, () => {
      if (!isDropping)
        return;
      isDropping = false;
      throw new RuntimeDisconnectedException("TeamRun is not connected to its runtime.");
    });
    const { host } = start([source("notes", notes)], [status("notes")]);
    await vi.waitFor(() => expect(log).toEqual(["activate notes"]));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    expect(log).toEqual(["activate notes", "activate notes"]);
    expect([errors, host.failures()]).toEqual([[], []]);
  });

  it("loads the saved layout once ready again when reading it failed because the connection ended", async () => {
    const read = vi.spyOn(bridge, "readLayout").mockResolvedValueOnce({ failure: { code: "Disconnected", message: "TeamRun is not connected to its runtime." } });
    const { host, loads } = start([], []);
    await vi.waitFor(() => expect(loads.length).toBe(1));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    await vi.waitFor(() => expect(loads.length).toBe(2));
    expect(read).toHaveBeenCalledTimes(2);
    expect(errors.map(t => RuntimeDisconnectedException.isIn(t))).toEqual([true]);
  });

  it("keeps the modules it reported until the runtime reports them again", async () => {
    const seen: string[][] = [];
    let reported: () => readonly ModuleStatus[] = () => [];
    const tasks = new WindowPartFixture("tasks", log, () => {
      seen.push(reported().map(t => t.id));
    });
    const { host } = start([source("tasks", tasks)], [status("tasks")]);
    reported = () => TestBed.inject(ModuleStatusService).modules();
    await vi.waitFor(() => expect(host.generation()).toBe(1));

    bridge.publishStartup({ kind: "Ready", details: [] });
    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(seen).toEqual([[], ["tasks"]]);
    expect(TestBed.inject(ModuleStatusService).modules().map(t => t.id)).toEqual(["tasks"]);
  });

  it("shows the tab a window part marks as working until the part is withdrawn", async () => {
    let marks = 0;
    const notes = new WindowPartFixture("notes", log, t => {
      if (marks++ === 0)
        t.markWorking("notes.list");
    });
    const { host } = start([source("notes", notes, [], ["notes.list"])], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = labels.isWorking(new ViewTab("notes.list"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect([shown, labels.isWorking(new ViewTab("notes.list"))]).toEqual([true, false]);
  });

  it("shows the badge a window part sets on its view, set again when the part reactivates", async () => {
    const badge = new ViewBadge(2, "2 new");
    const notes = new WindowPartFixture("notes", log, t => t.setViewBadge("notes.list", badge));
    const { host } = start([source("notes", notes, [], ["notes.list"])], [status("notes")]);
    const labels = TestBed.inject(TabLabelService);
    await vi.waitFor(() => expect(host.generation()).toBe(1));
    const shown = labels.badgeOf(new ViewTab("notes.list"));

    bridge.publishStartup({ kind: "Connecting", details: [] });
    bridge.publishStartup({ kind: "Ready", details: [] });
    await vi.waitFor(() => expect(host.generation()).toBe(2));

    expect(shown).toBe(badge);
    expect(labels.badgeOf(new ViewTab("notes.list"))).toBe(badge);
    expect(log).toContain("deactivate notes");
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

  it("asks the menu service whether a module declares a dynamic menu group and passes on the items of a group it supplies", () => {
    const { host } = start([], []);
    const menus = TestBed.inject(MenuService);
    const withdraw = vi.fn();
    const declares = vi.spyOn(menus, "declaresDynamicGroup").mockReturnValue(true);
    const provide = vi.spyOn(menus, "provideGroup").mockReturnValue(withdraw);
    const provider = (): readonly MenuItem[] => [];

    expect(host.declaresDynamicMenuGroup("notes", "notes.recent")).toBe(true);
    expect(host.provideMenuGroup("notes.recent", provider)).toBe(withdraw);
    expect(declares).toHaveBeenCalledWith("notes", "notes.recent");
    expect(provide).toHaveBeenCalledWith("notes.recent", provider);
  });

  it("does nothing before the runtime is ready", async () => {
    bridge.startup = { kind: "Connecting", details: [] };
    const { host, loads } = start([], []);
    await Promise.resolve();

    bridge.publishStartup({ kind: "WorkInProgress", details: ["Saving"] });

    expect([host.generation(), loads.length, bridge.requests.length]).toEqual([0, 0, 0]);
  });
});
