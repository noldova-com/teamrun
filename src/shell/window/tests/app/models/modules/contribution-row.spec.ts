/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { ContributionRow } from "../../../../src/app/models/modules/contribution-row";

describe("ContributionRow", () => {
  it("holds a contribution's name and its title, when it has one", () => {
    expect([new ContributionRow("notes.list", "Notes").title, new ContributionRow("notes.sync", null).title, new ContributionRow("notes.sync", null).name])
      .toEqual(["Notes", null, "notes.sync"]);
  });
});
