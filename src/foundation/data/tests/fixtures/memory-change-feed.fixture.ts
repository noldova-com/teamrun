/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Change, ChangeFeed, type ChangeOperation } from "@noldova/teamrun-foundation-data";

export class MemoryChangeFeed extends ChangeFeed {
  public readonly changes: Change[] = [];

  protected override appendCore(entity: string, entityId: string, operation: ChangeOperation, payload: string): Change {
    const change = new Change(this.changes.length + 1, entity, entityId, operation, payload, new Date().toISOString());
    this.changes.push(change);
    return change;
  }

  protected override readAfterCore(sequence: number, limit: number): readonly Change[] {
    return this.changes.filter(t => t.sequence > sequence).slice(0, limit);
  }
}
