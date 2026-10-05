/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ContributionGroup } from "../../../../src/app/models/modules/contribution-group";
import { ContributionRow } from "../../../../src/app/models/modules/contribution-row";

describe("ContributionGroup", () => {
  it("holds a kind of contribution, its title and a copy of its rows", () => {
    const rows = [new ContributionRow("notes.list", "Notes")];
    const group = new ContributionGroup("views", "Views", rows);
    rows.pop();

    expect([group.kind, group.title, group.rows]).toEqual(["views", "Views", [new ContributionRow("notes.list", "Notes")]]);
  });
});
