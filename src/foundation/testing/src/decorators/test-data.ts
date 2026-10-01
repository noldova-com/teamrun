/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestingException } from "../exceptions/testing.exception.js";
import { TestDataEntry } from "../models/decorators/test-data-entry.js";
import { TestMarks } from "../models/decorators/test-marks.js";
import { Resources } from "../resources.js";

export function TestData<TArguments extends unknown[]>(...values: TArguments): (value: (...testArguments: TArguments) => unknown) => void {
  const entry = new TestDataEntry(values);

  return (t: (...testArguments: TArguments) => unknown): void => {
    if (!Object.hasOwn(t, TestMarks.TEST_DATA))
      Object.defineProperty(t, TestMarks.TEST_DATA, { value: [], writable: false, enumerable: false, configurable: false });

    const entries: unknown = Object.getOwnPropertyDescriptor(t, TestMarks.TEST_DATA)?.value;
    if (!Array.isArray(entries))
      throw new TestingException(Resources.testDataMarkInvalid);

    entries.unshift(entry);
  };
}
