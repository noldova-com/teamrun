/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import CommandSearchFixture from "./fixtures/command-search.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

async function runAsync(desktop: DesktopApplicationFixture, text: string, command: string): Promise<void> {
  await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
  await expect.poll(() => desktop.window.evaluate(() => document.hasFocus())).toBe(true);
  await CommandSearchFixture.searchAsync(desktop.window, text);
  await desktop.window.locator(`.cdk-overlay-container .tr-command-search-pane [data-item="${command}"]`).click();
}

test.describe("a module with only a runtime part", () => {
  test("names its notifications, is listed by name in Notifications from modules and, turned off there, toasts no more", async ({ desktop }) => {
    const window = desktop.window;
    const toasts = window.locator(".tr-toast");
    const modules = window.locator("tr-setting-row[data-setting=\"shell.mutedModules\"]");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();

    await runAsync(desktop, "Remind me", "reminder.remind");
    await expect(toasts.locator(".tr-toast-title")).toHaveText(["Time for a break"]);
    await expect(toasts.locator(".tr-toast-meta")).toContainText("Reminder · ");
    await toasts.getByRole("button", { name: "Close" }).click();
    await SettingsFixture.openPageAsync(window, "Notifications");
    await expect(modules.getByRole("checkbox", { name: "Reminder notifications" })).toBeChecked();
    await desktop.checkpointAsync("runtime-only-module-notifications");
    await modules.getByRole("checkbox", { name: "Reminder notifications" }).uncheck();
    await runAsync(desktop, "Remind me", "reminder.remind");
    await runAsync(desktop, "Tick", "clock.tick");

    await expect(toasts.locator(".tr-toast-title")).toHaveText(["The clock ticked"]);
    await window.locator("button.tr-notifications-item").click();
    const reminders = window.locator(".tr-notifications-popover .tr-notifications-row").filter({ hasText: "Time for a break" });
    await expect(reminders).toHaveCount(2);
    await expect(reminders.first().locator(".tr-notifications-meta")).toContainText("Reminder · ");
  });

  test("is named in the module failures and the Modules document when it fails", async ({ desktop }) => {
    const window = desktop.window;
    const item = window.locator("tr-module-failures button.tr-module-failures-item");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
    const folder = path.join(desktop.dataDirectory, "modules", "reminder");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "fail-activation"), "");

    await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);
    await expect(item).toHaveText(/error\s*1 module didn't start/);
    await item.click();

    await expect(window.locator(".tr-modules-detail-title")).toHaveText("Reminder");
    await expect(window.locator(".tr-modules-row[aria-current=true] .tr-modules-name")).toHaveText("Reminder");
    await expect(window.locator(".tr-modules-fact-state")).toHaveText(/Failed\s*Its runtime part failed to activate\./);
  });
});
