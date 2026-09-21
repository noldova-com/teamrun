/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FailureStep {
  public readonly error: unknown;

  public constructor(error: unknown) {
    this.error = error;
  }
}
