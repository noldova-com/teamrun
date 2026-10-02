/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { type RuntimeHandover, StopPolicy } from "@noldova/teamrun-shell-protocol";
import {
  ConnectionException,
  type IRuntimeClientListener,
  LaunchException,
  PreShellDataFoundException,
  RuntimeHandoverException,
  WorkInProgressException
} from "@noldova/teamrun-shell-runtime";

import { StartupStateKind } from "../enums/startup-state-kind.js";
import type { IRuntimeConnection } from "../interfaces/i-runtime-connection.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import { StartupState } from "../models/startup-state.js";
import { Resources } from "../resources.js";

export class RuntimeStartup {
  private readonly launcher: IRuntimeLauncher;
  private readonly publish: (state: StartupState) => void;
  private readonly handOver: (handover: RuntimeHandover) => boolean;
  private readonly waitInterval: number;
  private readonly listener: IRuntimeClientListener;
  private state: StartupState = StartupState.connecting();
  private connectionValue: IRuntimeConnection | null = null;
  private isClosed: boolean = false;

  public constructor(launcher: IRuntimeLauncher, publish: (state: StartupState) => void, handOver: (handover: RuntimeHandover) => boolean, waitInterval: number) {
    this.launcher = launcher;
    this.publish = publish;
    this.handOver = handOver;
    this.waitInterval = waitInterval;
    this.listener = {
      onEvent: () => undefined,
      onDisconnected: () => this.reconnect()
    };
  }

  public get current(): StartupState {
    return this.state;
  }

  public get connection(): IRuntimeConnection | null {
    return this.connectionValue;
  }

  public startAsync(): Promise<void> {
    return this.attachAsync(StopPolicy.IfIdle);
  }

  public async actAsync(action: unknown): Promise<boolean> {
    const kind = this.state.kind;
    if (action === Resources.moveAsideAction && kind === StartupStateKind.PreShellData)
      await this.runAsync(() => this.launcher.moveAsideAsync(Resources.clientName, this.listener, StopPolicy.IfIdle));
    else if (action === Resources.stopWorkAction && kind === StartupStateKind.WorkInProgress)
      await this.attachAsync(StopPolicy.StopWork);
    else if (action === Resources.waitAction && kind === StartupStateKind.WorkInProgress)
      await this.waitForWorkAsync();
    else if (action === Resources.retryAction && kind === StartupStateKind.Failed)
      await this.attachAsync(StopPolicy.IfIdle);
    else
      return false;
    return true;
  }

  public close(): void {
    this.isClosed = true;
    this.connectionValue?.close();
    this.connectionValue = null;
  }

  private attachAsync(policy: StopPolicy): Promise<void> {
    return this.runAsync(() => this.launcher.attachAsync(Resources.clientName, this.listener, policy));
  }

  private async waitForWorkAsync(): Promise<void> {
    while (!this.isClosed) {
      try {
        this.accept(await this.launcher.attachAsync(Resources.clientName, this.listener, StopPolicy.IfIdle));
        return;
      }
      catch (error) {
        if (!(error instanceof WorkInProgressException))
          return this.refuse(error);
        this.update(StartupState.waitingForWork(error.work.descriptions));
      }
      await delay(this.waitInterval);
    }
  }

  private async runAsync(attach: () => Promise<IRuntimeConnection>): Promise<void> {
    this.update(StartupState.connecting());
    try {
      this.accept(await attach());
    }
    catch (error) {
      this.refuse(error);
    }
  }

  private accept(connection: IRuntimeConnection): void {
    if (this.isClosed) {
      connection.close();
      return;
    }
    this.connectionValue = connection;
    this.update(StartupState.ready());
  }

  private refuse(error: unknown): void {
    if (error instanceof PreShellDataFoundException)
      this.update(StartupState.preShellData(error.data.location));
    else if (error instanceof WorkInProgressException)
      this.update(StartupState.workInProgress(error.work.descriptions));
    else if (error instanceof RuntimeHandoverException) {
      if (!this.handOver(error.handover))
        this.update(StartupState.newerBuild(error.handover.identity.productVersion));
    }
    else if (error instanceof LaunchException || error instanceof ConnectionException)
      this.update(StartupState.failed(error.message));
    else
      throw error;
  }

  private reconnect(): void {
    if (Object.isNull(this.connectionValue) || this.isClosed)
      return;
    this.connectionValue = null;
    void this.startAsync();
  }

  private update(state: StartupState): void {
    this.state = state;
    this.publish(state);
  }
}
