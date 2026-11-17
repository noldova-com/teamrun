/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IPermissionsContext, PermissionDecision } from "@noldova/desktop.runtime";
import { type IRememberedAppGrants, RememberedAppGrant } from "@noldova/teamrun.core";

import { Resources } from "../resources.js";

export class RuntimeRememberedAppGrants implements IRememberedAppGrants {
  private readonly permissions: IPermissionsContext;

  public constructor(permissions: IPermissionsContext) {
    this.permissions = permissions;
  }

  public list(): readonly RememberedAppGrant[] {
    return this.permissions.listRemembered()
      .filter(t => t.module === Resources.computerUseModule && Resources.computerUseChatActions.includes(t.action) && t.decision === PermissionDecision.AllowedAlways)
      .flatMap(t => {
        if (t.action === Resources.computerUseScreenAction)
          return [new RememberedAppGrant(t.id, null, t.scope, t.remembered)];
        return Object.isNull(t.subject) ? [] : [new RememberedAppGrant(t.id, t.subject, t.scope, t.remembered)];
      });
  }

  public revoke(id: string): boolean {
    return this.permissions.revoke(id);
  }
}
