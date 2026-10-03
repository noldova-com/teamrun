/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const colors = {
  light: { error: "rgb(161, 38, 13)", menu: "rgb(255, 255, 255)", menuBorder: "rgb(206, 206, 206)" },
  dark: { error: "rgb(244, 135, 113)", menu: "rgb(31, 31, 31)", menuBorder: "rgb(69, 69, 69)" }
};
const titles = ["Note 2 couldn't be saved", "Syncing the clock", "The clock started"];

function bell(window: Page): Locator {
  return window.locator("button.tr-notifications-item");
}

function list(window: Page): Locator {
  return window.locator(".tr-notifications-popover");
}

test.describe("notifications", () => {
  test("the bell counts the modules' notifications and its list shows them newest first, marking them read", async ({ desktop }) => {
    const window = desktop.window;

    await expect(bell(window).locator(".tr-notifications-count")).toHaveText("3");
    await expect(bell(window)).toHaveAttribute("aria-label", "Notifications, 3 unread");
    await bell(window).click();

    await expect(list(window).locator(".tr-notifications-row-title")).toHaveText(titles);
    await expect(list(window).locator(".tr-notifications-row").first().locator(".tr-notifications-meta")).toContainText("Notes · ");
    await expect(list(window).locator(".tr-notifications-row").nth(1).locator("progress")).toBeVisible();
    await expect(bell(window).locator(".tr-notifications-count")).toHaveCount(0);
    await expect(bell(window)).toHaveAttribute("aria-label", "Notifications");
  });

  test("an action runs its module's command and closes the list", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await bell(window).click();

    await list(window).getByRole("button", { name: "New note" }).click();

    await expect(list(window)).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
  });

  test("Dismiss removes one and Clear all leaves the work still in progress", async ({ desktop }) => {
    const window = desktop.window;
    await expect(bell(window).locator(".tr-notifications-count")).toHaveText("3");
    await bell(window).click();

    await list(window).locator(".tr-notifications-row").first().getByRole("button", { name: "Dismiss" }).click();
    await expect(list(window).locator(".tr-notifications-row-title")).toHaveText(titles.slice(1));
    await list(window).getByRole("button", { name: "Clear all" }).click();

    await expect(list(window).locator(".tr-notifications-row-title")).toHaveText(["Syncing the clock"]);
    await expect(list(window).getByRole("button", { name: "Clear all" })).toBeDisabled();
  });

  test("Do not disturb silences the bell and lasts across a restart", async ({ desktop }) => {
    const window = desktop.window;
    await bell(window).click();

    await list(window).getByRole("checkbox", { name: "Do not disturb" }).check();
    await expect(bell(window).locator(".tr-notifications-icon")).toHaveText("notifications_off");
    await desktop.restartAsync();

    await expect(bell(desktop.window).locator(".tr-notifications-icon")).toHaveText("notifications_off");
    await expect(bell(desktop.window)).toHaveAttribute("aria-label", /, Do not disturb$/);
    await bell(desktop.window).click();
    await expect(list(desktop.window).getByRole("checkbox", { name: "Do not disturb" })).toBeChecked();
  });

  test("the bell and its list follow the component table", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    const window = desktop.window;
    await expect(bell(window).locator(".tr-notifications-count")).toHaveText("3");

    const item = await window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => getComputedStyle(document.querySelector(selector) as Element);
      const button = style("button.tr-notifications-item");
      const order = [...document.querySelectorAll(".tr-status-bar-right > *")].map(t => t.tagName.toLowerCase());
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        height: button.height, padding: [button.paddingLeft, button.paddingRight], radius: button.borderTopLeftRadius, iconSize: style(".tr-notifications-icon").fontSize,
        isBeforeFailures: order.indexOf("tr-notifications") === order.indexOf("tr-module-failures") - 1
      };
    });
    await bell(window).click();
    await expect(list(window).locator(".tr-notifications-row")).toHaveCount(3);
    const surface = await list(window).evaluate(t => {
      const style = getComputedStyle(t);
      return {
        width: style.width, padding: style.paddingTop, border: style.borderTopWidth, borderColor: style.borderTopColor, radius: style.borderTopLeftRadius,
        background: style.backgroundColor, hasShadow: style.boxShadow !== "none",
        errorIcon: getComputedStyle(t.querySelector(".tr-notifications-row[data-severity=Error] .tr-notifications-severity") as Element).color,
        checkbox: getComputedStyle(t.querySelector(".tr-notifications-quiet-box") as Element).width
      };
    });
    const [placed, anchor] = await Promise.all([list(window), bell(window)].map(t => t.evaluate(u => u.getBoundingClientRect().toJSON() as Record<string, number>)));
    const palette = item.isDark ? colors.dark : colors.light;

    expect({ ...item, isDark: undefined }).toEqual({ isDark: undefined, height: "20px", padding: ["6px", "6px"], radius: "3px", iconSize: "16px", isBeforeFailures: true });
    expect(surface).toEqual({
      width: "440px", padding: "12px", border: "1px", borderColor: palette.menuBorder, radius: "8px", background: palette.menu, hasShadow: true,
      errorIcon: palette.error, checkbox: "18px"
    });
    expect(Math.round((anchor?.["top"] ?? 0) - (placed?.["bottom"] ?? 0))).toBe(8);
    expect(Math.abs((anchor?.["right"] ?? 0) - (placed?.["right"] ?? 0))).toBeLessThan(1);
    await desktop.checkpointAsync("notifications");
  });
});
