/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Failure, FailureCode, type UpdateProcess, UpdateReady, type UpdateRequest, type UpdateSaved } from "@noldova/teamrun-shell-protocol";

import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { ConnectedClient } from "../../models/connected-client.js";
import type { EventChannel } from "../../models/event-channel.js";
import { ProductInfo } from "../../models/product-info.js";
import { Resources } from "../../resources.js";
import type { RuntimeServer } from "../endpoint/runtime-server.js";
import { Installation } from "../installation/installation.js";
import type { ProcessPresence } from "../installation/process-presence.js";
import type { ProcessSupervisor } from "../process/process-supervisor.js";

export class UpdatePreparation implements Disposable {
  private readonly server: RuntimeServer;
  private readonly presence: ProcessPresence;
  private readonly processes: ProcessSupervisor;
  private readonly updating: EventChannel;
  private readonly ended: EventChannel;
  private readonly saveWait: number;
  private readonly barrierInterval: number;
  private answers: Map<number, UpdateSaved> | null = null;
  private answered: (() => void) | null = null;
  private expected: readonly ConnectedClient[] = [];
  private watch: NodeJS.Timeout | undefined;
  private watched: Installation | null = null;

  public constructor(
    server: RuntimeServer,
    presence: ProcessPresence,
    processes: ProcessSupervisor,
    updating: EventChannel,
    ended: EventChannel,
    saveWait: number,
    barrierInterval: number) {
    this.server = server;
    this.presence = presence;
    this.processes = processes;
    this.updating = updating;
    this.ended = ended;
    this.saveWait = saveWait;
    this.barrierInterval = barrierInterval;
  }

  public async prepareAsync(connection: number, request: UpdateRequest): Promise<UpdateReady> {
    const answers = new Map<number, UpdateSaved>();
    const expected = this.server.clients.filter(t => t.connection !== connection);
    const settled = Promise.withResolvers<void>();
    this.answers = answers;
    this.expected = expected;
    this.answered = settled.resolve;
    this.server.beginUpdate(new Failure(FailureCode.Updating, Resources.formatUpdating(ProductInfo.current.name)));
    this.processes.pause();
    this.updating.publish(null);
    this.watchBarrier(new Installation(request.installation, t => this.presence.isRunningAsync(t)));
    this.settleIfAnswered(answers);
    const timer = setTimeout(settled.resolve, this.saveWait);
    await settled.promise;
    clearTimeout(timer);
    return this.readReadyAsync(expected, answers);
  }

  public recordSaved(connection: number, saved: UpdateSaved): void {
    if (Object.isNull(this.answers))
      throw new MethodFailureException(new Failure(FailureCode.Conflict, Resources.updateNotPreparing));
    this.answers.set(connection, saved);
    this.settleIfAnswered(this.answers);
  }

  public [Symbol.dispose](): void {
    this.watched = null;
    clearTimeout(this.watch);
  }

  private settleIfAnswered(answers: ReadonlyMap<number, UpdateSaved>): void {
    if (this.expected.every(t => answers.has(t.connection)))
      this.answered?.();
  }

  private async readReadyAsync(expected: readonly ConnectedClient[], answers: ReadonlyMap<number, UpdateSaved>): Promise<UpdateReady> {
    const problems = expected.flatMap(t => answers.get(t.connection)?.problems ?? [Resources.formatClientNotAnswered(t.client)]);
    const clients = expected.flatMap(t => {
      const saved = answers.get(t.connection);
      return Object.isUndefined(saved) ? [] : [[saved.processId, t.client] as const];
    });
    const processes: UpdateProcess[] = [...await this.presence.stampAsync(clients), ...this.processes.updateProcesses];
    return new UpdateReady(problems, processes);
  }

  private watchBarrier(installation: Installation): void {
    this.watched = installation;
    this.watch = setTimeout(() => void installation.isHeldAsync().catch(() => false).then(isHeld => {
      if (this.watched === installation) {
        if (isHeld)
          this.watchBarrier(installation);
        else
          this.end();
      }
    }), this.barrierInterval);
    this.watch.unref();
  }

  private end(): void {
    this.watched = null;
    this.answers = null;
    this.answered?.();
    this.answered = null;
    this.expected = [];
    this.server.endUpdate();
    this.processes.resume();
    this.ended.publish(null);
  }
}
