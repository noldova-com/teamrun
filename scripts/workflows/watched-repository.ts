/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class WatchedRepository {
  public readonly defaultBranch: string;
  public readonly requiredChecks: readonly string[];
  public readonly baseChangedAt: Date;

  public constructor(defaultBranch: string, requiredChecks: readonly string[], baseChangedAt: Date) {
    this.defaultBranch = defaultBranch;
    this.requiredChecks = [...new Set(requiredChecks)];
    this.baseChangedAt = baseChangedAt;
  }
}
