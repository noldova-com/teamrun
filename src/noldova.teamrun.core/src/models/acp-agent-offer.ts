/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AcpStoredAgent } from "./acp-stored-agent.js";

export class AcpAgentOffer {
  public readonly stored: AcpStoredAgent;
  public readonly unavailable: string | null;

  public constructor(stored: AcpStoredAgent, unavailable: string | null) {
    this.stored = stored;
    this.unavailable = unavailable;
  }
}
