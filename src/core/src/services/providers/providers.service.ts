/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode, type ProviderAccount, type ProviderDescriptor, type ProviderListModelsParams, type ProviderModel } from "@noldova/teamrun-protocol";

import type { IProviderAccountsService } from "../../interfaces/i-provider-accounts.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import { Resources } from "../../resources.js";
import type { ProviderRegistry } from "./provider-registry.js";

export class ProvidersService implements IProvidersService {
  private readonly registry: ProviderRegistry;
  private readonly accounts: IProviderAccountsService;

  public constructor(registry: ProviderRegistry, accounts: IProviderAccountsService) {
    this.registry = registry;
    this.accounts = accounts;
  }

  public list(): readonly ProviderDescriptor[] {
    return this.registry.all().map(t => t.descriptor);
  }

  public listModels(params: ProviderListModelsParams): Promise<readonly string[]> {
    return this.modelCatalog(params).then(models => models.map(t => t.id));
  }

  public modelCatalog(params: ProviderListModelsParams): Promise<readonly ProviderModel[]> {
    const adapter = this.registry.get(params.provider);
    return adapter.listModels(this.resolveAccount(params.provider, params.providerAccountId));
  }

  private resolveAccount(provider: string, providerAccountId: string | null): ProviderAccount | null {
    if (Object.isNull(providerAccountId))
      return null;

    const account = this.accounts.find(providerAccountId);
    if (Object.isNull(account))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderAccountNotFound(providerAccountId), [providerAccountId]);
    if (account.provider !== provider)
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProviderAccountMismatch(providerAccountId, provider), [providerAccountId, provider]);

    return account;
  }
}
