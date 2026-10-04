/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { KeyBindings } from "../../../src/app/models/key-bindings";

describe("KeyBindings", () => {
  it("reads the setting's commands and keys, a removed key as none", () => {
    const bindings = KeyBindings.fromJson({ "notes.newNote": "Shift+Alt+N", "shell.closeTab": null, "shell.openSettings": "Mod+Comma" });

    expect(bindings.list.map(t => [t.command, t.key?.text ?? null])).toEqual([["notes.newNote", "Alt+Shift+N"], ["shell.closeTab", null], ["shell.openSettings", "Mod+Comma"]]);
    expect([bindings.has("shell.closeTab"), bindings.has("clock.tick")]).toEqual([true, false]);
  });

  it("holds nothing before the settings load", () => {
    expect([KeyBindings.fromJson(undefined).list, KeyBindings.fromJson(["notes.newNote"]).list]).toEqual([[], []]);
  });

  it("skips an entry it cannot read and keeps the rest", () => {
    const bindings = KeyBindings.fromJson({ "notes.newNote": "Mod+W", "notes.open": "Shift+K", "notes": "F6", "clock.tick": "Mod+Plus", "clock.stop": 5, "shell.closeTab": "F7", "clock.pause": null });

    expect(bindings.toJson()).toEqual({ "shell.closeTab": "F7", "clock.pause": null });
  });

  it("adds, replaces and removes a command's entry without changing the original, and writes the setting's value", () => {
    const empty = KeyBindings.fromJson({});
    const bound = empty.with("notes.newNote", KeyChord.parse("F6")).with("clock.tick", null);
    const moved = bound.with("notes.newNote", KeyChord.parse("Mod+Alt+K")).without("clock.tick");

    expect([empty.toJson(), bound.toJson(), moved.toJson()]).toEqual([{}, { "notes.newNote": "F6", "clock.tick": null }, { "notes.newNote": "Mod+Alt+K" }]);
  });

  it("is the same as bindings with the same keys in any order", () => {
    const bindings = KeyBindings.fromJson({ "notes.newNote": "F6", "clock.tick": null });

    expect([
      bindings.isSameAs(KeyBindings.fromJson({ "clock.tick": null, "notes.newNote": "F6" })),
      bindings.isSameAs(KeyBindings.fromJson({ "notes.newNote": "F6", "clock.stop": null })),
      bindings.isSameAs(KeyBindings.fromJson({ "notes.newNote": "F7", "clock.tick": null })),
      bindings.isSameAs(KeyBindings.fromJson({ "notes.newNote": "F6" }))
    ]).toEqual([true, false, false, false]);
  });
});
