/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Page, expect } from "@playwright/test";

export default class SettingsFixture {
  private static readonly KEY: string = "ControlOrMeta+Comma";
  private static readonly GALLERY: string = "Gallery";
  private static readonly PAGES: string = "Settings pages";

  public static async openAsync(window: Page): Promise<void> {
    await window.locator("tr-workspace").click({ position: { x: 4, y: 4 } });
    await window.keyboard.press(SettingsFixture.KEY);
    await expect(window.locator("tr-settings")).toBeVisible();
  }

  public static async openPageAsync(window: Page, title: string): Promise<void> {
    await SettingsFixture.openAsync(window);
    await SettingsFixture.choosePageAsync(window, title);
  }

  public static async choosePageAsync(window: Page, title: string): Promise<void> {
    const settings = window.locator("tr-settings");
    const select = settings.locator(".tr-settings-page-select").getByRole("button");
    if (await select.isVisible()) {
      await select.click();
      await window.getByRole("listbox", { name: SettingsFixture.PAGES }).getByRole("option", { name: title, exact: true }).click();
      return;
    }
    await settings.locator(".tr-settings-pages").getByRole("treeitem", { name: title, exact: true }).click();
  }

  public static async openGalleryAsync(window: Page): Promise<void> {
    await SettingsFixture.openPageAsync(window, SettingsFixture.GALLERY);
    await expect(window.locator("tr-gallery")).toBeVisible();
  }
}
