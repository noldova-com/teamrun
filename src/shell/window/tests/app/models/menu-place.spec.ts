/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { MenuPlace } from "../../../src/app/models/menu-place";

describe("MenuPlace", () => {
  it("refuses an invalid name, a blank title and a blank icon, and keeps an icon it is given", () => {
    expect(() => new MenuPlace("tools", "Notes", false)).toThrowError(ArgumentException);
    expect(() => new MenuPlace("notes.tools", " ", false)).toThrowError(ArgumentException);
    expect(() => new MenuPlace("notes.tools", "Notes", false, " ")).toThrowError(ArgumentException);
    expect(new MenuPlace("notes.tools", "Notes", false, "build").icon).toBe("build");
  });
});
