/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Event, EventName, PlanUsage, type PlanWindow } from "@noldova/teamrun.protocol";

import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IPlanUsageService } from "../../interfaces/i-plan-usage.service.js";
import type { ITimer } from "../../interfaces/i-timer.js";
import { Resources } from "../../resources.js";
import { NodeTimer } from "../node-timer.js";

export class PlanUsageService implements IPlanUsageService, Disposable {
  private readonly events: IEventSink;
  private readonly timer: ITimer;
  private readonly usages: Map<string, PlanUsage> = new Map();
  private readonly planReads: Map<string, string> = new Map();
  private readonly resets: Map<string, AbortController> = new Map();

  public constructor(events: IEventSink, timer: ITimer = new NodeTimer()) {
    this.events = events;
    this.timer = timer;
  }

  public record(kind: string, providerId: string | null, windows: readonly PlanWindow[], readAt: string, plan?: string | null): PlanUsage {
    const key = JSON.stringify([kind, providerId]);
    const kept = this.usages.get(key);
    const latest = Object.isUndefined(kept) || kept.readAt <= readAt ? { windows, readAt } : kept;
    const planned = !Object.isUndefined(plan) && (this.planReads.get(key) ?? "") <= readAt;
    if (!Object.isUndefined(kept) && latest === kept && !planned)
      return kept;
    if (planned)
      this.planReads.set(key, readAt);
    const until = this.usedUpUntil(latest.windows);
    const usage = new PlanUsage(kind, providerId, latest.windows, latest.readAt, (planned ? plan : kept?.plan) ?? null, !Object.isUndefined(until), until ?? null);
    this.keep(key, usage);
    this.watchReset(key, usage);

    return usage;
  }

  public list(): readonly PlanUsage[] {
    return [...this.usages.values()];
  }

  public [Symbol.dispose](): void {
    for (const reset of this.resets.values())
      reset.abort();
    this.resets.clear();
  }

  private usedUpUntil(windows: readonly PlanWindow[]): string | null | undefined {
    const usedUp = windows.filter(t => t.isUsedUp);
    if (usedUp.length === 0)
      return undefined;
    const resets = usedUp.flatMap(t => Object.isNull(t.resetsAt) ? [] : [Date.parse(t.resetsAt)]);
    if (resets.length < usedUp.length)
      return null;
    const until = Math.max(...resets);
    return until > this.timer.now() ? new Date(until).toISOString() : undefined;
  }

  private keep(key: string, usage: PlanUsage): void {
    this.usages.set(key, usage);
    this.events.publish(new Event(EventName.PlanUsageUpdated, usage.toJson()));
  }

  private watchReset(key: string, usage: PlanUsage): void {
    this.resets.get(key)?.abort();
    this.resets.delete(key);
    if (Object.isNull(usage.usedUpUntil))
      return;
    const reset = new AbortController();
    this.resets.set(key, reset);
    void this.clearAtReset(key, usage, Date.parse(usage.usedUpUntil), reset.signal).catch(() => undefined);
  }

  private async clearAtReset(key: string, usage: PlanUsage, until: number, signal: AbortSignal): Promise<void> {
    while (this.timer.now() < until)
      await this.timer.delayAsync(Math.min(until - this.timer.now(), Resources.usedUpCheckInterval), signal);
    this.resets.delete(key);
    this.keep(key, new PlanUsage(usage.kind, usage.providerId, usage.windows, usage.readAt, usage.plan));
  }
}
