/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SampledFrame {
  public readonly time: number;
  public readonly shown: number;
  public readonly arrived: number | undefined;

  public constructor(time: number, shown: number, arrived: number | undefined) {
    this.time = time;
    this.shown = shown;
    this.arrived = arrived;
  }
}
