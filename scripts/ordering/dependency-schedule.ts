/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DependencySchedule<T> {
  private readonly items: readonly T[];
  private readonly nameOf: (item: T) => string;
  private readonly dependenciesOf: (item: T) => readonly string[];
  private readonly limit: number;

  public constructor(items: readonly T[], nameOf: (item: T) => string, dependenciesOf: (item: T) => readonly string[], limit: number) {
    this.items = items;
    this.nameOf = nameOf;
    this.dependenciesOf = dependenciesOf;
    this.limit = Math.max(1, limit);
  }

  public async runAsync(task: (item: T) => Promise<void>, formatCycle: (names: readonly string[]) => Error): Promise<void> {
    const finished = new Set<string>();
    const running = new Map<string, Promise<void>>();
    const failures: unknown[] = [];
    let waiting = this.items;
    while (running.size > 0 || (waiting.length > 0 && failures.length === 0)) {
      if (failures.length === 0) {
        const ready = waiting.filter(t => this.dependenciesOf(t).every(t => finished.has(t))).slice(0, this.limit - running.size);
        for (const item of ready) {
          const name = this.nameOf(item);
          running.set(name, task(item).then(() => { finished.add(name); }, (error: unknown) => { failures.push(error); }).finally(() => running.delete(name)));
        }
        waiting = waiting.filter(t => !ready.includes(t));
      }
      if (running.size === 0)
        throw formatCycle(waiting.map(t => this.nameOf(t)));
      await Promise.race(running.values());
    }
    if (failures.length > 0)
      throw failures[0];
  }
}
