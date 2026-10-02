/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StartedRuntime {
  public readonly processId: number;
  public readonly startLog: string;

  public constructor(processId: number, startLog: string) {
    this.processId = processId;
    this.startLog = startLog;
  }

  public get isRunning(): boolean {
    try {
      process.kill(this.processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }
}
