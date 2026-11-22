/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeRequestException } from "@noldova/desktop.window";
import type { ErrorCode } from "@noldova/teamrun.protocol";

import { RefusalDetails } from "./refusal-details.fixture";

export class RefusedError extends RuntimeRequestException {
  public constructor(message: string, code: ErrorCode, ...ids: readonly string[]) {
    super(code, message, new RefusalDetails(code, [...ids]).toJson());
  }
}
