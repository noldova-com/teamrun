/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  IModuleLog,
  IPermissionAnswerer,
  IPermissionsContext,
  PermissionCenter,
  PermissionRevocation,
  Registration,
  RememberedPermission
} from "@noldova/desktop.runtime";

export class CenterPermissionsContext implements IPermissionsContext {
  private readonly center: PermissionCenter;
  private readonly moduleId: string;
  private readonly log: IModuleLog;

  public constructor(center: PermissionCenter, moduleId: string, log: IModuleLog) {
    this.center = center;
    this.moduleId = moduleId;
    this.log = log;
  }

  public registerAnswerer(answerer: IPermissionAnswerer): Registration {
    return this.center.registerAnswerer(this.moduleId, answerer, this.log);
  }

  public listRemembered(): readonly RememberedPermission[] {
    return this.center.listRemembered(this.moduleId);
  }

  public revoke(id: string): boolean {
    return this.center.revoke(this.moduleId, id);
  }

  public onRevoked(listener: (revocation: PermissionRevocation) => void): Registration {
    return this.center.onRevoked(this.moduleId, listener, this.log);
  }
}
