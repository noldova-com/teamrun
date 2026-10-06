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
    pages.map(t => `${t.title}${t.isShortcuts ? "*" : ""}${t.isAbout ? "!" : ""}: ${t.groups.map(u => `${u.title}(${u.definitions.map(v => v.name.text).join(",")})`).join(" ")}`);

  it("puts Appearance, Notifications and Keyboard shortcuts first, then each module's pages by name, with their groups in order, and About last", () => {
    expect(summarize(SettingsPage.pagesOf([SettingsFixture.updateChecks, ...[...SettingsFixture.all].reverse()]))).toEqual([
      "Appearance: Text(shell.panelSize) Theme(shell.mode)",
      "Notifications: Notifications(shell.mutedModules,shell.doNotDisturb)",
      "Keyboard shortcuts*: ",
      "Clock: Ticks(clock.tickStep) Words(clock.greeting)",
      "About!: Updates(shell.updateChecks)"
    ]);
  });

  it("puts the pages it is given before About", () => {
    const pages = SettingsPage.pagesOf(SettingsFixture.all, [SettingsPage.galleryOf("Gallery")]);

    expect(pages.map(t => t.title)).toEqual(["Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Gallery", "About"]);
  });

  it("makes a Gallery page of no settings", () => {
    const gallery = SettingsPage.galleryOf("Gallery");

    expect([gallery.title, gallery.isGallery, gallery.isShortcuts, gallery.groups]).toEqual(["Gallery", true, false, []]);
    expect(SettingsPage.pagesOf(SettingsFixture.all).some(t => t.isGallery)).toBe(false);
  });

  it("keeps the leading pages even without settings, and filters a page's groups down to the matching settings", () => {
    const appearance = SettingsPage.pagesOf(SettingsFixture.all)[0] as SettingsPage;

    expect(summarize(SettingsPage.pagesOf([]))).toEqual(["Appearance: ", "Notifications: ", "Keyboard shortcuts*: ", "About!: "]);
    expect(summarize([appearance.filter(t => t.title.includes("size"))])).toEqual(["Appearance: Text(shell.panelSize)"]);
  });
});
