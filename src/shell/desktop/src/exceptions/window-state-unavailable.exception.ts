/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { WindowStateException } from "./window-state.exception.js";

export class WindowStateUnavailableException extends WindowStateException {
  public constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
