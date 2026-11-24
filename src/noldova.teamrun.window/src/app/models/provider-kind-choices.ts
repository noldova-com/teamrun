/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
export class ProviderKindChoices {
  public readonly kinds: readonly string[];
  public readonly taken: ReadonlyMap<string, string>;

  public constructor(kinds: readonly string[], taken: ReadonlyMap<string, string>) {
    this.kinds = kinds;
    this.taken = taken;
  }
}
