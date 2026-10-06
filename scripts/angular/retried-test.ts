/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class RetriedTest {
  public readonly file: string;
  public readonly name: string;
  public readonly failure: string;

  public constructor(file: string, name: string, failure: string) {
    this.file = file;
    this.name = name;
    this.failure = failure;
  }
}
