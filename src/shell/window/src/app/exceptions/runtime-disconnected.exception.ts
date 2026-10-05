/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/teamrun-shell-protocol";

import { RuntimeRequestException } from "./runtime-request.exception";

export class RuntimeDisconnectedException extends RuntimeRequestException {
  public constructor(message: string) {
    super(FailureCode.Disconnected, message);
  }

  public static isIn(error: unknown): boolean {
    let current: unknown = error;
    while (current instanceof Error) {
      if (current instanceof RuntimeDisconnectedException)
        return true;
      current = current.cause;
    }
    return false;
  }
}
