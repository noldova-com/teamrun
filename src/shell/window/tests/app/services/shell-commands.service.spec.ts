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
import type { CommandContribution } from "../../../src/app/models/command-contribution";
import { Layout } from "../../../src/app/models/layout/layout";
import type { LayoutService } from "../../../src/app/services/layout.service";
import { CommandSearchService } from "../../../src/app/services/command-search.service";
import { ShellCommandsService } from "../../../src/app/services/shell-commands.service";
import { TabStripService } from "../../../src/app/services/tab-strip.service";
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

  const tab = (key: string): JsonValue => ({ tab: key });

  it("offers the shell's tab and layout commands, each with a title and an icon and none with a default key", () => {
    expect(service.commands.map(t => t.name)).toEqual([
      "shell.closeTab", "shell.keepTab", "shell.closeOtherTabs", "shell.closeTabsToTheRight", "shell.closeAllTabs", "shell.moveTabLeft", "shell.moveTabRight",
      "shell.nextTab", "shell.previousTab", "shell.splitTabLeft", "shell.splitTabRight", "shell.splitTabUp", "shell.splitTabDown", "shell.dockTabLeft", "shell.dockTabRight", "shell.dockTabBottom",
      "shell.toggleLeftDock", "shell.toggleRightDock", "shell.toggleBottomDock", "shell.undo", "shell.redo", "shell.cut", "shell.copy", "shell.paste", "shell.selectAll",
      "shell.showCommands", "shell.resetLayout", "shell.spanBottomDock", "shell.fitBottomDockBetween", "shell.showAllTabs"
    ]);
    expect(service.commands.every(t => t.title.length > 0 && t.icon !== null)).toBe(true);
    expect(service.commands.filter(t => t.defaultKey !== null)).toEqual([]);
    expect(command("shell.keepTab").title).toBe("Keep the tab open");
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
    expect(bridge.edits).toEqual(["copy"]);
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

  it("keys the most-used commands by the platform's conventions, each key once and each command one of its own", () => {
    const labels = (platform: string): string[][] => service.keys(platform).map(([key, name]) => [name, key.label(platform)]);
    const names = new Set(service.commands.map(t => t.name));

    expect(labels("win32")).toEqual([
      ["shell.showCommands", "Ctrl+Shift+P"], ["shell.closeTab", "Ctrl+W"], ["shell.nextTab", "Ctrl+Tab"], ["shell.nextTab", "Ctrl+PageDown"],
      ["shell.previousTab", "Ctrl+Shift+Tab"], ["shell.previousTab", "Ctrl+PageUp"], ["shell.toggleLeftDock", "Ctrl+B"], ["shell.toggleBottomDock", "Ctrl+J"],
      ["shell.toggleRightDock", "Ctrl+Alt+B"]
    ]);
    expect(labels("darwin")).toEqual([
      ["shell.showCommands", "⇧⌘P"], ["shell.closeTab", "⌘W"], ["shell.nextTab", "⌃⇥"], ["shell.nextTab", "⌥⌘→"],
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

  it("shows and hides each dock and resets the layout", async () => {
    await runAsync("shell.toggleLeftDock");
    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(true);
    await runAsync("shell.toggleBottomDock");
    await runAsync("shell.toggleRightDock");
    expect([DockSide.Right, DockSide.Bottom].map(t => layout.layout().dock(t).isCollapsed)).toEqual([true, true]);

    await runAsync("shell.resetLayout");
    expect(layout.layout().dock(DockSide.Left).isCollapsed).toBe(false);
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
