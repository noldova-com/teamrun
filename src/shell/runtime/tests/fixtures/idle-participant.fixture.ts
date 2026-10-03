/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IIdleParticipant } from "@noldova/teamrun-shell-runtime";

export class IdleParticipantFixture implements IIdleParticipant {
  private readonly queries: (() => void)[] = [];
  private readonly reports: (() => void)[] = [];
  private idle: boolean = true;

  public idleCount: number = 0;

  public get isIdle(): boolean {
    for (const resolve of this.queries.splice(0))
      resolve();
    return this.idle;
  }

  public set isIdle(value: boolean) {
    this.idle = value;
  }

  public waitForQueryAsync(): Promise<void> {
    return new Promise<void>(resolve => this.queries.push(resolve));
  }

  public waitForIdleAsync(): Promise<void> {
    return new Promise<void>(resolve => this.reports.push(resolve));
  }

  public handleIdle(): void {
    this.idleCount++;
    for (const resolve of this.reports.splice(0))
      resolve();
  }
}
