/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

test.describe("text field menu", () => {
  test("a right click on a field opens Cut, Copy, Paste and Select all with only what applies enabled, Shift+F10 opens it by keyboard, and its rows edit the field through the system clipboard", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openAsync(window);
    const search = window.getByRole("searchbox", { name: "Search settings" });
    const menu = window.locator(".cdk-overlay-container tr-menu[data-place=\"shell.field\"]");
    const row = (name: string) => menu.getByRole("menuitem", { name });
    await search.fill("size");

    await search.click({ button: "right" });

    await expect(menu.getByRole("menuitem")).toHaveText([/Cut/, /Copy/, /Paste/, /Select all/]);
    await expect(row("Cut")).toHaveAttribute("aria-disabled", "true");
    await expect(row("Copy")).toHaveAttribute("aria-disabled", "true");
    await expect(row("Paste")).not.toHaveAttribute("aria-disabled", "true");
    await desktop.checkpointAsync("field-menu");
    await row("Select all").click();
    await expect(menu).toHaveCount(0);
    await expect(search).toBeFocused();

    await search.press("Shift+F10");

    await expect(row("Cut")).toBeFocused();
    await expect(row("Copy")).not.toHaveAttribute("aria-disabled", "true");
    await window.keyboard.press("Enter");
    await expect(menu).toHaveCount(0);
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    expect(await desktop.application.evaluate(({ clipboard }) => clipboard.readText())).toBe("size");

    await search.click({ button: "right" });
    await row("Paste").click();

    await expect(search).toHaveValue("size");
  });
});
