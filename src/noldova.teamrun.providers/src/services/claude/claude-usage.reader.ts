/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { ContextUsage, type PlanWindow, PlanWindowName, ReplyUsage } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class ClaudeUsageReader {
  private static readonly windowNames: readonly (readonly [string, PlanWindowName])[] = [
    [Resources.claudeFiveHourWindow, PlanWindowName.FiveHour],
    [Resources.claudeSevenDayWindow, PlanWindowName.Weekly],
    [Resources.claudeSevenDayOpusWindow, PlanWindowName.WeeklyOpus],
    [Resources.claudeSevenDaySonnetWindow, PlanWindowName.WeeklySonnet]
  ];

  public static readReply(result: unknown, billed: boolean): ReplyUsage | null {
    const json = ClaudeUsageReader.toJson(result);
    const models = Object.values(UsageValues.objectOf(UsageValues.fieldOf(json, Resources.claudeModelUsageField)) ?? {});
    const sum = (field: string): number | null => models.reduce<number | null>((total, model) => {
      const count = UsageValues.count(UsageValues.fieldOf(model, field));
      return Object.isNull(total) || Object.isNull(count) ? null : total + count;
    }, models.length === 0 ? null : 0);
    const uncached = sum(Resources.inputTokensField);
    const cacheRead = sum(Resources.claudeCacheReadInputTokensField);
    const cacheWrite = sum(Resources.claudeCacheCreationInputTokensField);
    const inputTokens = Object.isNull(uncached) || Object.isNull(cacheRead) || Object.isNull(cacheWrite) ? null : uncached + cacheRead + cacheWrite;
    const outputTokens = sum(Resources.outputTokensField);
    const cost = billed ? UsageValues.amount(UsageValues.fieldOf(json, Resources.claudeTotalCostField)) : null;

    return Object.isNull(inputTokens) && Object.isNull(outputTokens) && Object.isNull(cost) ? null
      : new ReplyUsage(inputTokens, outputTokens, cost, null, cacheRead, cacheWrite, null);
  }

  public static readsHourCache(result: unknown): boolean {
    const written = UsageValues.count(UsageValues.fieldOf(ClaudeUsageReader.toJson(result), Resources.usageField, Resources.claudeCacheCreationField,
      Resources.claudeHourCacheWritesField));
    return !Object.isNull(written) && written > 0;
  }

  public static readContext(response: unknown, chosenWindow: number | null = null): ContextUsage | null {
    const json = ClaudeUsageReader.toJson(response);
    const compacts = UsageValues.fieldOf(json, Resources.claudeAutoCompactEnabledField) === true;
    const context = UsageValues.context(UsageValues.fieldOf(json, Resources.claudeTotalTokensField), UsageValues.fieldOf(json, Resources.claudeMaxTokensField),
      compacts ? UsageValues.fieldOf(json, Resources.claudeAutoCompactThresholdField) : null);
    if (Object.isNull(context) || Object.isNull(chosenWindow) || chosenWindow >= context.windowTokens)
      return context;
    const compactAt = context.compactAtTokens;
    return new ContextUsage(context.usedTokens, chosenWindow, Object.isNull(compactAt) ? null : Math.min(compactAt, chosenWindow));
  }

  public static readWindow(result: unknown, model: string | null): number | null {
    const window = Object.isNull(model) ? null
      : UsageValues.count(UsageValues.fieldOf(ClaudeUsageReader.toJson(result), Resources.claudeModelUsageField, model, Resources.claudeContextWindowField));
    return Object.isNull(window) || window === 0 ? null : window;
  }

  public static readPlan(response: unknown): readonly PlanWindow[] | null {
    const json = ClaudeUsageReader.toJson(response);
    if (UsageValues.fieldOf(json, Resources.claudeRateLimitsAvailableField) === false)
      return [];
    const limits = UsageValues.objectOf(UsageValues.fieldOf(json, Resources.rateLimitsSnakeField));
    if (Object.isNull(limits))
      return null;

    return ClaudeUsageReader.windowNames.flatMap(([field, name]) => {
      const reported = UsageValues.window(name, UsageValues.fieldOf(limits[field], Resources.claudeUtilizationField),
        UsageValues.time(UsageValues.fieldOf(limits[field], Resources.claudeResetsAtField)));
      return Object.isNull(reported) ? [] : [reported];
    });
  }

  private static toJson(value: unknown): JsonValue | undefined {
    try {
      return JsonReader.toJsonValue(value);
    }
    catch {
      return undefined;
    }
  }
}
