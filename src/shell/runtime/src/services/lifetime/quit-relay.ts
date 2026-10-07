/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate as yieldTurn } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { Failure, FailureCode, QuitReport, QuitResult, ShellClients, StayCause, type StayedOpen } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { EventChannel } from "../../models/event-channel.js";
import { ProductInfo } from "../../models/product-info.js";
import type { RequestContext } from "../../models/request-context.js";
import { Resources } from "../../resources.js";
import type { RuntimeServer } from "../endpoint/runtime-server.js";

export class QuitRelay {
  private readonly server: RuntimeServer;
  private readonly quitting: EventChannel;
  private readonly waits: Map<RequestContext, PromiseWithResolvers<QuitReport>> = new Map();
  private desktops: ReadonlySet<number> = new Set();

  public constructor(server: RuntimeServer, quitting: EventChannel) {
    this.server = server;
    this.quitting = quitting;
  }

  public countWaiting(context: RequestContext): number {
    return new Set([...this.waits.keys()].map(t => t.connection).filter(t => t !== context.connection)).size;
  }

  public quitAsync(context: RequestContext): Promise<QuitReport> {
    const isJoining = this.waits.size > 0;
    if (!isJoining) {
      const desktops = this.server.clients.filter(t => t.client === ShellClients.desktop && t.connection !== context.connection).map(t => t.connection);
      if (desktops.length === 0)
        return Promise.resolve(new QuitReport(QuitResult.NoDesktop));
      this.desktops = new Set(desktops);
    }
    const wait = Promise.withResolvers<QuitReport>();
    this.waits.set(context, wait);
    context.signal.addEventListener(Resources.abortEvent, () => this.waits.delete(context), { once: true });
    if (!isJoining)
      this.quitting.publish(null);
    return wait.promise;
  }

  public recordStayed(connection: number, stayed: StayedOpen): void {
    if (!this.desktops.has(connection))
      return;
    const failure = stayed.cause === StayCause.Kept
      ? new Failure(FailureCode.Cancelled, Resources.formatQuitKept(ProductInfo.current.name))
      : new Failure(FailureCode.Conflict, Resources.formatQuitSaveFailed(ProductInfo.current.name));
    for (const wait of this.takeWaits())
      wait.reject(new MethodFailureException(failure));
  }

  public check(): void {
    if (this.waits.size > 0 && !this.server.clients.some(t => this.desktops.has(t.connection)))
      this.settle();
  }

  public async endAsync(): Promise<void> {
    if (this.waits.size === 0)
      return;
    this.settle();
    await yieldTurn();
  }

  private settle(): void {
    for (const wait of this.takeWaits())
      wait.resolve(new QuitReport(QuitResult.Quit));
  }

  private takeWaits(): PromiseWithResolvers<QuitReport>[] {
    const waits = [...this.waits.values()];
    this.waits.clear();
    this.desktops = new Set();
    return waits;
  }
}
