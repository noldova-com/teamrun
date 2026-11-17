/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader, JsonValue } from "@noldova/context.json";
import type { ITurnListener } from "@noldova/teamrun.core";
import { ReplyUsage } from "@noldova/teamrun.protocol";

import type { INotificationHandler } from "../../interfaces/i-notification-handler.js";
import { TokenTotals } from "../../models/token-totals.js";
import { Resources } from "../../resources.js";
import { UsageValues } from "../usage-values.js";
import type { CodexRateLimits } from "./codex-rate-limits.js";

export class CodexUsage implements INotificationHandler {
  private readonly threadId: string;
  private readonly listener: ITurnListener;
  private readonly before: TokenTotals | null;
  private readonly limits: CodexRateLimits;
  private latest: TokenTotals | null = null;
  private reportedWindow: number | null = null;

  public constructor(threadId: string, listener: ITurnListener, before: TokenTotals | null, limits: CodexRateLimits) {
    this.threadId = threadId;
    this.listener = listener;
    this.before = before;
    this.limits = limits;
  }

  public get totals(): TokenTotals | null {
    return this.latest ?? this.before;
  }

  public get window(): number | null {
    return this.reportedWindow;
  }

  public async handleNotificationAsync(method: string, params: JsonReader): Promise<void> {
    const json = params.toJson();
    if (method === Resources.rateLimitsUpdatedNotification) {
      const windows = this.limits.merge(json[Resources.rateLimitsField]);
      if (!Object.isNull(windows))
        await this.listener.onPlanUsageAsync(windows, new Date().toISOString());
    }
    else if (method === Resources.tokenUsageUpdatedNotification && json[Resources.threadIdField] === this.threadId)
      await this.handleTokenUsageAsync(json[Resources.tokenUsageField]);
  }

  private async handleTokenUsageAsync(usage: JsonValue | undefined): Promise<void> {
    const inputTokens = UsageValues.count(UsageValues.fieldOf(usage, Resources.totalField, Resources.inputTokensField));
    const outputTokens = UsageValues.count(UsageValues.fieldOf(usage, Resources.totalField, Resources.outputTokensField));
    const context = UsageValues.context(UsageValues.fieldOf(usage, Resources.lastField, Resources.totalTokensField), UsageValues.fieldOf(usage, Resources.modelContextWindowField));
    const counted = (field: string): number | null => UsageValues.count(UsageValues.fieldOf(usage, Resources.totalField, field));
    const totals = Object.isNull(inputTokens) || Object.isNull(outputTokens) ? null : new TokenTotals(inputTokens, outputTokens,
      counted(Resources.cachedInputTokensField), counted(Resources.cacheWriteInputTokensField), counted(Resources.reasoningOutputTokensField));
    if (!Object.isNull(totals))
      this.latest = totals;
    if (!Object.isNull(context))
      this.reportedWindow = context.windowTokens;
    const spent = Object.isNull(totals) || Object.isNull(this.before) || !totals.isAhead(this.before) ? null
      : totals.since(this.before);
    if (!Object.isNull(spent) || !Object.isNull(context))
      await this.listener.onUsageAsync(new ReplyUsage(spent?.inputTokens ?? null, spent?.outputTokens ?? null, null, context, spent?.cacheReadTokens ?? null,
        spent?.cacheWriteTokens ?? null, spent?.reasoningTokens ?? null));
  }
}
