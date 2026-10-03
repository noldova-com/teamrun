/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";

describe("StatusBarItemContribution", () => {
  it("keeps its name, side and first state, and refuses an invalid name", () => {
    const state = new StatusBarItemState("2 notes");
    const item = new StatusBarItemContribution("notes.count", StatusBarSide.Left, state);

    expect([item.name, item.side, item.state]).toEqual(["notes.count", StatusBarSide.Left, state]);
    expect(() => new StatusBarItemContribution("count", StatusBarSide.Left, state)).toThrowError(ArgumentException);
  });
});
