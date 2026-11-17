/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class NameOrder {
  private static readonly collator: Intl.Collator = new Intl.Collator(undefined, { sensitivity: "accent" });

  public static sort<T>(items: readonly T[], ...names: readonly ((item: T) => string)[]): readonly T[] {
    return items.toSorted((a, b) => names.reduce((order, name) => order === 0 ? NameOrder.collator.compare(name(a), name(b)) : order, 0));
  }
}
