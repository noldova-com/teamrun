/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ILog, type IProviderKindInstallation, type ITimer, NodeTimer } from "@noldova/teamrun.core";

import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IProcessTree } from "../../interfaces/i-process-tree.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { AcpAdapter } from "../acp/acp-adapter.js";
import { CommandRunner } from "../process/command-runner.js";
import { PowershellSession } from "../process/powershell-session.js";
import { ProcessTree } from "../process/process-tree.js";
import { GrokAgent } from "./grok-agent.js";
import { GrokHome } from "./grok-home.js";
import { GrokImageReader } from "./grok-image.reader.js";

export class GrokAdapter extends AcpAdapter {
  public readonly installation?: IProviderKindInstallation;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, formerProfileDirectory: string, clientInfo: AppServerClientInfo,
    starter: IProcessStarter, timings: ProviderTimings, timer: ITimer = new NodeTimer(),
    processTree: IProcessTree = new ProcessTree(process.platform, new CommandRunner(starter), process.env, Resources.processListTimeout, timer, timings.stopGrace,
      undefined, PowershellSession.shared),
    locate: () => ProcessCommand | null = CommandSource.none, log: ILog | null = null, installation: IProviderKindInstallation | null = null,
    idleTimer: ITimer = new NodeTimer()) {
    const home = new GrokHome(environment, formerProfileDirectory);
    super(new GrokAgent(command, environment, formerProfileDirectory, locate, home), clientInfo, starter, timings, timer, new GrokImageReader(home), log,
      processTree, idleTimer);
    if (!Object.isNull(installation))
      this.installation = installation;
  }
}
