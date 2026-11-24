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

class DockGroup {
  public readonly side: string | null;
  public readonly tabs: readonly (string | null)[];
  public readonly shown: string | null;

  public constructor(side: string | null, tabs: readonly (string | null)[], shown: string | null) {
    this.side = side;
    this.tabs = tabs;
    this.shown = shown;
  }
}

const EXPECTED: readonly DockGroup[] = [
  new DockGroup("Left", ["view/teamrun.projects"], "view/teamrun.projects"),
  new DockGroup("Right", ["view/teamrun.backgroundTasks", "view/teamrun.pages", "view/git.view"], "view/teamrun.backgroundTasks"),
  new DockGroup("Right", ["view/teamrun.plan", "view/teamrun.subAgents"], "view/teamrun.plan"),
  new DockGroup("Bottom", ["view/teamrun.activity", "view/teamrun.changes"], "view/teamrun.activity")
];
const SCHEMES: readonly ("light" | "dark")[] = ["light", "dark"];

interface IRowPlace {
  readonly rowLeft: number;
  readonly rowRight: number;
  readonly overflowLeft: number | null;
  readonly pagesLeft: number;
  readonly pagesRight: number;
  readonly pages: string;
  readonly git: string;
}

async function rightRowAsync(page: Page): Promise<IRowPlace> {
  return page.locator("nol-tab-group[data-side='Right']").filter({ has: page.locator("nol-tab[data-tab-key='view/teamrun.pages']") }).evaluate(group => {
    const row = group.querySelector(".nol-tab-group-scroller")?.getBoundingClientRect();
    const overflow = group.querySelector("button[aria-label='Show all tabs']");
    const tab = (key: string): Element | null => group.querySelector(`nol-tab[data-tab-key='${key}']`);
    const pages = tab("view/teamrun.pages");
    const git = tab("view/git.view");
    if (Object.isUndefined(row) || Object.isNull(pages) || Object.isNull(git))
      throw new Error("The right dock's upper tab row, Pages or Git isn't there.");
    const box = pages.getBoundingClientRect();
    return {
      rowLeft: row.left,
      rowRight: row.right,
      overflowLeft: Object.isNull(overflow) || getComputedStyle(overflow).visibility === "hidden" ? null : overflow.getBoundingClientRect().left,
      pagesLeft: box.left,
      pagesRight: box.right,
      pages: getComputedStyle(pages).visibility,
      git: getComputedStyle(git).visibility
    };
  });
}

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

function namesOf(places: readonly IGroupPlace[]): readonly DockGroup[] {
  return places.map(t => new DockGroup(t.side, t.tabs, t.shown)).sort((a, b) => EXPECTED.findIndex(t => t.tabs[0] === a.tabs[0]) - EXPECTED.findIndex(t => t.tabs[0] === b.tabs[0]));
}

function groupOf(places: readonly IGroupPlace[], key: string): IGroupPlace {
  const found = places.find(t => t.tabs.includes(key));
  if (Object.isUndefined(found))
    throw new Error(`No dock group holds ${key}.`);
  return found;
}

async function dragAsync(page: Page, key: string, after: string): Promise<void> {
  const from = await page.locator(`nol-tab[data-tab-key='${key}']`).boundingBox();
  const to = await page.locator(`nol-tab[data-tab-key='${after}']`).boundingBox();
  if (Object.isNull(from) || Object.isNull(to))
    throw new Error(`${key} or ${after} isn't shown.`);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  await page.mouse.move(to.x + to.width - 4, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(`nol-tab[data-tab-key='${key}']`)).toBeFocused();
}

test("a fresh install opens Explorer on the left, Background tasks, Pages and Git above Plans and Sub-agents on the right, and Activity and Changes along the bottom under both, each group showing its first tab, and Reset the layout returns to it after a view moves group, another tab shows and the dock is resized", async ({ app }, testInfo) => {
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
  const row = await rightRowAsync(page);
  expect([width, height, row.pages, row.git, !Object.isNull(row.overflowLeft), row.pagesLeft >= row.rowLeft, row.pagesRight <= (row.overflowLeft ?? row.rowRight)],
    "at 1280×800 Pages' tab lies whole in the right dock's tab row, before Show all tabs, which holds Git").toEqual([1280, 800, "visible", "hidden", true, true, true]);
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    await testInfo.attach(`fresh-install-${scheme}.png`, { body: await page.screenshot(), contentType: "image/png" });
  }
  await page.emulateMedia({ colorScheme: null });

  await TeamRunApp.showTabAsync(page, "Pages");
  await dragAsync(page, "view/teamrun.changes", "view/teamrun.subAgents");
  const sash = await page.getByRole("separator", { name: "Resize the right dock" }).boundingBox();
  if (Object.isNull(sash))
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
