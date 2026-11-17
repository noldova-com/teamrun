/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FileShare {
  private readonly discard: () => void;
  private released: boolean = false;

  public readonly address: string;

  public constructor(address: string, discard: () => void) {
    this.address = address;
    this.discard = discard;
  }

  public release(): void {
    if (this.released)
      return;
    this.released = true;
    this.discard();
  }
}
