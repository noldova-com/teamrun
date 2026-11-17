/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ILog, type IProviderKindInstallation, type ITimer, NodeTimer } from "@noldova/teamrun.core";

import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import type { AntigravityServer } from "../../models/antigravity-server.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { AcpAdapter } from "../acp/acp-adapter.js";
import { AntigravityAgent } from "./antigravity-agent.js";
import { AntigravityInstallation } from "./antigravity-installation.js";

export class AntigravityAdapter extends AcpAdapter {
  public readonly installation: IProviderKindInstallation;

  public constructor(locate: (chosen: string | null) => AntigravityServer | null, installation: IProviderKindInstallation, platform: string, environment: NodeJS.ProcessEnv,
    defaultProfileDirectory: string, tempRoot: string, clientInfo: AppServerClientInfo, starter: IProcessStarter, timings: ProviderTimings,
    timer: ITimer = new NodeTimer(), log: ILog | null = null) {
    super(new AntigravityAgent(locate, platform, environment, defaultProfileDirectory, tempRoot, log), clientInfo, starter, timings, timer, null, log);
    this.installation = new AntigravityInstallation(installation, locate, () => this.readServerVersion());
  }
}
