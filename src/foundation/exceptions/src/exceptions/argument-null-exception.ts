/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "../models/exception-options.js";
import { Resources } from "../resources.js";
import { ArgumentException } from "./argument-exception.js";

export class ArgumentNullException extends ArgumentException {
  public constructor(parameterName?: string, message?: string, options?: ExceptionOptions) {
    super(message ?? Resources.argumentNull, parameterName, options);
  }

  public static throwIfNull<T>(value: T, parameterName: string): asserts value is NonNullable<T> {
    if (Object.isNullOrUndefined(value))
      throw new ArgumentNullException(parameterName);
  }
}
