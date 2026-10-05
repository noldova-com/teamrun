/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { MenuCheck } from "../../../src/app/enums/menu-check";
import { CommandRow } from "../../../src/app/models/command-row";

describe("CommandRow", () => {
  it("is a row that runs a command, with its title, icon, key and state", () => {
    const row = new CommandRow("notes.sortBy", { by: "title" }, "By title", "sort", "Ctrl+T", true, MenuCheck.Radio, false);

    expect([row.isSubmenu, row.command, row.commandArguments, row.title, row.icon, row.key, row.isEnabled, row.check, row.isChecked])
      .toEqual([false, "notes.sortBy", { by: "title" }, "By title", "sort", "Ctrl+T", true, MenuCheck.Radio, false]);
  });
});
