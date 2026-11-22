/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Teammate } from "@noldova/teamrun.protocol";

export class OrganizationExplorerDepartment {
  public readonly id: string;
  public readonly path: string;
  public readonly teammates: readonly Teammate[];

  public constructor(id: string, path: string, teammates: readonly Teammate[]) {
    this.id = id;
    this.path = path;
    this.teammates = teammates;
  }
}
