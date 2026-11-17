/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class DiffRun {
  public readonly oldAt: number;
  public readonly newAt: number;
  public readonly removed: number;
  public readonly added: number;

  public constructor(oldAt: number, newAt: number, removed: number, added: number) {
    this.oldAt = oldAt;
    this.newAt = newAt;
    this.removed = removed;
    this.added = added;
  }
}
