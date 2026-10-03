/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("commands", () => {
  test("a window part's command runs from its default key", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await window.locator("[data-fixture-content=notes-list]").click();

    await window.keyboard.press("ControlOrMeta+Alt+KeyN");

    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
    await expect(window.locator("[data-fixture-content=notes-note-3]")).toHaveText("Note 3");
  });

  test("a runtime part's command runs through the protocol from its default key", async ({ desktop }) => {
    const window = desktop.window;
    const ticks = window.locator("[data-fixture-content=clock-ticks]");
    await expect(ticks).toHaveText("No ticks");
    await window.locator("[data-fixture-content=notes-list]").click();

    await window.keyboard.press("ControlOrMeta+Alt+KeyT");
    await expect(ticks).toHaveText("Ticks: 1");
    await window.keyboard.press("ControlOrMeta+Alt+KeyT");

    await expect(ticks).toHaveText("Ticks: 2");
  });

  test("a runtime part's command reports whether it is enabled and checked to menus and keys", async ({ desktop }) => {
    const window = desktop.window;
    const ticks = window.locator("[data-fixture-content=clock-ticks]");
    const controls = window.locator("[data-fixture-content=clock-controls]");
    const menu = window.locator(".cdk-overlay-container tr-menu[data-place=\"clock.controls\"]");
    const tick = menu.getByRole("menuitem", { name: /^Tick/ });
    const pause = menu.getByRole("menuitemcheckbox", { name: /^Pause ticking/ });
    await expect(ticks).toHaveText("No ticks");

    await controls.click({ button: "right" });
    await expect(tick).toBeEnabled();
    await expect(pause).toHaveAttribute("aria-checked", "false");
    await pause.click();
    await expect(menu).toHaveCount(0);
    await controls.click({ button: "right" });
    await expect(pause).toHaveAttribute("aria-checked", "true");
    await expect(tick).toBeDisabled();
    await window.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await window.locator("[data-fixture-content=notes-list]").click();
    await window.keyboard.press("ControlOrMeta+Alt+KeyT");

    await controls.click({ button: "right" });
    await pause.click();
    await controls.click({ button: "right" });
    await expect(pause).toHaveAttribute("aria-checked", "false");
    await expect(tick).toBeEnabled();
    await window.keyboard.press("Escape");
    await window.locator("[data-fixture-content=notes-list]").click();
    await window.keyboard.press("ControlOrMeta+Alt+KeyT");

    await expect(ticks).toHaveText("Ticks: 1");
  });
});
