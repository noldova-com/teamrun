/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILog, ITimer } from "@noldova/teamrun.core";
import { NodeTimer } from "@noldova/teamrun.core";

import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { AcpAdapter } from "../acp/acp-adapter.js";
import { MuseAgent } from "./muse-agent.js";

export class MuseAdapter extends AcpAdapter {
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, homeDirectory: string, clientInfo: AppServerClientInfo, starter: IProcessStarter,
    timings: ProviderTimings, locate: () => ProcessCommand | null = CommandSource.none, timer: ITimer = new NodeTimer(), log: ILog | null = null,
    platform: string = process.platform) {
    super(new MuseAgent(command, environment, homeDirectory, locate, platform), clientInfo, starter, timings, timer, null, log);
  }
}
