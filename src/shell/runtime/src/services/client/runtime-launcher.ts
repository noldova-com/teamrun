/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { type BuildIdentity, FailureCode, type RuntimeHandover, RunningWork, StopPolicy } from "@noldova/teamrun-shell-protocol";

import { BuildRelation } from "../../enums/build-relation.js";
import { ConnectionException } from "../../exceptions/connection.exception.js";
import { LaunchException } from "../../exceptions/launch.exception.js";
import { PreShellDataFoundException } from "../../exceptions/pre-shell-data-found.exception.js";
import { RuntimeHandoverException } from "../../exceptions/runtime-handover.exception.js";
import { WorkInProgressException } from "../../exceptions/work-in-progress.exception.js";
import type { IRuntimeClientListener } from "../../interfaces/runtime-client-listener.js";
import { Endpoint } from "../../models/endpoint.js";
import type { LaunchSettings } from "../../models/launch-settings.js";
import { ProcessLaunchCommand } from "../../models/process-launch-command.js";
import type { RuntimeDiscovery } from "../../models/runtime-discovery.js";
import { Resources } from "../../resources.js";
import { DiscoveryReader } from "../discovery/discovery-reader.js";
import { OwnershipLock } from "../ownership/ownership-lock.js";
import { BuildComparer } from "./build-comparer.js";
import { RuntimeClient } from "./runtime-client.js";

export class RuntimeLauncher {
  private readonly settings: LaunchSettings;
  private readonly identity: BuildIdentity;

  public constructor(settings: LaunchSettings, identity: BuildIdentity) {
    this.settings = settings;
    this.identity = identity;
  }

  public async attachAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy = StopPolicy.IfIdle): Promise<RuntimeClient> {
    return RuntimeLauncher.requireCurrentData(await this.connectAsync(clientName, listener, policy));
  }

  public async moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy = StopPolicy.IfIdle): Promise<RuntimeClient> {
    const client = await this.connectAsync(clientName, listener, policy);
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

  private async connectAsync(clientName: string, listener: IRuntimeClientListener, policy: StopPolicy): Promise<RuntimeClient> {
    const deadline = Date.now() + this.settings.launchTimeout;
    let hasStarted = false;
    while (Date.now() < deadline) {
      const discovery = await DiscoveryReader.readAsync(this.settings.dataDirectory);
      if (!Object.isNull(discovery) && OwnershipLock.isOwned(this.settings.dataDirectory)) {
        const client = await this.tryConnectAsync(discovery, clientName, listener);
        if (!Object.isNull(client)) {
          const handover = client.handover;
          if (Object.isNull(handover))
            return client;
          await this.resolveOtherBuildAsync(client, handover, policy, deadline);
          hasStarted = false;
          continue;
        }
      }
      else if (!hasStarted) {
        await this.startAsync();
        hasStarted = true;
      }
      await delay(this.settings.pollInterval);
    }
    throw new LaunchException(Resources.launchTimedOut);
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

  private async resolveOtherBuildAsync(client: RuntimeClient, handover: RuntimeHandover, policy: StopPolicy, deadline: number): Promise<void> {
    if (BuildComparer.compare(this.identity, handover.identity) === BuildRelation.Older) {
      client.close();
      throw new RuntimeHandoverException(handover);
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

  private async startAsync(): Promise<void> {
    const command = new ProcessLaunchCommand(this.settings.platform, this.settings.executablePath, [
      this.settings.entryPath,
      Resources.dataDirectoryArgument,
      this.settings.dataDirectory.root,
      Resources.idleGraceArgument,
      String(this.settings.idleGraceMilliseconds)
    ]);
    const child = spawn(command.executable, command.arguments, { detached: true, stdio: Resources.ignoredOutput, windowsHide: true, env: this.settings.environment });
    try {
      await once(child, Resources.spawnEvent);
    }
    catch (error) {
      throw new LaunchException(Resources.formatStartFailed(this.settings.executablePath), new ExceptionOptions(error));
    }
    child.unref();
  }
}
