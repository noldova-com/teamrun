/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionRequest, type IToolCallPermissions, type PermissionDecision, PermissionOutcome } from "@noldova/desktop.runtime";

export class ScriptedPermissions implements IToolCallPermissions {
  public readonly requests: IPermissionRequest[] = [];
  private readonly decide: () => PermissionDecision;

  public constructor(decide: () => PermissionDecision) {
    this.decide = decide;
  }

  public requestAsync(request: IPermissionRequest): Promise<PermissionOutcome> {
    this.requests.push(request);
    return Promise.resolve(new PermissionOutcome(this.decide()));
  }
}
