import path from "node:path";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

async function shootAsync(window: Page, name: string): Promise<void> {
  const menus = window.locator(".cdk-overlay-container tr-menu");
  await expect(menus.first()).toBeVisible();
  const boxes = await menus.evaluateAll(t => t.map(u => u.getBoundingClientRect()).map(u => [u.left, u.top, u.right, u.bottom]));
  const left = Math.max(0, Math.min(...boxes.map(t => t[0] ?? 0)) - 40);
  const top = Math.max(0, Math.min(...boxes.map(t => t[1] ?? 0)) - 40);
  const right = Math.max(...boxes.map(t => t[2] ?? 0)) + 40;
  const bottom = Math.max(...boxes.map(t => t[3] ?? 0)) + 24;
  await window.screenshot({ path: path.resolve("_build", "ui", "shots", `${name}.png`), clip: { x: left, y: top, width: right - left, height: bottom - top } });
}

test("column shots", async ({ desktop }) => {
  await desktop.useSuiteViewportAsync();
  const window = desktop.window;
  await window.locator("tr-tab[data-tab-key=\"view/notes.list\"]").click({ button: "right" });
  await shootAsync(window, "tab-menu");
  await window.keyboard.press("Escape");
  await window.locator(".tr-window-row-menu").click();
  await window.locator("tr-menu.tr-window-row-menu-list").getByRole("menuitem", { name: "View" }).click();
  await shootAsync(window, "main-menu-submenu");
});
