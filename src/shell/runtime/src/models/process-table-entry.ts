/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessTableEntry {
  public readonly processId: number;
  public readonly parentId: number;
  public readonly groupId: number | null;
  public readonly started: number;
  public readonly earliest: number;
  public readonly latest: number;
  public readonly executable: string | null;

  public constructor(processId: number, parentId: number, groupId: number | null, started: number, earliest: number, latest: number, executable: string | null) {
    this.processId = processId;
    this.parentId = parentId;
    this.groupId = groupId;
    this.started = started;
    this.earliest = earliest;
    this.latest = latest;
    this.executable = executable;
  }
}
