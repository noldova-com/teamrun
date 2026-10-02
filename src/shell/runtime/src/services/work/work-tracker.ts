/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WorkItem } from "../../models/work-item.js";

export class WorkTracker {
  private readonly items: Set<WorkItem> = new Set();
  private readonly changed: () => void;

  public constructor(changed: () => void) {
    this.changed = changed;
  }

  public get isEmpty(): boolean {
    return this.items.size === 0;
  }

  public get descriptions(): readonly string[] {
    return [...this.items].map(t => t.description);
  }

  public begin(description: string): WorkItem {
    const item = new WorkItem(description, t => this.end(t));
    this.items.add(item);
    this.changed();
    return item;
  }

  public cancelAll(): void {
    for (const item of this.items)
      item.cancel();
  }

  private end(item: WorkItem): void {
    if (this.items.delete(item))
      this.changed();
  }
}
