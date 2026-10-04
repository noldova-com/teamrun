/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProcessKillFixture } from "./process-kill.fixture.js";

export class SimulatedProcessesFixture implements Disposable {
  private readonly kill: ProcessKillFixture;
  private readonly owned: Set<number> = new Set();
  private readonly groups: Map<number, number> = new Map();
  private readonly resistant: Set<number> = new Set();
  private readonly failures: Map<string, unknown> = new Map();

  public constructor() {
    this.kill = new ProcessKillFixture((processId, signal) => this.isRunning(processId, signal));
  }

  public get signals(): readonly string[] {
    return this.kill.signals;
  }

  public own(processId: number): void {
    this.owned.add(processId);
  }

  public add(processId: number, groupId: number, resists: boolean = false): void {
    this.groups.set(processId, groupId);
    if (resists)
      this.resistant.add(processId);
  }

  public remove(processId: number): void {
    this.groups.delete(processId);
  }

  public fail(processId: number, signal: string | number, failure: unknown): void {
    this.failures.set(`${processId} ${signal}`, failure);
  }

  public isAlive(processId: number): boolean {
    return this.groups.has(processId);
  }

  public list(format: (processId: number) => string): string {
    return [...this.groups.keys()].map(format).join("\n");
  }

  public [Symbol.dispose](): void {
    this.kill[Symbol.dispose]();
  }

  private isRunning(processId: number, signal: string | number): boolean {
    const failure = this.failures.get(`${processId} ${signal}`);
    if (failure !== undefined)
      throw failure;
    const target = Math.abs(processId);
    const real = this.owned.has(target) && this.kill.real(processId, signal);
    const members = [...this.groups].filter(([id, group]) => processId < 0 ? group === target : id === processId).map(([id]) => id);
    if (signal !== 0)
      for (const member of members.filter(t => !this.resistant.has(t)))
        this.groups.delete(member);
    return real || members.length > 0;
  }
}
