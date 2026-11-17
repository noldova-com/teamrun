/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Provider } from "@noldova/teamrun.protocol";

import type { UsageMeter } from "./usage-meter";

export class ProviderRow {
  public readonly provider: Provider;
  public readonly status: string;
  public readonly dot: string;
  public readonly account: string;
  public readonly accountDetail: string;
  public readonly isNote: boolean;
  public readonly isFailed: boolean;
  public readonly isError: boolean;
  public readonly announcement: string | null;
  public readonly sameAccountAs: string | null;
  public readonly plan: string;
  public readonly limits: readonly UsageMeter[];
  public readonly limitsNote: string | null;
  public readonly warning: string | null;
  public readonly command: string | null;

  public constructor(provider: Provider, status: string, dot: string, account: string, accountDetail: string, isNote: boolean, isFailed: boolean,
    isError: boolean, announcement: string | null, sameAccountAs: string | null, plan: string, limits: readonly UsageMeter[],
    limitsNote: string | null, warning: string | null, command: string | null) {
    this.provider = provider;
    this.status = status;
    this.dot = dot;
    this.account = account;
    this.accountDetail = accountDetail;
    this.isNote = isNote;
    this.isFailed = isFailed;
    this.isError = isError;
    this.announcement = announcement;
    this.sameAccountAs = sameAccountAs;
    this.plan = plan;
    this.limits = [...limits];
    this.limitsNote = limitsNote;
    this.warning = warning;
    this.command = command;
  }
}
