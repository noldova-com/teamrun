/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ToolCallPermission {
  public readonly id: string;
  public readonly risk: string;
  public readonly decision: string;
  public readonly isRemembered: boolean;

  public constructor(id: string, risk: string, decision: string, isRemembered: boolean) {
    this.id = id;
    this.risk = risk;
    this.decision = decision;
    this.isRemembered = isRemembered;
  }
}
