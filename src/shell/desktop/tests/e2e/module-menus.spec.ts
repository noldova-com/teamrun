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

function noteView(window: Page, instance: string): Locator {
  return window.locator("tr-notes-note", { has: window.locator(`[data-fixture-content="notes-note-${instance}"]`) });
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

async function openBarMenuAsync(window: Page, title: string): Promise<Locator> {
  await window.locator("tr-menu-bar").getByRole("menuitem", { name: title }).click();
  const menu = window.locator(".cdk-overlay-container tr-menu.tr-place-menu").last();
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("the inline menu bar on Windows and Linux", () => {
  test.skip(process.platform === "darwin", "macOS shows the menus in its own menu bar.");

  test("the menu bar opens File, Edit, View and the modules' menus, and runs their rows with their checked state", async ({ desktop }) => {
    const window = desktop.window;
    const list = window.locator(".tr-notes-list-items");
    const bar = window.locator("tr-menu-bar");
    await expect(bar).toHaveAttribute("aria-label", "Menus");
    await expect(bar.getByRole("menuitem")).toHaveText([/File/, /Edit/, /View/, /Notes/]);
    await expect(window.locator(".tr-window-row-menu")).toHaveCount(0);

    const file = await openBarMenuAsync(window, "File");
    await expect(file.locator("button[tr-menu-item]")).toHaveText([/Close the tab/, /New note/, /New from template/]);
    await file.getByRole("menuitem", { name: "New note" }).click();
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
    await (await openBarMenuAsync(window, "Notes")).getByRole("menuitemradio", { name: "Sort by title" }).click();
    await expect(list).toHaveAttribute("data-sort", "title");
    const spans = await openBarMenuAsync(window, "View");
    await expect(spans.getByRole("menuitemradio", { name: "Bottom dock across the window" })).toHaveAttribute("aria-checked", "true");
    await spans.getByRole("menuitemradio", { name: "Bottom dock between the side docks" }).click();
    await expect((await openBarMenuAsync(window, "View")).getByRole("menuitemradio", { name: "Bottom dock between the side docks" })).toHaveAttribute("aria-checked", "true");
    await window.keyboard.press("Escape");
    await window.keyboard.press("Escape");
    const view = await openBarMenuAsync(window, "View");
    await expect(view.getByRole("menuitemcheckbox", { name: "Left dock" })).toHaveAttribute("aria-checked", "true");
    await view.getByRole("menuitemcheckbox", { name: "Left dock" }).click();
    await expect((await openBarMenuAsync(window, "View")).getByRole("menuitemcheckbox", { name: "Left dock" })).toHaveAttribute("aria-checked", "false");
    await window.keyboard.press("Escape");
    await window.keyboard.press("Escape");

    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
    await expect(list).toHaveCount(0);
    await expect(bar.getByRole("menuitem", { name: "View" })).toBeFocused();
  });

  test("the Edit menu copies from one field and pastes into another, acting on the field that had focus and its selection", async ({ desktop }) => {
    const window = desktop.window;
    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    const tag = noteView(window, "1").getByRole("textbox", { name: "Tag" });
    const summary = noteView(window, "1").getByRole("textbox", { name: "Summary" });
    await tag.selectText();

    await (await openBarMenuAsync(window, "Edit")).getByRole("menuitem", { name: "Copy" }).click();
    await expect(tag).toBeFocused();
    expect(await tag.evaluate(t => [(t as HTMLInputElement).selectionStart, (t as HTMLInputElement).selectionEnd])).toEqual([0, 5]);
    await summary.click();
    const edit = await openBarMenuAsync(window, "Edit");
    await expect(edit.getByRole("menuitem", { name: "Cut" })).toHaveAttribute("aria-disabled", "true");
    await edit.getByRole("menuitem", { name: "Paste" }).click();
    await expect(summary).toHaveValue("draft");
    await (await openBarMenuAsync(window, "Edit")).getByRole("menuitem", { name: "Undo" }).click();

    await expect(summary).toHaveValue("");
    await expect(summary).toBeFocused();
  });
});

test.describe("the menu bar on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux show the menus in the window row.");

  test("the native menu bar holds the shell's and the modules' menus, shows checked state and runs a chosen row in the window", async ({ desktop }) => {
    const window = desktop.window;
    const read = (id: string): Promise<readonly [boolean, boolean] | null> => desktop.application.evaluate(({ Menu }, itemId) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
      return item ? [item.enabled, item.checked] as const : null;
    }, id);

    await expect.poll(() => desktop.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.map(t => t.label) ?? []))
      .toEqual([expect.any(String), "File", "Edit", "View", "Notes", "Window"]);
    await expect.poll(() => read("notes.tools/notes.toolsSorting/1")).toEqual([true, true]);
    await desktop.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("shell.file/notes.create/0")?.click());
    await desktop.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("notes.tools/notes.toolsSorting/0")?.click());

    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
    await expect(window.locator(".tr-notes-list-items")).toHaveAttribute("data-sort", "title");
    await expect.poll(() => read("notes.tools/notes.toolsSorting/0")).toEqual([true, true]);
    await expect.poll(() => read("notes.tools/notes.toolsSorting/1")).toEqual([true, false]);
  });
});

test.describe("module menus", () => {
  test("a note's context menu shows the module's groups apart and runs its items with the note it was opened on", async ({ desktop }) => {
    const window = desktop.window;

    const menu = await openNoteMenuAsync(window, 3);

    await expect(menu.locator("button[tr-menu-item]")).toHaveText(["Open note", "New from template", "Sort by title", "Sort by week", "Wrap lines"].map(t => new RegExp(t)));
    await expect(menu.locator("tr-menu-separator")).toHaveCount(2);
    await menu.getByRole("menuitem", { name: "Open note" }).click();
    await expect(menu).toHaveCount(0);
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/week-3\"] .tr-tab-label")).toHaveText("Meeting notes, week 3");
    await desktop.checkpointAsync("module-menus-context");
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

  test("an exclusive group is a set of radio rows that switches the sorting, and a checked command is a checkbox row that toggles", async ({ desktop }) => {
    const window = desktop.window;
    const list = window.locator(".tr-notes-list-items");
    let menu = await openNoteMenuAsync(window, 2);
    await expect(menu.getByRole("menuitemradio", { name: "Sort by week" })).toHaveAttribute("aria-checked", "true");
    await expect(menu.getByRole("menuitemradio", { name: "Sort by title" })).toHaveAttribute("aria-checked", "false");
    await expect(menu.getByRole("menuitemcheckbox", { name: "Wrap lines" })).toHaveAttribute("aria-checked", "false");

    await menu.getByRole("menuitemradio", { name: "Sort by title" }).click();
    await expect(list).toHaveAttribute("data-sort", "title");
    await expect(list.locator(".tr-notes-list-item").nth(1)).toHaveText("Meeting notes, week 10");
    await (await openNoteMenuAsync(window, 2)).getByRole("menuitemcheckbox", { name: "Wrap lines" }).click();
    await expect(list).toHaveClass(/tr-notes-list-wrapped/);
    menu = await openNoteMenuAsync(window, 2);

    await expect(menu.getByRole("menuitemradio", { name: "Sort by title" })).toHaveAttribute("aria-checked", "true");
    await expect(menu.getByRole("menuitemradio", { name: "Sort by week" })).toHaveAttribute("aria-checked", "false");
    await expect(menu.getByRole("menuitemcheckbox", { name: "Wrap lines" })).toHaveAttribute("aria-checked", "true");
    await expect(menu.locator(".tr-menu-item-check")).toHaveCount(2);
  });
});

test.describe("a note's fields", () => {
  test("are found in the clicked note's view, never in the view it replaces while the window has not rendered the switch", async ({ desktop }) => {
    const window = desktop.window;
    const tag = noteView(window, "1").getByRole("textbox", { name: "Tag" });
    await expect(noteView(window, "2")).toBeVisible();
    await window.clock.install();
    await window.clock.pauseAt(Date.now() + 1000);

    await window.locator("tr-tab[data-tab-key=\"document/notes.note/1\"]").click();
    await expect(noteView(window, "2").getByRole("textbox", { name: "Tag" })).toBeAttached();
    await expect(tag).toHaveCount(0);
    const selecting = tag.selectText();
    await window.clock.resume();
    await selecting;

    await expect(noteView(window, "2")).toHaveCount(0);
    expect(await tag.evaluate(t => [(t as HTMLInputElement).selectionStart, (t as HTMLInputElement).selectionEnd])).toEqual([0, 5]);
  });
});
