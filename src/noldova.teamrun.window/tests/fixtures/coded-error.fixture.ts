/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeRequestException } from "@noldova/desktop.window";
import type { ErrorCode } from "@noldova/teamrun.protocol";

export class CodedError extends RuntimeRequestException {
  public constructor(message: string, code: ErrorCode) {
    super(code, message);
  }
}
