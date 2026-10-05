/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SettingsView } from "../../../../src/app/models/settings/settings-view";

describe("SettingsView", () => {
  it("holds the page, the search and both scroll positions, and starts on Appearance with no search at the top", () => {
    const view = new SettingsView("Shortcuts", "tab", 40, 120);

    expect([view.page, view.query, view.pageListTop, view.contentTop]).toEqual(["Shortcuts", "tab", 40, 120]);
    expect([SettingsView.initial.page, SettingsView.initial.query, SettingsView.initial.pageListTop, SettingsView.initial.contentTop]).toEqual(["Appearance", "", 0, 0]);
  });
});
