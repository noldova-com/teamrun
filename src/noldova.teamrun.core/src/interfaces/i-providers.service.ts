/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type {
  FirstLaunch,
  Provider,
  ProviderCreateParams,
  ProviderEnabledParams,
  ProviderIdParams,
  ProviderMcpServerList,
  ProviderProfileDiscoverParams,
  ProviderProfileDiscovery,
  ProviderSignInCommand,
  ProviderSignIns,
  ProviderUpdateParams
} from "@noldova/teamrun.protocol";

export interface IProvidersService {
  listAsync(transaction?: SqlTransaction): Promise<readonly Provider[]>;
  findAsync(providerId: string, transaction?: SqlTransaction): Promise<Provider | null>;
  findUsualAsync(kind: string, transaction?: SqlTransaction): Promise<Provider | null>;
  createAsync(params: ProviderCreateParams): Promise<Provider>;
  updateAsync(params: ProviderUpdateParams): Promise<Provider>;
  setEnabledAsync(params: ProviderEnabledParams): Promise<Provider>;
  checkAsync(params: ProviderIdParams): Promise<Provider>;
  listOwnMcpServersAsync(params: ProviderIdParams): Promise<ProviderMcpServerList>;
  signInAsync(params: ProviderIdParams, signal?: AbortSignal): Promise<Provider>;
  readSignInCommandAsync(params: ProviderIdParams): Promise<ProviderSignInCommand | null>;
  cancelSignIn(params: ProviderIdParams): void;
  listSignIns(): ProviderSignIns;
  signOutAsync(params: ProviderIdParams): Promise<Provider>;
  discoverAsync(params: ProviderProfileDiscoverParams): Promise<ProviderProfileDiscovery>;
  deleteAsync(params: ProviderIdParams): Promise<void>;
  readFirstLaunchAsync(transaction?: SqlTransaction): Promise<FirstLaunch>;
  finishFirstLaunchAsync(): Promise<FirstLaunch>;
}
