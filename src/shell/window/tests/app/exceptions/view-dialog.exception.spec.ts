/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { ViewDialogException } from "../../../src/app/exceptions/view-dialog.exception";

describe("ViewDialogException", () => {
  it("is an exception with its message", () => {
    const exception = new ViewDialogException("No such view.");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("No such view.");
  });
});
