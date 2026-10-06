/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { ExceptionOptions } from "../models/exception-options.js";
import { Resources } from "../resources.js";
import { Exception } from "./exception.js";

export class ArgumentException extends Exception {
  public override readonly name: string = "ArgumentException";
  public readonly parameterName?: string;

  public constructor(message?: string, parameterName?: string, options?: ExceptionOptions) {
    super(Resources.formatArgumentMessage(message ?? Resources.argumentInvalid, parameterName), options);

    if (!Object.isUndefined(parameterName))
      this.parameterName = parameterName;
  }

  public static throwIfNullOrWhitespace(value: string | null | undefined, parameterName: string): asserts value is string {
    if (Object.isNullOrUndefined(value))
      throw new ArgumentException(Resources.argumentNull, parameterName);

    if (value === String.empty)
      throw new ArgumentException(Resources.argumentEmpty, parameterName);

    if (String.isNullOrWhitespace(value))
      throw new ArgumentException(Resources.argumentWhitespace, parameterName);
  }

  public static throwIfEmpty<T>(value: readonly T[], parameterName: string): asserts value is readonly [T, ...T[]] {
    if (value.length === 0)
      throw new ArgumentException(Resources.argumentCollectionEmpty, parameterName);
  }
}
