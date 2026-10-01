/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { ThemeException } from "../../../src/app/exceptions/theme.exception";

describe("ThemeException", () => {
  it("is a foundation exception with its message", () => {
    const exception = new ThemeException("The theme has no value.");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("The theme has no value.");
  });
});
