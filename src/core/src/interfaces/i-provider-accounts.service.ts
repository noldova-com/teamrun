/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderAccount, ProviderAccountCreateParams, ProviderAccountIdParams } from "@noldova/teamrun-protocol";

export interface IProviderAccountsService {
  list(): readonly ProviderAccount[];
  find(providerAccountId: string): ProviderAccount | null;
  create(params: ProviderAccountCreateParams): ProviderAccount;
  check(params: ProviderAccountIdParams): Promise<ProviderAccount>;
  delete(params: ProviderAccountIdParams): void;
}
