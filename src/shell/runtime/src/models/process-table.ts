/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { ProcessRecord } from "./process-record.js";
import type { ProcessTableEntry } from "./process-table-entry.js";

export class ProcessTable {
  public readonly entries: readonly ProcessTableEntry[];

  public constructor(entries: readonly ProcessTableEntry[]) {
    this.entries = [...entries];
  }

  public find(processId: number): ProcessTableEntry | undefined {
    return this.entries.find(t => t.processId === processId);
  }

  public findGroup(record: ProcessRecord): readonly ProcessTableEntry[] {
    const leader = this.find(record.processId);
    if (!Object.isUndefined(leader) && !record.isStartOf(leader))
      return [];
    return this.entries.filter(t => t.groupId === record.processId && t.started >= record.earliestStart);
  }

  public findTree(record: ProcessRecord): readonly ProcessTableEntry[] {
    const leader = this.find(record.processId);
    if (Object.isUndefined(leader)) {
      const descendants: ProcessTableEntry[] = [];
      this.collect(record.processId, record.earliestStart, descendants);
      return descendants;
    }
    if (!record.isStartOf(leader))
      return [];
    const tree = [leader];
    this.collect(leader.processId, leader.started, tree);
    return tree;
  }

  private collect(processId: number, since: number, tree: ProcessTableEntry[]): void {
    for (const child of this.entries.filter(t => t.parentId === processId && t.started >= since && !tree.includes(t))) {
      tree.push(child);
      this.collect(child.processId, child.started, tree);
    }
  }
}
