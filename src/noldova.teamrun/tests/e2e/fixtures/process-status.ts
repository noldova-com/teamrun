/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StartedProcess } from "./started-process.ts";

export class ProcessStatus extends StartedProcess {
  public readonly parent: number;
  public readonly session: number;
  public readonly state: string;
  public readonly command: string;

  public constructor(pid: number, name: string, start: string, parent: number, session: number, state: string, command: string) {
    super(pid, name, start);
    this.parent = parent;
    this.session = session;
    this.state = state;
    this.command = command;
  }
}
