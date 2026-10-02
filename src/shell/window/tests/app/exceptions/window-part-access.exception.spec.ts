/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { WindowPartAccessException } from "../../../src/app/exceptions/window-part-access.exception";

describe("WindowPartAccessException", () => {
  it("is an exception with its message", () => {
    const exception = new WindowPartAccessException("The module notes may not use clock.time.");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("The module notes may not use clock.time.");
  });
});
