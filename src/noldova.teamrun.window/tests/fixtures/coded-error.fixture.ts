/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ErrorCode } from "@noldova/teamrun.protocol";

export class CodedError extends Error {
  public readonly code: ErrorCode;

  public constructor(message: string, code: ErrorCode) {
    super(message);
    this.code = code;
  }
}
