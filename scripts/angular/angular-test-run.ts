/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type RetriedTest from "./retried-test.ts";

export default class AngularTestRun {
  public readonly exitCode: number | null;
  public readonly collected: readonly string[] | null;
  public readonly retried: readonly RetriedTest[];

  public constructor(exitCode: number | null, collected: readonly string[] | null, retried: readonly RetriedTest[]) {
    this.exitCode = exitCode;
    this.collected = collected;
    this.retried = retried;
  }

  public get isSuccessful(): boolean {
    return this.exitCode === 0;
  }
}
