/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class IsolatedTest {
  public readonly index: number;
  public readonly file: string;

  public constructor(index: number, file: string) {
    this.index = index;
    this.file = file;
  }
}
