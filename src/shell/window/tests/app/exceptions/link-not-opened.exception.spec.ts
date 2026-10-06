/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { LinkNotOpenedException } from "../../../src/app/exceptions/link-not-opened.exception";

describe("LinkNotOpenedException", () => {
  it("is an exception with its message", () => {
    const exception = new LinkNotOpenedException("The link was refused.");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("The link was refused.");
  });
});
