/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type WritableSignal, signal } from "@angular/core";

import {
  TerminalLine, TerminalOwners, TerminalRun, type TerminalRunEnd, TerminalRunOutput, type TerminalRunTarget, type TerminalShellKind, TerminalTextRun
} from "@noldova/terminal.window";

import type { IInlineTerminal } from "../../src/app/interfaces/i-inline-terminal";
import type { IRunStarter } from "../../src/app/interfaces/i-run-starter";

export class FakeInlineTerminal implements IInlineTerminal {
  public readonly element: HTMLElement = document.createElement("div");
  public readonly sessionId: string;
  public readonly maximumRows: number;
  public readonly rowHeight: WritableSignal<number> = signal(0);
  public readonly events: string[] = [];

  public constructor(sessionId: string, maximumRows: number) {
    this.sessionId = sessionId;
    this.maximumRows = maximumRows;
  }

  public setMaximumRows(rows: number): void {
    this.events.push(`rows ${rows}`);
  }

  public setShown(shown: boolean): void {
    this.events.push(shown ? "shown" : "hidden");
  }

  public focus(): void {
    this.events.push("focus");
  }

  public dispose(): void {
    this.events.push("dispose");
  }
}

export class FakeInlineTerminals {
  public readonly opened: FakeInlineTerminal[] = [];

  public open(sessionId: string, rows: number): FakeInlineTerminal {
    const terminal = new FakeInlineTerminal(sessionId, rows);
    this.opened.push(terminal);
    return terminal;
  }
}

export class FakeRunStarter implements IRunStarter {
  public readonly runs: unknown[][] = [];
  public readonly reads: string[] = [];
  public readonly outputs: Map<string, TerminalRunOutput | Error> = new Map();
  public readonly ends: Map<string, Promise<TerminalRunEnd>> = new Map();
  public sessions: (string | Error)[] = [];
  public held: Promise<void> | null = null;

  public static outputOf(...texts: string[]): TerminalRunOutput {
    return new TerminalRunOutput(texts.map(t => new TerminalLine(t, false,
      t.length === 0 ? [] : [new TerminalTextRun(t.length, TerminalOwners.defaultColor, TerminalOwners.defaultColor, 0)])), 0);
  }

  public async startRunAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[], target: TerminalRunTarget | null,
    shown: ((sessionId: string) => void) | null = null): Promise<TerminalRun> {
    this.runs.push([owner, command, folder, shellKinds, target?.sessionId ?? null, target?.whenBusy ?? null]);
    const session = this.sessions.shift() ?? "none";
    const runId = `run-${this.runs.length}`;
    if (!Object.isNull(this.held))
      await this.held;
    if (session instanceof Error)
      throw session;
    shown?.(session);
    return new TerminalRun(session, runId, this.ends.get(runId));
  }

  public readRunOutputAsync(run: TerminalRun): Promise<TerminalRunOutput> {
    this.reads.push(run.runId);
    const output = this.outputs.get(run.runId) ?? new TerminalRunOutput([], 0);
    return output instanceof Error ? Promise.reject(output) : Promise.resolve(output);
  }
}
