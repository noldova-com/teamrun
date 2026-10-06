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
import TabDragFixture from "./fixtures/tab-drag.fixture.ts";

interface ILiveState {
  readonly isSame: boolean;
  readonly value: string;
  readonly selection: readonly number[];
  readonly scrolls: readonly number[];
}

const firstNote = "document/notes.note/1";
const secondNote = "document/notes.note/2";

function noteContent(window: Page): Locator {
  return window.locator("tr-tab-content").filter({ has: window.locator("[data-fixture-content=notes-note-1]") });
}

function listContent(window: Page): Locator {
  return window.locator("tr-tab-content").filter({ has: window.locator("[data-fixture-content=notes-list]") });
}

async function markAsync(content: Locator, name: string): Promise<void> {
  await content.evaluate((t, key) => Reflect.set(globalThis, key, t), name);
}

function isSameAsync(content: Locator, name: string): Promise<boolean> {
  return content.evaluate((t, key) => t === Reflect.get(globalThis, key), name);
}

function stateAsync(window: Page): Promise<ILiveState> {
  return noteContent(window).evaluate(t => {
    const summary = t.querySelector("textarea") as HTMLTextAreaElement;
    return {
      isSame: t === Reflect.get(globalThis, "liveNote"),
      value: summary.value,
      selection: [summary.selectionStart, summary.selectionEnd],
      scrolls: [t.scrollTop, summary.scrollTop]
    };
  });
}

test.describe("live views", () => {
  test("a document keeps its page, what was typed, its selection and its scroll positions across tab switches, drags between groups and a dialog, and a docked view keeps its page while its dock collapses", async ({ desktop }) => {
    const window = desktop.window;
    await desktop.useViewportAsync(1280, 720);
    await TabDragFixture.tab(window, firstNote).click();
    const summary = noteContent(window).getByRole("textbox", { name: "Summary" });
    await summary.click();
    await summary.fill(Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`).join("\n"));
    await noteContent(window).evaluate(t => {
      const field = t.querySelector("textarea") as HTMLTextAreaElement;
      field.setSelectionRange(3, 9);
      field.scrollTop = 40;
      t.scrollTop = 200;
    });
    await markAsync(noteContent(window), "liveNote");
    const kept = await stateAsync(window);

    await TabDragFixture.tab(window, secondNote).click();
    await expect(window.locator("[data-fixture-content=notes-note-1]")).toHaveCount(0);
    await TabDragFixture.tab(window, firstNote).click();
    await expect.poll(() => stateAsync(window)).toEqual(kept);

    await TabDragFixture.dragOntoPlateAsync(window, firstNote, secondNote, "Right");
    await window.mouse.up();
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([firstNote]);
    await expect.poll(() => stateAsync(window)).toEqual(kept);
    await TabDragFixture.dragOntoPlateAsync(window, firstNote, secondNote, "Center");
    await window.mouse.up();
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, secondNote))).toEqual([secondNote, firstNote]);
    await expect.poll(() => stateAsync(window)).toEqual(kept);

    await CommandSearchFixture.searchAsync(window, "Show note 1 in a dialog");
    await window.keyboard.press("Enter");
    await expect(window.getByRole("dialog").locator("[data-fixture-content=notes-note-1]")).toBeVisible();
    const inDialog = await stateAsync(window);
    await window.keyboard.press("Escape");
    await expect(window.getByRole("dialog")).toHaveCount(0);
    await expect.poll(() => stateAsync(window)).toEqual(kept);
    expect([inDialog.isSame, inDialog.value, inDialog.selection]).toEqual([true, kept.value, kept.selection]);

    await markAsync(listContent(window), "liveList");
    await window.keyboard.press("ControlOrMeta+KeyB");
    await expect(window.locator("[data-fixture-content=notes-list]")).toHaveCount(0);
    await window.keyboard.press("ControlOrMeta+KeyB");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
    expect(await isSameAsync(listContent(window), "liveList")).toBe(true);
  });
});
