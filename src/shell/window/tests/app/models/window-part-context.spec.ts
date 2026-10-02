/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Type } from "@angular/core";

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import { DockSide } from "../../../src/app/enums/dock-side";
import { WindowPartAccessException } from "../../../src/app/exceptions/window-part-access.exception";
import type { IWindowPartHost } from "../../../src/app/interfaces/i-window-part-host";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { DocumentContribution } from "../../../src/app/models/document-contribution";
import { ViewContribution } from "../../../src/app/models/view-contribution";
import { WindowPartContext } from "../../../src/app/models/window-part-context";

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

  public openDocument(moduleId: string, name: string, instance: string, title: string): void {
    this.calls.push(`open ${moduleId} ${name} ${instance} ${title}`);
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
    context = new WindowPartContext("notes", ["tasks"], ["notes.newNote", "notes.taken"], host);
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

  it("refuses another module's views, documents and documents to open", () => {
    expect(() => context.registerView(view("clock.face"))).toThrowError(WindowPartAccessException);
    expect(() => context.registerDocument(new DocumentContribution("notesx.note", load))).toThrowError(WindowPartAccessException);
    expect(() => context.openDocument("clock.page", "1", "Page")).toThrowError(WindowPartAccessException);
    expect(context.views).toEqual([]);
    expect(host.calls).toEqual([]);
  });

  it("opens its own documents through the host", () => {
    context.openDocument("notes.note", "1", "Note 1");

    expect(host.calls).toEqual(["open notes notes.note 1 Note 1"]);
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
    context.onEvent("notes.changed", t => heard.push(t));

    context.withdraw();
    host.publish("notes.changed", 1);

    expect([context.views, context.documents, heard, host.listeners.size]).toEqual([[], [], [], 0]);
    expect(host.calls).toEqual(["refresh", "refresh", "refresh"]);
  });
});
