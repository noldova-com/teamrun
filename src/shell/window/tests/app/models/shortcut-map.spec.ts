/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { CommandContribution } from "../../../src/app/models/command-contribution";
import { ShortcutBinding } from "../../../src/app/models/shortcut-binding";
import { ShortcutMap } from "../../../src/app/models/shortcut-map";

describe("ShortcutMap", () => {
  const command = (name: string, key: string | null): CommandContribution => new CommandContribution(name, name, null, key, () => Promise.resolve(null));
  const press = (key: string, code: string, modifiers: Partial<Record<"ctrlKey" | "altKey" | "shiftKey" | "metaKey", boolean>>): KeyboardEventInit & { key: string; code: string } =>
    ({ key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...modifiers });

  it("finds the command a key runs, by the platform's modifiers", () => {
    const commands = [command("notes.newNote", "Mod+Alt+N"), command("clock.tick", "Ctrl+Alt+T")];

    const windows = new ShortcutMap(commands, [], "win32");
    const mac = new ShortcutMap(commands, [], "darwin");

    expect(windows.find(new KeyboardEvent("keydown", press("n", "KeyN", { ctrlKey: true, altKey: true })))).toBe("notes.newNote");
    expect(mac.find(new KeyboardEvent("keydown", press("n", "KeyN", { metaKey: true, altKey: true })))).toBe("notes.newNote");
    expect(mac.find(new KeyboardEvent("keydown", press("t", "KeyT", { ctrlKey: true, altKey: true })))).toBe("clock.tick");
    expect(windows.find(new KeyboardEvent("keydown", press("n", "KeyN", { ctrlKey: true })))).toBeUndefined();
    expect(windows.keyOf("clock.tick")?.text).toBe("Ctrl+Alt+T");
    expect(windows.keyOf("notes.open")).toBeNull();
    expect(windows.collisions).toEqual([]);
  });

  it("lets the first command keep a contested key and records each collision", () => {
    const commands = [command("clock.tick", "Mod+Alt+T"), command("notes.toggle", "Ctrl+Alt+T"), command("tasks.today", "Mod+Alt+T")];

    const windows = new ShortcutMap(commands, [], "linux");
    const mac = new ShortcutMap(commands, [], "darwin");

    expect(windows.collisions.map(t => [t.key.text, t.keptBy, t.refused])).toEqual([["Ctrl+Alt+T", "clock.tick", "notes.toggle"], ["Mod+Alt+T", "clock.tick", "tasks.today"]]);
    expect(mac.collisions.map(t => [t.key.text, t.keptBy, t.refused])).toEqual([["Mod+Alt+T", "clock.tick", "tasks.today"]]);
    expect(windows.keyOf("notes.toggle")).toBeNull();
    expect(mac.keyOf("notes.toggle")?.text).toBe("Ctrl+Alt+T");
  });

  it("puts the person's bindings before the defaults and unbinds a command bound to no key", () => {
    const commands = [command("clock.tick", "Mod+Alt+T"), command("notes.newNote", "Mod+Alt+N"), command("tasks.today", null)];
    const bindings = [
      new ShortcutBinding("tasks.today", KeyChord.parse("Mod+Alt+T")),
      new ShortcutBinding("notes.newNote", null),
      new ShortcutBinding("weather.refresh", KeyChord.parse("F5")),
      new ShortcutBinding("clock.tick", KeyChord.parse("Mod+Alt+T"))
    ];

    const map = new ShortcutMap(commands, bindings, "win32");

    expect(map.keyOf("tasks.today")?.text).toBe("Mod+Alt+T");
    expect(map.keyOf("notes.newNote")).toBeNull();
    expect(map.keyOf("clock.tick")).toBeNull();
    expect(map.find(new KeyboardEvent("keydown", press("F5", "F5", {})))).toBeUndefined();
    expect(map.collisions.map(t => [t.keptBy, t.refused])).toEqual([["tasks.today", "clock.tick"]]);
  });
});
