/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import {
  DockSide, type IWindowPart, type IWindowPartContext, StatusBarItemContribution, StatusBarItemState, StatusBarSide, ViewBadge, ViewContribution
} from "@noldova/teamrun-shell-window";

export class ClockWindowPart implements IWindowPart {
  public readonly moduleId: string = "clock";

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    context.registerView(new ViewContribution("clock.face", "Clock", "schedule", DockSide.Right, true,
      () => import("./components/clock-face/clock-face.component").then(t => t.ClockFaceComponent)));
    const describe = (text: string): StatusBarItemState => new StatusBarItemState(text, { icon: "timer", tooltip: "Tick the clock", command: "clock.tick" });
    const ticks = context.registerStatusBarItem(new StatusBarItemContribution("clock.ticks", StatusBarSide.Right, describe("No ticks")));
    context.onEvent("clock.ticked", t => {
      const count = JsonReader.fromValue(t).readInteger("ticks");
      ticks.update(describe(`Ticks: ${count}`));
      context.setViewBadge("clock.face", new ViewBadge(count, `${count} ticks`));
    });
  }

  public async deactivateAsync(): Promise<void> {
  }
}
