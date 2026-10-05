/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { RuntimeRequestException } from "../../../src/app/exceptions/runtime-request.exception";

describe("RuntimeRequestException", () => {
  it("is an exception with the failure's code, message and details", () => {
    const exception = new RuntimeRequestException("NotFound", "There is no such note.", { path: "/notes/a.md" });

    expect(exception).toBeInstanceOf(Exception);
    expect([exception.code, exception.message, exception.details]).toEqual(["NotFound", "There is no such note.", { path: "/notes/a.md" }]);
  });

  it("has no details when the failure has none", () => {
    const exception = new RuntimeRequestException("Unavailable", "The runtime did not answer notes.open in time.");

    expect(exception.details).toBeUndefined();
  });
});
