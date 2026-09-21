/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "../models/exception-options.js";
import { Resources } from "../resources.js";
import { Exception } from "./exception.js";

export class IndexOutOfRangeException extends Exception {
  public constructor(message: string = Resources.indexOutOfRange, options?: ExceptionOptions) {
    super(message, options);
  }
}
