/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, type ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import type { FailureCode } from "../enums/failure-code.js";

export class ProtocolException extends Exception {
  public readonly code: FailureCode;

  public constructor(code: FailureCode, message: string, options?: ExceptionOptions) {
    super(message, options);

    this.code = code;
  }
}
