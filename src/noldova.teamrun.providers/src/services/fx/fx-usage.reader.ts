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

export class FxUsageReader implements IAcpUsageReader {
  public readonly contextMethods: readonly string[] = [];
  public readonly planMethods: readonly string[] = [];

  public readReply(result: JsonValue): ReplyUsage | null {
    const usage = UsageValues.fieldOf(result, Resources.usageField);
    const count = (field: string): number | null => UsageValues.count(UsageValues.fieldOf(usage, field));
    const inputTokens = count(Resources.inputTokensField);
    const outputTokens = count(Resources.outputTokensField);

    return Object.isNull(inputTokens) && Object.isNull(outputTokens) ? null
      : new ReplyUsage(inputTokens, outputTokens, null, null, count(Resources.fxCacheReadTokensField), count(Resources.fxCacheWriteTokensField),
        count(Resources.fxReasoningTokensField));
  }

  public readContext(_answer: JsonValue): ContextUsage | null {
    return null;
  }

  public readPlan(_answer: JsonValue): readonly PlanWindow[] | null {
    return null;
  }
}
