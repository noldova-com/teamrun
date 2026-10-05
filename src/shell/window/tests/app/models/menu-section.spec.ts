/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MenuCheck } from "../../../src/app/enums/menu-check";
import { CommandRow } from "../../../src/app/models/command-row";
import { MenuSection } from "../../../src/app/models/menu-section";
import { SubmenuRow } from "../../../src/app/models/submenu-row";

describe("MenuSection", () => {
  it("holds a group's rows in a copy of their order", () => {
    const rows = [new CommandRow("notes.newNote", {}, "New note", null, null, true, MenuCheck.None, false), new SubmenuRow("notes.templates", "Templates")];
    const section = new MenuSection("notes.create", rows);
    rows.pop();

    expect(section.group).toBe("notes.create");
    expect(section.rows.map(t => t.title)).toEqual(["New note", "Templates"]);
  });
});
