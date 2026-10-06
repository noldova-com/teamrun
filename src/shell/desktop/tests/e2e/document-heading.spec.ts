/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import CommandSearchFixture from "./fixtures/command-search.fixture.ts";
import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

const deepBreadcrumb = ["Team notes kept for the whole release", "Archive of everything decided before the launch", "Reviews of the window and its controls", "Weeks 38 to 41"];
const movedTitle = "Note 2, moved after the review of the window row";

function heading(window: Page): Locator {
  return window.locator("tr-window-row .tr-window-row-heading");
}

function tab(window: Page, key: string): Locator {
  return window.locator(`tr-tab[data-tab-key="${key}"]`);
}

async function readTitlesAsync(desktop: DesktopApplicationFixture): Promise<string[]> {
  const native = await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle() ?? "");
  return [await desktop.window.title(), native];
}

async function expectTitledAsync(desktop: DesktopApplicationFixture, title: string): Promise<void> {
  const product = await desktop.window.evaluate(() => document.title.split(" — ").at(-1) ?? "");
  await expect.poll(() => readTitlesAsync(desktop)).toEqual([`${title} — ${product}`, `${title} — ${product}`]);
}

test.describe("the active document's heading", () => {
  test.beforeEach(async ({ desktop }) => {
    await expect(tab(desktop.window, "document/notes.note/2")).toBeVisible();
  });

  test("shows the breadcrumb and title of the active document in the window row, follows it, and names the window after it", async ({ desktop }) => {
    const window = desktop.window;

    await tab(window, "document/notes.note/1").click();
    await expect(heading(window)).toHaveAccessibleName("Notes › Drafts › Note 1");
    await expect(heading(window).locator(".tr-window-row-segment")).toHaveText(["Notes", "Drafts"]);
    await expect(heading(window).locator(".tr-window-row-title")).toHaveText("Note 1");
    await expectTitledAsync(desktop, "Note 1");
    expect(await heading(window).evaluate(t => [getComputedStyle(t).getPropertyValue("app-region"), getComputedStyle(t.closest("tr-window-row") as Element).getPropertyValue("app-region")]))
      .toEqual(["no-drag", "drag"]);
    await desktop.checkpointAsync("document-heading");

    await tab(window, "document/notes.note/2").click();
    await expect(heading(window)).toHaveAccessibleName("Notes › Note 2");
    await expectTitledAsync(desktop, "Note 2");

    await SettingsFixture.openAsync(window);
    await expect(heading(window)).toHaveAccessibleName("Settings");
    await expect(heading(window).locator(".tr-window-row-segment")).toHaveCount(0);
    await expectTitledAsync(desktop, "Settings");
  });

  test("takes a module's new title and breadcrumb, and cuts a long breadcrumb before the title in the smallest window, showing all of it in a tooltip", async ({ desktop }) => {
    const window = desktop.window;
    await tab(window, "document/notes.note/2").click();
    await CommandSearchFixture.searchAsync(window, "Move note 2 deep");
    await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "notes.moveNote");
    await window.keyboard.press("Enter");

    await expect(heading(window)).toHaveAccessibleName([...deepBreadcrumb, movedTitle].join(" › "));
    await expect(tab(window, "document/notes.note/2").locator(".tr-tab-label")).toHaveText(movedTitle);
    await expectTitledAsync(desktop, movedTitle);
    await desktop.useViewportAsync(640, 480);
    const parts = await heading(window).evaluate(t => {
      const row = t.closest("tr-window-row") as Element;
      const actions = row.querySelector(".tr-window-row-actions") as Element;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const cut = [...t.querySelectorAll<HTMLElement>(".tr-window-row-segment, .tr-window-row-title")].map(u => [u.scrollWidth > u.clientWidth, getComputedStyle(u).textOverflow]);
      return { cut, drag: (actions.getBoundingClientRect().left - t.getBoundingClientRect().right) / rem };
    });

    expect(parts.cut.slice(0, deepBreadcrumb.length)).toEqual(deepBreadcrumb.map(() => [true, "ellipsis"]));
    expect(parts.cut.at(-1)?.[1]).toBe("ellipsis");
    expect(parts.drag).toBeGreaterThanOrEqual(6);
    await heading(window).hover();
    await expect(window.locator(".cdk-overlay-container tr-tooltip")).toHaveText([...deepBreadcrumb, movedTitle].join(" › "));
    await desktop.checkpointAsync("document-heading-small");
  });
});
