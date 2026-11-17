/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ServiceException } from "@noldova/teamrun.services";
import { ErrorCode, type Message, type Provenance, type Provider } from "@noldova/teamrun.protocol";
import { Resources } from "../resources.js";
import { ActiveRun } from "./active-run.js";
import type { WakeTurn } from "./wake-turn.js";

export class ReplyWork {
  private readonly ending: PromiseWithResolvers<void> = Promise.withResolvers();
  private started: boolean = false;
  private finished: boolean = false;
  private readonly sent: Set<string> = new Set();
  private readonly joined: Message[] = [];
  private depth: number;
  private chosen: Provider | null;

  public readonly message: Message;
  public readonly instructions: string | null;
  public readonly trigger: Message;
  public readonly run: ActiveRun;
  public readonly wake: WakeTurn | null;
  public readonly chain: string;
  public readonly continued: Message | null;

  public constructor(message: Message, provider: Provider | null, instructions: string | null, trigger: Message, hop: number,
    wake: WakeTurn | null = null, chain: string | null = null, continued: Message | null = null) {
    this.message = message;
    this.chosen = provider;
    this.instructions = instructions;
    this.trigger = trigger;
    this.depth = hop;
    this.wake = wake;
    this.chain = chain ?? message.id;
    this.continued = continued;
    this.run = new ActiveRun(message.id);
  }

  public get provider(): Provider | null {
    return this.chosen;
  }

  public get hop(): number {
    return this.depth;
  }

  public get provenance(): Provenance {
    const provenance = this.message.provenance;
    if (Object.isNull(provenance))
      throw new ServiceException(ErrorCode.Internal, Resources.formatReplyWithoutProvenance(this.message.id), [this.message.id]);
    return provenance;
  }

  public get handOffs(): readonly Message[] {
    return this.joined;
  }

  public get isStarted(): boolean {
    return this.started;
  }

  public get isEnded(): boolean {
    return this.finished;
  }

  public get ended(): Promise<void> {
    return this.ending.promise;
  }

  public get sentTo(): ReadonlySet<string> {
    return this.sent;
  }

  public join(handOff: Message, hop: number): void {
    this.joined.push(handOff);
    this.depth = Math.max(this.depth, hop);
  }

  public recordSend(teammateIds: readonly string[]): void {
    for (const id of teammateIds)
      this.sent.add(id);
  }

  public moveTo(provider: Provider): void {
    this.chosen = provider;
  }

  public start(): void {
    this.started = true;
  }

  public end(): void {
    this.finished = true;
    this.ending.resolve();
  }
}
