/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PlanStepShown {
  public readonly text: string;
  public readonly isRunning: boolean;

  public constructor(text: string, isRunning: boolean) {
    this.text = text;
    this.isRunning = isRunning;
  }
}
