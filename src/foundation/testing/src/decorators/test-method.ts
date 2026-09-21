/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestMarks } from "../models/decorators/test-marks.js";

export function TestMethod(value: Function): void {
  Object.defineProperty(value, TestMarks.TEST_METHOD, { value: true, writable: false, enumerable: false, configurable: false });
}
