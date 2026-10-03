/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("settings", () => {
  test("a module's window part changes its setting, its runtime part uses the new value, and the value outlives reopening the window", async ({ desktop }) => {
    const step = (): Locator => desktop.window.locator("[data-fixture-content=clock-step]");
    await expect(step()).toHaveText("Step: 1");

    await desktop.window.locator("[data-fixture-content=clock-step-up]").click();
    await expect(step()).toHaveText("Step: 2");
    await desktop.window.locator("[data-fixture-content=notes-list]").click();
    await desktop.window.keyboard.press("ControlOrMeta+Alt+KeyT");

    await expect(desktop.window.locator("[data-fixture-content=clock-ticks]")).toHaveText("Ticks: 2");
    await desktop.reopenAsync();
    await expect(step()).toHaveText("Step: 2");
    await desktop.checkpointAsync("settings-module-step");
  });
});
