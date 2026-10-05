/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { KeyChord } from "@noldova/teamrun-shell-protocol";

import { ShortcutNotice } from "../../../../src/app/models/settings/shortcut-notice";

describe("ShortcutNotice", () => {
  it("holds a command's notice, with the key and its holder when another command has it", () => {
    const key = KeyChord.parse("F6");
    const used = new ShortcutNotice("notes.sync", "F6 is used by Focus next group.", key, "shell.focusNextGroup");
    const refused = new ShortcutNotice("notes.sync", "That key cannot be used.");

    expect([used.command, used.text, used.key, used.holder]).toEqual(["notes.sync", "F6 is used by Focus next group.", key, "shell.focusNextGroup"]);
    expect([refused.key, refused.holder]).toEqual([null, null]);
  });
});
