/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { WindowPartFailureException } from "../../../src/app/exceptions/window-part-failure.exception";

describe("WindowPartFailureException", () => {
  it("is an exception with its message, the failing module and the cause", () => {
    const cause = new Error("Load failed.");
    const exception = new WindowPartFailureException("notes", "The notes window part failed.", cause);

    expect(exception).toBeInstanceOf(Exception);
    expect([exception.message, exception.moduleId, exception.cause]).toEqual(["The notes window part failed.", "notes", cause]);
  });
});
