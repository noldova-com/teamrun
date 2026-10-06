/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { ShellMethods, StopPolicy, StopRequest, type UpdateProcess, UpdateReady, UpdateRequest, WorkReport } from "@noldova/teamrun-shell-protocol";
import { type Installation, type ProcessPresence, UpdateBarrier, UpdateBarrierState } from "@noldova/teamrun-shell-runtime";

import { UpdateStopException } from "../exceptions/update-stop.exception.js";
import type { IUpdateTarget } from "../interfaces/i-update-target.js";
import { Resources } from "../resources.js";

export class UpdateStop {
  private readonly installation: Installation;
  private readonly presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">;
  private readonly connectAsync: (dataDirectory: string) => Promise<IUpdateTarget | null>;
  private readonly askAsync: (work: readonly string[]) => Promise<boolean>;
  private readonly processId: number;
  private readonly productVersion: string;
  private readonly now: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  public constructor(
    installation: Installation,
    presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">,
    connectAsync: (dataDirectory: string) => Promise<IUpdateTarget | null>,
    askAsync: (work: readonly string[]) => Promise<boolean>,
    processId: number,
    productVersion: string,
    now: () => number,
    wait: (milliseconds: number) => Promise<void>) {
    this.installation = installation;
    this.presence = presence;
    this.connectAsync = connectAsync;
    this.askAsync = askAsync;
    this.processId = processId;
    this.productVersion = productVersion;
    this.now = now;
    this.wait = wait;
  }

  public async runAsync(version: string, handOffAsync: () => Promise<void>): Promise<boolean> {
    const targets: IUpdateTarget[] = [];
    let isHeld = false;
    try {
      targets.push(...await this.connectAllAsync(await this.installation.listDataDirectoriesAsync()));
      const work = await this.readWorkAsync(targets);
      if (work.length > 0 && !await this.askAsync(work))
        return false;
      const holder = await this.stampSelfAsync();
      isHeld = await this.installation.holdAsync(new UpdateBarrier(holder, version, UpdateBarrierState.Preparing, null), this.productVersion);
      if (!isHeld)
        throw new UpdateStopException(Resources.updateUnderWay);
      const known = new Set(targets.map(t => t.dataDirectory));
      targets.push(...await this.connectAllAsync((await this.installation.listDataDirectoriesAsync()).filter(t => !known.has(t))));
      const processes = (await Promise.all(targets.map(t => this.prepareAsync(t)))).flat();
      const remaining = await Promise.all(targets.map(async (t): Promise<readonly [IUpdateTarget, readonly string[]]> => [t, await this.readTargetWorkAsync(t)]));
      const agreed = new Set(work);
      const unseen = remaining.flatMap(([, t]) => t).filter(t => !agreed.has(t));
      if (unseen.length > 0)
        throw new UpdateStopException(Resources.formatWorkStartedMeanwhile(unseen.join(Resources.workSeparator)));
      await Promise.all(remaining.map(([target, t]) => this.stopAsync(target, t.length > 0 ? StopPolicy.StopWork : StopPolicy.IfIdle)));
      await this.verifyAsync([...targets.map(t => t.runtime), ...processes.filter(t => t.role !== Resources.clientName)]);
      await this.installation.replaceAsync(new UpdateBarrier(holder, version, UpdateBarrierState.Closing, null));
      await this.verifyAsync(await this.listOtherDesktopsAsync(processes));
      await this.installation.replaceAsync(new UpdateBarrier(holder, version, UpdateBarrierState.HandedOff, null));
      await handOffAsync();
      return true;
    }
    catch (error) {
      if (isHeld)
        await this.installation.releaseAsync();
      throw error instanceof UpdateStopException ? error : new UpdateStopException(error instanceof Error ? error.message : String(error), new ExceptionOptions(error));
    }
    finally {
      for (const target of targets)
        target.connection.close();
    }
  }

  private async connectAllAsync(dataDirectories: readonly string[]): Promise<readonly IUpdateTarget[]> {
    const targets = await Promise.all(dataDirectories.map(t => this.connectAsync(t)));
    return targets.filter(t => !Object.isNull(t));
  }

  private async readWorkAsync(targets: readonly IUpdateTarget[]): Promise<readonly string[]> {
    return (await Promise.all(targets.map(t => this.readTargetWorkAsync(t)))).flat();
  }

  private async readTargetWorkAsync(target: IUpdateTarget): Promise<readonly string[]> {
    const response = await target.connection.callAsync(ShellMethods.work, null, Resources.workQueryTimeout);
    if (!Object.isUndefined(response.failure))
      throw new UpdateStopException(Resources.formatUpdateRefused(target.dataDirectory, response.failure.message));
    return WorkReport.fromJson(response.payload).descriptions.map(t => Resources.formatUpdateWork(t, target.dataDirectory));
  }

  private async listOtherDesktopsAsync(processes: readonly UpdateProcess[]): Promise<readonly UpdateProcess[]> {
    const desktops = [...processes.filter(t => t.role === Resources.clientName), ...await this.installation.listDesktopsAsync()];
    return desktops.filter((t, index) => t.processId !== this.processId && desktops.findIndex(u => u.processId === t.processId) === index);
  }

  private async stampSelfAsync(): Promise<UpdateProcess> {
    const [holder] = await this.presence.stampAsync([[this.processId, Resources.clientName]]);
    if (Object.isUndefined(holder))
      throw new UpdateStopException(Resources.updateHolderNotFound);
    return holder;
  }

  private async prepareAsync(target: IUpdateTarget): Promise<readonly UpdateProcess[]> {
    const response = await target.connection.callAsync(ShellMethods.update, new UpdateRequest(this.installation.folder).toJson(), Resources.updatePrepareTimeout);
    if (!Object.isUndefined(response.failure))
      throw new UpdateStopException(Resources.formatUpdateRefused(target.dataDirectory, response.failure.message));
    const ready = UpdateReady.fromJson(response.payload);
    if (!ready.isReady)
      throw new UpdateStopException(Resources.formatUpdateUnsaved(target.dataDirectory, ready.problems.join(Resources.workSeparator)));
    return ready.processes;
  }

  private async stopAsync(target: IUpdateTarget, policy: StopPolicy): Promise<void> {
    const response = await target.connection.callAsync(ShellMethods.stop, new StopRequest(policy).toJson(), Resources.updatePrepareTimeout);
    if (!Object.isUndefined(response.failure))
      throw new UpdateStopException(Resources.formatUpdateRefused(target.dataDirectory, response.failure.message));
  }

  private async verifyAsync(processes: readonly UpdateProcess[]): Promise<void> {
    const deadline = this.now() + Resources.updateExitWait;
    let running = processes;
    for (;;) {
      const checks = await Promise.all(running.map(t => this.presence.isRunningAsync(t)));
      running = running.filter((_, index) => checks[index]);
      if (running.length === 0)
        return;
      if (this.now() >= deadline)
        throw new UpdateStopException(Resources.formatProcessesNotExited(running.map(t => `${t.role} ${t.processId}`).join(Resources.workSeparator)));
      await this.wait(Resources.updateExitInterval);
    }
  }
}
