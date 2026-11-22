/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HolderListing {
  public readonly lines: readonly string[];
  public readonly failure: string | null;

  public constructor(lines: readonly string[], failure: string | null) {
    this.lines = lines;
    this.failure = failure;
  }
}
