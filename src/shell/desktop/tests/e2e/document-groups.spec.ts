/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import CommandSearchFixture from "./fixtures/command-search.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const notes = "view/notes.list";
const firstNote = "document/notes.note/1";
const secondNote = "document/notes.note/2";

function tab(window: Page, key: string): Locator {
  return window.locator(`tr-tab[data-tab-key="${key}"]`);
}

function groupOf(window: Page, key: string): Locator {
  return window.locator("tr-tab-group").filter({ has: tab(window, key) });
}

async function centerOf(locator: Locator): Promise<{ readonly x: number; readonly y: number }> {
  const box = await locator.boundingBox();
  if (box === null)
    throw new Error("The element is not visible.");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function startDragAsync(window: Page, key: string): Promise<void> {
  const start = await centerOf(tab(window, key));
  await window.mouse.move(start.x, start.y);
  await window.mouse.down();
  await window.mouse.move(start.x + 12, start.y + 12, { steps: 3 });
}

async function moveOverAsync(window: Page, target: Locator): Promise<void> {
  const point = await centerOf(target);
  await window.mouse.move(point.x, point.y, { steps: 6 });
}

async function dragOntoPlateAsync(window: Page, key: string, groupKey: string, direction: string): Promise<void> {
  await startDragAsync(window, key);
  await moveOverAsync(window, groupOf(window, groupKey).locator("[role=tabpanel]"));
  await moveOverAsync(window, window.locator(`tr-docking-plate [data-direction=${direction}]`));
}

function tabKeysOf(group: Locator): Promise<readonly (string | null)[]> {
  return group.locator("tr-tab").evaluateAll(tabs => tabs.map(t => t.getAttribute("data-tab-key")));
}

async function runCommandAsync(window: Page, title: string, name: string): Promise<void> {
  await CommandSearchFixture.searchAsync(window, title);
  await expect(window.getByRole("option").first()).toHaveAttribute("data-item", name);
  await window.keyboard.press("Enter");
}

async function chooseRowAsync(window: Page, label: string, key: string = "Enter"): Promise<void> {
  for (let step = 0; step < 12; step++) {
    const current = await window.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    if (current.includes(label)) {
      await window.keyboard.press(key);
      return;
    }
    await window.keyboard.press("ArrowDown");
  }
  throw new Error(`The menu has no row ${label}.`);
}

async function openTabMenuAsync(window: Page, key: string): Promise<void> {
  await tab(window, key).focus();
  await window.keyboard.press("Shift+F10");
  await expect(window.locator(".cdk-overlay-container tr-menu[data-place='shell.tab']")).toBeVisible();
  await expect.poll(() => window.evaluate(() => document.activeElement?.closest("tr-menu") !== null && document.activeElement?.closest("tr-menu") !== undefined)).toBe(true);
}

function documentGroups(window: Page): Locator {
  return window.locator("tr-tab-group").filter({ has: window.locator("tr-tab[data-tab-key^='document/']") });
}

async function splitFirstNoteAsync(window: Page): Promise<void> {
  await dragOntoPlateAsync(window, firstNote, secondNote, "Right");
  await window.mouse.up();
  await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([firstNote]);
}

test.describe("document groups", () => {
  test.beforeEach(async ({ desktop }) => {
    await expect(tab(desktop.window, firstNote)).toBeVisible();
    await expect(tab(desktop.window, secondNote)).toBeVisible();
  });

  for (const [direction, axis] of [["Left", "x"], ["Right", "x"], ["Top", "y"], ["Bottom", "y"]] as const) {
    test(`a document's ${direction.toLowerCase()} arrow splits its group and shows no dock guides`, async ({ desktop }) => {
      const window = desktop.window;
      await dragOntoPlateAsync(window, firstNote, secondNote, direction);

      await expect(window.locator(`tr-docking-plate [data-direction=${direction}]`)).toHaveClass(/tr-docking-guide-chosen/);
      await expect(window.locator(".tr-docking-side")).toHaveCount(0);
      await expect(window.locator(".tr-docking-preview")).toBeVisible();
      await window.mouse.up();

      await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([firstNote]);
      expect(await tabKeysOf(groupOf(window, secondNote))).toEqual([secondNote]);
      const moved = await groupOf(window, firstNote).boundingBox();
      const stayed = await groupOf(window, secondNote).boundingBox();
      expect((moved?.[axis] ?? 0) < (stayed?.[axis] ?? 0)).toBe(direction === "Left" || direction === "Top");
      await expect(documentGroups(window)).toHaveCount(2);
      await desktop.checkpointAsync(`document-split-${direction.toLowerCase()}`);
    });
  }

  test("a document dropped on another document group's center joins it, and the emptied group closes", async ({ desktop }) => {
    const window = desktop.window;
    await splitFirstNoteAsync(window);

    await dragOntoPlateAsync(window, firstNote, secondNote, "Center");
    await expect(window.locator(".tr-docking-side")).toHaveCount(0);
    await window.mouse.up();

    await expect.poll(() => tabKeysOf(groupOf(window, secondNote))).toEqual([secondNote, firstNote]);
    await expect(documentGroups(window)).toHaveCount(1);
    await desktop.checkpointAsync("document-center-joins-group");
  });

  test("a document shows no plate over a views group", async ({ desktop }) => {
    const window = desktop.window;
    await startDragAsync(window, firstNote);
    await moveOverAsync(window, groupOf(window, notes).locator("[role=tabpanel]"));

    await expect(window.locator("tr-docking-plate")).toHaveCount(0);
    await expect(window.locator(".tr-docking-side")).toHaveCount(0);
    await window.mouse.up();
    await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([firstNote, secondNote]);
  });

  test("the keyboard splits a document from its tab menu, moves it to the next or previous group and runs the move command from command search", async ({ desktop }) => {
    const window = desktop.window;
    await openTabMenuAsync(window, firstNote);
    await chooseRowAsync(window, "Split", "ArrowRight");
    await chooseRowAsync(window, "Split right");

    await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([firstNote]);
    await expect(tab(window, firstNote)).toBeFocused();
    await openTabMenuAsync(window, firstNote);
    await chooseRowAsync(window, "Move to previous group");
    await expect.poll(() => tabKeysOf(groupOf(window, secondNote))).toEqual([secondNote, firstNote]);
    await expect(documentGroups(window)).toHaveCount(1);
    await expect(tab(window, firstNote)).toBeFocused();

    await openTabMenuAsync(window, secondNote);
    await chooseRowAsync(window, "Split", "ArrowRight");
    await chooseRowAsync(window, "Split down");
    await expect(documentGroups(window)).toHaveCount(2);
    await runCommandAsync(window, "Move the tab to the next group", "shell.moveTabToNextGroup");
    await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([firstNote, secondNote]);
    await expect(documentGroups(window)).toHaveCount(1);
  });

  test("the focus commands move between the groups", async ({ desktop }) => {
    const window = desktop.window;
    await splitFirstNoteAsync(window);
    await tab(window, secondNote).click();

    await runCommandAsync(window, "Focus the next group", "shell.focusNextGroup");
    await expect(tab(window, secondNote)).not.toBeFocused();
    await expect(window.locator("tr-tab:focus")).toHaveCount(1);
    await runCommandAsync(window, "Focus the previous group", "shell.focusPreviousGroup");
    await expect(tab(window, secondNote)).toBeFocused();
  });

  test("closing the last document of a group from the keyboard focuses a tab of the group that remains", async ({ desktop }) => {
    const window = desktop.window;
    await splitFirstNoteAsync(window);
    await tab(window, firstNote).focus();

    await window.keyboard.press("ControlOrMeta+KeyW");

    await expect(documentGroups(window)).toHaveCount(1);
    await expect(tab(window, firstNote)).toHaveCount(0);
    await expect(tab(window, secondNote)).toBeFocused();
  });

  test("opening a document puts it in the active document group", async ({ desktop }) => {
    const window = desktop.window;
    await splitFirstNoteAsync(window);
    await tab(window, firstNote).click();

    await window.locator(".tr-notes-list-item", { hasText: /^Meeting notes, week 1$/ }).click();
    await window.locator("tr-tab[data-tab-key='document/notes.note/week-1']").dblclick();

    await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([firstNote, "document/notes.note/week-1"]);
    expect(await tabKeysOf(groupOf(window, secondNote))).toEqual([secondNote]);
  });

  test("a split's sash resizes the two document groups", async ({ desktop }) => {
    const window = desktop.window;
    await splitFirstNoteAsync(window);
    const sash = window.getByRole("separator", { name: "Resize the pane on the left" });
    const left = groupOf(window, secondNote);
    const width = (await left.boundingBox())?.width ?? 0;
    const grip = await centerOf(sash);

    await window.mouse.move(grip.x, grip.y);
    await window.mouse.down();
    await window.mouse.move(grip.x + 60, grip.y, { steps: 6 });
    await window.mouse.up();

    await expect.poll(async () => Math.round((await left.boundingBox())?.width ?? 0)).toBe(Math.round(width + 60));
    await desktop.checkpointAsync("document-split-resized");
  });

  test("the last document group stays and shows its empty card when its last document closes", async ({ desktop }) => {
    const window = desktop.window;
    await tab(window, firstNote).click({ button: "right" });
    await window.getByRole("menuitem", { name: "Close all" }).click();

    await expect(window.locator("tr-tab[data-tab-key^='document/']")).toHaveCount(0);
    await expect(window.locator("tr-tab-group:not([data-side])")).toHaveCount(1);
    await expect(window.locator("tr-tab-group:not([data-side]) tr-tab")).toHaveCount(0);
    await desktop.checkpointAsync("document-last-group-empty");
  });

  for (const reopen of [true, false])
    test(`the arrangement and sizes return ${reopen ? "after reopening on the running runtime" : "after a restart that stops the runtime"}`, async ({ desktop }) => {
      const window = desktop.window;
      await splitFirstNoteAsync(window);
      const before = await window.locator("tr-tab-group").evaluateAll(groups => groups.map(group => [
        [...group.querySelectorAll("tr-tab")].map(t => t.getAttribute("data-tab-key")),
        group.getBoundingClientRect().toJSON()
      ]));

      await (reopen ? desktop.reopenAsync() : desktop.restartAsync());

      await expect(tab(desktop.window, firstNote)).toBeVisible();
      await expect.poll(() => desktop.window.locator("tr-tab-group").evaluateAll(groups => groups.map(group => [
        [...group.querySelectorAll("tr-tab")].map(t => t.getAttribute("data-tab-key")),
        group.getBoundingClientRect().toJSON()
      ]))).toEqual(before);
    });

  for (const reopen of [true, false])
    test(`each group's active tab returns ${reopen ? "after reopening on the running runtime" : "after a restart that stops the runtime"}`, async ({ desktop }) => {
      const window = desktop.window;
      const outline = "view/notes.outline";
      const thirdNote = "document/notes.note/3";
      await tab(window, firstNote).click();
      await window.keyboard.press("ControlOrMeta+Alt+KeyN");
      await expect(tab(window, thirdNote)).toHaveAttribute("aria-selected", "true");
      await tab(window, secondNote).click();
      await tab(window, outline).click();
      await expect(tab(window, secondNote)).toHaveAttribute("aria-selected", "true");
      await expect(tab(window, outline)).toHaveAttribute("aria-selected", "true");

      await (reopen ? desktop.reopenAsync() : desktop.restartAsync());

      await expect.poll(() => tabKeysOf(groupOf(desktop.window, firstNote))).toEqual([firstNote, secondNote, thirdNote]);
      await expect(tab(desktop.window, secondNote)).toHaveAttribute("aria-selected", "true");
      await expect(tab(desktop.window, outline)).toHaveAttribute("aria-selected", "true");
      await expect(tab(desktop.window, thirdNote)).toHaveAttribute("aria-selected", "false");
    });

  test("Reset the layout returns the documents to one group", async ({ desktop }) => {
    const window = desktop.window;
    await splitFirstNoteAsync(window);
    await expect(documentGroups(window)).toHaveCount(2);

    await runCommandAsync(window, "Reset the layout", "shell.resetLayout");

    await expect(documentGroups(window)).toHaveCount(1);
    await expect.poll(() => tabKeysOf(groupOf(window, firstNote))).toEqual([secondNote, firstNote]);
  });
});
