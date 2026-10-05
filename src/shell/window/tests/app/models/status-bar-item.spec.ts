/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import { StatusBarItem } from "../../../src/app/models/status-bar-item";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";

describe("StatusBarItem", () => {
  it("checks its first state and each update before showing it, and keeps the shown state when a check refuses one", () => {
    const checked: string[] = [];
    const item = new StatusBarItem(new StatusBarItemContribution("clock.ticks", StatusBarSide.Right, new StatusBarItemState("No ticks")), t => {
      checked.push(t.text);
      if (t.text === "Refused")
        throw new Error("Refused.");
    });
    const first = item.state().text;

    item.update(new StatusBarItemState("2 ticks"));
    const updated = item.state().text;

    expect(() => item.update(new StatusBarItemState("Refused"))).toThrowError("Refused.");
    expect([item.name, item.side, first, updated, item.state().text, checked]).toEqual(["clock.ticks", StatusBarSide.Right, "No ticks", "2 ticks", "2 ticks", ["No ticks", "2 ticks", "Refused"]]);
  });
});
