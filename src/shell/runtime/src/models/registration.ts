/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Registration implements Disposable {
  private readonly release: () => void;

  public constructor(release: () => void) {
    this.release = release;
  }

  public [Symbol.dispose](): void {
    this.release();
  }
}
