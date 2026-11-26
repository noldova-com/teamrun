/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CodexVersionCheck {
  public readonly stamp: string | null;
  public done: Promise<void> = Promise.resolve();
  public retryAt: number = Number.POSITIVE_INFINITY;

  public constructor(stamp: string | null) {
    this.stamp = stamp;
  }
}
