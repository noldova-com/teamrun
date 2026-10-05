/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { MenuRow } from "../../../src/app/models/menu-row";

class TitleRow extends MenuRow {
  public constructor(title: string, icon: string | null) {
    super(title, icon);
  }
}

describe("MenuRow", () => {
  it("holds a row's title and icon", () => {
    const row = new TitleRow("Sort", "sort");

    expect([row.title, row.icon]).toEqual(["Sort", "sort"]);
  });
});
