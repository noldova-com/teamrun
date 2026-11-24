/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MissingValueException } from "../../../src/app/exceptions/missing-value.exception";
import { Resources } from "../../../src/resources";

describe("MissingValueException", () => {
  it("carries its name and says a value is missing", () => {
    const exception = new MissingValueException();

    expect(exception.name).toBe("MissingValueException");
    expect(exception.message).toBe(Resources.missingValue);
  });
});
