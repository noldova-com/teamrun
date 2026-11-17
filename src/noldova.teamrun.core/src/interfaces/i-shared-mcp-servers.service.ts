/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Provider, SharedMcpProviderSetParams, SharedMcpServer, SharedMcpServerDefinition, SharedMcpServerIdParams, SharedMcpServerListing, SharedMcpServerUpdateParams,
  SharedMcpSecretSetParams, SharedMcpSignInStarted, SharedMcpTeammateSetParams
} from "@noldova/teamrun.protocol";

import type { SharedMcpSelection } from "../models/shared-mcp-selection.js";

export interface ISharedMcpServersService {
  listAsync(): Promise<readonly SharedMcpServerListing[]>;
  createAsync(definition: SharedMcpServerDefinition): Promise<SharedMcpServer>;
  updateAsync(params: SharedMcpServerUpdateParams): Promise<SharedMcpServer>;
  deleteAsync(params: SharedMcpServerIdParams): Promise<void>;
  setProviderAsync(params: SharedMcpProviderSetParams): Promise<SharedMcpServer>;
  setTeammateAsync(params: SharedMcpTeammateSetParams): Promise<SharedMcpServer>;
  setSecretAsync(params: SharedMcpSecretSetParams): Promise<SharedMcpServer>;
  startSignInAsync(params: SharedMcpServerIdParams): Promise<SharedMcpSignInStarted>;
  signOutOfAsync(params: SharedMcpServerIdParams): Promise<SharedMcpServer>;
  selectAsync(provider: Provider | null, teammateId: string | null, workingDirectory: string | null): Promise<SharedMcpSelection>;
}
