/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { ContextUsage } from "./context-usage.js";

export class ReplyUsage {
  public readonly inputTokens: number | null;
  public readonly outputTokens: number | null;
  public readonly costUsd: number | null;
  public readonly context: ContextUsage | null;
  public readonly cacheReadTokens: number | null;
  public readonly cacheWriteTokens: number | null;
  public readonly reasoningTokens: number | null;

  public constructor(inputTokens: number | null, outputTokens: number | null, costUsd: number | null, context: ContextUsage | null,
    cacheReadTokens: number | null = null, cacheWriteTokens: number | null = null, reasoningTokens: number | null = null) {
    const counts: readonly (readonly [number | null, string])[] = [[inputTokens, Resources.inputTokensField], [outputTokens, Resources.outputTokensField],
      [cacheReadTokens, Resources.cacheReadTokensField], [cacheWriteTokens, Resources.cacheWriteTokensField], [reasoningTokens, Resources.reasoningTokensField]];
    for (const [count, field] of counts)
      if (!Object.isNull(count))
        ContextUsage.throwIfNotCount(count, field);
    if (!Object.isNull(costUsd) && (!Number.isFinite(costUsd) || costUsd < 0))
      throw new ArgumentException(Resources.usageFigureNegative, Resources.costUsdField);

    this.inputTokens = inputTokens;
    this.outputTokens = outputTokens;
    this.costUsd = costUsd;
    this.context = context;
    this.cacheReadTokens = cacheReadTokens;
    this.cacheWriteTokens = cacheWriteTokens;
    this.reasoningTokens = reasoningTokens;
  }

  public static fromJson(value: unknown, path?: string): ReplyUsage {
    const reader = JsonReader.fromValue(value, path);
    const context = reader.readNullableObject(Resources.contextField);
    const cost = reader.readValue(Resources.costUsdField);
    return new ReplyUsage(reader.readNullableInteger(Resources.inputTokensField), reader.readNullableInteger(Resources.outputTokensField),
      Object.isNull(cost) ? null : reader.readNumber(Resources.costUsdField), Object.isNull(context) ? null : ContextUsage.fromJson(context.toJson(), context.path),
      ReplyUsage.readOptionalCount(reader, Resources.cacheReadTokensField), ReplyUsage.readOptionalCount(reader, Resources.cacheWriteTokensField),
      ReplyUsage.readOptionalCount(reader, Resources.reasoningTokensField));
  }

  public toJson(): JsonObject {
    return {
      [Resources.inputTokensField]: this.inputTokens,
      [Resources.outputTokensField]: this.outputTokens,
      [Resources.costUsdField]: this.costUsd,
      [Resources.contextField]: this.context?.toJson() ?? null,
      [Resources.cacheReadTokensField]: this.cacheReadTokens,
      [Resources.cacheWriteTokensField]: this.cacheWriteTokens,
      [Resources.reasoningTokensField]: this.reasoningTokens
    };
  }

  public merge(newer: ReplyUsage): ReplyUsage {
    return new ReplyUsage(newer.inputTokens ?? this.inputTokens, newer.outputTokens ?? this.outputTokens, newer.costUsd ?? this.costUsd,
      newer.context ?? this.context, newer.cacheReadTokens ?? this.cacheReadTokens, newer.cacheWriteTokens ?? this.cacheWriteTokens,
      newer.reasoningTokens ?? this.reasoningTokens);
  }

  private static readOptionalCount(reader: JsonReader, name: string): number | null {
    return reader.hasField(name) ? reader.readNullableInteger(name) : null;
  }
}
