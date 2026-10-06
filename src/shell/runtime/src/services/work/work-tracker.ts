/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { WorkReport } from "@noldova/teamrun-shell-protocol";

import { WorkItem } from "../../models/work-item.js";

export class WorkTracker {
  private readonly items: Map<WorkItem, string> = new Map();
  private readonly changed: () => void;
  private sequence: number = 0;

  public constructor(changed: () => void) {
    this.changed = changed;
  }

  public get isEmpty(): boolean {
    return this.items.size === 0;
  }

  public get descriptions(): readonly string[] {
    return [...this.items.keys()].map(t => t.description);
  }

  public get report(): WorkReport {
    return new WorkReport(this.descriptions, this.sequence);
  }

  public begin(description: string, owner: string = String.empty): WorkItem {
    const item = new WorkItem(description, t => this.end(t));
    this.items.set(item, owner);
    this.notify();
    return item;
  }

  public cancelAll(): void {
    for (const item of this.items.keys())
      item.cancel();
  }

  public endOwnedBy(owner: string): void {
    const owned = [...this.items].filter(([, t]) => t === owner).map(([t]) => t);
    if (owned.length === 0)
      return;
    for (const item of owned) {
      item.cancel();
      this.items.delete(item);
    }
    this.notify();
  }

  private end(item: WorkItem): void {
    if (this.items.delete(item))
      this.notify();
  }

  private notify(): void {
    this.sequence++;
    this.changed();
  }
}
