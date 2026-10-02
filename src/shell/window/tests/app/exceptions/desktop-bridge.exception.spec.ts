/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { DesktopBridgeException } from "../../../src/app/exceptions/desktop-bridge.exception";

describe("DesktopBridgeException", () => {
  it("is an exception with its message", () => {
    const exception = new DesktopBridgeException("No bridge.");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("No bridge.");
  });
});
