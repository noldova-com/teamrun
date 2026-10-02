/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import type { IIdleParticipant } from "../../interfaces/idle-participant.js";
import { Resources } from "../../resources.js";

export class IdleMonitor implements Disposable {
  private readonly graceMilliseconds: number;
  private readonly participant: IIdleParticipant;
  private timer: NodeJS.Timeout | null = null;
  private isDisposed: boolean = false;

  public constructor(graceMilliseconds: number, participant: IIdleParticipant) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(graceMilliseconds, Resources.idleGraceParameterName);

    this.graceMilliseconds = graceMilliseconds;
    this.participant = participant;
  }

  public get isArmed(): boolean {
    return !Object.isNull(this.timer);
  }

  public check(): void {
    if (this.isDisposed)
      return;
    if (!this.participant.isIdle) {
      this.disarm();
      return;
    }
    if (Object.isNull(this.timer))
      this.timer = setTimeout(() => this.fire(), this.graceMilliseconds);
  }

  public [Symbol.dispose](): void {
    this.isDisposed = true;
    this.disarm();
  }

  private fire(): void {
    this.timer = null;
    if (this.participant.isIdle)
      this.participant.handleIdle();
  }

  private disarm(): void {
    if (Object.isNull(this.timer))
      return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
