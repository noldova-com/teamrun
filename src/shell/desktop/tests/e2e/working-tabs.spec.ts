/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("working tabs", () => {
  test("a document a window part marks as working shows a busy tab with a spinner, reveals Close on hover, and returns to normal once cleared", async ({ desktop }) => {
    const window = desktop.window;
    const tab = window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]");
    const work = window.locator("[data-fixture-content=notes-work-1]:visible");
    await tab.click();

    await work.click();
    await expect(tab).toHaveAttribute("aria-busy", "true");
    await expect(tab.locator(".tr-tab-spinner")).toBeVisible();
    await expect(tab.locator(".tr-tab-close")).toBeHidden();
    await desktop.checkpointAsync("working-tab");
    await tab.hover();
    await expect(tab.locator(".tr-tab-close")).toBeVisible();
    await expect(tab.locator(".tr-tab-spinner")).toBeHidden();

    await work.click();
    await expect(tab).not.toHaveAttribute("aria-busy");
    await expect(tab.locator(".tr-tab-spinner")).toHaveCount(0);
    await expect(window.locator("tr-tab[aria-busy]")).toHaveCount(0);
  });
});
