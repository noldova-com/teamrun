/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SubmenuRow } from "../../../src/app/models/submenu-row";

describe("SubmenuRow", () => {
  it("is a row that opens a submenu, with no icon unless it is given one", () => {
    const row = new SubmenuRow("notes.templates", "Templates");

    expect([row.isSubmenu, row.place, row.title, row.icon, new SubmenuRow("notes.templates", "Templates", "add").icon]).toEqual([true, "notes.templates", "Templates", null, "add"]);
  });
});
