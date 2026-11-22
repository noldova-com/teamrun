/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PlanFirstCase {
  public readonly state: string;
  public readonly planFirst: boolean;
  public readonly later: boolean;

  public constructor(state: string, planFirst: boolean, later: boolean) {
    this.state = state;
    this.planFirst = planFirst;
    this.later = later;
  }
}
