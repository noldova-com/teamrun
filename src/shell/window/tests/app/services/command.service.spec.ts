/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { DialogService } from "@noldova/teamrun-shell-ui";

import { CommandNotFoundException } from "../../../src/app/exceptions/command-not-found.exception";
import { CommandContribution } from "../../../src/app/models/command-contribution";
import { WindowPartSource } from "../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../src/app/models/window-part-tokens";
import { CommandService } from "../../../src/app/services/command.service";
import { ShellCommandsService } from "../../../src/app/services/shell-commands.service";
import { Resources } from "../../../src/resources";
import { DesktopBridgeFixture } from "../../fixtures/desktop-bridge.fixture";
import { ViewDialogFixture } from "../../fixtures/view-dialog.fixture";

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

  let bridge: DesktopBridgeFixture;

  function start(platform: string, isDialogOpen: boolean = false, viewModule: string | null = null): CommandService {
    bridge = DesktopBridgeFixture.install(platform);
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } },
        { provide: DialogService, useValue: { isOpen: isDialogOpen } },
        ViewDialogFixture.provideShowing(viewModule),
        { provide: WindowPartTokens.sources, useValue: [new WindowPartSource("notes", "Notes", [], [], [], [], [], [], [], () => Promise.reject(new Error("unused")))] }
      ]
    });
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
    const shell = TestBed.inject(ShellCommandsService).commands;
    expect(service.commands().slice(0, shell.length)).toEqual(shell);
    expect(service.commands().slice(shell.length).map(t => t.name)).toEqual(["notes.newNote"]);
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

  it("runs only the edit commands' keys while a modal dialog is open, leaving the rest to the page", async () => {
    const service = start("win32", true);
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);
    bridge.publishEvent("shell.settingsChanged", { name: "shell.keyBindings", value: { "shell.selectAll": "F7" }, isSet: true });
    const input = document.createElement("input");
    input.value = "draft";
    document.body.append(input);
    input.focus();

    const module = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    const shell = press({ key: ",", code: "Comma", ctrlKey: true });
    const edit = new KeyboardEvent("keydown", { key: "F7", code: "F7", bubbles: true, cancelable: true });
    input.dispatchEvent(edit);
    input.remove();

    expect(runs).toEqual([]);
    expect([module.defaultPrevented, shell.defaultPrevented, edit.defaultPrevented]).toEqual([false, false, true]);
  });

  it("runs the keys of the module whose view a dialog shows, as in its tab, but still leaves the shell's to the page", async () => {
    const service = start("win32", true, "notes");
    service.setCommands([command("notes.newNote", "Mod+Alt+N"), command("clock.tick", "Mod+Alt+T")]);

    const module = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    const other = press({ key: "t", code: "KeyT", ctrlKey: true, altKey: true });
    const closeTab = press({ key: "w", code: "KeyW", ctrlKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.newNote null"]));
    expect([module.defaultPrevented, other.defaultPrevented, closeTab.defaultPrevented]).toEqual([true, false, false]);
    expect(["notes.newNote", "clock.tick", "shell.closeTab", "shell.selectAll"].map(t => service.isHeldByDialog(t))).toEqual([false, true, true, false]);
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

  it("applies the person's bindings as the setting changes and reports a command that fails", async () => {
    const service = start("linux");
    service.setCommands([command("notes.newNote", "Mod+Alt+N", true)]);
    const before = service.keyLabel("notes.newNote");
    bridge.publishEvent("shell.settingsChanged", { name: "shell.keyBindings", value: { "notes.newNote": "F6" }, isSet: true });

    press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });
    press({ key: "F6", code: "F6" });

    await vi.waitFor(() => expect(errors.map(t => (t as Error).message)).toEqual(["notes.newNote failed"]));
    expect(runs).toEqual(["notes.newNote null"]);
    expect(service.shortcuts().keyOf("notes.newNote")?.text).toBe("F6");
    expect([before, service.keyLabel("notes.newNote"), service.bindings().has("notes.newNote")]).toEqual(["Ctrl+Alt+N", "F6", true]);
  });

  it("names a command's owner: the product for the shell's, the module's name, or else its id", () => {
    const service = start("win32");

    expect(["shell.closeTab", "notes.newNote", "clock.tick"].map(t => service.ownerOf(t))).toEqual([Resources.productName, "Notes", "clock"]);
  });

  it("leaves the key of a disabled command to the page, and says which commands are enabled for given arguments", async () => {
    const service = start("win32");
    let isOn = false;
    service.setCommands([new CommandContribution("notes.archive", "Archive", null, "Mod+Alt+A", async () => {
      runs.push("notes.archive");
      return null;
    }, t => isOn || t !== null)]);

    const off = press({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    isOn = true;
    const on = press({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });

    await vi.waitFor(() => expect(runs).toEqual(["notes.archive"]));
    expect([off.defaultPrevented, on.defaultPrevented]).toEqual([false, true]);
    expect([service.isEnabled("notes.archive"), service.isEnabled("notes.archive", { id: 1 })]).toEqual([true, true]);
    expect(() => service.isEnabled("notes.gone")).toThrowError(CommandNotFoundException);
  });

  it("counts a command whose enabled check throws as disabled, reports the failure and leaves its key to the page", () => {
    const service = start("linux");
    service.setCommands([new CommandContribution("notes.openNote", "Open note", null, "Mod+Alt+O", async () => {
      runs.push("notes.openNote");
      return null;
    }, () => {
      throw new Error("The arguments name no note.");
    })]);

    const pressed = press({ key: "o", code: "KeyO", ctrlKey: true, altKey: true });

    expect([service.isEnabled("notes.openNote"), pressed.defaultPrevented, runs.length]).toEqual([false, false, 0]);
    expect(errors.map(t => (t as Error).message)).toEqual(["The arguments name no note.", "The arguments name no note."]);
  });

  it("asks a command whether it is checked, counts one with no check or whose check throws as unchecked and reports the failure", () => {
    const service = start("win32");
    service.setCommands([
      new CommandContribution("notes.wrapLines", "Wrap lines", null, null, () => Promise.resolve(null), () => true, t => t !== null),
      new CommandContribution("notes.newNote", "New note", null, null, () => Promise.resolve(null)),
      new CommandContribution("notes.sorting", "Sorting", null, null, () => Promise.resolve(null), () => true, () => {
        throw new Error("No sorting.");
      })
    ]);

    expect([service.isChecked("notes.wrapLines"), service.isChecked("notes.wrapLines", { on: true }), service.isChecked("notes.newNote"), service.isChecked("notes.sorting")])
      .toEqual([false, true, false, false]);
    expect(errors.map(t => (t as Error).message)).toEqual(["No sorting."]);
    expect(service.isChecked("notes.gone")).toBe(false);
    expect(errors.map(t => t instanceof CommandNotFoundException)).toEqual([false, true]);
  });

  it("labels a command's key for the platform, and has none for a command without one", () => {
    const service = start("darwin");
    service.setCommands([command("notes.newNote", "Mod+Alt+N"), command("notes.sync", null)]);

    expect([service.keyLabel("notes.newNote"), service.keyLabel("notes.sync")]).toEqual(["⌥⌘N", null]);
    expect(service.titleOf("notes.sync")).toBe("notes.sync");
    expect(() => service.titleOf("notes.gone")).toThrowError(CommandNotFoundException);
  });

  it("lists a command's default keys on the platform, the shell's own and a module's", () => {
    const service = start("darwin");
    service.setCommands([command("notes.newNote", "Mod+Alt+N"), command("notes.sync", null)]);

    expect(["shell.nextTab", "notes.newNote", "notes.sync"].map(t => service.defaultKeysOf(t).map(u => u.text))).toEqual([["Ctrl+Tab", "Mod+Alt+ArrowRight"], ["Mod+Alt+N"], []]);
  });

  it("runs a command by name and reports its failure", async () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", null, true)]);

    service.run("notes.newNote", { folder: "inbox" });
    service.run("notes.gone");

    await vi.waitFor(() => expect(errors.map(t => (t as Error).constructor.name).sort()).toEqual(["CommandNotFoundException", "Error"]));
    expect(runs).toEqual(["notes.newNote {\"folder\":\"inbox\"}"]);
  });

  it("stops listening when the window closes", () => {
    const service = start("win32");
    service.setCommands([command("notes.newNote", "Mod+Alt+N")]);

    TestBed.resetTestingModule();
    const event = press({ key: "n", code: "KeyN", ctrlKey: true, altKey: true });

    expect(event.defaultPrevented).toBe(false);
  });
});
