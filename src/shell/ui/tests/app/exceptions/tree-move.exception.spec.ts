/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { TreeMoveException } from "../../../src/app/exceptions/tree-move.exception";

describe("TreeMoveException", () => {
  it("is a foundation exception with its message", () => {
    const exception = new TreeMoveException("The row cannot move.");

    expect(exception).toBeInstanceOf(Exception);
    expect(exception.message).toBe("The row cannot move.");
  });
});
