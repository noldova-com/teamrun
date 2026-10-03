/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
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

async function tickWithFocusAsync(desktop: DesktopApplicationFixture): Promise<void> {
  await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
  await expect.poll(() => desktop.window.evaluate(() => document.hasFocus())).toBe(true);
  await desktop.window.locator("[data-fixture-content=notes-list]").click();
  await desktop.window.keyboard.press("ControlOrMeta+Alt+KeyT");
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

  test("a notification posted after startup shows a toast that is announced and closes by itself, and Do not disturb holds the next one back", async ({ desktop }) => {
    const window = desktop.window;
    const toasts = window.locator(".tr-toast");
    await expect(bell(window).locator(".tr-notifications-count")).toHaveText("3");
    await expect(toasts).toHaveCount(0);

    await tickWithFocusAsync(desktop);
    await expect(toasts.locator(".tr-toast-title")).toHaveText(["The clock ticked"]);
    await expect(toasts.locator(".tr-toast-text")).toHaveText(["Ticks: 1"]);
    await expect(window.locator(".tr-toasts-announcement[aria-live=polite]")).toHaveText("The clock ticked. Ticks: 1");
    await expect(toasts).toHaveCount(0, { timeout: 15_000 });
    await bell(window).click();
    await list(window).getByRole("checkbox", { name: "Do not disturb" }).check();
    await window.keyboard.press("Escape");
    await tickWithFocusAsync(desktop);

    await expect(bell(window).locator(".tr-notifications-count")).toHaveText("1");
    await expect(toasts).toHaveCount(0);
  });

  test("a toast follows the component table, never takes focus and closes on Close", async ({ desktop }) => {
    const window = desktop.window;
    await expect(bell(window).locator(".tr-notifications-count")).toHaveText("3");
    await tickWithFocusAsync(desktop);
    const toast = window.locator(".tr-toast");
    await expect(toast).toHaveCount(1);
    await toast.hover();

    const look = await toast.evaluate(t => {
      const style = getComputedStyle(t);
      const bar = (document.querySelector("tr-status-bar") as Element).getBoundingClientRect();
      const box = t.getBoundingClientRect();
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        width: style.width, padding: style.paddingTop, border: style.borderTopWidth, radius: style.borderTopLeftRadius, hasShadow: style.boxShadow !== "none",
        background: style.backgroundColor, borderColor: style.borderTopColor,
        right: Math.round(document.documentElement.clientWidth - box.right), gapAboveBar: Math.round(bar.top - box.bottom),
        hasFocus: t.contains(document.activeElement)
      };
    });
    const palette = look.isDark ? { background: "rgb(31, 31, 31)", border: "rgb(69, 69, 69)" } : { background: "rgb(255, 255, 255)", border: "rgb(229, 229, 229)" };

    expect({ ...look, isDark: undefined }).toEqual({
      isDark: undefined, width: "360px", padding: "12px", border: "1px", radius: "8px", hasShadow: true,
      background: palette.background, borderColor: palette.border, right: 8, gapAboveBar: 8, hasFocus: false
    });
    await desktop.checkpointAsync("toast");
    await toast.getByRole("button", { name: "Close" }).click();
    await expect(toast).toHaveCount(0);
  });

  test("the bell and its list follow the component table", async ({ desktop }) => {
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
