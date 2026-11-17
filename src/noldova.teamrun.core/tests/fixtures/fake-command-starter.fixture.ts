/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommandStarter } from "@noldova/teamrun.core";

import { ChangeSignal } from "./change-signal.fixture.js";
import { FakeCommand } from "./fake-command.fixture.js";

export class FakeCommandStarter implements ICommandStarter {
  public readonly started: FakeCommand[] = [];
  public refusal: string | null = null;

  public refusalOf(_command: string): string | null {
    return this.refusal;
  }

  public start(command: string, directory: string, output: (text: string) => void): FakeCommand {
    const started = new FakeCommand(command, directory, output);
    this.started.push(started);
    ChangeSignal.notify();
    return started;
  }
}
