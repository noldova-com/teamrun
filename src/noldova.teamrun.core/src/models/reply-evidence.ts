/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WorkingTreeChange } from "./working-tree-change.js";

export class ReplyEvidence {
  public readonly changes: readonly WorkingTreeChange[];
  public readonly isComplete: boolean;
  public readonly refusal: string | null;

  private constructor(changes: readonly WorkingTreeChange[], isComplete: boolean, refusal: string | null) {
    this.changes = changes;
    this.isComplete = isComplete;
    this.refusal = refusal;
  }

  public static compared(changes: readonly WorkingTreeChange[], isComplete: boolean): ReplyEvidence {
    return new ReplyEvidence(changes, isComplete, null);
  }

  public static refused(refusal: string): ReplyEvidence {
    return new ReplyEvidence([], true, refusal);
  }
}
