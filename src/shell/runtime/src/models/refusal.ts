/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Failure, QualifiedName } from "@noldova/teamrun-shell-protocol";

export class Refusal {
  public readonly failure: Failure;
  public readonly method: QualifiedName;

  public constructor(failure: Failure, method: QualifiedName) {
    this.failure = failure;
    this.method = method;
  }
}
