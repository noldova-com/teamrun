/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { TopBarSide } from "../../../src/app/enums/top-bar-side";
import { TopBarAction } from "../../../src/app/models/top-bar-action";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";

describe("TopBarAction", () => {
  it("checks its first state and each update before showing it, and keeps the shown state when a check refuses one", () => {
    const checked: string[] = [];
    const action = new TopBarAction(new TopBarActionContribution("notes.share", new TopBarActionState("share", "Share", "notes.share"), TopBarSide.Start), t => {
      checked.push(t.title);
      if (t.title === "Refused")
        throw new Error("Refused.");
    });
    const first = action.state().title;

    action.update(new TopBarActionState("share", "Shared", "notes.share"));
    const updated = action.state().title;

    expect(() => action.update(new TopBarActionState("share", "Refused", "notes.share"))).toThrowError("Refused.");
    expect([action.name, action.side, first, updated, action.state().title, checked]).toEqual(["notes.share", TopBarSide.Start, "Share", "Shared", "Shared", ["Share", "Shared", "Refused"]]);
  });
});
