/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";

import { PlanUsageStatus } from "../../../src/app/services/plan-usage-status";
import { UsageFormatterService } from "../../../src/app/services/usage-formatter.service";
import { RecordingWindowPartContext } from "../../fixtures/recording-window-part-context.fixture";

describe("PlanUsageStatus", () => {
  const shown = new StatusBarItemState("5h 12%", { icon: "data_usage" });

  it("registers one hidden item on the status bar's right for each window part", () => {
    const context = new RecordingWindowPartContext();
    PlanUsageStatus.register(context);

    expect(context.statusBarItems.map(t => [t.name, t.side, t.state()])).toEqual([["teamrun.planUsage", StatusBarSide.Right, UsageFormatterService.hidden]]);
    expect(PlanUsageStatus.of(context)).not.toBeNull();
    expect(PlanUsageStatus.of(new RecordingWindowPartContext())).toBeNull();
    PlanUsageStatus.release(context);
    expect(PlanUsageStatus.of(context)).toBeNull();
  });

  it("shows the latest chat's figures and hides them only when that chat lets go", () => {
    const context = new RecordingWindowPartContext();
    PlanUsageStatus.register(context);
    const status = PlanUsageStatus.of(context)!;
    const item = context.statusBarItems[0]!;

    status.show("c1", shown);
    expect(item.state()).toBe(shown);
    status.show("c2", new StatusBarItemState("Week 3%"));
    status.release("c1");
    expect(item.state().text).toBe("Week 3%");
    status.release("c2");
    expect(item.state()).toBe(UsageFormatterService.hidden);
    status.release("c2");
    expect(item.state()).toBe(UsageFormatterService.hidden);
  });
});
