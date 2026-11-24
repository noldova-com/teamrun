/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SocketStateCount {
  public readonly state: string;
  public readonly count: number;

  public constructor(state: string, count: number) {
    this.state = state;
    this.count = count;
  }
}
