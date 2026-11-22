/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { PartReadError } from "./part-read-error.fixture";

export class Required {
  public static of<T>(value: T | null | undefined): T {
    if (Object.isNullOrUndefined(value))
      throw new PartReadError("The value the spec reads isn't there.");
    return value;
  }
}
