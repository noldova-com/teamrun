/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";

describe("TopBarActionState", () => {
  it("keeps its icon, title, command and options, and is shown with no arguments by default", () => {
    const plain = new TopBarActionState("note_add", "New note", "notes.newNote");
    const full = new TopBarActionState("note_add", "New note", "notes.newNote", { commandArguments: { title: "Plan" }, isHidden: true });

    expect([plain.icon, plain.title, plain.command, plain.commandArguments, plain.isHidden]).toEqual(["note_add", "New note", "notes.newNote", null, false]);
    expect([full.commandArguments, full.isHidden]).toEqual([{ title: "Plan" }, true]);
  });

  it("refuses a blank icon or title and an invalid command", () => {
    expect(() => new TopBarActionState(" ", "New note", "notes.newNote")).toThrowError(ArgumentException);
    expect(() => new TopBarActionState("note_add", "", "notes.newNote")).toThrowError(ArgumentException);
    expect(() => new TopBarActionState("note_add", "New note", "newNote")).toThrowError(ArgumentException);
  });
});
