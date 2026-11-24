/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderKindRegistry } from "@noldova/teamrun.core";
import type { IProcessStarter } from "@noldova/teamrun.providers";
import type { IProviderKindRegistryFactory } from "@noldova/teamrun.runtime";

export class GivenRegistries implements IProviderKindRegistryFactory {
  private readonly registry: ProviderKindRegistry;

  public constructor(registry: ProviderKindRegistry) {
    this.registry = registry;
  }

  public create(_productVersion: string, _dataDirectory: string, _starter: IProcessStarter): ProviderKindRegistry {
    return this.registry;
  }
}
