/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderAccount, ProviderDescriptor } from "@noldova/teamrun-protocol";
import { Resources } from "../resources";

export class AccountChoice {
  public readonly key: string;
  public readonly provider: string;
  public readonly accountId: string | null;
  public readonly label: string;
  public readonly fullLabel: string;

  public constructor(provider: string, accountId: string | null, label: string, providerName: string) {
    this.key = JSON.stringify([provider, accountId]);
    this.provider = provider;
    this.accountId = accountId;
    this.label = Resources.formatLocalAccount(label);
    this.fullLabel = Resources.formatLocalAccount(Resources.formatAccountChoice(providerName, label));
  }

  public static saved(accounts: readonly ProviderAccount[], providers: readonly ProviderDescriptor[]): readonly AccountChoice[] {
    return accounts.map(account => new AccountChoice(account.provider, account.id, account.label,
      providers.find(t => t.id === account.provider)?.displayName ?? account.provider));
  }

  public static native(providers: readonly ProviderDescriptor[]): readonly AccountChoice[] {
    return providers.map(t => new AccountChoice(t.id, null, Resources.defaultSignInLabel, t.displayName));
  }
}
