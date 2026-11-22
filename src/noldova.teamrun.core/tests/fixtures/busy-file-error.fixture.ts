/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { SystemCallError } from "./system-call-error.fixture.js";

export class BusyFileError extends SystemCallError {
  public constructor(message: string, syscall: string | null) {
    super(message, "EBUSY", syscall);
  }
}
