/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionAnswerer, type IPermissionsContext, type PermissionRevocation, Registration, type RememberedPermission } from "@noldova/desktop.runtime";

export class ListedPermissionsContext implements IPermissionsContext {
  private readonly remembered: readonly RememberedPermission[];

  public constructor(remembered: readonly RememberedPermission[]) {
    this.remembered = remembered;
  }

  public registerAnswerer(_answerer: IPermissionAnswerer): Registration {
    return new Registration(() => undefined);
  }

  public listRemembered(): readonly RememberedPermission[] {
    return this.remembered;
  }

  public revoke(id: string): boolean {
    return this.remembered.some(t => t.id === id);
  }

  public onRevoked(_listener: (revocation: PermissionRevocation) => void): Registration {
    return new Registration(() => undefined);
  }
}
