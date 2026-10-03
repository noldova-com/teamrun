/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { CommandContribution } from "../../../src/app/models/command-contribution";

describe("CommandContribution", () => {
  const run = (): Promise<null> => Promise.resolve(null);

  it("keeps its name, title, icon, default key and handler", async () => {
    const command = new CommandContribution("notes.newNote", "New note", "note_add", "Alt+Mod+N", run);

    expect([command.name, command.title, command.icon, command.defaultKey?.text]).toEqual(["notes.newNote", "New note", "note_add", "Mod+Alt+N"]);
    expect(await command.runAsync(null)).toBeNull();
    expect(new CommandContribution("notes.newNote", "New note", null, null, run).defaultKey).toBeNull();
  });

  it("refuses an invalid name, a blank title or icon and a default key that is not allowed", () => {
    expect(() => new CommandContribution("newNote", "New note", null, null, run)).toThrowError(ArgumentException);
    expect(() => new CommandContribution("notes.newNote", " ", null, null, run)).toThrowError(ArgumentException);
    expect(() => new CommandContribution("notes.newNote", "New note", "", null, run)).toThrowError(ArgumentException);
    expect(() => new CommandContribution("notes.newNote", "New note", null, "Mod+Q", run)).toThrowError(/reserved for macOS/);
    expect(() => new CommandContribution("notes.newNote", "New note", null, "N", run)).toThrowError(/so that typing is never taken/);
  });
});
