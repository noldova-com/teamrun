/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { SettingsView } from "../../../src/app/models/settings/settings-view";
import { ShortcutRow } from "../../../src/app/models/settings/shortcut-row";
import { ViewStateService } from "../../../src/app/services/view-state.service";

describe("ViewStateService", () => {
  it("gives back the state kept for a tab's key, the latest one, only as the type asked for", () => {
    const views = TestBed.inject(ViewStateService);
    const later = new SettingsView("Clock", "tick", 0, 40);

    views.keep("document/shell.settings", new SettingsView("Keyboard shortcuts", "", 12, 0));
    views.keep("document/shell.settings", later);
    views.keep("view/notes.list", new ShortcutRow("notes.newNote", "New note", "Ctrl+Alt+N", null));

    expect(views.find("document/shell.settings", SettingsView)).toBe(later);
    expect(views.find("view/notes.list", SettingsView)).toBeNull();
    expect(views.find("document/notes.note/1", SettingsView)).toBeNull();
  });
});
