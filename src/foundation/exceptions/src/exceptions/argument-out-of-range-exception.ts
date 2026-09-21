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

export class ArgumentOutOfRangeException extends ArgumentException {
  public readonly actualValue: unknown;

  public constructor(parameterName?: string, actualValue?: unknown, message?: string, options?: ExceptionOptions) {
    super(message ?? Resources.argumentOutOfRange, parameterName, options);

    this.actualValue = actualValue;
  }

  public static throwIfNotPositiveInteger(value: number, parameterName: string, message?: string): void {
    if (!Number.isInteger(value) || value <= 0)
      throw new ArgumentOutOfRangeException(parameterName, value, message);
  }
}
