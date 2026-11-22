/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class StartedProcess {
  public readonly pid: number;
  public readonly name: string;
  public readonly start: string;

  public constructor(pid: number, name: string, start: string) {
    this.pid = pid;
    this.name = name;
    this.start = start;
  }
}
