/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { FolderState } from "../../enums/folder-state.js";
import type { ITimer } from "../../interfaces/i-timer.js";
import type { FolderCheckTimings } from "../../models/folder-check-timings.js";
import { Resources } from "../../resources.js";

export class FolderProbe {
  private readonly statAsync: (path: string) => Promise<{ isDirectory(): boolean }>;
  private readonly timings: FolderCheckTimings;
  private readonly timer: ITimer;
  private readonly stuck: Map<string, Promise<FolderState>> = new Map();
  private readonly linkedTurns: (() => void)[] = [];
  private linkedRunning: number = 0;
  private linkedStuck: number = 0;

  public constructor(statAsync: (path: string) => Promise<{ isDirectory(): boolean }>, timings: FolderCheckTimings, timer: ITimer) {
    this.statAsync = statAsync;
    this.timings = timings;
    this.timer = timer;
  }

  public async checkAsync(path: string): Promise<FolderState> {
    const check = this.stuck.get(path) ?? this.readAsync(path);
    const state = await this.withinAsync<FolderState | null>(check, this.timings.deadline, null);
    if (!Object.isNull(state))
      return state;
    if (!this.stuck.has(path))
      this.stuck.set(path, check.finally(() => this.stuck.delete(path)));
    return FolderState.Unreachable;
  }

  public async checkLinkedAsync(path: string): Promise<FolderState> {
    const held = this.stuck.get(path);
    if (!Object.isUndefined(held))
      return await this.withinAsync(held, this.timings.deadline, FolderState.Unreachable);
    if (this.linkedStuck >= Resources.maximumLinkedFolderChecks)
      return FolderState.Unreachable;
    const turn: { read: Promise<FolderState> | null; isLate: boolean } = { read: null, isLate: false };
    const read = (): Promise<FolderState> => {
      turn.read = this.readAsync(path).finally(() => this.passLinkedTurn());
      return turn.read;
    };
    const check = this.takeLinkedTurn() ? read() : this.waitLinkedTurnAsync().then(() => {
      if (!turn.isLate)
        return read();
      this.passLinkedTurn();
      return FolderState.Unreachable;
    });
    const state = await this.withinAsync<FolderState | null>(check, this.timings.deadline, null);
    if (!Object.isNull(state))
      return state;
    turn.isLate = true;
    if (!Object.isNull(turn.read) && !this.stuck.has(path)) {
      this.linkedStuck += 1;
      this.stuck.set(path, turn.read.finally(() => {
        this.linkedStuck -= 1;
        this.stuck.delete(path);
      }));
    }
    return FolderState.Unreachable;
  }

  public async withinListWaitAsync(checks: Promise<unknown>): Promise<void> {
    await this.withinAsync(checks, this.timings.listWait, null);
  }

  private readAsync(path: string): Promise<FolderState> {
    return this.statAsync(path).then(t => t.isDirectory() ? FolderState.Present : FolderState.Missing, () => FolderState.Missing);
  }

  private takeLinkedTurn(): boolean {
    if (this.linkedRunning >= Resources.maximumLinkedFolderChecks)
      return false;
    this.linkedRunning += 1;
    return true;
  }

  private waitLinkedTurnAsync(): Promise<void> {
    return new Promise<void>(resolve => this.linkedTurns.push(resolve));
  }

  private passLinkedTurn(): void {
    const next = this.linkedTurns.shift();
    if (Object.isUndefined(next))
      this.linkedRunning -= 1;
    else
      next();
  }

  private async withinAsync<T>(work: Promise<T>, milliseconds: number, late: T): Promise<T> {
    const waited = new AbortController();
    const elapsed = this.timer.delayAsync(milliseconds, waited.signal).then(() => late, () => late);
    const result = await Promise.race([work, elapsed]);
    waited.abort();
    return result;
  }
}
