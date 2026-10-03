/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { StatusBarSide } from "../../../src/app/enums/status-bar-side";
import { TopBarSide } from "../../../src/app/enums/top-bar-side";
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

  it("splits the status bar's items and the top bar's actions by side, keeping their order", () => {
    const bars = TestBed.inject(BarItemsService);
    const items = [item("notes.count", StatusBarSide.Left), item("notes.sync", StatusBarSide.Right), item("clock.ticks", StatusBarSide.Right), item("clock.zone", StatusBarSide.Left)];
    const action = (name: string, side?: TopBarSide): TopBarAction =>
      new TopBarAction(new TopBarActionContribution(name, new TopBarActionState("note_add", "New note", "notes.newNote"), side), () => undefined);
    const actions = [action("notes.compose"), action("notes.back", TopBarSide.Start), action("notes.print", TopBarSide.End), action("notes.forward", TopBarSide.Start)];

    bars.set(items, actions);

    expect(bars.leftItems().map(t => t.name)).toEqual(["notes.count", "clock.zone"]);
    expect(bars.rightItems().map(t => t.name)).toEqual(["notes.sync", "clock.ticks"]);
    expect(bars.startActions().map(t => t.name)).toEqual(["notes.back", "notes.forward"]);
    expect(bars.endActions().map(t => t.name)).toEqual(["notes.compose", "notes.print"]);
  });
});
