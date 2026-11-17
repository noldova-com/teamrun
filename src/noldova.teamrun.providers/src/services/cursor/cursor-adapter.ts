/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ILog, type IProviderKindInstallation, type ITimer, NodeTimer, type SignInCheck, TimeoutException } from "@noldova/teamrun.core";
import { AuthStatus, type Provider } from "@noldova/teamrun.protocol";

import { SignOutException } from "../../exceptions/sign-out.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IProcessTree } from "../../interfaces/i-process-tree.js";
import type { AppServerClientInfo } from "../../models/app-server-client-info.js";
import { CommandSource } from "../../models/command-source.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { ProcessOrigin } from "../../models/process-origin.js";
import type { ProviderTimings } from "../../models/provider-timings.js";
import { Resources } from "../../resources.js";
import { AcpAdapter } from "../acp/acp-adapter.js";
import { CommandRunner } from "../process/command-runner.js";
import { PowershellSession } from "../process/powershell-session.js";
import { ProcessTree } from "../process/process-tree.js";
import { CursorAboutReader } from "./cursor-about.reader.js";
import { CursorAgent } from "./cursor-agent.js";
import { CursorImageReader } from "./cursor-image.reader.js";

export class CursorAdapter extends AcpAdapter {
  private readonly cursor: CursorAgent;
  private readonly runner: CommandRunner;
  private readonly commandTimeout: number;

  public readonly installation?: IProviderKindInstallation;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, defaultProfileDirectory: string, clientInfo: AppServerClientInfo,
    starter: IProcessStarter, timings: ProviderTimings, timer: ITimer = new NodeTimer(),
    processTree: IProcessTree = new ProcessTree(process.platform, new CommandRunner(starter), process.env, Resources.processListTimeout, timer, timings.stopGrace,
      undefined, PowershellSession.shared),
    locate: () => ProcessCommand | null = CommandSource.none, log: ILog | null = null, platform: string = process.platform,
    installation: IProviderKindInstallation | null = null) {
    const agent = new CursorAgent(command, environment, defaultProfileDirectory, locate, platform);
    super(agent, clientInfo, starter, timings, timer, new CursorImageReader(), log, processTree);
    this.cursor = agent;
    this.runner = new CommandRunner(starter);
    this.commandTimeout = timings.signInCheckTimeout;
    if (!Object.isNull(installation))
      this.installation = installation;
  }

  public override async checkSignIn(provider: Provider): Promise<SignInCheck> {
    const check = await super.checkSignIn(provider);
    if (check.authStatus !== AuthStatus.LoggedIn)
      return check;
    const launch = this.cursor.aboutLaunch(provider, await this.runner.readEnvironmentAsync(this.cursor.baseEnvironment));
    const about = await this.runner.run(launch.command.withOrigin(new ProcessOrigin(Resources.cursorKindId, provider.id)), launch.environment, this.commandTimeout)
      .catch(() => null);
    return Object.isNull(about) || !about.succeeded ? check : CursorAboutReader.read(about.stdout, check);
  }

  public override async signOut(provider: Provider): Promise<void> {
    const launch = this.cursor.signOutLaunch(provider, await this.runner.readEnvironmentAsync(this.cursor.baseEnvironment));
    const result = await this.runner.run(launch.command.withOrigin(new ProcessOrigin(Resources.cursorKindId, provider.id)), launch.environment, this.commandTimeout);
    if (result.timedOut)
      throw new TimeoutException(Resources.formatCursorSignOutTimedOut(this.commandTimeout));
    if (!result.succeeded)
      throw new SignOutException(Resources.formatCursorSignOutFailed(String.isNullOrWhitespace(result.output) ? null : result.output));
  }
}
