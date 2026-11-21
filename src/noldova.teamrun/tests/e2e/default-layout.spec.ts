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
  ["Right", ["view/teamrun.backgroundTasks", "view/teamrun.pages"], "view/teamrun.backgroundTasks"],
  ["Right", ["view/teamrun.plan", "view/teamrun.subAgents"], "view/teamrun.plan"],
  ["Bottom", ["view/teamrun.activity", "view/teamrun.changes"], "view/teamrun.activity"]
];

async function placesAsync(page: Page): Promise<readonly IGroupPlace[]> {
  return page.locator("nol-tab-group[data-side]").evaluateAll(groups => groups.map(group => {
    const tabs = [...group.querySelectorAll("nol-tab")];
    const box = group.getBoundingClientRect();
    return {
      side: group.getAttribute("data-side"),
      tabs: tabs.map(t => t.getAttribute("data-tab-key")).filter(t => t !== "view/git.view"),
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

test("a fresh install opens Explorer on the left, Background tasks and Pages above Plans and Sub-agents on the right, and Activity and Changes along the bottom under both, each group showing its first tab, and Reset the layout returns to it", async ({ app }, testInfo) => {
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
  await page.locator("nol-tab[data-tab-key='view/teamrun.changes']").click();
  const sash = page.getByRole("separator", { name: "Resize the right dock" });
  await sash.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => placesAsync(page), TeamRunApp.pollOf(30_000)).not.toEqual(fresh);
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
