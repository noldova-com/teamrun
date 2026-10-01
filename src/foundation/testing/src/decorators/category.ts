/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { TestingException } from "../exceptions/testing.exception.js";
import { TestMarks } from "../models/decorators/test-marks.js";
import { Resources } from "../resources.js";

export function Category(name: string): (value: Function) => void {
  ArgumentException.throwIfNullOrWhitespace(name, "name");

  return (t: Function): void => {
    if (!Object.hasOwn(t, TestMarks.CATEGORY))
      Object.defineProperty(t, TestMarks.CATEGORY, { value: [], writable: false, enumerable: false, configurable: false });

    const categories: unknown = Object.getOwnPropertyDescriptor(t, TestMarks.CATEGORY)?.value;
    if (!Array.isArray(categories))
      throw new TestingException(Resources.categoryMarkInvalid);

    categories.unshift(name);
  };
}
