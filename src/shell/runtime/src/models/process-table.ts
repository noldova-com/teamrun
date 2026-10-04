/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../resources.js";
import type { ProcessRecord } from "./process-record.js";
import { ProcessTableEntry } from "./process-table-entry.js";

export class ProcessTable {
  public readonly entries: readonly ProcessTableEntry[];

  public constructor(entries: readonly ProcessTableEntry[]) {
    this.entries = [...entries];
  }

  public find(processId: number): ProcessTableEntry | undefined {
    return this.entries.find(t => t.processId === processId);
  }

  public findLeader(record: ProcessRecord): ProcessTableEntry | undefined {
    const leader = this.find(record.processId);
    return !Object.isUndefined(leader) && record.isStartOf(leader) ? leader : undefined;
  }

  public includes(member: ProcessTableEntry): boolean {
    return this.entries.some(t => t.processId === member.processId && t.groupId === member.groupId && Math.abs(t.started - member.started) <= Resources.processStartTolerance);
  }

  public listGroup(groupId: number): readonly ProcessTableEntry[] {
    return this.entries.filter(t => t.groupId === groupId);
  }

  public findOrphans(record: ProcessRecord, until: number): readonly ProcessTableEntry[] {
    const orphans: ProcessTableEntry[] = [];
    this.collect(new ProcessTableEntry(record.processId, 0, null, record.earliestStart, null), until, orphans);
    return orphans;
  }

  public findTree(leader: ProcessTableEntry): readonly ProcessTableEntry[] {
    const tree = [leader];
    this.collect(leader, Number.POSITIVE_INFINITY, tree);
    return tree;
  }

  public findLateChildren(killed: readonly ProcessTableEntry[], until: number): readonly ProcessTableEntry[] {
    const late: ProcessTableEntry[] = [];
    for (const parent of killed)
      this.collect(parent, until, late, killed);
    return late;
  }

  private collect(parent: ProcessTableEntry, until: number, found: ProcessTableEntry[], known: readonly ProcessTableEntry[] = found): void {
    const children = this.entries.filter(t =>
      t.parentId === parent.processId && t.started >= parent.started && t.started <= until &&
      !found.some(u => u.processId === t.processId) && !known.some(u => u.processId === t.processId));
    for (const child of children) {
      found.push(child);
      this.collect(child, Number.POSITIVE_INFINITY, found, known);
    }
  }
}
