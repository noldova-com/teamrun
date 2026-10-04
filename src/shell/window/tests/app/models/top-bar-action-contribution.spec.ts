/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TopBarSide } from "../../../src/app/enums/top-bar-side";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";

describe("TopBarActionContribution", () => {
  it("keeps its name and first state, and refuses an invalid name", () => {
    const state = new TopBarActionState("note_add", "New note", "notes.newNote");
    const action = new TopBarActionContribution("notes.compose", state);

    expect([action.name, action.state]).toEqual(["notes.compose", state]);
    expect(() => new TopBarActionContribution("compose", state)).toThrowError(ArgumentException);
  });

  it("is placed at the end of the row unless it asks for the start", () => {
    const state = new TopBarActionState("note_add", "New note", "notes.newNote");

    expect(new TopBarActionContribution("notes.compose", state).side).toBe(TopBarSide.End);
    expect(new TopBarActionContribution("notes.compose", state, TopBarSide.Start).side).toBe(TopBarSide.Start);
  });
});
