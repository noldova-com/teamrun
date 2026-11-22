/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ModelCatalog } from "./model-catalog";

export class CatalogReads {
  private readonly latest: Map<string, Promise<ModelCatalog>> = new Map();

  public follow(key: string, read: Promise<ModelCatalog>, apply: (catalog: ModelCatalog) => void): void {
    this.latest.set(key, read);
    void read.then(t => {
      if (this.latest.get(key) === read)
        apply(t);
    });
  }
}
