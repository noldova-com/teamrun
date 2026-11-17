/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";
import { LaunchedTerminal, TerminalEnd, type TerminalLaunch } from "@noldova/terminal.window";

import type { ITerminalLauncher } from "../../src/app/interfaces/i-terminal-launcher";

export class FakeTerminalLauncher implements ITerminalLauncher {
  private readonly ends: ((end: TerminalEnd) => void)[] = [];
  private readonly commandEnds: ((exitCode: number | null) => void)[] = [];
  private refusal: Error | null = null;
  private closeRefusal: Error | null = null;
  private closeHold: Promise<unknown> | null = null;

  public readonly launches: { readonly context: IWindowPartContext; readonly request: TerminalLaunch }[] = [];
  public readonly closes: number[] = [];

  public refuse(error: Error): this {
    this.refusal = error;
    return this;
  }

  public refuseClose(error: Error): this {
    this.closeRefusal = error;
    return this;
  }

  public holdCloses(until: Promise<unknown>): this {
    this.closeHold = until;
    return this;
  }

  public openAsync(context: IWindowPartContext, request: TerminalLaunch): Promise<LaunchedTerminal> {
    this.launches.push({ context, request });
    const index = this.launches.length - 1;
    return this.opened(index);
  }

  public endCommand(index: number, exitCode: number | null): void {
    this.commandEnds[index]?.(exitCode);
  }

  public end(index: number, end: TerminalEnd = new TerminalEnd("Close", null)): void {
    this.commandEnds[index]?.(null);
    this.ends[index]?.(end);
  }

  private opened(index: number): Promise<LaunchedTerminal> {
    if (!Object.isNull(this.refusal))
      return Promise.reject(this.refusal);
    const ended = new Promise<TerminalEnd>(resolve => this.ends.push(resolve));
    const commandEnded = new Promise<number | null>(resolve => this.commandEnds.push(resolve));
    return Promise.resolve(new LaunchedTerminal(`terminal-${index + 1}`, ended, () => this.close(index), commandEnded));
  }

  private async close(index: number): Promise<void> {
    this.closes.push(index);
    await this.closeHold;
    if (!Object.isNull(this.closeRefusal))
      throw this.closeRefusal;
    this.end(index);
  }
}
