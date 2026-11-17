/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandExit, type IRunningCommand } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeCommand implements IRunningCommand {
  private readonly exit: PromiseWithResolvers<CommandExit> = Promise.withResolvers();
  private readonly output: (text: string) => void;

  public readonly command: string;
  public readonly directory: string;
  public stops: number = 0;
  public endsOnStop: boolean = true;

  public constructor(command: string, directory: string, output: (text: string) => void) {
    this.command = command;
    this.directory = directory;
    this.output = output;
  }

  public get exited(): Promise<CommandExit> {
    return this.exit.promise;
  }

  public write(text: string): void {
    this.output(text);
  }

  public end(code: number | null, signal: string | null = null, error: string | null = null): void {
    this.exit.resolve(new CommandExit(code, signal, error));
  }

  public stopAsync(): Promise<void> {
    this.stops += 1;
    ChangeSignal.notify();
    if (this.endsOnStop)
      this.end(null, "SIGTERM");
    return Promise.resolve();
  }
}
