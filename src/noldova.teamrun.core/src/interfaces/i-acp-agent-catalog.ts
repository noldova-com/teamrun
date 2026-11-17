/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type { AcpAgentListing, AcpLocalCommandAddParams } from "@noldova/teamrun.protocol";

import type { AcpAgentOffer } from "../models/acp-agent-offer.js";
import type { AcpStoredAgent } from "../models/acp-stored-agent.js";
import type { IProviderAdapter } from "./i-provider-adapter.js";

export interface IAcpAgentCatalog {
  listAsync(stored: readonly AcpStoredAgent[]): Promise<AcpAgentListing>;
  readIconAsync(id: string): Promise<string | null>;
  readOfferAsync(id: string): Promise<AcpAgentOffer | null>;
  localOf(params: AcpLocalCommandAddParams, isTaken: (kind: string) => boolean): AcpStoredAgent;
  openAsync(stored: AcpStoredAgent, save: (json: JsonObject) => Promise<void>): Promise<IProviderAdapter>;
  referencesOf(stored: AcpStoredAgent): readonly string[];
  removeFilesAsync(stored: AcpStoredAgent): Promise<void>;
}
