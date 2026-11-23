/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CodexAppServerProgram, CodexServerChoice, CommandRunner, NodeProcessStarter, ProcessCommand, ProcessTerminator } from "@noldova/teamrun.providers";

import { HeldAppServerDownload } from "./held-app-server-download.fixture.js";
import { StampedVersionReader } from "./stamped-version-reader.fixture.js";

export class ChosenAppServerProgram extends CodexAppServerProgram {
  private readonly chosen: CodexServerChoice;

  public readonly refusals: string[] = [];

  public constructor(command: ProcessCommand, download: string) {
    super(new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))), new StampedVersionReader(), new HeldAppServerDownload(), 1);
    this.chosen = new CodexServerChoice(command, download);
  }

  public override choose(command: ProcessCommand): Promise<CodexServerChoice> {
    return Promise.resolve(this.refusals.length === 0 ? this.chosen : new CodexServerChoice(CodexAppServerProgram.sharedOf(command), null));
  }

  public override refuse(program: string, reason: string): void {
    this.refusals.push(`${program}: ${reason}`);
  }
}
