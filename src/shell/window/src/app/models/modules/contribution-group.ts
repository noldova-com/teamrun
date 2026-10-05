/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ContributionRow } from "./contribution-row";

export class ContributionGroup {
  public readonly kind: string;
  public readonly title: string;
  public readonly rows: readonly ContributionRow[];

  public constructor(kind: string, title: string, rows: readonly ContributionRow[]) {
    this.kind = kind;
    this.title = title;
    this.rows = [...rows];
  }
}
