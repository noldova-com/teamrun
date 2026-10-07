/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { VirtualListCache } from "../services/virtual-list-cache";
import { HeightLedger } from "./height-ledger";
import type { VirtualListSource } from "./virtual-list-source";

export class VirtualListState<T> {
  public readonly source: VirtualListSource<T>;
  public readonly ledger: HeightLedger;
  public readonly cache: VirtualListCache<T>;

  public constructor(source: VirtualListSource<T>, report: (error: unknown) => void) {
    this.source = source;
    this.ledger = new HeightLedger(source.length(), source.estimate);
    this.cache = new VirtualListCache(source, report);
  }
}
