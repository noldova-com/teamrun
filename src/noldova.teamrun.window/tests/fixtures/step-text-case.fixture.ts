/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StepTextCase {
  public readonly provider: string;
  public readonly model: string;
  public readonly look: Record<string, unknown>;
  public readonly check: Record<string, unknown>;

  public constructor(provider: string, model: string, look: Record<string, unknown>, check: Record<string, unknown>) {
    this.provider = provider;
    this.model = model;
    this.look = look;
    this.check = check;
  }
}
