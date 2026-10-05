/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { ShortcutBinding } from "../../../src/app/models/shortcut-binding";

describe("ShortcutBinding", () => {
  it("holds a command and its key, or no key when it is unbound", () => {
    const key = KeyChord.parse("Mod+Alt+K");

    expect([new ShortcutBinding("notes.sync", key).command, new ShortcutBinding("notes.sync", key).key, new ShortcutBinding("notes.sync", null).key]).toEqual(["notes.sync", key, null]);
  });
});
