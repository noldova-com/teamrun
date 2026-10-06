/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProgramStatus } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../../resources";

export class ProgramRow {
  public readonly processId: number;
  public readonly name: string;
  public readonly path: string;
  public readonly process: string;
  public readonly state: string;
  public readonly started: string;

  public constructor(processId: number, name: string, path: string, process: string, state: string, started: string) {
    this.processId = processId;
    this.name = name;
    this.path = path;
    this.process = process;
    this.state = state;
    this.started = started;
  }

  public static from(status: ProgramStatus, now: number, time: Intl.DateTimeFormat): ProgramRow {
    const name = status.program.split(Resources.pathSeparators).filter(t => t.length > 0).at(-1) ?? status.program;
    const minutes = Math.max(0, Math.floor((now - status.started.getTime()) / Resources.minuteDuration));
    return new ProgramRow(
      status.processId,
      name,
      status.program,
      Resources.formatProcessId(status.processId),
      status.hasExited ? Resources.programExited : Resources.formatRunningFor(minutes),
      Resources.formatProgramStarted(time.format(status.started)));
  }
}
