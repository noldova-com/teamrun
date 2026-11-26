/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorCode } from "@noldova/teamrun.protocol";

import { ClosedRunErrorInfo } from "./closed-run-error-info.fixture.js";

export class ClosedRunError extends Error {
  public readonly info: ClosedRunErrorInfo;

  public constructor(message: string) {
    super(message);
    this.info = new ClosedRunErrorInfo(ErrorCode.Conflict);
  }
}
