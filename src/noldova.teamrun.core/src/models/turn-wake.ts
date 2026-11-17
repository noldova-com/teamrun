/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TurnWake {
  public readonly taskId: string | null;
  public readonly command: string | null;
  public readonly compaction: boolean;

  public constructor(taskId: string | null, command: string | null, compaction: boolean = false) {
    this.taskId = taskId;
    this.command = command;
    this.compaction = compaction;
  }
}
