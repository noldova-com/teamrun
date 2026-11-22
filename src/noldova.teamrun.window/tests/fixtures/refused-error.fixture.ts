/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ErrorCode } from "@noldova/teamrun.protocol";

import { RefusalDetails } from "./refusal-details.fixture";

export class RefusedError extends Error {
  public readonly code: ErrorCode;
  public readonly details: RefusalDetails;

  public constructor(message: string, code: ErrorCode, ...ids: readonly string[]) {
    super(message);
    this.code = code;
    this.details = new RefusalDetails(code, [...ids]);
  }
}
