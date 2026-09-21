/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";

import type { IProviderAdapter } from "../../interfaces/i-provider-adapter.js";
import { Resources } from "../../resources.js";

export class ProviderRegistry {
  private readonly adapters: Map<string, IProviderAdapter> = new Map();

  public register(adapter: IProviderAdapter): void {
    if (this.adapters.has(adapter.descriptor.id))
      throw new ArgumentException(Resources.formatProviderAlreadyRegistered(adapter.descriptor.id), Resources.adapterParameterName);

    this.adapters.set(adapter.descriptor.id, adapter);
  }

  public has(provider: string): boolean {
    return this.adapters.has(provider);
  }

  public get(provider: string): IProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (Object.isUndefined(adapter))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotRegistered(provider), [provider]);

    return adapter;
  }

  public all(): readonly IProviderAdapter[] {
    return [...this.adapters.values()];
  }
}
