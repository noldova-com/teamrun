/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { type ContextUsage, type PlanWindow, ReplyUsage } from "@noldova/teamrun.protocol";

import type { IAcpUsageReader } from "../../interfaces/i-acp-usage.reader.js";
import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";

export class AcpUsageReader implements IAcpUsageReader {
  public readonly contextMethods: readonly string[] = [];
  public readonly planMethods: readonly string[] = [];

  public readReply(result: JsonValue): ReplyUsage | null {
    const usage = UsageValues.fieldOf(result, Resources.usageField);
    const count = (field: string): number | null => UsageValues.count(UsageValues.fieldOf(usage, field));
    const inputTokens = count(Resources.inputTokensField);
    const outputTokens = count(Resources.outputTokensField);

    if (Object.isNull(inputTokens) && Object.isNull(outputTokens))
      return null;
    const cacheReadTokens = count(Resources.acpCachedReadTokensField);
    const cacheWriteTokens = count(Resources.acpCachedWriteTokensField);
    return new ReplyUsage(AcpUsageReader.inputOf(inputTokens, outputTokens, count(Resources.totalTokensField), cacheReadTokens, cacheWriteTokens), outputTokens,
      null, null, cacheReadTokens, cacheWriteTokens, count(Resources.acpThoughtTokensField));
  }

  private static inputOf(inputTokens: number | null, outputTokens: number | null, totalTokens: number | null, cacheReadTokens: number | null,
    cacheWriteTokens: number | null): number | null {
    if (Object.isNull(inputTokens) || totalTokens === inputTokens + (outputTokens ?? 0))
      return inputTokens;
    return inputTokens + (cacheReadTokens ?? 0) + (cacheWriteTokens ?? 0);
  }

  public readContext(_answer: JsonValue): ContextUsage | null {
    return null;
  }

  public readPlan(_answer: JsonValue): readonly PlanWindow[] | null {
    return null;
  }
}
