/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { CommandNotFoundException } from "../../../src/app/exceptions/command-not-found.exception";

describe("CommandNotFoundException", () => {
  it("is an exception with its message", () => {
    const exception = new CommandNotFoundException("No command notes.missing.");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("No command notes.missing.");
  });
});
