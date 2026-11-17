/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IAcpAgentCatalog, ILog, ISharedMcpSecrets, ProviderKindRegistry } from "@noldova/teamrun.core";
import type { IProcessStarter } from "@noldova/teamrun.providers";

export interface IProviderKindRegistryFactory {
  create(productVersion: string, dataDirectory: string, starter: IProcessStarter, log?: ILog | null): ProviderKindRegistry;
  createAcpCatalog?(productVersion: string, dataDirectory: string, starter: IProcessStarter, secrets: ISharedMcpSecrets, log?: ILog | null): IAcpAgentCatalog;
}
