/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILog, IProviderKindInstallation } from "@noldova/teamrun.core";

import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { AcpAdapter } from "./acp-adapter.js";
import type { GeneralAcpAgent } from "./general-acp-agent.js";

export class GeneralAcpAdapter extends AcpAdapter {
  public readonly installation?: IProviderKindInstallation;

  public constructor(agent: GeneralAcpAgent, installation: IProviderKindInstallation | null, clientInfo: AppServerClientInfo, starter: IProcessStarter,
    timings: ProviderTimings, log: ILog | null = null) {
    super(agent, clientInfo, starter, timings, undefined, null, log);
    if (!Object.isNull(installation))
      this.installation = installation;
  }
}
