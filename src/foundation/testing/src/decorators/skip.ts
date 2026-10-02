/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { TestMarks } from "../models/decorators/test-marks.js";

export function Skip(reason: string): (value: Function) => void {
  ArgumentException.throwIfNullOrWhitespace(reason, "reason");

  return (t: Function): void => {
    Object.defineProperty(t, TestMarks.SKIP, { value: reason, writable: false, enumerable: false, configurable: false });
  };
}
