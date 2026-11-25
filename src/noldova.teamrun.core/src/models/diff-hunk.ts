/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DiffRun } from "./diff-run.js";

export class DiffHunk {
  public readonly head: DiffRun;
  private readonly items: DiffRun[];
  private lastRun: DiffRun;

  public constructor(head: DiffRun) {
    this.head = head;
    this.items = [head];
    this.lastRun = head;
  }

  public get runs(): readonly DiffRun[] {
    return this.items;
  }

  public get last(): DiffRun {
    return this.lastRun;
  }

  public add(run: DiffRun): void {
    this.items.push(run);
    this.lastRun = run;
  }
}
