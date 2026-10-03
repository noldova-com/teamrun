/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import { StatusBarItem } from "../../../src/app/models/status-bar-item";
import { StatusBarItemContribution } from "../../../src/app/models/status-bar-item-contribution";
import { StatusBarItemState } from "../../../src/app/models/status-bar-item-state";
import { TopBarAction } from "../../../src/app/models/top-bar-action";
import { TopBarActionContribution } from "../../../src/app/models/top-bar-action-contribution";
import { TopBarActionState } from "../../../src/app/models/top-bar-action-state";
import { BarItemsService } from "../../../src/app/services/bar-items.service";

describe("BarItemsService", () => {
  const item = (name: string, side: StatusBarSide): StatusBarItem =>
    new StatusBarItem(new StatusBarItemContribution(name, side, new StatusBarItemState(name)), () => undefined);

  it("splits the status bar's items by side, keeping their order, and keeps the top bar's actions", () => {
    const bars = TestBed.inject(BarItemsService);
    const items = [item("notes.count", StatusBarSide.Left), item("notes.sync", StatusBarSide.Right), item("clock.ticks", StatusBarSide.Right), item("clock.zone", StatusBarSide.Left)];
    const action = new TopBarAction(new TopBarActionContribution("notes.compose", new TopBarActionState("note_add", "New note", "notes.newNote")), () => undefined);

    bars.set(items, [action]);

    expect(bars.leftItems().map(t => t.name)).toEqual(["notes.count", "clock.zone"]);
    expect(bars.rightItems().map(t => t.name)).toEqual(["notes.sync", "clock.ticks"]);
    expect(bars.topBarActions()).toEqual([action]);
  });
});
