/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { type ILog, type ITimer, NodeTimer, SignInCheck, TimeoutException } from "@noldova/teamrun.core";
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
import { FxAgent } from "./fx-agent.js";

export class FxAdapter extends AcpAdapter {
  private readonly fx: FxAgent;
  private readonly runner: CommandRunner;
  private readonly statusTimeout: number;

  public constructor(command: ProcessCommand | null, environment: NodeJS.ProcessEnv, clientInfo: AppServerClientInfo,
    starter: IProcessStarter, timings: ProviderTimings, timer: ITimer = new NodeTimer(),
    processTree: IProcessTree = new ProcessTree(process.platform, new CommandRunner(starter), process.env, Resources.processListTimeout, timer, timings.stopGrace,
      undefined, PowershellSession.shared),
    locate: () => ProcessCommand | null = CommandSource.none, log: ILog | null = null, platform: string = process.platform) {
    const agent = new FxAgent(command, environment, locate, platform);
    super(agent, clientInfo, starter, timings, timer, null, log, processTree);
    this.fx = agent;
    this.runner = new CommandRunner(starter);
    this.statusTimeout = timings.signInCheckTimeout;
  }

  public override async checkSignIn(provider: Provider): Promise<SignInCheck> {
    let stdout: string;
    try {
      const launch = this.fx.statusLaunch(provider, await this.runner.readEnvironmentAsync(this.fx.baseEnvironment));
      stdout = (await this.runner.run(launch.command.withOrigin(new ProcessOrigin(Resources.fxKindId, provider.id)), launch.environment, this.statusTimeout)).stdout;
    }
    catch {
      return super.checkSignIn(provider);
    }
    const auth = FxAdapter.authOf(stdout);
    if (auth === Resources.fxAuthMissing)
      return new SignInCheck(AuthStatus.LoggedOut, null, null, this.fx.formatSignIn(provider));
    const check = await super.checkSignIn(provider);
    return Object.isUndefined(auth) && check.authStatus === AuthStatus.Error ? new SignInCheck(AuthStatus.Error, null, null, Resources.formatFxNotFx(check.error!)) : check;
  }

  public override async checkFoundSignIn(provider: Provider): Promise<SignInCheck> {
    const launch = this.fx.statusLaunch(provider, await this.runner.readEnvironmentAsync(this.fx.baseEnvironment));
    const auth = FxAdapter.authOf((await this.runner.run(launch.command.withOrigin(new ProcessOrigin(Resources.fxKindId, provider.id)), launch.environment,
      this.statusTimeout)).stdout);
    if (Object.isUndefined(auth))
      return new SignInCheck(AuthStatus.Unknown, null, null, null);
    return auth === Resources.fxAuthMissing ? new SignInCheck(AuthStatus.LoggedOut, null, null, this.fx.formatSignIn(provider))
      : new SignInCheck(AuthStatus.LoggedIn, null, null, null);
  }

  public override async signOut(provider: Provider): Promise<void> {
    const environment = await this.runner.readEnvironmentAsync(this.fx.baseEnvironment);
    const failures: Error[] = [];
    for (const account of Resources.fxAccounts) {
      const launch = this.fx.signOutLaunch(account, environment);
      const result = await this.runner.run(launch.command.withOrigin(new ProcessOrigin(Resources.fxKindId, provider.id)), launch.environment, this.statusTimeout);
      if (result.timedOut)
        failures.push(new TimeoutException(Resources.formatFxSignOutTimedOut(account, this.statusTimeout)));
      else if (!result.succeeded)
        failures.push(new SignOutException(Resources.formatFxSignOutFailed(account, String.isNullOrWhitespace(result.output) ? null : result.output)));
    }
    if (failures.length === 0)
      return;
    const message = failures.map(t => t.message).join(" ");
    throw failures.every(t => t instanceof TimeoutException) ? new TimeoutException(message) : new SignOutException(message);
  }

  private static authOf(stdout: string): string | undefined {
    try {
      return JsonReader.parse(stdout).readOptionalString(Resources.fxAuthField);
    }
    catch {
      return undefined;
    }
  }
}
