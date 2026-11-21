/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OrganizationTarget } from "@noldova/teamrun.protocol";

export class OrganizationCrumb {
  public readonly label: string;
  public readonly target: OrganizationTarget;
  public readonly isHere: boolean;

  public constructor(label: string, target: OrganizationTarget, isHere: boolean) {
    this.label = label;
    this.target = target;
    this.isHere = isHere;
  }
}
