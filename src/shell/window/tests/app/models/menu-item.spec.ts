/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { MenuItem } from "../../../src/app/models/menu-item";

describe("MenuItem", () => {
  it("refuses a choice that is not a qualified name, and is a choice only when made as one", () => {
    expect(() => MenuItem.ofChoice("sorting")).toThrowError(ArgumentException);
    expect([MenuItem.ofChoice("notes.sorting").choice, MenuItem.ofSubmenu("notes.templates").choice, MenuItem.ofCommand("notes.sortBy").choice]).toEqual(["notes.sorting", null, null]);
  });

  it("refuses a command or submenu that is not a qualified name and a blank label, and has no arguments or label unless given them", () => {
    expect(() => MenuItem.ofCommand("sortBy")).toThrowError(ArgumentException);
    expect(() => MenuItem.ofSubmenu("templates")).toThrowError(ArgumentException);
    expect(MenuItem.ofCommand("notes.sortBy").commandArguments).toEqual({});
    expect(() => MenuItem.ofCommand("notes.sortBy", {}, " ")).toThrowError(ArgumentException);
    expect(MenuItem.ofCommand("notes.sortBy").label).toBeNull();
  });
});
