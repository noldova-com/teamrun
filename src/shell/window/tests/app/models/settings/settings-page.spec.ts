/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SettingsPage } from "../../../../src/app/models/settings/settings-page";
import { SettingsFixture } from "../../../fixtures/settings.fixture";

describe("SettingsPage", () => {
  const summarize = (pages: readonly SettingsPage[]): readonly string[] =>
    pages.map(t => `${t.title}${t.isShortcuts ? "*" : ""}: ${t.groups.map(u => `${u.title}(${u.definitions.map(v => v.name.text).join(",")})`).join(" ")}`);

  it("puts Appearance, Notifications and Keyboard shortcuts first, then each module's pages by name, with their groups in order", () => {
    expect(summarize(SettingsPage.pagesOf([...SettingsFixture.all].reverse()))).toEqual([
      "Appearance: Text(shell.panelSize) Theme(shell.mode)",
      "Notifications: Notifications(shell.mutedModules,shell.doNotDisturb)",
      "Keyboard shortcuts*: ",
      "Clock: Ticks(clock.tickStep) Words(clock.greeting)"
    ]);
  });

  it("makes a Gallery page of no settings", () => {
    const gallery = SettingsPage.galleryOf("Gallery");

    expect([gallery.title, gallery.isGallery, gallery.isShortcuts, gallery.groups]).toEqual(["Gallery", true, false, []]);
    expect(SettingsPage.pagesOf(SettingsFixture.all).some(t => t.isGallery)).toBe(false);
  });

  it("keeps the leading pages even without settings, and filters a page's groups down to the matching settings", () => {
    const appearance = SettingsPage.pagesOf(SettingsFixture.all)[0] as SettingsPage;

    expect(summarize(SettingsPage.pagesOf([]))).toEqual(["Appearance: ", "Notifications: ", "Keyboard shortcuts*: "]);
    expect(summarize([appearance.filter(t => t.title.includes("size"))])).toEqual(["Appearance: Text(shell.panelSize)"]);
  });
});
