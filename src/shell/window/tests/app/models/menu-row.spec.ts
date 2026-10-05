/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MenuCheck } from "../../../src/app/enums/menu-check";
import { CommandRow } from "../../../src/app/models/command-row";
import { MenuRow } from "../../../src/app/models/menu-row";
import { SubmenuRow } from "../../../src/app/models/submenu-row";

describe("MenuRow", () => {
  it("is what a command row and a submenu row share: a title and an icon", () => {
    const command = new CommandRow("notes.sortBy", {}, "Sort", "sort", null, true, MenuCheck.None, false);
    const submenu = new SubmenuRow("notes.templates", "Templates");

    expect([command instanceof MenuRow, command.title, command.icon]).toEqual([true, "Sort", "sort"]);
    expect([submenu instanceof MenuRow, submenu.title, submenu.icon]).toEqual([true, "Templates", null]);
  });
});
