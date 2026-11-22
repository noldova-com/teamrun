/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TeammateModelSettings {
  public readonly model: string | null;
  public readonly effort: string | null;
  public readonly speed: string | null;

  public constructor(model: string | null, effort: string | null, speed: string | null) {
    this.model = model;
    this.effort = effort;
    this.speed = speed;
  }
}
