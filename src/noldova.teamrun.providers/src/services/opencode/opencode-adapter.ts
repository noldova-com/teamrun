/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ILog, type ITimer, NodeTimer } from "@noldova/teamrun.core";

import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IProcessTree } from "../../interfaces/i-process-tree.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { AcpAdapter } from "../acp/acp-adapter.js";
import { OpencodeAgent } from "./opencode-agent.js";

export class OpencodeAdapter extends AcpAdapter {
  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string, clientInfo: AppServerClientInfo,
    starter: IProcessStarter, timings: ProviderTimings, timer: ITimer = new NodeTimer(),
    processTree?: IProcessTree,
    locate: () => ProcessCommand | null = CommandSource.none, log: ILog | null = null) {
    super(new OpencodeAgent(command, environment, formerProfileDirectory, locate), clientInfo, starter, timings, timer, null, log, processTree);
  }
}
