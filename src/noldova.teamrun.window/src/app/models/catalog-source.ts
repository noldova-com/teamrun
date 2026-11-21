/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CatalogSource {
  public readonly kind: string;
  public readonly providerId: string | null;

  public constructor(kind: string, providerId: string | null) {
    this.kind = kind;
    this.providerId = providerId;
  }
}
