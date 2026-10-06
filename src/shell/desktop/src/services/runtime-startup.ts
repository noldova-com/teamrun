/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import "@noldova/teamrun-foundation-core";
import { type Event, type Failure, type RuntimeHandover, ShellEvents, ShellMethods, StopPolicy, UpdateSaved } from "@noldova/teamrun-shell-protocol";
import {
  ConnectionException,
  type IRuntimeClientListener,
  LaunchException,
  PreShellDataFoundException,
  RuntimeHandoverException,
  UpdateBarrierState,
  WorkInProgressException
} from "@noldova/teamrun-shell-runtime";

import { StartupStateKind } from "../enums/startup-state-kind.js";
import type { IRuntimeConnection } from "../interfaces/i-runtime-connection.js";
import type { IRuntimeLauncher } from "../interfaces/i-runtime-launcher.js";
import type { IUpdateHost } from "../interfaces/i-update-host.js";
import { StartupState } from "../models/startup-state.js";
import { Resources } from "../resources.js";

export class RuntimeStartup {
  private readonly launcher: IRuntimeLauncher;
  private readonly publish: (state: StartupState) => void;
  private readonly handOver: (handover: RuntimeHandover) => boolean;
  private readonly waitInterval: number;
  private readonly forward: (event: Event) => void;
  private readonly log: (message: string) => void;
  private readonly now: () => number;
  private readonly wait: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly updates: IUpdateHost;
  private readonly listener: IRuntimeClientListener;
  private readonly closing: AbortController = new AbortController();
  private state: StartupState = StartupState.connecting();
  private connectionValue: IRuntimeConnection | null = null;
  private readyAt: number = 0;
  private unstableEnds: number = 0;

  public constructor(
    launcher: IRuntimeLauncher,
    publish: (state: StartupState) => void,
    handOver: (handover: RuntimeHandover) => boolean,
    waitInterval: number,
    forward: (event: Event) => void,
    log: (message: string) => void,
    now: () => number,
    wait: (milliseconds: number, signal: AbortSignal) => Promise<void>,
    updates: IUpdateHost) {
    this.launcher = launcher;
    this.publish = publish;
    this.handOver = handOver;
    this.waitInterval = waitInterval;
    this.forward = forward;
    this.log = log;
    this.now = now;
    this.wait = wait;
    this.updates = updates;
    this.listener = {
      onEvent: t => this.receive(t),
      onDisconnected: t => this.reconnect(t)
    };
  }

  public get current(): StartupState {
    return this.state;
  }

  public get connection(): IRuntimeConnection | null {
    return this.connectionValue;
  }

  private get isClosed(): boolean {
    return this.closing.signal.aborted;
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
    else if (action === Resources.retryAction && kind === StartupStateKind.Failed) {
      this.unstableEnds = 0;
      await this.attachAsync(StopPolicy.IfIdle);
    }
    else
      return false;
    return true;
  }

  public close(): void {
    this.closing.abort();
    this.connectionValue?.close();
    this.connectionValue = null;
  }

  private attach(policy: StopPolicy): Promise<IRuntimeConnection> {
    return this.launcher.attachAsync(Resources.clientName, this.listener, policy);
  }

  private attachAsync(policy: StopPolicy): Promise<void> {
    return this.runAsync(() => this.attach(policy));
  }

  private async waitForWorkAsync(): Promise<void> {
    while (!this.isClosed) {
      try {
        this.accept(await this.attach(StopPolicy.IfIdle));
        return;
      }
      catch (error) {
        if (!(error instanceof WorkInProgressException))
          return this.refuse(error);
        this.update(StartupState.waitingForWork(error.work.descriptions));
      }
      await this.pauseAsync(this.waitInterval);
    }
  }

  private async pauseAsync(milliseconds: number): Promise<void> {
    try {
      await this.wait(milliseconds, this.closing.signal);
    }
    catch (error) {
      if (!this.isClosed)
        throw error;
    }
  }

  private async runAsync(attach: () => Promise<IRuntimeConnection>): Promise<void> {
    this.update(StartupState.connecting());
    await this.connectAsync(attach);
  }

  private async connectAsync(attach: () => Promise<IRuntimeConnection>): Promise<void> {
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
    this.readyAt = this.now();
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
    else if (error instanceof LaunchException || error instanceof ConnectionException) {
      this.log(Resources.formatRuntimeNotStarted(error.message));
      this.update(StartupState.failed(error.message));
    }
    else {
      this.log(Resources.formatRuntimeNotStarted(inspect(error)));
      this.update(StartupState.failed(String(error)));
    }
  }

  private receive(event: Event): void {
    if (event.name.equals(ShellEvents.updating))
      void this.freezeAsync(this.connectionValue);
    else if (event.name.equals(ShellEvents.updateEnded) && this.state.kind === StartupStateKind.Updating && !Object.isNull(this.connectionValue))
      this.update(StartupState.ready());
    this.forward(event);
  }

  private async freezeAsync(connection: IRuntimeConnection | null): Promise<void> {
    if (Object.isNull(connection))
      return;
    const barrier = await this.updates.readBarrierAsync().catch(() => null);
    this.update(StartupState.updating(barrier?.version ?? String.empty));
    const saved = new UpdateSaved(this.updates.processId, await this.updates.saveAsync());
    await connection.callAsync(ShellMethods.updateSaved, saved.toJson())
      .catch((error: unknown) => this.log(Resources.formatUpdateSavedUnsent(String(error))));
  }

  private async followUpdateAsync(): Promise<void> {
    while (!this.isClosed) {
      await this.pauseAsync(Resources.updateBarrierInterval);
      const barrier = await this.updates.readBarrierAsync().catch(() => undefined);
      if (Object.isNull(barrier)) {
        await this.attachAsync(StopPolicy.IfIdle);
        return;
      }
      if (barrier?.state === UpdateBarrierState.Closing && barrier.holder.processId !== this.updates.processId) {
        this.updates.quit();
        return;
      }
    }
  }

  private reconnect(failure: Failure | null): void {
    if (Object.isNull(this.connectionValue) || this.isClosed)
      return;
    this.connectionValue = null;
    if (this.state.kind === StartupStateKind.Updating) {
      void this.followUpdateAsync();
      return;
    }
    this.unstableEnds = this.now() - this.readyAt < Resources.stableConnectionPeriod ? this.unstableEnds + 1 : 1;
    const delay = Resources.reconnectionDelays[this.unstableEnds - 1];
    if (Object.isUndefined(delay))
      return this.stopReconnecting(failure);
    if (!Object.isNull(failure))
      this.log(Resources.formatConnectionEnded(failure.code, failure.message));
    void this.reconnectAsync(delay);
  }

  private async reconnectAsync(delay: number): Promise<void> {
    this.update(StartupState.connecting());
    if (delay > 0)
      await this.pauseAsync(delay);
    if (!this.isClosed)
      await this.connectAsync(() => this.attach(StopPolicy.IfIdle));
  }

  private stopReconnecting(failure: Failure | null): void {
    const details = Resources.formatReconnectionStopped(Object.isNull(failure) ? Resources.endedByRuntime : Resources.formatEndedByDesktop(failure.code, failure.message));
    this.log(Resources.formatRuntimeNotStarted(details));
    this.update(StartupState.failed(details));
  }

  private update(state: StartupState): void {
    this.state = state;
    this.publish(state);
  }
}
