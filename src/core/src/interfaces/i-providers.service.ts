/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProviderDescriptor, ProviderListModelsParams, ProviderModel } from "@noldova/teamrun-protocol";

export interface IProvidersService {
  list(): readonly ProviderDescriptor[];
  listModels(params: ProviderListModelsParams): Promise<readonly string[]>;
  modelCatalog(params: ProviderListModelsParams): Promise<readonly ProviderModel[]>;
}
