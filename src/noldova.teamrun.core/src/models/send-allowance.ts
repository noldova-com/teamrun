/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SendAllowance {
  public readonly starts: string | null;

  public constructor(starts: string | null) {
    this.starts = starts;
  }
}
