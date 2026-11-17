/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRememberedAppGrants, RememberedAppGrant } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeRememberedAppGrants implements IRememberedAppGrants {
  public readonly revoked: string[] = [];
  public grants: RememberedAppGrant[] = [];

  public list(): readonly RememberedAppGrant[] {
    return this.grants;
  }

  public revoke(id: string): boolean {
    this.revoked.push(id);
    ChangeSignal.notify();
    const before = this.grants.length;
    this.grants = this.grants.filter(t => t.id !== id);

    return this.grants.length < before;
  }
}
