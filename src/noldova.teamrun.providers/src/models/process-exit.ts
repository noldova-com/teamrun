/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessExit {
  public readonly code: number | null;
  public readonly signal: string | null;

  public constructor(code: number | null, signal: string | null) {
    this.code = code;
    this.signal = signal;
  }
}
