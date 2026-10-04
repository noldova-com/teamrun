/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { MenuRowContribution } from "../../../src/app/models/menu-row-contribution";

describe("MenuRowContribution", () => {
  it("names a command with its arguments and an optional label, copying the arguments", () => {
    const commandArguments = { week: 3 };
    const row = new MenuRowContribution("notes.openNote", commandArguments, "Week 3");
    commandArguments.week = 4;

    expect([row.command, row.commandArguments, row.label]).toEqual(["notes.openNote", { week: 3 }, "Week 3"]);
    expect([new MenuRowContribution("notes.openNote").commandArguments, new MenuRowContribution("notes.openNote").label]).toEqual([{}, null]);
  });

  it("refuses a command that is not a qualified name and a blank label", () => {
    expect(() => new MenuRowContribution("openNote")).toThrowError(ArgumentException);
    expect(() => new MenuRowContribution("notes.openNote", {}, " ")).toThrowError(ArgumentException);
  });
});
