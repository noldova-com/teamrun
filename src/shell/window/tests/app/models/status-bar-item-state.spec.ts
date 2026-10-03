/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";

describe("StatusBarItemState", () => {
  it("keeps its text and options, and is shown without a command by default", () => {
    const plain = new StatusBarItemState("2 notes");
    const full = new StatusBarItemState("Ticks: 3", { icon: "timer", tooltip: "Tick the clock", command: "clock.tick", commandArguments: { by: 1 }, isHidden: true });

    expect([plain.text, plain.icon, plain.tooltip, plain.command, plain.commandArguments, plain.isHidden, plain.label]).toEqual(["2 notes", null, null, null, null, false, "2 notes"]);
    expect([full.icon, full.tooltip, full.command, full.commandArguments, full.isHidden, full.label]).toEqual(["timer", "Tick the clock", "clock.tick", { by: 1 }, true, "Tick the clock"]);
  });

  it("shows only an icon when it has a tooltip to name it", () => {
    const icon = new StatusBarItemState("", { icon: "notifications", tooltip: "Notifications" });

    expect([icon.text, icon.label]).toEqual(["", "Notifications"]);
  });

  it("refuses to show nothing, an icon without a name, a blank icon or tooltip and an invalid command", () => {
    expect(() => new StatusBarItemState(" ")).toThrowError("A status bar item shows text, an icon or both.");
    expect(() => new StatusBarItemState("", { icon: "notifications" })).toThrowError(/needs a tooltip/);
    expect(() => new StatusBarItemState("Notes", { icon: " " })).toThrowError(ArgumentException);
    expect(() => new StatusBarItemState("Notes", { tooltip: "" })).toThrowError(ArgumentException);
    expect(() => new StatusBarItemState("Notes", { command: "tick" })).toThrowError(ArgumentException);
  });
});
