/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationHistory } from "@noldova/teamrun-foundation-data";

export class MemoryMigrationHistory extends MigrationHistory {
  public readonly applied: string[] = [];

  public override getApplied(): readonly string[] {
    return [...this.applied].sort();
  }

  public override record(id: string): void {
    this.applied.push(id);
  }
}
