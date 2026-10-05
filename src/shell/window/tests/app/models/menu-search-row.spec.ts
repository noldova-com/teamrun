/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MenuSearchRow } from "../../../src/app/models/menu-search-row";

describe("MenuSearchRow", () => {
  it("holds a found row's path, title, icon and the menus it is in", () => {
    const row = new MenuSearchRow("notes.tools/notes.sortBy", "By title", "sort", "Notes > Sort");

    expect([row.id, row.title, row.icon, row.menu]).toEqual(["notes.tools/notes.sortBy", "By title", "sort", "Notes > Sort"]);
  });
});
