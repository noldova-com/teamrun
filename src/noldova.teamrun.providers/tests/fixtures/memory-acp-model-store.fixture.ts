/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider, ProviderModel } from "@noldova/teamrun.protocol";
import type { IAcpModelStore } from "@noldova/teamrun.providers";

export class MemoryAcpModelStore implements IAcpModelStore {
  private models: readonly ProviderModel[] | null = null;

  public keep(_provider: Provider | null, models: readonly ProviderModel[]): void {
    this.models = models;
  }

  public read(_provider: Provider | null): readonly ProviderModel[] | null {
    return this.models;
  }
}
