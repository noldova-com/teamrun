/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { CommandNotFoundException } from "../../../src/app/exceptions/command-not-found.exception";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { ShortcutBinding } from "../../../src/app/models/shortcut-binding";
import { CommandService } from "../../../src/app/services/command.service";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";

describe("CommandService", () => {
  let errors: unknown[];
  let runs: string[];

  const command = (name: string, key: string | null, fails: boolean = false): CommandContribution =>
    new CommandContribution(name, name, null, key, async t => {
      runs.push(`${name} ${JSON.stringify(t)}`);
      if (fails)
        throw new Error(`${name} failed`);
      return name;
    });

  function start(platform: string): CommandService {
    DesktopBridgeFixture.install(platform);
    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }] });
    return TestBed.inject(CommandService);
  }

  function press(init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    document.body.dispatchEvent(event);
    return event;
  }

  beforeEach(() => {
    errors = [];
    runs = [];
  });

  afterEach(() => DesktopBridgeFixture.remove());

  it("runs a command by name with its arguments and refuses one that is not registered", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", null)]);

    expect(await service.runAsync("notes.newNote", { folder: "inbox" })).toBe("notes.newNote");
    expect(await service.runAsync("notes.newNote")).toBe("notes.newNote");
    await expect(service.runAsync("clock.tick")).rejects.toThrowError(CommandNotFoundException);
    expect(runs).toEqual(["notes.newNote {\"folder\":\"inbox\"}", "notes.newNote null"]);
    expect(service.commands().map(t => t.name)).toEqual(["notes.newNote"]);
  });

  it("runs the command a key press is bound to and keeps the browser from handling it", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);

    const pressed = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    const other = press({ key: "n", code: "KeyN", ctrlKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote null"]));
    expect(pressed.defaultPrevented).toBe(true);
    expect(other.defaultPrevented).toBe(false);
  });

  it("uses Cmd for Mod on macOS", async () => {
    const service = start("darwin");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);

    press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    press({ key: "n", code: "KeyN", metaKey: true, altKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote null"]));
  });

  it("leaves keys an input or editor handled, composed text and repeats alone", () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);
    const input = document.createElement("input");
    document.body.append(input);
    input.addEventListener("keydown", t => t.preventDefault());

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "n", code: "KeyN", ctrlKey: true, altKey: true, bubbles: true, cancelable: true }));
    const composing = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true, isComposing: true });
    const repeated = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true, repeat: true });
    input.remove();

    expect(runs).toEqual([]);
    expect([composing.defaultPrevented, repeated.defaultPrevented]).toEqual([false, false]);
  });

  it("applies the person's bindings and reports a command that fails", async () => {
    const service = start("linux");
    service.setCommands([command("notes.newNote", "Mod+Alt+N", true)]);
    service.setBindings([new ShortcutBinding("notes.newNote", KeyChord.parse("F6"))]);

    press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    press({ key: "F6", code: "F6" });

    await vi.waitFor(() => expect(errors.map(t => (t as Error).message)).toEqual(["notes.newNote failed"]));
    expect(runs).toEqual(["notes.newNote null"]);
    expect(service.shortcuts().keyOf("notes.newNote")?.text).toBe("F6");
  });

  it("stops listening when the window closes", () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);

    TestBed.resetTestingModule();
    const event = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });

    expect(event.defaultPrevented).toBe(false);
  });
});
