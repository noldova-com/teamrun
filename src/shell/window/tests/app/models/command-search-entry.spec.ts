/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { QuickInputItem } from "@noldova/teamrun-shell-ui";

import { CommandSearchEntry } from "../../../src/app/models/command-search-entry";

describe("CommandSearchEntry", () => {
  it("reads its detail from its item, or an empty one when the item has none", () => {
    const run = (): void => undefined;

    expect(new CommandSearchEntry(new QuickInputItem("notes.newNote", "New note", null, "Notes", null), run).detail).toBe("Notes");
    expect(new CommandSearchEntry(new QuickInputItem("notes.newNote", "New note", null, null, null), run).detail).toBe("");
  });
});
