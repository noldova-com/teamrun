/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, inject } from "@angular/core";

import "@noldova/context.core";
import { StatusBarItemState } from "@noldova/desktop.window";
import { type ContextUsage, type Message, type PlanUsage, type PlanWindow, PlanWindowName, ReplyUsage } from "@noldova/teamrun.protocol";

import { UsageLevel } from "../enums/usage-level";
import { ReplyStatRow } from "../models/reply-stat-row";
import { ReplyStats } from "../models/reply-stats";
import { Resources } from "../../resources";
import { UsageMeter } from "../models/usage-meter";
import { ClockService } from "./clock.service";
import { TimeFormatService } from "./time-format.service";

@Injectable({ providedIn: "root" })
export class UsageFormatterService {
  public static readonly hidden: StatusBarItemState = new StatusBarItemState(Resources.planUsageLabel, { isHidden: true });
  private static readonly noUsage: ReplyUsage = new ReplyUsage(null, null, null, null);
  private static readonly compact: Intl.NumberFormat = new Intl.NumberFormat(Resources.usageNumberLocale, Resources.compactCountOptions);

  private readonly clock: ClockService = inject(ClockService);
  private readonly times: TimeFormatService = inject(TimeFormatService);

  public contextPercent(context: ContextUsage): number {
    return UsageFormatterService.percentOf(context.usedTokens, context.windowTokens);
  }

  public compactPercent(context: ContextUsage): number | null {
    return Object.isNull(context.compactAtTokens) ? null : UsageFormatterService.percentOf(context.compactAtTokens, context.windowTokens);
  }

  public contextDetail(context: ContextUsage, teammate: string): string {
    const compact = this.compactPercent(context);
    const detail = Resources.formatContextDetail(teammate, UsageFormatterService.count(context.usedTokens), UsageFormatterService.count(context.windowTokens));
    return Object.isNull(compact) ? detail : `${detail} ${Resources.formatCompactsAt(compact)}`;
  }

  public replyStats(message: Message): string | null {
    const usage = message.provenance?.usage ?? UsageFormatterService.noUsage;
    const parts: string[] = [];
    if (!Object.isNull(usage.inputTokens))
      parts.push(Resources.formatTokensIn(UsageFormatterService.count(usage.inputTokens)));
    if (!Object.isNull(usage.outputTokens))
      parts.push(Resources.formatTokensOut(UsageFormatterService.count(usage.outputTokens)));
    if (!Object.isNull(message.startedAt) && !Object.isNull(message.endedAt))
      parts.push(Resources.formatDuration(Date.parse(message.endedAt) - Date.parse(message.startedAt)));
    if (!Object.isNull(usage.costUsd))
      parts.push(UsageFormatterService.cost(usage.costUsd));
    return parts.length === 0 ? null : parts.join(Resources.titleSeparator);
  }

  public statsOf(message: Message, model: string | null): ReplyStats | null {
    const provenance = message.provenance;
    if (Object.isNull(provenance))
      return null;
    const usage = provenance.usage ?? UsageFormatterService.noUsage;
    const kind = provenance.observed.kind ?? provenance.requested.kind;
    const rows = [...UsageFormatterService.inputRows(usage, Resources.newInputKinds.includes(kind)), ...UsageFormatterService.outputRows(usage)];
    if (!Object.isNull(usage.costUsd))
      rows.push(new ReplyStatRow(Resources.costLabel, UsageFormatterService.cost(usage.costUsd)));
    if (!Object.isNull(usage.context))
      rows.push(new ReplyStatRow(Resources.contextLabel,
        Resources.formatContextShare(this.contextPercent(usage.context), UsageFormatterService.count(usage.context.windowTokens))));
    if (!Object.isNull(message.startedAt) && !Object.isNull(message.endedAt))
      rows.push(new ReplyStatRow(Resources.timeWorkedLabel, Resources.formatDuration(Date.parse(message.endedAt) - Date.parse(message.startedAt))));
    if (!Object.isNull(model))
      rows.push(new ReplyStatRow(Resources.modelLabel, model));
    const hasTokens = !Object.isNull(usage.inputTokens) || !Object.isNull(usage.outputTokens);
    return new ReplyStats(this.statsLabel(usage), hasTokens ? null : Resources.noTokensReportedText, rows);
  }

  public planLines(usage: PlanUsage): readonly string[] {
    if (usage.windows.length === 0)
      return [Resources.noUsageReportedLabel];
    return UsageFormatterService.ordered(usage).map(t => this.lineOf(t));
  }

  public limitsOf(usage: PlanUsage): readonly UsageMeter[] {
    return UsageFormatterService.shownOf(usage).map(t => this.meterOf(t));
  }

  public otherLines(usage: PlanUsage): readonly string[] {
    const shown = UsageFormatterService.shownOf(usage);
    return UsageFormatterService.ordered(usage).filter(t => !shown.includes(t)).map(t => this.lineOf(t));
  }

  public isNearLimit(usage: PlanUsage): boolean {
    return usage.windows.some(t => (UsageFormatterService.shownPercent(t) ?? UsageFormatterService.countPercent(t)) >= Resources.planWarningPercent);
  }

  public usedUpLabel(usage: PlanUsage | null): string | null {
    return Object.isNull(usage) || !usage.usedUp ? null : this.usedUpState(usage.usedUpUntil);
  }

  public usedUpNote(usage: PlanUsage | null): string | null {
    if (Object.isNull(usage) || !usage.usedUp)
      return null;
    const window = UsageFormatterService.ordered(usage).find(t => t.isUsedUp) ?? null;
    const until = usage.usedUpUntil ?? window?.resetsAt ?? null;
    const what = Object.isNull(window) ? Resources.usedUpLabel : Resources.formatLimitUsedUp(Resources.planWindowLabels[window.name]);
    return Object.isNull(until) ? what : Resources.formatUsedUpNote(what, this.usedUpResetOf(Date.parse(until)));
  }

  public leftLabel(usage: PlanUsage | null): string | null {
    if (Object.isNull(usage))
      return null;
    if (usage.usedUp)
      return this.usedUpState(usage.usedUpUntil);
    const used = UsageFormatterService.shownOf(usage).filter(t => !t.unlimited && Object.isNull(t.balance))
      .map(t => UsageFormatterService.shownPercent(t) ?? UsageFormatterService.countPercent(t));
    return used.length === 0 ? null : Resources.formatPercentLeft(Resources.fullPercent - Math.max(...used));
  }

  public usedUpState(until: string | null): string {
    if (Object.isNull(until))
      return Resources.usedUpLabel;
    const at = Date.parse(until);
    return at > this.clock.now() ? Resources.formatUsedUp(this.usedUpResetOf(at)) : Resources.formatWasUsedUp(this.shortResetOf(at));
  }

  public planStatus(usage: PlanUsage | null, provider: string): StatusBarItemState {
    if (Object.isNull(usage) || usage.windows.length === 0 && !Object.isNull(usage.plan))
      return UsageFormatterService.hidden;
    const near = this.isNearLimit(usage);
    const text = usage.windows.length === 0 ? Resources.noUsageReportedLabel : UsageFormatterService.shownOf(usage)
      .map(t => Resources.formatPlanShort(Resources.planWindowShortLabels[t.name], UsageFormatterService.figureOf(t, true))).join(Resources.titleSeparator);
    const tooltip = Resources.formatSentences([provider, ...(near ? [Resources.nearPlanLimitLabel] : []), ...this.planLines(usage)]);
    return new StatusBarItemState(text, { icon: near ? Resources.planLimitGlyph : Resources.planUsageGlyph, tooltip, command: Resources.showProvidersCommand });
  }

  private statsLabel(usage: ReplyUsage): string | null {
    const parts: string[] = [];
    if (!Object.isNull(usage.inputTokens))
      parts.push(Resources.formatShortTokensIn(UsageFormatterService.compact.format(usage.inputTokens)));
    if (!Object.isNull(usage.outputTokens))
      parts.push(Resources.formatShortTokensOut(UsageFormatterService.compact.format(usage.outputTokens)));
    if (parts.length > 0)
      return parts.join(Resources.titleSeparator);
    return Object.isNull(usage.context) ? null : Resources.formatShortContext(this.contextPercent(usage.context));
  }

  private meterOf(window: PlanWindow): UsageMeter {
    const label = Resources.planWindowShortLabels[window.name];
    if (window.unlimited || !Object.isNull(window.balance))
      return new UsageMeter(label, null, UsageFormatterService.figureOf(window, true), UsageLevel.Normal, this.lineOf(window));
    const used = UsageFormatterService.shownPercent(window) ?? UsageFormatterService.countPercent(window);
    const left = Math.max(0, Resources.wholePercent - used);
    const level = UsageFormatterService.levelOf(used);
    const count = window.used;
    const allowance = window.allowance;
    const figure = Object.isNull(count) || Object.isNull(allowance) ? Resources.formatShortLeft(left)
      : Resources.formatShortCountLeft(UsageFormatterService.count(Math.max(0, allowance - count)), UsageFormatterService.count(allowance));
    const reset = level !== UsageLevel.Normal && !Object.isNull(window.resetsAt) ? this.shortResetOf(Date.parse(window.resetsAt)) : null;
    return new UsageMeter(label, left, Object.isNull(reset) ? figure : `${figure}${Resources.titleSeparator}${reset}`, level, this.lineOf(window));
  }

  private lineOf(window: PlanWindow): string {
    return Resources.formatPlanWindow(Resources.planWindowLabels[window.name], UsageFormatterService.figureOf(window, false), this.resetOf(window));
  }

  private shortResetOf(at: number): string {
    const now = this.clock.now();
    const today = new Date(at).toDateString() === new Date(now).toDateString();
    if (today)
      return this.times.time(at);
    return at - now < Resources.dayMilliseconds ? this.times.shortDateTime(at) : this.times.shortDate(at);
  }

  private usedUpResetOf(at: number): string {
    const now = this.clock.now();
    if (new Date(at).toDateString() === new Date(now).toDateString())
      return this.times.time(at);
    return at > now && at - now < Resources.weekMilliseconds ? this.times.weekdayTime(at) : this.times.shortDate(at);
  }

  private resetOf(window: PlanWindow): string | null {
    if (window.unlimited || !Object.isNull(window.balance))
      return null;
    if (Object.isNull(window.resetsAt))
      return Resources.noResetLabel;
    const at = Date.parse(window.resetsAt);
    const today = new Date(at).toDateString() === new Date(this.clock.now()).toDateString();
    return Resources.formatResets(today ? this.times.time(at) : this.times.dateTime(at));
  }

  private static inputRows(usage: ReplyUsage, isInputTotal: boolean): readonly ReplyStatRow[] {
    const input = usage.inputTokens;
    const rows: ReplyStatRow[] = Object.isNull(input) ? [] : [new ReplyStatRow(Resources.tokensInLabel, UsageFormatterService.count(input))];
    if (!Object.isNull(usage.cacheReadTokens))
      rows.push(new ReplyStatRow(Resources.fromCacheLabel, UsageFormatterService.count(usage.cacheReadTokens), !Object.isNull(input)));
    if (!Object.isNull(usage.cacheWriteTokens))
      rows.push(new ReplyStatRow(Resources.writtenToCacheLabel, UsageFormatterService.count(usage.cacheWriteTokens), !Object.isNull(input)));
    if (!Object.isNull(input) && isInputTotal && rows.length > 1)
      rows.push(new ReplyStatRow(Resources.newInputLabel, UsageFormatterService.count(Math.max(0, input - (usage.cacheReadTokens ?? 0) - (usage.cacheWriteTokens ?? 0))), true));
    return rows;
  }

  private static outputRows(usage: ReplyUsage): readonly ReplyStatRow[] {
    const output = usage.outputTokens;
    const rows: ReplyStatRow[] = Object.isNull(output) ? [] : [new ReplyStatRow(Resources.tokensOutLabel, UsageFormatterService.count(output))];
    if (!Object.isNull(usage.reasoningTokens))
      rows.push(new ReplyStatRow(Resources.reasoningLabel, UsageFormatterService.count(usage.reasoningTokens), !Object.isNull(output)));
    return rows;
  }

  private static cost(costUsd: number): string {
    return Resources.formatCost(costUsd.toFixed(costUsd > 0 && costUsd < Resources.smallCostUsd ? Resources.smallCostDigits : Resources.costDigits));
  }

  private static ordered(usage: PlanUsage): readonly PlanWindow[] {
    const names = Object.values(PlanWindowName);
    return [...usage.windows].sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
  }

  private static shownOf(usage: PlanUsage): readonly PlanWindow[] {
    return UsageFormatterService.ordered(usage).toSorted((a, b) => Number(b.isUsedUp) - Number(a.isUsedUp))
      .slice(0, Resources.shownPlanWindows);
  }

  private static figureOf(window: PlanWindow, short: boolean): string {
    const percent = UsageFormatterService.shownPercent(window);
    if (window.unlimited)
      return Resources.unlimitedPlanLabel;
    if (!Object.isNull(window.balance))
      return Resources.formatBalanceLeft(UsageFormatterService.count(window.balance));
    if (Object.isNull(window.used))
      return short ? Resources.formatShortPercent(percent!) : Resources.formatPercentUsed(percent!);
    const used = UsageFormatterService.count(window.used);
    const allowance = UsageFormatterService.count(window.allowance!);
    return short ? Resources.formatShortCount(used, allowance, percent) : Resources.formatCountUsed(used, allowance, percent);
  }

  private static countPercent(window: PlanWindow): number {
    return Object.isNull(window.used) ? 0 : UsageFormatterService.percentOf(window.used, window.allowance!);
  }

  private static levelOf(percent: number): UsageLevel {
    if (percent >= Resources.planCriticalPercent)
      return UsageLevel.Critical;
    return percent >= Resources.planWarningPercent ? UsageLevel.Warning : UsageLevel.Normal;
  }

  private static shownPercent(window: PlanWindow): number | null {
    return Object.isNull(window.usedPercent) ? null : Math.round(window.usedPercent);
  }

  private static percentOf(part: number, whole: number): number {
    return Math.min(Resources.fullPercent, Math.round(part / whole * Resources.fullPercent));
  }

  private static count(value: number): string {
    return value.toLocaleString(Resources.usageNumberLocale);
  }
}
