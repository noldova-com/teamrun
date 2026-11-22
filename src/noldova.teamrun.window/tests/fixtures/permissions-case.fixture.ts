/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PermissionsCase {
  public readonly permissions: string;
  public readonly mode: string | null;
  public readonly planFirst: boolean;
  public readonly warned: boolean;

  public constructor(permissions: string, mode: string | null, planFirst: boolean, warned: boolean) {
    this.permissions = permissions;
    this.mode = mode;
    this.planFirst = planFirst;
    this.warned = warned;
  }
}
