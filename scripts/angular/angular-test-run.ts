/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class AngularTestRun {
  public readonly exitCode: number | null;
  public readonly collected: readonly string[] | null;

  public constructor(exitCode: number | null, collected: readonly string[] | null) {
    this.exitCode = exitCode;
    this.collected = collected;
  }

  public get isSuccessful(): boolean {
    return this.exitCode === 0;
  }
}
