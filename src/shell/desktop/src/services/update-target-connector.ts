/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { StopPolicy } from "@noldova/teamrun-shell-protocol";
import { AttachOptions, DataDirectory, DiscoveryReader, type IRuntimeClientListener, NoRuntimeException, OwnershipLock, type ProcessPresence,
  type RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";

import { UpdateStopException } from "../exceptions/update-stop.exception.js";
import type { IRuntimeConnection } from "../interfaces/i-runtime-connection.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { IUpdateTarget } from "../interfaces/i-update-target.js";
import { Resources } from "../resources.js";

export class UpdateTargetConnector {
  private static readonly LISTENER: IRuntimeClientListener = { onEvent: () => undefined, onDisconnected: () => undefined };

  private readonly installationFolder: string;
  private readonly locate: (program: string) => string;
  private readonly createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher;
  private readonly presence: Pick<ProcessPresence, "stampAsync">;
  private readonly now: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  public constructor(
    installationFolder: string,
    locate: (program: string) => string,
    createLauncher: (dataDirectory: DataDirectory) => IRuntimeLauncher,
    presence: Pick<ProcessPresence, "stampAsync">,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>) {
    this.installationFolder = installationFolder;
    this.locate = locate;
    this.createLauncher = createLauncher;
    this.presence = presence;
    this.now = now;
    this.wait = wait;
  }

  public async connectAsync(root: string): Promise<IUpdateTarget | null> {
    const dataDirectory = new DataDirectory(root);
    let connection: IRuntimeConnection | null = null;
    try {
      const discovery = await this.findDiscoveryAsync(dataDirectory, root);
      if (Object.isNull(discovery) || this.locate(discovery.executablePath) !== this.installationFolder)
        return null;
      connection = await this.attachAsync(dataDirectory);
      if (Object.isNull(connection))
        return null;
      const current = await DiscoveryReader.readAsync(dataDirectory);
      const [runtime] = Object.isNull(current) ? [] : await this.presence.stampAsync([[current.processId, Resources.runtimeRole]]);
      if (Object.isUndefined(runtime))
        throw new UpdateStopException(Resources.formatRuntimeNotFound(root));
      return { dataDirectory: root, runtime, connection };
    }
    catch (error) {
      connection?.close();
      throw error instanceof UpdateStopException ? error : new UpdateStopException(Resources.formatRuntimeNotReached(root), new ExceptionOptions(error));
    }
  }

  private async findDiscoveryAsync(dataDirectory: DataDirectory, root: string): Promise<RuntimeDiscovery | null> {
    const deadline = this.now() + Resources.runtimeStartWait;
    for (;;) {
      const discovery = await DiscoveryReader.readAsync(dataDirectory);
      if (!Object.isNull(discovery) || !OwnershipLock.isOwned(dataDirectory))
        return discovery;
      if (this.now() >= deadline)
        throw new UpdateStopException(Resources.formatRuntimeStillStarting(root));
      await this.wait(Resources.runtimeStartInterval);
    }
  }

  private async attachAsync(dataDirectory: DataDirectory): Promise<IRuntimeConnection | null> {
    try {
      return await this.createLauncher(dataDirectory).attachAsync(Resources.updateClientName, UpdateTargetConnector.LISTENER, StopPolicy.IfIdle, new AttachOptions(false, false));
    }
    catch (error) {
      if (error instanceof NoRuntimeException)
        return null;
      throw error;
    }
  }
}
