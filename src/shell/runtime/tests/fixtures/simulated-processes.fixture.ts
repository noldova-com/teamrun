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
  private readonly replaced: Set<number> = new Set();

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

  public replace(processId: number): void {
    this.replaced.add(processId);
  }

  public isAlive(processId: number): boolean {
    return this.groups.has(processId);
  }

  public list(format: (processId: number) => string): string {
    return [...this.groups.keys()].map(format).join("\n");
  }

  public async answerKillsAsync(commandArguments: readonly string[], table: string = ""): Promise<string> {
    const script = Buffer.from(commandArguments.at(-1) ?? "", "base64").toString("utf16le");
    const targets = (/\$targets = @\(([\d,]*)\)/.exec(script)?.[1] ?? "").split(",").filter(t => t !== "").map(Number);
    const deadline = Date.now() + Number(/AddMilliseconds\((\d+)\)/.exec(script)?.[1]);
    const lines: string[] = [];
    const held: number[] = [];
    for (const processId of targets.filter((_, index) => index % 2 === 0)) {
      if (!this.isRunning(processId, 0))
        lines.push(`${processId}\tgone`);
      else if (this.replaced.has(processId))
        lines.push(`${processId}\tother`);
      else {
        lines.push(`${processId}\t${this.tryKill(processId) ? "killed" : "failed"}`);
        held.push(processId);
      }
    }
    if (script.includes("Get-CimInstance"))
      lines.push(table);
    for (const processId of held) {
      while (this.isRunning(processId, 0) && Date.now() < deadline)
        await new Promise(t => setTimeout(t, 10));
      lines.push(`${processId}\t${this.isRunning(processId, 0) ? "running" : "ended"}`);
    }
    return lines.join("\r\n");
  }

  public [Symbol.dispose](): void {
    this.kill[Symbol.dispose]();
  }

  private tryKill(processId: number): boolean {
    try {
      return process.kill(processId, "SIGKILL");
    }
    catch {
      return false;
    }
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
