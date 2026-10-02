/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class DependencyOrder<T> {
  private readonly items: readonly T[];
  private readonly nameOf: (item: T) => string;
  private readonly dependenciesOf: (item: T) => readonly string[];

  public constructor(items: readonly T[], nameOf: (item: T) => string, dependenciesOf: (item: T) => readonly string[]) {
    this.items = items;
    this.nameOf = nameOf;
    this.dependenciesOf = dependenciesOf;
  }

  public sort(formatCycle: (names: readonly string[]) => Error): readonly T[] {
    const ordered: T[] = [];
    const placed = new Set<string>();
    let remaining = this.items;
    while (remaining.length > 0) {
      const ready = remaining.filter(t => this.dependenciesOf(t).every(t => placed.has(t)));
      if (ready.length === 0)
        throw formatCycle(remaining.map(t => this.nameOf(t)));
      for (const item of ready) {
        ordered.push(item);
        placed.add(this.nameOf(item));
      }
      remaining = remaining.filter(t => !placed.has(this.nameOf(t)));
    }
    return ordered;
  }
}
