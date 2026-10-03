/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { DockSide } from "../../../src/app/enums/dock-side";
import { WindowPartAccessException } from "../../../src/app/exceptions/window-part-access.exception";
import type { IWindowPartHost } from "../../../src/app/interfaces/i-window-part-host";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import type { IWindowPart } from "../../../src/app/interfaces/i-window-part";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";
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

  public isCommandRegistered(name: string): boolean {
    return this.registered.has(name);
  }

  public runCommandAsync(name: string, commandArguments: JsonValue): Promise<JsonValue> {
    this.calls.push(`run ${name}`);
    return Promise.resolve({ name, commandArguments });
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
  const load = (): Promise<Type<unknown>> => Promise.resolve(ListComponent);
  const view = (name: string): ViewContribution => new ViewContribution(name, "Notes", "sticky_note_2", DockSide.Left, true, load);
  let host: FakeWindowPartHost;
  let context: WindowPartContext;

  beforeEach(() => {
    host = new FakeWindowPartHost();
    const source = new WindowPartSource("notes", "Notes", ["tasks"], [], ["notes.newNote", "notes.taken"], ["notes.count", "notes.sync"], ["notes.compose", "notes.share"],
      () => Promise.reject<IWindowPart>(new Error("unused")));
    context = new WindowPartContext(source, host);
  });

  it("registers its module's own views and documents and has the host refresh after each", () => {
    context.registerView(view("notes.list"));
    context.registerDocument(new DocumentContribution("notes.note", load));

    expect(context.moduleId).toBe("notes");
    expect(context.views.map(t => t.name)).toEqual(["notes.list"]);
    expect(context.documents.map(t => t.name)).toEqual(["notes.note"]);
    expect(host.calls).toEqual(["refresh", "refresh"]);
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

  it("refuses another module's views, documents and documents to open", () => {
    expect(() => context.registerView(view("clock.face"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerDocument(new DocumentContribution("notesx.note", load))).toThrowError(WindowPartAccessException);
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
