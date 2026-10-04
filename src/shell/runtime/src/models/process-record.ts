/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import type { ProcessTableEntry } from "./process-table-entry.js";

export class ProcessRecord {
  public readonly id: number;
  public readonly moduleId: string;
  public readonly processId: number;
  public readonly program: string;
  public readonly executable: string;
  public readonly requested: number;
  public readonly started: number;

  public constructor(id: number, moduleId: string, processId: number, program: string, executable: string, requested: number, started: number) {
    this.id = id;
    this.moduleId = moduleId;
    this.processId = processId;
    this.program = program;
    this.executable = executable;
    this.requested = requested;
    this.started = started;
  }

  public get earliestStart(): number {
    return this.requested - Resources.processStartTolerance;
  }

  public isStartOf(entry: ProcessTableEntry): boolean {
    return entry.processId === this.processId && entry.started >= this.earliestStart && entry.started <= this.started + Resources.processStartTolerance;
  }
}
