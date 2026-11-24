/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MissingValueException } from "../../../src/app/exceptions/missing-value.exception";
import { Required } from "../../../src/app/models/required";

describe("Required", () => {
  it("returns a value that is there, falsy ones included", () => {
    expect(Required.of("name")).toBe("name");
    expect(Required.of(0)).toBe(0);
    expect(Required.of(String.empty)).toBe(String.empty);
  });

  it("refuses a null value", () => {
    expect(() => Required.of(null)).toThrow(MissingValueException);
  });

  it("refuses an undefined value", () => {
    expect(() => Required.of(undefined)).toThrow(MissingValueException);
  });
});
