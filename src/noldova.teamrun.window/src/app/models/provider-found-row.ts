/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { DiscoveredProfile } from "@noldova/teamrun.protocol";

export class ProviderFoundRow {
  public readonly profile: DiscoveredProfile;
  public readonly status: string;
  public readonly state: string;
  public readonly dot: string;
  public readonly account: string;
  public readonly accountDetail: string;
  public readonly isNote: boolean;
  public readonly plan: string | null;

  public constructor(profile: DiscoveredProfile, status: string, state: string, dot: string, account: string, accountDetail: string, isNote: boolean,
    plan: string | null) {
    this.profile = profile;
    this.status = status;
    this.state = state;
    this.dot = dot;
    this.account = account;
    this.accountDetail = accountDetail;
    this.isNote = isNote;
    this.plan = plan;
  }
}
