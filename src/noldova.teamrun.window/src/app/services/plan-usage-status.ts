/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IWindowPartContext, type StatusBarItem, StatusBarItemContribution, type StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";

import { Resources } from "../../resources";
import { UsageFormatterService } from "./usage-formatter.service";

export class PlanUsageStatus {
  private static readonly statuses: WeakMap<IWindowPartContext, PlanUsageStatus> = new WeakMap();

  private readonly item: StatusBarItem;
  private owner: string | null = null;

  private constructor(item: StatusBarItem) {
    this.item = item;
  }

  public static register(context: IWindowPartContext): void {
    const item = context.registerStatusBarItem(new StatusBarItemContribution(Resources.planUsageStatusItem, StatusBarSide.Right, UsageFormatterService.hidden));
    PlanUsageStatus.statuses.set(context, new PlanUsageStatus(item));
  }

  public static of(context: IWindowPartContext): PlanUsageStatus | null {
    return PlanUsageStatus.statuses.get(context) ?? null;
  }

  public static release(context: IWindowPartContext): void {
    PlanUsageStatus.statuses.delete(context);
  }

  public show(conversationId: string, state: StatusBarItemState): void {
    this.owner = conversationId;
    this.item.update(state);
  }

  public release(conversationId: string): void {
    if (this.owner !== conversationId)
      return;
    this.owner = null;
    this.item.update(UsageFormatterService.hidden);
  }
}
