/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";

export abstract class RuntimeException extends Exception {
  protected constructor(message: string, cause?: unknown) {
    super(message, Object.isUndefined(cause) ? undefined : new ExceptionOptions(cause));
  }
}
