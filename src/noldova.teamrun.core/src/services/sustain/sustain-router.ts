/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type PlanUsage, type Teammate, TeammateFallback } from "@noldova/teamrun.protocol";

import type { ITimer } from "../../interfaces/i-timer.js";
import type { AccountLimits } from "./account-limits.js";

export class SustainRouter {
  private readonly limits: AccountLimits;
  private readonly usages: () => readonly PlanUsage[];
  private readonly usableAsync: (providerId: string) => Promise<boolean>;
  private readonly timer: ITimer;

  public constructor(limits: AccountLimits, usages: () => readonly PlanUsage[], usableAsync: (providerId: string) => Promise<boolean>, timer: ITimer) {
    this.limits = limits;
    this.usages = usages;
    this.usableAsync = usableAsync;
    this.timer = timer;
  }

  public async chooseAsync(teammate: Teammate, own: TeammateFallback, tried: ReadonlySet<string> = new Set<string>()): Promise<TeammateFallback> {
    return await this.nextAsync(teammate, own, tried) ?? own;
  }

  public async nextAsync(teammate: Teammate, own: TeammateFallback, tried: ReadonlySet<string>): Promise<TeammateFallback | null> {
    if (!teammate.sustain || (!tried.has(own.providerId) && !await this.isAccountOutAsync(own.providerId)))
      return own;
    return (await this.leftAsync(teammate)).find(t => !tried.has(t.providerId)) ?? null;
  }

  public async resetOfAsync(providerId: string): Promise<string | null> {
    return await this.limits.resetOfAsync(providerId) ?? this.usageOf(providerId)?.usedUpUntil ?? null;
  }

  public async isOutAsync(teammate: Teammate): Promise<boolean> {
    return await this.isAccountOutAsync(teammate.providerId) && (!teammate.sustain || (await this.leftAsync(teammate)).length === 0);
  }

  public async isAccountOutAsync(providerId: string): Promise<boolean> {
    return this.limits.isOutAsync(providerId, this.timer.now(), this.usageOf(providerId));
  }

  private async leftAsync(teammate: Teammate): Promise<readonly TeammateFallback[]> {
    const left: TeammateFallback[] = [];
    for (const fallback of teammate.fallbacks)
      if (await this.usableAsync(fallback.providerId) && !await this.isAccountOutAsync(fallback.providerId))
        left.push(fallback);
    return teammate.resetsSoonestFirst ? left.toSorted((a, b) => SustainRouter.compare(this.soonestReset(a.providerId), this.soonestReset(b.providerId))) : left;
  }

  private soonestReset(providerId: string): number {
    const resets = (this.usageOf(providerId)?.windows ?? []).flatMap(t => Object.isNull(t.resetsAt) ? [] : [Date.parse(t.resetsAt)]);
    return resets.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...resets);
  }

  private static compare(a: number, b: number): number {
    return a === b ? 0 : a < b ? -1 : 1;
  }

  private usageOf(providerId: string): PlanUsage | null {
    return this.usages().find(t => t.providerId === providerId) ?? null;
  }
}
