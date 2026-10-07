/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/teamrun-foundation-exceptions";

import { VirtualListException } from "../../../src/app/exceptions/virtual-list.exception";

describe("VirtualListException", () => {
  it("is a foundation exception with its name and message", () => {
    const exception = new VirtualListException("2 items from 9 are not in a list of 10.");

    expect(exception).toBeInstanceOf(Exception);
    expect([exception.name, exception.message]).toEqual(["VirtualListException", "2 items from 9 are not in a list of 10."]);
  });
});
