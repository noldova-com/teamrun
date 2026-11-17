/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type ContextUsage, type PlanWindow, PlanWindowName, ReplyUsage } from "@noldova/teamrun.protocol";

import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class GrokUsageReader implements IAcpUsageReader {
  public readonly contextMethods: readonly string[] = Resources.xaiSessionInfoMethods;
  public readonly planMethods: readonly string[] = Resources.xaiBillingMethods;

  public readReply(result: JsonValue): ReplyUsage | null {
    const usage = UsageValues.fieldOf(result, Resources.acpMetaField, Resources.usageField);
    const inputTokens = UsageValues.count(UsageValues.fieldOf(usage, Resources.inputTokensField));
    const outputTokens = UsageValues.count(UsageValues.fieldOf(usage, Resources.outputTokensField));
    const ticks = UsageValues.count(UsageValues.fieldOf(usage, Resources.xaiCostTicksField));
    const cost = Object.isNull(ticks) ? null : ticks / Resources.xaiTicksPerUsd;

    const count = (field: string): number | null => UsageValues.count(UsageValues.fieldOf(usage, field));

    return Object.isNull(inputTokens) && Object.isNull(outputTokens) && Object.isNull(cost) ? null
      : new ReplyUsage(inputTokens, outputTokens, cost, null, count(Resources.xaiCachedReadTokensField), count(Resources.xaiCacheCreationTokensField),
        count(Resources.xaiReasoningTokensField));
  }

  public readContext(answer: JsonValue): ContextUsage | null {
    const context = UsageValues.fieldOf(answer, Resources.resultField, Resources.contextField);
    const total = UsageValues.count(UsageValues.fieldOf(context, Resources.xaiContextTotalField));
    const percent = UsageValues.count(UsageValues.fieldOf(context, Resources.xaiAutoCompactPercentField));
    const compactAt = Object.isNull(total) || Object.isNull(percent) || percent > Resources.percentScale ? null : Math.round(total * percent / Resources.percentScale);

    return UsageValues.context(UsageValues.fieldOf(context, Resources.xaiContextUsedField), total, compactAt);
  }

  public readPlan(answer: JsonValue): readonly PlanWindow[] | null {
    const config = UsageValues.objectOf(UsageValues.fieldOf(answer, Resources.configField));
    if (Object.isNull(config))
      return null;
    const period = config[Resources.xaiCurrentPeriodField];
    const type = UsageValues.fieldOf(period, Resources.typeField);
    const name = type === Resources.xaiWeeklyPeriod ? PlanWindowName.WeeklyCredits : type === Resources.xaiMonthlyPeriod ? PlanWindowName.MonthlyCredits : null;
    const window = UsageValues.window(name, config[Resources.xaiCreditUsagePercentField], UsageValues.time(UsageValues.fieldOf(period, Resources.xaiPeriodEndField)));

    return Object.isNull(window) ? [] : [window];
  }
}
