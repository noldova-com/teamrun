/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FailedTest {
  public readonly identity: string;
  public readonly file: string;
  public readonly failure: string;

  public constructor(identity: string, file: string, failure: string) {
    this.identity = identity;
    this.file = file;
    this.failure = failure;
  }
}
