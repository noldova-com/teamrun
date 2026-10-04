/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type NightlyFailure from "./nightly-failure.ts";

export default class NightlyFinding {
  public readonly failure: NightlyFailure;
  public readonly labels: readonly string[];

  public constructor(failure: NightlyFailure, labels: readonly string[]) {
    this.failure = failure;
    this.labels = [...labels];
  }
}
