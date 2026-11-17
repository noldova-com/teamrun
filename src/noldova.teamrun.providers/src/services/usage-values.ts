/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { ContextUsage, PlanWindow, type PlanWindowName } from "@noldova/teamrun.protocol";

export class UsageValues {
  public static objectOf(value: JsonValue | undefined): JsonObject | null {
    return Object.isObject(value) && !Array.isArray(value) ? value as JsonObject : null;
  }

  public static fieldOf(value: JsonValue | undefined, ...path: readonly string[]): JsonValue | undefined {
    let current = value;
    for (const name of path)
      current = UsageValues.objectOf(current)?.[name];
    return current;
  }

  public static count(value: JsonValue | undefined): number | null {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  public static amount(value: JsonValue | undefined): number | null {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  }

  public static time(value: JsonValue | undefined): string | null {
    const date = typeof value === "string" && value.trim().length > 0 ? new Date(value) : null;
    return Object.isNull(date) || Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  public static timeFromMilliseconds(value: JsonValue | undefined): string | null {
    const milliseconds = UsageValues.count(value);
    return Object.isNull(milliseconds) ? null : new Date(milliseconds).toISOString();
  }

  public static context(used: JsonValue | undefined, window: JsonValue | undefined, compactAt: JsonValue | undefined = null): ContextUsage | null {
    const usedTokens = UsageValues.count(used);
    const windowTokens = UsageValues.count(window);
    const compactAtTokens = UsageValues.count(compactAt);
    if (Object.isNull(usedTokens) || Object.isNull(windowTokens) || windowTokens === 0)
      return null;
    return new ContextUsage(usedTokens, windowTokens, compactAtTokens === 0 ? null : compactAtTokens);
  }

  public static window(name: PlanWindowName | null, usedPercent: JsonValue | undefined, resetsAt: string | null): PlanWindow | null {
    const used = UsageValues.amount(usedPercent);
    return Object.isNull(name) || Object.isNull(used) ? null : new PlanWindow(name, used, resetsAt);
  }
}
