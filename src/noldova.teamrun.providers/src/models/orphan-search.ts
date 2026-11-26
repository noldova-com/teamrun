/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessListRow } from "./process-list-row.js";

export class OrphanSearch {
  public readonly listing: ReadonlyMap<number, ProcessListRow>;
  public readonly orphans: Map<number, number>;
  public readonly rootsGone: boolean;

  public constructor(listing: ReadonlyMap<number, ProcessListRow>, orphans: Map<number, number>, rootsGone: boolean) {
    this.listing = listing;
    this.orphans = orphans;
    this.rootsGone = rootsGone;
  }
}
