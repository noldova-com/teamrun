/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { ShortcutCollision } from "../../../src/app/models/shortcut-collision";

describe("ShortcutCollision", () => {
  it("holds a key, the command that kept it and the one refused it", () => {
    const key = KeyChord.parse("F6");
    const collision = new ShortcutCollision(key, "shell.focusNextGroup", "notes.sync");

    expect([collision.key, collision.keptBy, collision.refused]).toEqual([key, "shell.focusNextGroup", "notes.sync"]);
  });
});
