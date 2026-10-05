/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName, SettingChange, SettingKey, SettingScope } from "@noldova/teamrun-shell-protocol";

import { DockSide } from "../../../src/app/enums/dock-side";
import { WindowPartAccessException } from "../../../src/app/exceptions/window-part-access.exception";
import type { IWindowPartHost } from "../../../src/app/interfaces/i-window-part-host";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import type { MenuItem } from "../../../src/app/models/menu-item";
import { MenuRowContribution } from "../../../src/app/models/menu-row-contribution";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";
import { ViewBadge } from "../../../src/app/models/view-badge";
import { ViewContribution } from "../../../src/app/models/view-contribution";
import { WindowPartContext } from "../../../src/app/models/window-part-context";
import { WindowPartSource } from "../../../src/app/models/window-part-source";

@Component({ template: "" })
class ListComponent {
}

class FakeWindowPartHost implements IWindowPartHost {
  public readonly calls: string[] = [];
  public readonly listeners: Set<(name: string, payload: JsonValue) => void> = new Set();
  public readonly registered: Set<string> = new Set(["notes.taken"]);
  public readonly settingListeners: Set<(change: SettingChange) => void> = new Set();
  public readonly dynamicGroups: Set<string> = new Set(["notes.recent"]);
  public readonly providers: Map<string, (context: JsonObject) => readonly MenuItem[]> = new Map();

  public requestAsync(method: string, payload: JsonValue): Promise<JsonValue> {
    this.calls.push(`request ${method}`);
    return Promise.resolve({ method, payload });
  }

  public onEvent(listener: (name: string, payload: JsonValue) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public openDocument(moduleId: string, name: string, instance: string, title: string, isPreview: boolean): void {
    this.calls.push(`open ${moduleId} ${name} ${instance} ${title}${isPreview ? " as a preview" : ""}`);
  }

  public keepDocument(moduleId: string, name: string, instance: string): void {
    this.calls.push(`keep ${moduleId} ${name} ${instance}`);
  }

  public log(moduleId: string, message: string): void {
    this.calls.push(`log ${moduleId} ${message}`);
  }

  public showInDialogAsync(name: string, instance: string | null, title: string | null): Promise<void> {
    this.calls.push(`show ${name} ${instance ?? "-"} ${title ?? "-"}`);
    return Promise.resolve();
  }

  public isCommandRegistered(name: string): boolean {
    return this.registered.has(name);
  }

  public declaresDynamicMenuGroup(moduleId: string, group: string): boolean {
    return moduleId === "notes" && this.dynamicGroups.has(group);
  }

  public provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuItem[]): () => void {
    this.providers.set(group, provider);
    return () => this.providers.delete(group);
  }

  public runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue> {
    this.calls.push(`run ${name}`);
    return Promise.resolve({ name, commandArguments });
  }

  public postNotificationAsync(post: NotificationPost): Promise<number> {
    this.calls.push(`post ${post.title}`);
    return Promise.resolve(this.calls.length);
  }

  public updateNotificationAsync(id: number, post: NotificationPost): Promise<void> {
    this.calls.push(`update ${id} ${post.title}`);
    return Promise.resolve();
  }

  public dismissNotification(id: number): void {
    this.calls.push(`dismiss ${id}`);
  }

  public readSetting(name: string): JsonValue | undefined {
    return name === "notes.missing" ? undefined : `${name} value`;
  }

  public writeSettingAsync(name: string, value: JsonValue, scope: SettingScope | null): Promise<void> {
    this.calls.push(`write ${name} ${JSON.stringify(value)} ${scope?.id ?? "app"}`);
    return Promise.resolve();
  }

  public resetSettingAsync(name: string, scope: SettingScope | null): Promise<void> {
    this.calls.push(`reset ${name} ${scope?.id ?? "app"}`);
    return Promise.resolve();
  }

  public onSettingChanged(listener: (change: SettingChange) => void): () => void {
    this.settingListeners.add(listener);
    return () => this.settingListeners.delete(listener);
  }

  public changeSetting(change: SettingChange): void {
    for (const listener of this.settingListeners)
      listener(change);
  }

  public setViewBadge(view: string, badge: ViewBadge | null): void {
    this.calls.push(`badge ${view} ${badge?.count ?? "dot"} ${badge?.description ?? "none"}`);
  }

  public refresh(): void {
    this.calls.push("refresh");
  }

  public publish(name: string, payload: JsonValue): void {
    for (const listener of this.listeners)
      listener(name, payload);
  }
}

describe("WindowPartContext", () => {
  const notification = (kind: string, title: string, action: string | null): NotificationPost => new NotificationPost(
    QualifiedName.parse(kind), null, title, null, NotificationSeverity.Info, null,
    action === null ? [] : [new NotificationAction("Show", new CommandRun(QualifiedName.parse(action), null))], null);
  const load = (): Promise<Type<unknown>> => Promise.resolve(ListComponent);
  const view = (name: string): ViewContribution => new ViewContribution(name, "Notes", "sticky_note_2", DockSide.Left, true, load);
  let host: FakeWindowPartHost;
  let context: WindowPartContext;

  beforeEach(() => {
    host = new FakeWindowPartHost();
    const source = new WindowPartSource("notes", ["tasks"], ["notes.list"], ["notes.note"], ["notes.newNote", "notes.taken"], ["notes.count", "notes.sync"], ["notes.compose", "notes.share"], ["notes.saved"],
      () => Promise.reject<IWindowPart>(new Error("unused")));
    context = new WindowPartContext(source, host);
  });

  it("posts, updates and dismisses its declared notifications, and dismisses the rest when withdrawn", async () => {
    const first = await context.postNotificationAsync(notification("notes.saved", "Saved", "tasks.show"));
    const second = await context.postNotificationAsync(notification("notes.saved", "Saved again", "notes.newNote"));
    await first.updateAsync(notification("notes.saved", "Saved twice", null));
    first.dismiss();
    first.dismiss();
    context.withdraw();
    second.dismiss();

    expect([first.id, second.id]).toEqual([1, 2]);
    expect(host.calls).toEqual(["post Saved", "post Saved again", "update 1 Saved twice", "dismiss 1", "dismiss 2", "refresh"]);
  });

  it("neither updates nor dismisses a notification it dismissed or forgot, and still handles one posted afterwards", async () => {
    const dismissed = await context.postNotificationAsync(notification("notes.saved", "Saved", null));
    dismissed.dismiss();
    await dismissed.updateAsync(notification("notes.saved", "Saved twice", null));
    const forgotten = await context.postNotificationAsync(notification("notes.saved", "Saved again", null));
    context.forgetNotifications();
    await forgotten.updateAsync(notification("notes.saved", "Saved again twice", null));
    forgotten.dismiss();
    const later = await context.postNotificationAsync(notification("notes.saved", "Saved later", null));
    await later.updateAsync(notification("notes.saved", "Saved later twice", null));
    context.withdraw();

    expect(host.calls).toEqual(["post Saved", "dismiss 1", "post Saved again", "post Saved later", "update 4 Saved later twice", "dismiss 4", "refresh"]);
  });

  it("refuses a notification of another module, an undeclared kind or another module's command, before and on update", async () => {
    const posted = await context.postNotificationAsync(notification("notes.saved", "Saved", null));

    await expect(context.postNotificationAsync(notification("tasks.due", "Due", null))).rejects.toThrowError(WindowPartAccessException);
    await expect(context.postNotificationAsync(notification("notes.deleted", "Deleted", null)))
      .rejects.toThrowError("The module notes does not declare the notification kind notes.deleted.");
    await expect(context.postNotificationAsync(notification("notes.saved", "Saved", "calendar.show"))).rejects.toThrowError(WindowPartAccessException);
    await expect(posted.updateAsync(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Info,
      new CommandRun(QualifiedName.parse("clock.open"), null), [], null))).rejects.toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["post Saved"]);
  });

  it("reads its own, its dependencies' and the shell's settings, changes only its own, and hears their changes until withdrawn", async () => {
    const folder = new SettingScope(QualifiedName.parse("notes.folder"), "f1");
    const heard: string[] = [];
    context.onSettingChanged("tasks.size", (value, scope) => heard.push(`${String(value)} ${scope?.id ?? "app"}`));

    const read = ["notes.sortBy", "tasks.size", "shell.mode", "notes.missing"].map(t => context.readSetting(t));
    await context.writeSettingAsync("notes.sortBy", "date");
    await context.writeSettingAsync("notes.sortBy", "title", folder);
    await context.resetSettingAsync("notes.sortBy");
    await context.resetSettingAsync("notes.sortBy", folder);
    host.changeSetting(new SettingChange(new SettingKey(QualifiedName.parse("shell.mode")), "Dark", true));
    host.changeSetting(new SettingChange(new SettingKey(QualifiedName.parse("tasks.size"), folder), 2, true));
    context.withdraw();
    host.changeSetting(new SettingChange(new SettingKey(QualifiedName.parse("tasks.size")), 3, true));

    expect(read).toEqual(["notes.sortBy value", "tasks.size value", "shell.mode value", undefined]);
    expect(host.calls).toEqual(["write notes.sortBy \"date\" app", "write notes.sortBy \"title\" f1", "reset notes.sortBy app", "reset notes.sortBy f1", "refresh"]);
    expect(heard).toEqual(["2 f1"]);
    expect(() => context.readSetting("clock.speed")).toThrowError(WindowPartAccessException);
    expect(() => context.onSettingChanged("clock.speed", () => undefined)).toThrowError(WindowPartAccessException);
    await expect(context.writeSettingAsync("tasks.size", 1)).rejects.toThrowError(WindowPartAccessException);
    await expect(context.resetSettingAsync("shell.mode")).rejects.toThrowError(WindowPartAccessException);
  });

  it("registers its module's own views and documents and has the host refresh after each", () => {
    context.registerView(view("notes.list"));
    context.registerDocument(new DocumentContribution("notes.note", load));

    expect(context.moduleId).toBe("notes");
    expect(context.views.map(t => t.name)).toEqual(["notes.list"]);
    expect(context.documents.map(t => t.name)).toEqual(["notes.note"]);
    expect(host.calls).toEqual(["refresh", "refresh"]);
    expect(() => context.registerView(view("notes.list"))).toThrowError("The view notes.list is already registered.");
    expect(() => context.registerDocument(new DocumentContribution("notes.note", load))).toThrowError("The document notes.note is already registered.");
  });

  it("registers its declared commands, refuses others and runs its own and its dependencies' commands", async () => {
    const newNote = new CommandContribution("notes.newNote", "New note", null, "Mod+Alt+N", () => Promise.resolve(null));

    context.registerCommand(newNote);

    expect(context.commands).toEqual([newNote]);
    expect(() => context.registerCommand(new CommandContribution("notes.delete", "Delete", null, null, () => Promise.resolve(null))))
      .toThrowError("The module notes does not declare the command notes.delete.");
    expect(() => context.registerCommand(new CommandContribution("notes.taken", "Taken", null, null, () => Promise.resolve(null))))
      .toThrowError("The command notes.taken is already registered.");
    expect(() => context.registerCommand(new CommandContribution("clock.tick", "Tick", null, null, () => Promise.resolve(null))))
      .toThrowError(WindowPartAccessException);
    expect(await context.runCommandAsync("tasks.add", { title: "Write" })).toEqual({ name: "tasks.add", commandArguments: { title: "Write" } });
    expect(await context.runCommandAsync("notes.newNote")).toEqual({ name: "notes.newNote", commandArguments: null });
    expect(() => context.runCommandAsync("clock.tick")).toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["refresh", "run tasks.add", "run notes.newNote"]);
  });

  it("registers its declared status bar items in declared order and lets them change within its own and its dependencies' commands", () => {
    const sync = context.registerStatusBarItem(new StatusBarItemContribution("notes.sync", StatusBarSide.Right, new StatusBarItemState("Synced", { command: "tasks.sync" })));
    const count = context.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));

    count.update(new StatusBarItemState("3 notes", { command: "notes.newNote" }));

    expect(context.statusBarItems).toEqual([count, sync]);
    expect([count.name, count.side, count.state().text, sync.side]).toEqual(["notes.count", StatusBarSide.Left, "3 notes", StatusBarSide.Right]);
    expect(() => count.update(new StatusBarItemState("4 notes", { command: "clock.tick" }))).toThrowError(WindowPartAccessException);
    expect(count.state().text).toBe("3 notes");
    expect(host.calls).toEqual(["refresh", "refresh"]);
  });

  it("refuses a status bar item it does not declare, owns twice or another module owns, or one whose command it may not run", () => {
    const item = (name: string, command?: string): StatusBarItemContribution =>
      new StatusBarItemContribution(name, StatusBarSide.Left, new StatusBarItemState("Notes", Object.isUndefined(command) ? {} : { command }));
    context.registerStatusBarItem(item("notes.count"));

    expect(() => context.registerStatusBarItem(item("notes.words"))).toThrowError("The module notes does not declare the status bar item notes.words.");
    expect(() => context.registerStatusBarItem(item("notes.count"))).toThrowError("The status bar item notes.count is already registered.");
    expect(() => context.registerStatusBarItem(item("clock.ticks"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerStatusBarItem(item("notes.sync", "clock.tick"))).toThrowError(WindowPartAccessException);
    expect(context.statusBarItems.map(t => t.name)).toEqual(["notes.count"]);
  });

  it("registers its declared top bar actions in declared order and refuses others and other modules' commands", () => {
    const share = context.registerTopBarAction(new TopBarActionContribution("notes.share", new TopBarActionState("share", "Share", "tasks.share")));
    const compose = context.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));

    compose.update(new TopBarActionState("note_add", "New note", "notes.newNote", { isHidden: true }));

    expect(context.topBarActions).toEqual([compose, share]);
    expect([compose.name, compose.state().isHidden]).toEqual(["notes.compose", true]);
    expect(() => compose.update(new TopBarActionState("timer", "Tick", "clock.tick"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerTopBarAction(new TopBarActionContribution("notes.print", new TopBarActionState("print", "Print", "notes.newNote"))))
      .toThrowError("The module notes does not declare the top bar action notes.print.");
    expect(() => context.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote"))))
      .toThrowError("The top bar action notes.compose is already registered.");
    expect(host.calls).toEqual(["refresh", "refresh"]);
  });

  it("refuses another module's views, documents and documents to open, and its own that it does not declare or registers twice", () => {
    expect(() => context.registerView(view("clock.face"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerDocument(new DocumentContribution("notesx.note", load))).toThrowError(WindowPartAccessException);
    expect(() => context.registerView(view("notes.outline"))).toThrowError("The module notes does not declare the view notes.outline.");
    expect(() => context.registerDocument(new DocumentContribution("notes.page", load))).toThrowError("The module notes does not declare the document notes.page.");
    expect(() => context.openDocument("clock.page", "1", "Page")).toThrowError(WindowPartAccessException);
    expect(() => context.keepDocument("clock.page", "1")).toThrowError(WindowPartAccessException);
    expect(context.views).toEqual([]);
    expect(host.calls).toEqual([]);
  });

  it("opens its own documents through the host, as previews when asked, and keeps them", () => {
    context.openDocument("notes.note", "1", "Note 1");
    context.openDocument("notes.note", "2", "Note 2", { preview: true });
    context.openDocument("notes.note", "3", "Note 3", { preview: false });
    context.keepDocument("notes.note", "2");

    expect(host.calls).toEqual(["open notes notes.note 1 Note 1", "open notes notes.note 2 Note 2 as a preview", "open notes notes.note 3 Note 3", "keep notes notes.note 2"]);
  });

  it("shows its own, its dependencies' and the shell's views and documents in a dialog through the host, and refuses another module's", async () => {
    await context.showInDialogAsync("notes.list");
    await context.showInDialogAsync("notes.note", { instance: "1", title: "Note 1" });
    await context.showInDialogAsync("tasks.board", { title: "Board" });
    await context.showInDialogAsync("shell.settings");

    await expect(context.showInDialogAsync("clock.face")).rejects.toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["show notes.list - -", "show notes.note 1 Note 1", "show tasks.board - Board", "show shell.settings - -"]);
  });

  it("writes its log lines through the host under its module's id", () => {
    context.log("Opened the list");

    expect(host.calls).toEqual(["log notes Opened the list"]);
  });

  it("calls its own module's and its dependencies' methods and refuses others", async () => {
    expect(await context.requestAsync("notes.read", { id: 1 })).toEqual({ method: "notes.read", payload: { id: 1 } });
    expect(await context.requestAsync("tasks.list", null)).toEqual({ method: "tasks.list", payload: null });
    await expect(context.requestAsync("clock.time", null)).rejects.toThrowError(WindowPartAccessException);
    await expect(context.requestAsync("shell.stop", null)).rejects.toThrowError(WindowPartAccessException);
    expect(host.calls).toEqual(["request notes.read", "request tasks.list"]);
  });

  it("hears only the event it listens for, from its module or a dependency, until it stops listening", () => {
    const heard: JsonValue[] = [];
    const stop = context.onEvent("tasks.changed", t => heard.push(t));

    host.publish("tasks.changed", 1);
    host.publish("notes.changed", 2);
    stop();
    host.publish("tasks.changed", 3);

    expect(heard).toEqual([1]);
    expect(() => context.onEvent("clock.ticked", () => undefined)).toThrowError(WindowPartAccessException);
  });

  it("supplies the rows of its own dynamic groups, keeps only the commands it may run and stops supplying them when withdrawn", () => {
    const withdraw = context.provideMenuGroup("notes.recent", t => [new MenuRowContribution("notes.newNote", t, "New"), new MenuRowContribution("tasks.show"), new MenuRowContribution("other.show")]);
    const items = host.providers.get("notes.recent")?.({ tab: "a" }) ?? [];

    expect(items.map(t => [t.command, t.commandArguments, t.label])).toEqual([["notes.newNote", { tab: "a" }, "New"], ["tasks.show", {}, null]]);
    withdraw();
    expect(host.providers.has("notes.recent")).toBe(false);
    context.provideMenuGroup("notes.recent", () => []);
    context.withdraw();
    expect(host.providers.has("notes.recent")).toBe(false);
  });

  it("refuses to supply another module's group and a group that it does not declare as dynamic", () => {
    expect(() => context.provideMenuGroup("tasks.recent", () => [])).toThrowError(WindowPartAccessException);
    expect(() => context.provideMenuGroup("notes.sorting", () => [])).toThrowError(WindowPartAccessException);
  });

  it("sets and clears a badge on its own declared views only, and clears what it set when withdrawn", () => {
    context.setViewBadge("notes.list", new ViewBadge(3, "3 unread"));
    context.setViewBadge("notes.list", null);
    context.setViewBadge("notes.list", new ViewBadge(null, "Changed"));

    expect(() => context.setViewBadge("tasks.list", null)).toThrowError(WindowPartAccessException);
    expect(() => context.setViewBadge("notes.outline", null)).toThrowError(new WindowPartAccessException("The module notes does not declare the view notes.outline."));
    context.withdraw();
    context.withdraw();
    expect(host.calls).toEqual(["badge notes.list 3 3 unread", "badge notes.list dot none", "badge notes.list dot Changed", "badge notes.list dot none", "refresh", "refresh"]);
  });

  it("withdraws its contributions and listeners and has the host refresh", () => {
    const heard: JsonValue[] = [];
    context.registerView(view("notes.list"));
    context.registerDocument(new DocumentContribution("notes.note", load));
    context.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left, new StatusBarItemState("2 notes")));
    context.registerTopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")));
    context.onEvent("notes.changed", t => heard.push(t));

    context.withdraw();
    host.publish("notes.changed", 1);

    expect([context.views, context.documents, context.statusBarItems, context.topBarActions, heard, host.listeners.size]).toEqual([[], [], [], [], [], 0]);
    expect(host.calls).toEqual(["refresh", "refresh", "refresh", "refresh", "refresh"]);
  });
});
