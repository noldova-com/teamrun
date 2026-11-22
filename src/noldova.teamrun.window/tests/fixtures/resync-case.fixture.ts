/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ResyncCase {
  public readonly cause: string;
  public readonly resync: () => void;

  public constructor(cause: string, resync: () => void) {
    this.cause = cause;
    this.resync = resync;
  }
}
