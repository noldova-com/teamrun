/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

function note(window: Page, week: number): Locator {
  return window.locator(".tr-notes-list-item", { hasText: new RegExp(`^Meeting notes, week ${week}$`) });
}

function place(window: Page, name: string): Locator {
  return window.locator(`.cdk-overlay-container tr-menu[data-place="${name}"]`);
}

async function openNoteMenuAsync(window: Page, week: number): Promise<Locator> {
  await note(window, week).click({ button: "right" });
  const menu = place(window, "notes.listItem");
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("module menus", () => {
  test("a note's context menu shows the module's groups apart and runs its items with the note it was opened on", async ({ desktop }) => {
    const window = desktop.window;

    const menu = await openNoteMenuAsync(window, 3);

    await expect(menu.getByRole("menuitem")).toHaveText(["Open note", "New from template", "Sort by title", "Sort by week", "Wrap lines"].map(t => new RegExp(t)));
    await expect(menu.locator("tr-menu-separator")).toHaveCount(2);
    await menu.getByRole("menuitem", { name: "Open note" }).click();
    await expect(menu).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/week-3\"] .tr-tab-label")).toHaveText("Meeting notes, week 3");
  });

  test("a submenu opens the module's own place and runs its item", async ({ desktop }) => {
    const window = desktop.window;
    const menu = await openNoteMenuAsync(window, 5);

    await menu.getByRole("menuitem", { name: "New from template" }).click();
    const templates = place(window, "notes.templates");
    await expect(templates).toBeVisible();
    await templates.getByRole("menuitem", { name: "New note" }).click();

    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
    await expect(window.locator("tr-status-bar-item[data-tr-item=\"notes.count\"]")).toHaveText("3 notes");
  });

  test("an exclusive group switches the sorting and a checked command toggles", async ({ desktop }) => {
    const window = desktop.window;
    const list = window.locator(".tr-notes-list-items");
    await expect(list).toHaveAttribute("data-sort", "week");

    await (await openNoteMenuAsync(window, 2)).getByRole("menuitem", { name: "Sort by title" }).click();
    await expect(list).toHaveAttribute("data-sort", "title");
    await expect(list.locator(".tr-notes-list-item").nth(1)).toHaveText("Meeting notes, week 10");
    await (await openNoteMenuAsync(window, 2)).getByRole("menuitem", { name: "Wrap lines" }).click();
    await expect(list).toHaveClass(/tr-notes-list-wrapped/);
    await (await openNoteMenuAsync(window, 2)).getByRole("menuitem", { name: "Wrap lines" }).click();

    await expect(list).not.toHaveClass(/tr-notes-list-wrapped/);
  });
});
