/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

export class LoadOnce<T> {
  private loading: Promise<T> | null = null;

  public getAsync(load: () => Promise<T>): Promise<T> {
    if (Object.isNull(this.loading)) {
      const loading = load();
      this.loading = loading;
      void loading.catch(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  public whenLoaded(use: (value: T) => void): void {
    void this.loading?.then(use, () => undefined);
  }
}
