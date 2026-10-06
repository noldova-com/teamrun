/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { Failure } from "@noldova/teamrun-shell-protocol";

export class MethodFailureException extends Exception {
  public override readonly name: string = "MethodFailureException";
  public readonly failure: Failure;

  public constructor(failure: Failure) {
    super(failure.message);

    this.failure = failure;
  }
}
