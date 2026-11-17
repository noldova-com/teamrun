/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { PlanWindow, PlanWindowName } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class CodexRateLimits {
  private readonly windows: Map<PlanWindowName, PlanWindow> = new Map();

  public merge(snapshot: JsonValue | undefined): readonly PlanWindow[] | null {
    const limits = UsageValues.objectOf(snapshot);
    const limitId = limits?.[Resources.limitIdField];
    if (Object.isNull(limits) || !Object.isNullOrUndefined(limitId) && limitId !== Resources.codexLimitId)
      return null;
    for (const field of [Resources.primaryField, Resources.secondaryField]) {
      const window = CodexRateLimits.windowOf(limits[field]);
      if (!Object.isNull(window))
        this.windows.set(window.name, window);
    }
    const credits = UsageValues.objectOf(limits[Resources.creditsField]);
    if (!Object.isNull(credits)) {
      const window = CodexRateLimits.creditsOf(credits);
      if (Object.isNull(window))
        this.windows.delete(PlanWindowName.Credits);
      else
        this.windows.set(window.name, window);
    }

    return [...this.windows.values()];
  }

  private static creditsOf(credits: JsonObject): PlanWindow | null {
    if (credits[Resources.unlimitedField] === true)
      return new PlanWindow(PlanWindowName.Credits, null, null, null, null, true);
    const balance = credits[Resources.balanceField];
    const amount = typeof balance === "string" && balance.trim().length > 0 ? UsageValues.amount(Number(balance)) : null;
    return credits[Resources.hasCreditsField] !== true || Object.isNull(amount) ? null
      : new PlanWindow(PlanWindowName.Credits, null, null, null, null, false, amount);
  }

  private static windowOf(value: JsonValue | undefined): PlanWindow | null {
    const window = UsageValues.objectOf(value);
    const minutes = window?.[Resources.windowDurationMinsField];
    const name = minutes === Resources.codexFiveHourMinutes ? PlanWindowName.FiveHour : minutes === Resources.codexWeeklyMinutes ? PlanWindowName.Weekly : null;
    const resetsAt = UsageValues.count(window?.[Resources.resetsAtField]);

    return UsageValues.window(name, window?.[Resources.usedPercentField], Object.isNull(resetsAt) ? null : new Date(resetsAt * Resources.millisecondsPerSecond).toISOString());
  }
}
