/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class HandoverHistory {
  public readonly text: string;
  public readonly kept: ReadonlySet<number>;
  public readonly covered: ReadonlySet<number>;

  public constructor(text: string, kept: ReadonlySet<number>, covered: ReadonlySet<number> = new Set<number>()) {
    this.text = text;
    this.kept = kept;
    this.covered = covered;
  }
}
