/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class NameGroup<T> {
  public readonly names: readonly string[];
  public readonly value: T;

  public constructor(names: readonly string[], value: T) {
    this.names = names;
    this.value = value;
  }
}
