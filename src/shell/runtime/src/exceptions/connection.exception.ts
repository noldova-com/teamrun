/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import type { Failure } from "@noldova/teamrun-shell-protocol";

export class ConnectionException extends Exception {
  public readonly failure: Failure | null;

  public constructor(message: string, failure: Failure | null = null, options?: ExceptionOptions) {
    super(message, options);

    this.failure = failure;
  }
}
