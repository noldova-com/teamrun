/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessTableEntry } from "./process-table-entry.js";

export class ProcessRecord {
  public readonly id: number;
  public readonly moduleId: string;
  public readonly processId: number;
  public readonly program: string;
  public readonly executable: string;
  public readonly boot: string;
  public readonly requested: number;
  public readonly started: number;
  public readonly seen: number;
  public readonly clockOffset: number;

  public constructor(
    id: number,
    moduleId: string,
    processId: number,
    program: string,
    executable: string,
    boot: string,
    requested: number,
    started: number,
    seen: number,
    clockOffset: number) {
    this.id = id;
    this.moduleId = moduleId;
    this.processId = processId;
    this.program = program;
    this.executable = executable;
    this.boot = boot;
    this.requested = requested;
    this.started = started;
    this.seen = seen;
    this.clockOffset = clockOffset;
  }

  public isStartOf(entry: ProcessTableEntry): boolean {
    return entry.processId === this.processId && entry.latest >= this.requested && entry.earliest <= this.started;
  }

  public isSeenWith(entry: ProcessTableEntry): boolean {
    return entry.latest >= this.requested && entry.latest <= this.seen;
  }

  public isAfterRequest(entry: ProcessTableEntry): boolean {
    return entry.latest >= this.requested;
  }
}
