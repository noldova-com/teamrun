/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, type Page } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

interface IGroupPlace {
  readonly side: string | null;
  readonly tabs: readonly (string | null)[];
  readonly shown: string | null;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const EXPECTED: readonly (readonly [string, readonly string[], string])[] = [
  ["Left", ["view/teamrun.projects"], "view/teamrun.projects"],
  ["Right", ["view/teamrun.backgroundTasks", "view/git.view", "view/teamrun.pages"], "view/teamrun.backgroundTasks"],
  ["Right", ["view/teamrun.plan", "view/teamrun.subAgents"], "view/teamrun.plan"],
  ["Bottom", ["view/teamrun.activity", "view/teamrun.changes"], "view/teamrun.activity"]
];

async function placesAsync(page: Page): Promise<readonly IGroupPlace[]> {
  return page.locator("nol-tab-group[data-side]").evaluateAll(groups => groups.map(group => {
    const tabs = [...group.querySelectorAll("nol-tab")];
    const box = group.getBoundingClientRect();
    return {
      side: group.getAttribute("data-side"),
      tabs: tabs.map(t => t.getAttribute("data-tab-key")),
      shown: tabs.find(t => t.getAttribute("aria-selected") === "true")?.getAttribute("data-tab-key") ?? null,
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom
    };
  }));
}

function namesOf(places: readonly IGroupPlace[]): readonly (readonly [string | null, readonly (string | null)[], string | null])[] {
  return [...places.map(t => [t.side, t.tabs, t.shown] as const)].sort((a, b) => EXPECTED.findIndex(t => t[1][0] === a[1][0]) - EXPECTED.findIndex(t => t[1][0] === b[1][0]));
}

function groupOf(places: readonly IGroupPlace[], key: string): IGroupPlace {
  const found = places.find(t => t.tabs.includes(key));
  if (found === undefined)
    throw new Error(`No dock group holds ${key}.`);
  return found;
}

async function dragAsync(page: Page, key: string, after: string): Promise<void> {
  const from = await page.locator(`nol-tab[data-tab-key='${key}']`).boundingBox();
  const to = await page.locator(`nol-tab[data-tab-key='${after}']`).boundingBox();
  if (from === null || to === null)
    throw new Error(`${key} or ${after} isn't shown.`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x + to.width - 4, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(`nol-tab[data-tab-key='${key}']`)).toBeFocused();
}

test("a fresh install opens Explorer on the left, Background tasks, Git and Pages above Plans and Sub-agents on the right, and Activity and Changes along the bottom under both, each group showing its first tab, and Reset the layout returns to it after a view moves group, another tab shows and the dock is resized", async ({ app }, testInfo) => {
  const page = await app.startAsync();
  await expect(page.locator("nol-tab[data-tab-key='view/teamrun.projects']")).toBeVisible({ timeout: 60_000 });

  await expect.poll(async () => namesOf(await placesAsync(page)), TeamRunApp.pollOf(30_000)).toEqual(EXPECTED);
  const fresh = await placesAsync(page);
  const [width, height] = await page.evaluate(() => [innerWidth, innerHeight]);
  const explorer = groupOf(fresh, "view/teamrun.projects");
  const upper = groupOf(fresh, "view/teamrun.backgroundTasks");
  const lower = groupOf(fresh, "view/teamrun.plan");
  const bottom = groupOf(fresh, "view/teamrun.activity");
  expect([explorer.left < width / 4, upper.right > width * 3 / 4, upper.left > explorer.right, upper.bottom <= lower.top, upper.left === lower.left, upper.right === lower.right,
    bottom.top > height / 2, bottom.top >= explorer.bottom, bottom.top >= lower.bottom, bottom.left < explorer.right, bottom.right > upper.left])
    .toEqual([true, true, true, true, true, true, true, true, true, true, true]);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await testInfo.attach(`fresh-install-${scheme}.png`, { body: await page.screenshot(), contentType: "image/png" });
  }
  await page.emulateMedia({ colorScheme: null });

  await page.locator("nol-tab[data-tab-key='view/teamrun.pages']").click();
  await dragAsync(page, "view/teamrun.changes", "view/teamrun.subAgents");
  const sash = await page.getByRole("separator", { name: "Resize the right dock" }).boundingBox();
  if (sash === null)
    throw new Error("The right dock's separator isn't shown.");
  await page.mouse.move(sash.x + sash.width / 2, sash.y + sash.height / 2);
  await page.mouse.down();
  await page.mouse.move(sash.x + sash.width / 2 - 48, sash.y + sash.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => {
    const moved = await placesAsync(page);
    return [groupOf(moved, "view/teamrun.pages").shown, groupOf(moved, "view/teamrun.changes").side, groupOf(moved, "view/teamrun.changes").tabs, groupOf(moved, "view/teamrun.changes").shown,
      groupOf(moved, "view/teamrun.activity").tabs, Math.abs(lower.left - groupOf(moved, "view/teamrun.plan").left - 48) <= 1];
  }, TeamRunApp.pollOf(30_000)).toEqual(["view/teamrun.pages", "Right", ["view/teamrun.plan", "view/teamrun.subAgents", "view/teamrun.changes"], "view/teamrun.changes", ["view/teamrun.activity"], true]);
  await page.keyboard.press("ControlOrMeta+Shift+KeyP");
  const search = page.getByRole("combobox", { name: /^Search / });
  await expect(search).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.type("Reset the layout");
  await expect(page.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/desktop.resetLayout");
  await page.keyboard.press("Enter");

  await expect.poll(() => placesAsync(page), TeamRunApp.pollOf(30_000)).toEqual(fresh);
  expect(app.unexpectedFailures).toEqual([]);
});
