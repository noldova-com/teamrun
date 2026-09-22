/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import type { IIdleParticipant } from "../interfaces/i-idle-participant.js";
import { Resources } from "../resources.js";

export class IdleMonitor implements Disposable {
  private readonly graceMilliseconds: number | null;
  private readonly participant: IIdleParticipant;
  private timer: NodeJS.Timeout | null = null;

  public constructor(graceMilliseconds: number | null, participant: IIdleParticipant) {
    if (!Object.isNull(graceMilliseconds))
      ArgumentOutOfRangeException.throwIfNotPositiveInteger(graceMilliseconds, Resources.idleGraceParameterName);

    this.graceMilliseconds = graceMilliseconds;
    this.participant = participant;
  }

  public get isArmed(): boolean {
    return !Object.isNull(this.timer);
  }

  public check(): void {
    if (Object.isNull(this.graceMilliseconds))
      return;
    if (!this.participant.isIdle) {
      this.disarm();
      return;
    }
    if (!Object.isNull(this.timer))
      return;

    this.timer = setTimeout(() => this.fire(), this.graceMilliseconds);
  }

  public [Symbol.dispose](): void {
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
