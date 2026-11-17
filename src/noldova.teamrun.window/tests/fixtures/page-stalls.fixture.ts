/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

interface ISpan {
  readonly start: number;
  readonly duration: number;
}

export class PageStalls {
  private static readonly TICK: number = 250;
  private static readonly LATE: number = 1_000;
  private static recorder: PageStalls | null = null;

  private readonly now: () => number = performance.now.bind(performance);
  private readonly longTasks: ISpan[] = [];
  private readonly lateTicks: ISpan[] = [];
  private readonly observer: PerformanceObserver;
  private lastTick: number = this.now();

  private constructor() {
    this.observer = new PerformanceObserver(list => this.keep(list.getEntries()));
    this.observer.observe({ type: "longtask", buffered: true });
    setInterval(() => this.tick(), PageStalls.TICK);
  }

  public static get shared(): PageStalls {
    PageStalls.recorder ??= new PageStalls();
    return PageStalls.recorder;
  }

  public elapsed(): number {
    return this.now();
  }

  public during(from: number, to: number): string {
    this.keep(this.observer.takeRecords());
    this.tick();
    const overlaps = (span: ISpan): boolean => span.start < to && span.start + span.duration > from;
    const at = (span: ISpan): string => `at ${Math.round(span.start - from)} ms for ${Math.round(span.duration)} ms`;
    const shared = (a: ISpan, b: ISpan): number => Math.max(0, Math.min(a.start + a.duration, b.start + b.duration) - Math.max(a.start, b.start));
    const covered = (late: ISpan): number => Math.round(Math.min(late.duration, this.longTasks.reduce((sum, t) => sum + shared(t, late), 0)));
    const tasks = this.longTasks.filter(overlaps).map(t => `a long task ${at(t)}`);
    const timers = this.lateTicks.filter(overlaps).map(t => `the timer late ${at(t)}, with long tasks over ${covered(t)} of its ${Math.round(t.duration)} ms`);
    return [...tasks, ...timers].join("; ") || `no long task over 50 ms and no timer late by ${PageStalls.LATE} ms`;
  }

  private keep(entries: readonly PerformanceEntry[]): void {
    for (const entry of entries)
      this.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }

  private tick(): void {
    const now = this.now();
    const late = now - this.lastTick - PageStalls.TICK;
    if (late >= PageStalls.LATE)
      this.lateTicks.push({ start: this.lastTick + PageStalls.TICK, duration: late });
    this.lastTick = now;
  }
}
