/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "../models/exception-options.js";

export abstract class Exception extends Error {
  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);

    this.name = new.target.name;
  }
}
