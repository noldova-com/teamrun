/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { BottomDockSpan } from "../../../src/app/enums/bottom-dock-span";
import { DockSide } from "../../../src/app/enums/dock-side";
import { ToolbarMove } from "../../../src/app/enums/toolbar-move";
import type { CommandContribution } from "../../../src/app/models/command-contribution";
import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { Layout } from "../../../src/app/models/layout/layout";
import { ViewRegistry } from "../../../src/app/models/layout/view-registry";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { CommandSearchService } from "../../../src/app/services/command-search.service";
import { SettingsPageService } from "../../../src/app/services/settings-page.service";
import { ShellCommandsService } from "../../../src/app/services/shell-commands.service";
import { TabStripService } from "../../../src/app/services/tab-strip.service";
import { ToolbarService } from "../../../src/app/services/toolbar.service";
import { UpdateService } from "../../../src/app/services/update.service";
import { ViewDialogService } from "../../../src/app/services/view-dialog.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { LayoutFixture } from "../../fixtures/layout.fixture";
import { LayoutServiceFixture } from "../../fixtures/layout-service.fixture";

describe("ShellCommandsService", () => {
  const { files, search, changes, plan, todo, settings } = LayoutFixture;
  const registry = LayoutFixture.createRegistry();
  const prepared = Layout.createDefault(registry).openView(search, registry).openDocument(plan).openDocument(todo).openDocument(settings, true);
  let layout: LayoutService;
  let service: ShellCommandsService;
  let bridge: DesktopBridgeFixture;

  beforeEach(async () => {
    bridge = DesktopBridgeFixture.install();
    layout = await LayoutServiceFixture.prepareAsync(registry, prepared);
    service = TestBed.inject(ShellCommandsService);
  });

  afterEach(() => DesktopBridgeFixture.remove());

  function command(name: string): CommandContribution {
    const found = service.commands.find(t => t.name === name);
    if (Object.isUndefined(found))
      throw new Error(`No ${name} command.`);
    return found;
  }

  async function runAsync(name: string, commandArguments: JsonValue = null): Promise<void> {
    expect(await command(name).runAsync(commandArguments)).toBeNull();
    TestBed.tick();
  }

  function enabled(name: string, commandArguments: JsonValue = null): boolean {
    return command(name).isEnabled(commandArguments);
  }

  function checked(name: string, commandArguments: JsonValue): boolean {
    return command(name).isChecked?.(commandArguments) ?? false;
  }

  const tab = (key: string): JsonValue => ({ tab: key });

  it("offers the shell's tab and layout commands, each with a title and an icon and none with a default key", () => {
    expect(service.commands.map(t => t.name)).toEqual([
      "shell.closeTab", "shell.keepTab", "shell.closeOtherTabs", "shell.closeTabsToTheRight", "shell.closeAllTabs", "shell.moveTabLeft", "shell.moveTabRight",
      "shell.nextTab", "shell.previousTab", "shell.splitTabLeft", "shell.splitTabRight", "shell.splitTabUp", "shell.splitTabDown", "shell.dockTabLeft", "shell.dockTabRight",
      "shell.dockTabBottom", "shell.moveTabToGroup", "shell.moveTabToNextGroup", "shell.moveTabToPreviousGroup", "shell.focusNextGroup", "shell.focusPreviousGroup",
      "shell.toggleLeftDock", "shell.toggleRightDock", "shell.toggleBottomDock", "shell.undo", "shell.redo", "shell.cut",
      "shell.copy", "shell.paste", "shell.selectAll", "shell.showCommands", "shell.openSettings", "shell.installCommand", "shell.checkForUpdates", "shell.downloadUpdate", "shell.restartToUpdate", "shell.openModules", "shell.showInDialog", "shell.toggleToolbar", "shell.moveToolbarLeft",
      "shell.moveToolbarRight", "shell.moveToolbarUp", "shell.moveToolbarDown", "shell.hideToolbar",
      "shell.focusToolbars", "shell.resetLayout", "shell.spanBottomDock", "shell.fitBottomDockBetween", "shell.showAllTabs"
    ]);
    expect(service.commands.every(t => t.title.length > 0 && t.icon !== null)).toBe(true);
    expect(service.commands.filter(t => t.defaultKey !== null)).toEqual([]);
    expect(command("shell.keepTab").title).toBe("Keep the tab open");
  });

  it("opens Settings as a kept document, or reveals the open one, and is enabled only while the document is registered", async () => {
    await runAsync("shell.openSettings");
    const opened = layout.layout().documents;
    layout.setRegistry(new ViewRegistry([], ["notes.note"]));

    expect([opened.active?.key, opened.preview]).toEqual([settings.key, null]);
    expect(opened.tabs.filter(t => t.equals(settings)).length).toBe(1);
    expect(enabled("shell.openSettings")).toBe(false);
  });

  it("opens Settings at the page its arguments name, and at its last page without one", async () => {
    const pages = TestBed.inject(SettingsPageService);

    await runAsync("shell.openSettings", { page: "About" });
    const requested = pages.requested();
    pages.take();
    await runAsync("shell.openSettings", {});

    expect([requested, pages.requested(), layout.layout().documents.active?.key]).toEqual(["About", null, settings.key]);
  });

  it("checks for, downloads and restarts to install an update through the desktop, each offered and enabled only in its state", async () => {
    const updates = TestBed.inject(UpdateService);
    const names = ["shell.checkForUpdates", "shell.downloadUpdate", "shell.restartToUpdate"];
    const offers = (): readonly string[] => names.map(t => `${command(t).isApplicable(null)}/${enabled(t)}`);
    const update = (kind: string, version: string | null = null, mustMove: boolean = false): object => ({ kind, version, progress: null, checkedAt: null, reason: null, mustMove });
    const seen: (readonly string[])[] = [offers()];
    for (const state of [update("UpToDate"), update("Checking"), update("Available", "1.3.0"), update("Available", "1.3.0", true), update("Downloading", "1.3.0"),
      update("Ready", "1.3.0"), update("Failed", "1.3.0")]) {
      bridge.publishUpdate(state);
      seen.push(offers());
    }

    for (const name of names)
      await runAsync(name);
    await vi.waitFor(() => expect(bridge.updateActions.length).toBe(3));

    expect(updates.state().kind).toBe("Failed");
    expect(seen).toEqual([
      ["false/false", "false/false", "false/false"],
      ["true/true", "false/false", "false/false"],
      ["true/false", "false/false", "false/false"],
      ["true/true", "true/true", "false/false"],
      ["true/true", "false/false", "false/false"],
      ["true/false", "false/false", "false/false"],
      ["true/false", "false/false", "true/true"],
      ["true/true", "true/true", "false/false"]
    ]);
    expect(bridge.updateActions).toEqual(["Check", "Download", "Restart"]);
    expect(names.map(t => command(t).title)).toEqual(["Check for updates", "Download update", "Restart to update"]);
  });

  it("opens Modules as one kept document, revealing the open one, and is enabled only while the document is registered", async () => {
    const modules = new DocumentTab("shell.modules");
    const unregistered = enabled("shell.openModules");
    layout.setRegistry(new ViewRegistry(registry.views, ["notes.note", "shell.settings", "shell.modules"]));

    await runAsync("shell.openModules");
    layout.activate(plan);
    await runAsync("shell.openModules");
    const opened = layout.layout().documents;

    expect([unregistered, enabled("shell.openModules")]).toEqual([false, true]);
    expect([opened.active?.key, opened.preview?.key]).toEqual([modules.key, settings.key]);
    expect(opened.tabs.filter(t => t.equals(modules)).length).toBe(1);
    expect(command("shell.openModules").title).toBe("Modules…");
  });

  it("installs the command in PATH through the desktop, offered and enabled only on macOS", async () => {
    const offered = [command("shell.installCommand").isApplicable(null), enabled("shell.installCommand")];
    bridge.platform = "darwin";

    const isInstalled = await command("shell.installCommand").runAsync(null);

    expect(offered).toEqual([false, false]);
    expect([command("shell.installCommand").isApplicable(null), enabled("shell.installCommand"), isInstalled, bridge.commandInstalls]).toEqual([true, true, true, 1]);
    expect(command("shell.installCommand").title).toBe("Install command in PATH");
  });

  it("shows a registered view or document named by its tab key in a dialog, and is enabled only for one while no dialog is shown", async () => {
    const dialogs = TestBed.inject(ViewDialogService);
    const before = layout.layout().documents.tabs.map(t => t.key);
    const refused = [null, {}, tab("view"), tab("view/Files"), tab("view/files.missing"), tab("panel/files.search"), tab("document/notes.note/ "), tab("document/notes.page/1")]
      .map(t => enabled("shell.showInDialog", t));
    const accepted = [tab("view/files.search"), tab("view/terminal.shell/3"), tab("document/notes.note/a/b"), tab("document/shell.settings")].map(t => enabled("shell.showInDialog", t));

    const running = command("shell.showInDialog").runAsync(tab("document/notes.note/a/b"));
    const shown = dialogs.shown()?.key;
    const whileShown = enabled("shell.showInDialog", tab("view/files.search"));
    const ignored = await command("shell.showInDialog").runAsync(tab("view/files.search"));
    dialogs.close();

    expect(refused.some(t => t)).toBe(false);
    expect(accepted.every(t => t)).toBe(true);
    expect([shown, whileShown, ignored, await running]).toEqual(["document/notes.note/a/b", false, null, null]);
    expect(dialogs.shown()).toBeNull();
    expect(layout.layout().documents.tabs.map(t => t.key)).toEqual(before);
  });

  it("edits the field that had focus before a menu took it, restoring the field and its selection first, and only when the field allows the edit", async () => {
    const host = document.createElement("div");
    host.innerHTML = "<input type=\"text\" value=\"Meeting notes\"><div class=\"cdk-overlay-container\"><button type=\"button\">Copy</button></div>";
    document.body.append(host);
    const field = host.querySelector("input") as HTMLInputElement;
    const row = host.querySelector("button") as HTMLButtonElement;
    const disabledBefore = enabled("shell.copy");
    field.focus();
    field.setSelectionRange(0, 7);
    row.focus();

    const enabledInMenu = ["shell.copy", "shell.cut", "shell.paste", "shell.selectAll", "shell.undo", "shell.redo"].map(t => enabled(t));
    await runAsync("shell.copy");
    const restored = [document.activeElement === field, field.selectionStart, field.selectionEnd];
    field.setSelectionRange(2, 2);
    row.focus();
    await runAsync("shell.cut");
    host.remove();

    expect(disabledBefore).toBe(false);
    expect(enabledInMenu).toEqual([true, true, true, true, true, true]);
    expect(restored).toEqual([true, 0, 7]);
    expect(bridge.edits).toEqual(["Copy"]);
  });

  it("acts on the current tab without arguments: the active tab of the group last focused or activated, else the documents' active tab", async () => {
    expect(enabled("shell.keepTab")).toBe(true);
    layout.activate(files);
    await runAsync("shell.closeTab");
    expect(layout.layout().isOpen(files)).toBe(false);

    layout.focusGroup(layout.layout().documents.id);
    await runAsync("shell.moveTabLeft");
    expect(layout.layout().documents.tabs).toEqual([plan, settings, todo]);

    layout.focusGroup(999);
    expect(layout.currentGroup()).toBe(layout.layout().documents);
  });

  it("acts on the tab its arguments name, and is disabled for a tab that is not open", async () => {
    await runAsync("shell.closeTab", tab(plan.key));

    expect(layout.layout().documents.tabs).toEqual([todo, settings]);
    expect(enabled("shell.closeTab", tab("document/notes.note/gone"))).toBe(false);
    await runAsync("shell.closeTab", tab("document/notes.note/gone"));
    expect(layout.layout().documents.tabs).toEqual([todo, settings]);
  });

  it("keeps a preview, and only a preview", async () => {
    expect([enabled("shell.keepTab", tab(settings.key)), enabled("shell.keepTab", tab(plan.key))]).toEqual([true, false]);

    await runAsync("shell.keepTab", tab(settings.key));

    expect(layout.layout().documents.preview).toBeNull();
  });

  it("closes the other tabs, the tabs to the right and all tabs of a group, when there are any to close", async () => {
    expect([enabled("shell.closeOtherTabs", tab(files.key)), enabled("shell.closeTabsToTheRight", tab(settings.key))]).toEqual([true, false]);
    await runAsync("shell.closeTabsToTheRight", tab(plan.key));
    expect(layout.layout().documents.tabs).toEqual([plan]);
    expect(enabled("shell.closeOtherTabs", tab(plan.key))).toBe(false);

    await runAsync("shell.closeOtherTabs", tab(files.key));
    expect(layout.layout().groupOf(files)?.tabs).toEqual([files]);
    await runAsync("shell.closeAllTabs", tab(plan.key));
    expect(layout.layout().documents.tabs).toEqual([]);
  });

  it("moves a tab left and right within its group, and does nothing at either end", async () => {
    expect([enabled("shell.moveTabLeft", tab(plan.key)), enabled("shell.moveTabRight", tab(settings.key))]).toEqual([false, false]);
    await runAsync("shell.moveTabLeft", tab(plan.key));
    await runAsync("shell.moveTabRight", tab(plan.key));

    expect(layout.layout().documents.tabs).toEqual([todo, plan, settings]);
  });

  it("splits a tab off on any edge when its group keeps a tab, and docks a movable tab on any side", async () => {
    expect([enabled("shell.splitTabRight", tab(changes.key)), enabled("shell.splitTabRight", tab(search.key))]).toEqual([false, true]);
    expect(enabled("shell.dockTabBottom", tab(plan.key))).toBe(false);

    await runAsync("shell.splitTabDown", tab(search.key));
    expect(layout.layout().groupOf(search)?.tabs).toEqual([search]);
    await runAsync("shell.dockTabBottom", tab(search.key));
    expect(layout.layout().sideOf(layout.layout().groupOf(search)?.id ?? -1)).toBe(DockSide.Bottom);
  });

  it("leaves out what can never apply to a tab: Keep open on a kept tab, and docking a document", () => {
    const applies = (name: string, commandArguments: JsonValue): boolean => command(name).isApplicable(commandArguments);

    expect([applies("shell.keepTab", tab(settings.key)), applies("shell.keepTab", tab(plan.key))]).toEqual([true, false]);
    expect(["shell.splitTabLeft", "shell.dockTabLeft", "shell.moveTabToGroup"].map(t => [applies(t, tab(plan.key)), applies(t, tab(search.key))]))
      .toEqual([[true, true], [false, true], [true, true]]);
    expect([applies("shell.closeTab", tab(plan.key)), applies("shell.closeTab", tab("missing")), applies("shell.moveTabToGroup", tab("missing"))])
      .toEqual([true, false, false]);
  });

  it("closes a group's only tab, which closes the group and leaves no tab of it to focus", async () => {
    const group = layout.layout().groupOf(changes)?.id ?? -1;

    await runAsync("shell.closeTab", tab(changes.key));

    expect([layout.layout().isOpen(changes), layout.layout().group(group)]).toEqual([false, null]);
  });

  it("passes the focus to the group that remains when a closed tab was the last of its group, and has none to focus when no tab remains", async () => {
    await runAsync("shell.splitTabRight", tab(todo.key));
    const remaining = layout.layout().documentGroups[0];

    await runAsync("shell.closeTab", tab(todo.key));

    expect([layout.layout().documentGroups.map(t => t.id), layout.currentGroup().id, layout.currentGroup().active]).toEqual([[remaining?.id], remaining?.id, remaining?.active]);
    await runAsync("shell.closeTab", tab(plan.key));
    await runAsync("shell.closeTab", tab(settings.key));
    expect([layout.layout().documents.tabs, layout.currentGroup().active]).toEqual([[], null]);
  });

  it("moves a tab to another group that accepts it, and to no other", async () => {
    const other = layout.layout().groupOf(changes)?.id ?? -1;
    const own = layout.layout().groupOf(search)?.id ?? -1;
    const documents = layout.layout().documents.id;
    const move = (key: string, group?: number): JsonValue => Object.isUndefined(group) ? { tab: key } : { tab: key, group };

    expect([move(search.key, other), move(search.key, own), move(search.key, documents), move(plan.key, other), move(search.key), move(search.key, 999), null]
      .map(t => enabled("shell.moveTabToGroup", t))).toEqual([true, false, true, false, false, false, false]);
    await runAsync("shell.moveTabToGroup", move(search.key, other));
    await runAsync("shell.moveTabToGroup", move(search.key, other));

    expect(layout.layout().groupOf(search)?.id).toBe(other);
    expect(layout.layout().groupOf(search)?.tabs.at(-1)).toEqual(search);
  });

  it("splits a document into a documents group, moves a tab between the groups it can join and focuses the next or previous group, wrapping at either end", async () => {
    const names = ["shell.moveTabToNextGroup", "shell.moveTabToPreviousGroup", "shell.focusNextGroup", "shell.focusPreviousGroup"];
    const before = names.map(t => enabled(t, t.includes("focus") ? null : tab(plan.key)));

    await runAsync("shell.splitTabRight", tab(todo.key));
    const [first, second] = layout.layout().documentGroups;
    const contents = (): number[] => layout.layout().documentGroups.map(t => t.tabs.length);

    expect(before).toEqual([false, false, true, true]);
    expect([first?.tabs, second?.tabs, layout.layout().documents.id]).toEqual([[plan, settings], [todo], second?.id]);
    expect([enabled("shell.splitTabRight", tab(todo.key)), enabled("shell.splitTabRight", tab(plan.key))]).toEqual([false, true]);
    const frames = layout.geometry().frames.filter(t => t.group.active !== null).length;
    const visited = new Set<number>();
    for (let step = 0; step < frames; step++) {
      await runAsync("shell.focusNextGroup");
      visited.add(layout.currentGroup().id);
    }
    expect([visited.size, visited.has(first?.id ?? -1), visited.has(second?.id ?? -1), layout.currentGroup().id]).toEqual([frames, true, true, second?.id]);
    await runAsync("shell.focusPreviousGroup");
    await runAsync("shell.focusNextGroup");
    expect(layout.currentGroup().id).toBe(second?.id);
    layout.focusGroup(first?.id ?? -1);
    await runAsync("shell.moveTabToNextGroup", tab(plan.key));
    expect([contents(), layout.layout().documents.id]).toEqual([[1, 2], second?.id]);
    await runAsync("shell.moveTabToPreviousGroup", tab(plan.key));
    await runAsync("shell.moveTabToPreviousGroup", tab(todo.key));
    expect(contents()).toEqual([3]);
    expect(names.map(t => enabled(t, t.includes("focus") ? null : tab(plan.key)))).toEqual([false, false, true, true]);
  });

  it("moves a view to the next or previous group, which may be a documents group, wrapping around every group", async () => {
    const groups = layout.layout().groups;
    const own = layout.layout().groupOf(search);
    const next = groups[(groups.findIndex(t => t.id === own?.id) + 1) % groups.length];

    await runAsync("shell.moveTabToNextGroup", tab(search.key));

    expect(layout.layout().groupOf(search)?.id).toBe(next?.id);
    await runAsync("shell.moveTabToPreviousGroup", tab(search.key));
    expect(layout.layout().groupOf(search)?.id).toBe(own?.id);
  });

  it("keys the most-used commands by the platform's conventions, each key once and each command one of its own", () => {
    const labels = (platform: string): string[][] => service.keys(platform).map(([key, name]) => [name, key.label(platform)]);
    const names = new Set(service.commands.map(t => t.name));

    expect(labels("win32")).toEqual([
      ["shell.showCommands", "Ctrl+Shift+P"], ["shell.openSettings", "Ctrl+,"], ["shell.closeTab", "Ctrl+W"], ["shell.nextTab", "Ctrl+Tab"], ["shell.nextTab", "Ctrl+PageDown"],
      ["shell.previousTab", "Ctrl+Shift+Tab"], ["shell.previousTab", "Ctrl+PageUp"], ["shell.toggleLeftDock", "Ctrl+B"], ["shell.toggleBottomDock", "Ctrl+J"],
      ["shell.toggleRightDock", "Ctrl+Alt+B"]
    ]);
    expect(labels("darwin")).toEqual([
      ["shell.showCommands", "⇧⌘P"], ["shell.openSettings", "⌘,"], ["shell.closeTab", "⌘W"], ["shell.nextTab", "⌃⇥"], ["shell.nextTab", "⌥⌘→"],
      ["shell.previousTab", "⌃⇧⇥"], ["shell.previousTab", "⌥⌘←"], ["shell.toggleLeftDock", "⌘B"], ["shell.toggleBottomDock", "⌘J"],
      ["shell.toggleRightDock", "⌥⌘B"]
    ]);
    for (const platform of ["linux", "darwin"]) {
      const keys = service.keys(platform);
      expect(keys.every(([key], index) => keys.findIndex(([other]) => other.isSameOn(key, platform)) === index)).toBe(true);
      expect(keys.every(([, name]) => names.has(name))).toBe(true);
    }
  });

  it("shows the next or previous tab of the current group, wrapping at either end, when the group has another", async () => {
    layout.activate(settings);
    await runAsync("shell.nextTab");
    expect(layout.layout().documents.active).toEqual(plan);
    await runAsync("shell.previousTab");
    expect(layout.layout().documents.active).toEqual(settings);
    await runAsync("shell.previousTab", tab(plan.key));
    expect(layout.layout().documents.active).toEqual(settings);

    expect([enabled("shell.nextTab", tab(changes.key)), enabled("shell.previousTab", tab(files.key))]).toEqual([false, true]);
  });

  it("opens the command search", async () => {
    const open = vi.spyOn(TestBed.inject(CommandSearchService), "open").mockImplementation(() => undefined);

    await runAsync("shell.showCommands");

    expect(open).toHaveBeenCalledOnce();
  });

  it("shows or hides the toolbar it names, checked while shown, and is enabled only for a toolbar that exists", async () => {
    const toolbars = TestBed.inject(ToolbarService);
    const known = vi.spyOn(toolbars, "isKnown").mockImplementation(name => name === "notes.main");
    const shown = vi.spyOn(toolbars, "isShown").mockReturnValue(true);
    const setShown = vi.spyOn(toolbars, "setShown").mockImplementation(() => undefined);
    const main = { toolbar: "notes.main" };
    const missing = { toolbar: "notes.none" };

    expect([enabled("shell.toggleToolbar", main), enabled("shell.toggleToolbar", missing), enabled("shell.toggleToolbar"), enabled("shell.toggleToolbar", {})]).toEqual([true, false, false, false]);
    expect([checked("shell.toggleToolbar", main), checked("shell.toggleToolbar", missing), checked("shell.toggleToolbar", null)]).toEqual([true, false, false]);
    await runAsync("shell.toggleToolbar", main);
    expect(setShown).toHaveBeenLastCalledWith("notes.main", false);
    shown.mockReturnValue(false);
    await runAsync("shell.toggleToolbar", main);
    expect(setShown).toHaveBeenLastCalledWith("notes.main", true);
    setShown.mockClear();
    await runAsync("shell.toggleToolbar", missing);
    expect(setShown).not.toHaveBeenCalled();
    expect(known).toHaveBeenCalled();
  });

  it("moves the toolbar it names one step and returns the focus to its grip, enabled only where that step is possible, and hides it", async () => {
    const toolbars = TestBed.inject(ToolbarService);
    vi.spyOn(toolbars, "isKnown").mockImplementation(name => name === "notes.main");
    const canMove = vi.spyOn(toolbars, "canMove").mockImplementation((_, move) => move === ToolbarMove.Left);
    const moveBy = vi.spyOn(toolbars, "moveBy").mockImplementation(() => undefined);
    const setShown = vi.spyOn(toolbars, "setShown").mockImplementation(() => undefined);
    const main = { toolbar: "notes.main" };
    const missing = { toolbar: "notes.none" };
    const frame = document.createElement("div");
    frame.className = "tr-toolbar";
    frame.dataset["toolbar"] = "notes.main";
    const grip = document.createElement("button");
    grip.className = "tr-toolbar-grip";
    frame.append(grip);
    document.body.append(frame);

    expect(Object.values(ToolbarMove).map(t => enabled(`shell.moveToolbar${t[0]?.toUpperCase()}${t.slice(1)}`, main))).toEqual([true, false, false, false]);
    expect([enabled("shell.moveToolbarLeft", missing), enabled("shell.moveToolbarLeft"), enabled("shell.hideToolbar", main), enabled("shell.hideToolbar", missing)]).toEqual([false, false, true, false]);
    await runAsync("shell.moveToolbarLeft", main);
    await vi.waitFor(() => expect(document.activeElement).toBe(grip));
    expect(moveBy).toHaveBeenLastCalledWith("notes.main", ToolbarMove.Left);
    moveBy.mockClear();
    await runAsync("shell.moveToolbarLeft", missing);
    expect(moveBy).not.toHaveBeenCalled();
    await runAsync("shell.hideToolbar", main);
    expect(setShown).toHaveBeenLastCalledWith("notes.main", false);
    setShown.mockClear();
    await runAsync("shell.hideToolbar", missing);
    expect(setShown).not.toHaveBeenCalled();
    frame.remove();
    await runAsync("shell.moveToolbarLeft", main);
    expect(canMove).toHaveBeenCalled();
  });

  it("moves the focus to the next toolbar's grip, else the previous one's, else Search commands, after hiding a toolbar", async () => {
    const toolbars = TestBed.inject(ToolbarService);
    vi.spyOn(toolbars, "isKnown").mockReturnValue(true);
    const frames = ["notes.first", "notes.second"].map(name => {
      const frame = document.createElement("div");
      frame.className = "tr-toolbar";
      frame.dataset["toolbar"] = name;
      const grip = document.createElement("button");
      grip.className = "tr-toolbar-grip";
      frame.append(grip);
      document.body.append(frame);
      return frame;
    });
    const search = document.createElement("button");
    search.className = "tr-window-row-search";
    document.body.append(search);
    vi.spyOn(toolbars, "setShown").mockImplementation(name => frames.find(t => t.dataset["toolbar"] === name)?.remove());

    await runAsync("shell.hideToolbar", { toolbar: "notes.first" });
    await vi.waitFor(() => expect(document.activeElement).toBe(frames[1]?.querySelector("button")));
    await runAsync("shell.hideToolbar", { toolbar: "notes.second" });
    await vi.waitFor(() => expect(document.activeElement).toBe(search));
    search.remove();
  });

  it("focuses the first toolbar item, and is enabled only while a toolbar is shown", async () => {
    const hasContent = vi.spyOn(TestBed.inject(ToolbarService), "hasContent");
    const item = document.createElement("button");
    item.className = "tr-toolbar-item";
    item.tabIndex = 0;
    document.body.append(item);

    expect(enabled("shell.focusToolbars")).toBe(false);
    hasContent.mockReturnValue(true);
    expect(enabled("shell.focusToolbars")).toBe(true);
    await runAsync("shell.focusToolbars");
    expect(document.activeElement).toBe(item);
    item.remove();
    await runAsync("shell.focusToolbars");
  });

  it("shows and hides each dock and resets the layout", async () => {
    await runAsync("shell.toggleLeftDock");
    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(true);
    await runAsync("shell.toggleBottomDock");
    await runAsync("shell.toggleRightDock");
    expect([DockSide.Right, DockSide.Bottom].map(t => layout.layout().dock(t).isCollapsed)).toEqual([true, true]);

    await runAsync("shell.resetLayout");
    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(false);
  });

  it("checks a side dock's command only while the dock shows, and opens a dock the narrow window closed instead of hiding it", async () => {
    const shown = (): boolean[] => ["shell.toggleLeftDock", "shell.toggleRightDock"].map(t => checked(t, null));
    layout.setViewport(120, 60);
    const wide = shown();

    layout.setViewport(40, 40);
    const narrow = shown();
    await runAsync("shell.toggleRightDock");

    expect([wide, narrow]).toEqual([[true, true], [false, false]]);
    expect(shown()).toEqual([false, true]);
    expect(layout.layout().dock(DockSide.Right).isExpanded).toBe(true);
  });

  it("keeps the bottom dock between the side docks or spans it across the window, both always enabled and the current one changing nothing", async () => {
    const enabled = (): boolean[] => ["shell.spanBottomDock", "shell.fitBottomDockBetween"].map(t => command(t).isEnabled(null));
    const initial = layout.layout();

    await runAsync("shell.spanBottomDock");
    expect(layout.layout()).toBe(initial);
    await runAsync("shell.fitBottomDockBetween");
    expect([layout.layout().bottomSpan, ...enabled()]).toEqual([BottomDockSpan.Between, true, true]);
    await runAsync("shell.spanBottomDock");

    expect(layout.layout().bottomSpan).toBe(BottomDockSpan.Full);
  });

  it("shows all tabs of a group whose tabs overflow, the current group by default", async () => {
    const strips = TestBed.inject(TabStripService);
    const documents = layout.layout().documents.id;
    expect(enabled("shell.showAllTabs")).toBe(false);
    await runAsync("shell.showAllTabs");
    expect(strips.listRequest()).toBeNull();
    strips.setOverflowing(documents, true);
    expect(enabled("shell.showAllTabs", tab("document/notes.note/gone"))).toBe(false);
    layout.focusGroup(documents);

    expect([enabled("shell.showAllTabs"), enabled("shell.showAllTabs", tab(files.key))]).toEqual([true, false]);
    await runAsync("shell.showAllTabs");
    expect(strips.listRequest()).toBe(documents);
  });
});
