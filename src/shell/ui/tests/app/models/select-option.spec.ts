/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SelectOption } from "../../../src/app/models/select-option";

describe("SelectOption", () => {
  it("holds an option's value and the title it shows", () => {
    const option = new SelectOption("dark", "Dark");

    expect([option.value, option.title]).toEqual(["dark", "Dark"]);
  });
});
