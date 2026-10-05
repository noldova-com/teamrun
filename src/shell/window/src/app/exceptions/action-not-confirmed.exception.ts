/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { RuntimeDisconnectedException } from "./runtime-disconnected.exception";

export class ActionNotConfirmedException extends Exception {
  public constructor(message: string, cause: unknown) {
    super(message, { cause });
  }

  public static from(error: unknown, message: string): unknown {
    return RuntimeDisconnectedException.isIn(error) ? new ActionNotConfirmedException(message, error) : error;
  }
}
