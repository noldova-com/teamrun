/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProgramStatus } from "@noldova/teamrun-shell-protocol";

export class RunningProgram {
  public readonly moduleId: string;
  public readonly program: string;
  public readonly processId: number;
  public readonly started: Date;
  public readonly hasExited: boolean;

  public constructor(moduleId: string, program: string, processId: number, started: Date, hasExited: boolean = false) {
    this.moduleId = moduleId;
    this.program = program;
    this.processId = processId;
    this.started = started;
    this.hasExited = hasExited;
  }

  public toStatus(): ProgramStatus {
    return new ProgramStatus(this.moduleId, this.program, this.processId, this.started, this.hasExited);
  }
}
