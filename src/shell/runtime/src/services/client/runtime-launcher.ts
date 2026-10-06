/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { type BuildIdentity, FailureCode, type RuntimeHandover, RunningWork, StopPolicy } from "@noldova/teamrun-shell-protocol";

import { BuildRelation } from "../../enums/build-relation.js";
import { UpdateBarrierStatus } from "../../enums/update-barrier-status.js";
import { BuildMismatchException } from "../../exceptions/build-mismatch.exception.js";
import { ConnectionException } from "../../exceptions/connection.exception.js";
import { LaunchException } from "../../exceptions/launch.exception.js";
import { NoRuntimeException } from "../../exceptions/no-runtime.exception.js";
import { PreShellDataFoundException } from "../../exceptions/pre-shell-data-found.exception.js";
import { RuntimeHandoverException } from "../../exceptions/runtime-handover.exception.js";
import { UpdateInProgressException } from "../../exceptions/update-in-progress.exception.js";
import { WorkInProgressException } from "../../exceptions/work-in-progress.exception.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { IRuntimeClientListener } from "../../interfaces/i-runtime-client-listener.js";
import { AttachOptions } from "../../models/attach-options.js";
import { Endpoint } from "../../models/endpoint.js";
import type { LaunchSettings } from "../../models/launch-settings.js";
import { ProcessLaunchCommand } from "../../models/process-launch-command.js";
import type { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import { StartedRuntime } from "../../models/started-runtime.js";
import { Resources } from "../../resources.js";
import { DiagnosticRedactor } from "../diagnostics/diagnostic-redactor.js";
import { DiscoveryReader } from "../discovery/discovery.reader.js";
import type { Installation } from "../installation/installation.js";
import { OwnershipLock } from "../ownership/ownership-lock.js";
import { ChildProcessStarter } from "../process/child-process-starter.js";
import { BuildComparer } from "./build-comparer.js";
import { RuntimeClient } from "./runtime-client.js";

export class RuntimeLauncher {
  private readonly settings: LaunchSettings;
  private readonly identity: BuildIdentity;
  private readonly starter: IProcessStarter;
  private readonly installation: Installation | null;

  public constructor(settings: LaunchSettings, identity: BuildIdentity, starter: IProcessStarter = new ChildProcessStarter(), installation: Installation | null = null) {
    this.settings = settings;
    this.identity = identity;
    this.starter = starter;
    this.installation = installation;
  }

  public async attachAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy = StopPolicy.IfIdle, options: AttachOptions = new AttachOptions()): Promise<RuntimeClient> {
    return RuntimeLauncher.requireCurrentData(await this.connectAsync(clientName, listener, policy, options));
  }

  public async moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy = StopPolicy.IfIdle): Promise<RuntimeClient> {
    const client = await this.connectAsync(clientName, listener, policy, new AttachOptions());
    if (Object.isNull(client.preShellData))
      return client;

    const response = await client.moveAsideAsync().finally(() => client.close());
    const failure = response.failure;
    if (!Object.isUndefined(failure))
      throw new LaunchException(Resources.formatMoveAsideFailed(failure.message));
    return this.attachAsync(clientName, listener, policy);
  }

  private static requireCurrentData(client: RuntimeClient): RuntimeClient {
    const data = client.preShellData;
    if (Object.isNull(data))
      return client;
    client.close();
    throw new PreShellDataFoundException(data);
  }

  private async connectAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy, options: AttachOptions): Promise<RuntimeClient> {
    const deadline = Date.now() + this.settings.launchTimeout;
    const limit = Date.now() + this.settings.launchLimit;
    let started: StartedRuntime | null = null;
    let refusals = 0;
    for (;;) {
      const discovery = await DiscoveryReader.readAsync(this.settings.dataDirectory);
      if (!Object.isNull(discovery) && OwnershipLock.isOwned(this.settings.dataDirectory)) {
        const client = await this.tryConnectAsync(discovery, clientName, listener).catch(async (error: unknown) => {
          if (refusals >= Resources.refusedTokenRetries || !await this.isRepublishedAsync(error, discovery))
            throw error;
          refusals++;
          return null;
        });
        if (!Object.isNull(client)) {
          await RuntimeLauncher.forgetAsync(started);
          started = null;
          const handover = client.handover;
          if (Object.isNull(handover))
            return client;
          await this.resolveOtherBuildAsync(client, handover, policy, deadline, options.takeOver);
          continue;
        }
      }
      else if (Object.isNull(started)) {
        if (!options.start)
          throw new NoRuntimeException(this.settings.dataDirectory.root);
        await this.requireNoUpdateAsync();
        started = await this.startAsync();
      }
      else if (!started.isRunning && !OwnershipLock.isOwned(this.settings.dataDirectory))
        throw await this.describeExitAsync(started);
      const timeout = this.readTimeout(deadline, limit);
      if (!Object.isNull(timeout)) {
        await RuntimeLauncher.forgetAsync(started);
        throw new LaunchException(timeout);
      }
      await delay(this.settings.pollInterval);
    }
  }

  private readTimeout(deadline: number, limit: number): string | null {
    if (Date.now() < deadline)
      return null;
    const isOwned = OwnershipLock.isOwned(this.settings.dataDirectory);
    if (isOwned && Date.now() < limit)
      return null;
    return isOwned ? Resources.formatLaunchLimitReached(this.settings.launchLimit) : Resources.launchTimedOut;
  }

  private static async forgetAsync(started: StartedRuntime | null): Promise<void> {
    if (!Object.isNull(started))
      await rm(started.startLog, { force: true });
  }

  private async describeExitAsync(started: StartedRuntime): Promise<LaunchException> {
    const text = await readFile(started.startLog, Resources.utf8Encoding);
    await rm(started.startLog, { force: true });
    await this.requireNoUpdateAsync();
    const reason = new DiagnosticRedactor(homedir()).redact(text.slice(-Resources.startLogTailLength).trim());
    return new LaunchException(String.isNullOrWhitespace(reason) ? Resources.runtimeExitedWithoutReason : Resources.formatRuntimeExited(reason));
  }

  private async tryConnectAsync(discovery: RuntimeDiscovery, clientName: string, listener: IRuntimeClientListener): Promise<RuntimeClient | null> {
    try {
      return await RuntimeClient.connectAsync(Endpoint.parse(discovery.endpoint), discovery.token, this.identity, clientName, listener, this.settings.clientSettings);
    }
    catch (error) {
      if (error instanceof ConnectionException && Object.isNull(error.failure))
        return null;
      throw error;
    }
  }

  private async isRepublishedAsync(error: unknown, discovery: RuntimeDiscovery): Promise<boolean> {
    return error instanceof ConnectionException && error.failure?.code === FailureCode.Unauthorized &&
      (await DiscoveryReader.readAsync(this.settings.dataDirectory))?.token !== discovery.token;
  }

  private async resolveOtherBuildAsync(client: RuntimeClient, handover: RuntimeHandover, policy: StopPolicy, deadline: number, takeOver: boolean): Promise<void> {
    if (BuildComparer.compare(this.identity, handover.identity) === BuildRelation.Older) {
      client.close();
      throw new RuntimeHandoverException(handover);
    }
    if (!takeOver) {
      client.close();
      throw new BuildMismatchException(handover);
    }

    const response = await client.stopAsync(policy).finally(() => client.close());
    const failure = response.failure;
    if (!Object.isUndefined(failure)) {
      if (failure.code === FailureCode.Conflict && !Object.isUndefined(failure.details))
        throw new WorkInProgressException(RunningWork.fromJson(failure.details));
      throw new LaunchException(Resources.formatStopRefused(failure.message));
    }
    while (OwnershipLock.isOwned(this.settings.dataDirectory)) {
      if (Date.now() >= deadline)
        throw new LaunchException(Resources.stopTimedOut);
      await delay(this.settings.pollInterval);
    }
  }

  private async requireNoUpdateAsync(): Promise<void> {
    const installation = this.installation;
    if (Object.isNull(installation))
      return;
    const status = await installation.checkAsync(this.identity.productVersion);
    if (status !== UpdateBarrierStatus.None)
      throw new UpdateInProgressException(status);
  }

  private async startAsync(): Promise<StartedRuntime> {
    const directory = this.settings.dataDirectory;
    const unique = randomUUID();
    const startLogName = Resources.formatStartLogName(unique);
    const installation = this.installation;
    const command = new ProcessLaunchCommand(this.settings.platform, this.settings.executablePath, [
      this.settings.entryPath,
      Resources.dataDirectoryArgument,
      directory.root,
      Resources.idleGraceArgument,
      String(this.settings.idleGraceMilliseconds),
      Resources.startLogArgument,
      startLogName,
      ...Object.isNull(installation) ? [] : [Resources.installationArgument, installation.folder]
    ], this.settings.environment, path.join(directory.logsFolder, Resources.formatCopyRecordName(unique)));
    await mkdir(directory.logsFolder, { recursive: true });
    const startLog = path.join(directory.logsFolder, startLogName);
    const processId = await this.starter.startAsync(command.executable, command.arguments, this.settings.environment, startLog);
    return new StartedRuntime(processId, startLog);
  }
}
