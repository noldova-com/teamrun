/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AcpAgentIdParams, AcpAgentListing, AcpLocalCommandAddParams, ProviderKind } from "@noldova/teamrun.protocol";

export interface IAcpAgentsService {
  listAsync(): Promise<AcpAgentListing>;
  readIconAsync(params: AcpAgentIdParams): Promise<string | null>;
  addAsync(params: AcpAgentIdParams): Promise<ProviderKind>;
  addLocalAsync(params: AcpLocalCommandAddParams): Promise<ProviderKind>;
  removeAsync(params: AcpAgentIdParams): Promise<void>;
}
