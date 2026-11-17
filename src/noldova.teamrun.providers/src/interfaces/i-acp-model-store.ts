/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Provider, ProviderModel } from "@noldova/teamrun.protocol";

export interface IAcpModelStore {
  keep(provider: Provider | null, models: readonly ProviderModel[]): void;
  read(provider: Provider | null): readonly ProviderModel[] | null;
}
