/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { ShortcutRow } from "../../../../src/app/models/settings/shortcut-row";

describe("ShortcutRow", () => {
  it("holds a command's row: its name, title, owner, key and whether it has a key, was changed or collides", () => {
    const row = new ShortcutRow("notes.sync", "Sync", "Notes", "F6", true, true, "Focus next group");

    expect([row.name, row.title, row.owner, row.key, row.hasKey, row.isModified, row.collision]).toEqual(["notes.sync", "Sync", "Notes", "F6", true, true, "Focus next group"]);
  });
});
