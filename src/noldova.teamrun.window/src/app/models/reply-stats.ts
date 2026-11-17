/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ReplyStatRow } from "./reply-stat-row";

export class ReplyStats {
  public readonly label: string | null;
  public readonly note: string | null;
  public readonly rows: readonly ReplyStatRow[];

  public constructor(label: string | null, note: string | null, rows: readonly ReplyStatRow[]) {
    this.label = label;
    this.note = note;
    this.rows = rows;
  }
}
