/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Locator, type Page, expect } from "playwright/test";

import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

interface IBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const ABILITIES_PAGE: string = "What each provider can do";
const OTHER_PAGE: string = "Appearance";
const PAGES: string = "Settings pages";
const PROVIDER: string = "Provider";
const ABILITY_COUNT: number = 42;
const BUILT_IN_PROVIDERS: readonly string[] = ["Claude Code", "Codex", "GitHub Copilot", "Grok", "OpenCode", "Cursor", "Antigravity", "Pi", "fx", "Muse Code"];
const TOLERANCE_REM: number = 0.05;
const CENTRE_TOLERANCE_REM: number = 0.5;
const WINDOW_MINIMUM: { readonly width: number; readonly height: number } = { width: 640, height: 720 };
const LOOKS: readonly { readonly name: string; readonly colorScheme: "light" | "dark"; readonly forcedColors: "none" | "active" }[] = [
  { name: "light", colorScheme: "light", forcedColors: "none" },
  { name: "dark", colorScheme: "dark", forcedColors: "none" },
  { name: "forced colors", colorScheme: "light", forcedColors: "active" }
];

const boxOf = (locator: Locator): Promise<IBox> => locator.evaluate(t => {
  const box = t.getBoundingClientRect();
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return { left: box.left / rem, right: box.right / rem, top: box.top / rem, bottom: box.bottom / rem };
});

const expectAt = (actual: number, expected: number, what: string): void => {
  expect(Math.abs(actual - expected), `${what}: ${actual} rem against ${expected} rem`).toBeLessThan(TOLERANCE_REM);
};

const choosePageAsync = async (page: Page, title: string): Promise<void> => {
  const settings = page.locator("nol-settings");
  const select = settings.locator(".nol-settings-page-select").getByRole("button");
  const item = settings.locator(".nol-settings-pages").getByRole("treeitem", { name: title, exact: true, includeHidden: true });
  await expect.poll(async () => await select.isVisible() || await item.isVisible(), TeamRunApp.pollOf(30_000)).toBe(true);
  if (await select.isVisible()) {
    await select.click();
    await page.getByRole("listbox", { name: PAGES }).getByRole("option", { name: title, exact: true }).click();
  } else
    await item.click({ timeout: 30_000 });
  await expect(item).toHaveAttribute("aria-selected", "true");
};

const rowsOf = (page: Page): Locator => page.locator("nol-settings-page-host .nol-teamrun-ability");

const answersOffTheirLineAsync = (page: Page): Promise<string[]> => rowsOf(page).evaluateAll(rows => rows.flatMap(row => {
  const name = row.querySelector(".nol-setting-row-title");
  const answer = row.querySelector(".nol-teamrun-ability-answer");
  if (name === null || answer === null)
    return [`${row.getAttribute("data-ability") ?? ""} has no name or answer`];
  const [nameBox, answerBox, rowBox] = [name.getBoundingClientRect(), answer.getBoundingClientRect(), row.getBoundingClientRect()];
  return answerBox.top < nameBox.bottom && answerBox.left >= nameBox.right ? [] : [`${name.textContent} (${nameBox.width}px) beside ${answerBox.width}px in a ${rowBox.width}px row`];
}));

test("Settings' page of what each provider can do lines up with Settings' other pages and ends each ability's row with its answer, in light, dark and forced colors", async ({ app }) => {
  const page = await app.openChatAsync();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const column = page.locator(".nol-settings-column");
  const rows = rowsOf(page);

  for (const look of LOOKS) {
    await page.emulateMedia({ colorScheme: look.colorScheme, forcedColors: look.forcedColors });
    await choosePageAsync(page, OTHER_PAGE);
    const setting = page.locator("nol-setting-row").first();
    await expect(setting).toBeVisible({ timeout: 30_000 });
    const [appearanceColumn, settingBox, settingTitle] = await Promise.all([boxOf(column), boxOf(setting), boxOf(setting.locator(".nol-setting-row-title").first())]);

    await choosePageAsync(page, ABILITIES_PAGE);
    await expect(page.locator(".nol-settings-column > h2.nol-settings-group-title")).toHaveText(ABILITIES_PAGE);
    await expect(rows).toHaveCount(ABILITY_COUNT, { timeout: 30_000 });
    const refused = rows.filter({ has: page.locator(".nol-teamrun-ability-answer", { hasText: /^(Can't|Not )/u }) }).first();
    const ownColumn = await boxOf(column);
    expectAt(ownColumn.left, appearanceColumn.left, `${look.name}: the column's start against Appearance's`);
    expectAt(ownColumn.right, appearanceColumn.right, `${look.name}: the column's end against Appearance's`);
    for (const row of [rows.first(), refused]) {
      const [rowBox, heading, title, answer, description] = await Promise.all([boxOf(row), boxOf(row.locator(".nol-setting-row-heading")),
        boxOf(row.locator(".nol-setting-row-title")), boxOf(row.locator(".nol-teamrun-ability-answer")), boxOf(row.locator(".nol-teamrun-ability-description"))]);
      expectAt(rowBox.left, settingBox.left, `${look.name}: the row's start against Appearance's first row`);
      expectAt(rowBox.right, settingBox.right, `${look.name}: the row's end against Appearance's first row`);
      expectAt(title.left - rowBox.left, settingTitle.left - settingBox.left, `${look.name}: the ability's name in its row against a setting's title`);
      expectAt(answer.right, heading.right, `${look.name}: the answer against the row heading's end`);
      expectAt(description.left, title.left, `${look.name}: the description against the ability's name`);
      expect(answer.left, `${look.name}: the answer clears the ability's name`).toBeGreaterThanOrEqual(title.right);
      expect(answer.top, `${look.name}: the answer sits on the name's first line`).toBeLessThan(title.bottom);
    }
  }
  await page.setViewportSize(WINDOW_MINIMUM);
  const picker = page.locator("nol-select.nol-teamrun-abilities-kind").getByRole("button");
  await picker.click();
  const providers = (await page.getByRole("listbox", { name: PROVIDER }).getByRole("option").allTextContents()).map(t => t.trim());
  await page.keyboard.press("Escape");
  expect([...providers].sort((a, b) => a.localeCompare(b)), "the picker lists every built-in provider").toEqual([...BUILT_IN_PROVIDERS].sort((a, b) => a.localeCompare(b)));
  const offTheirLine: string[] = [];
  for (const look of LOOKS) {
    await page.emulateMedia({ colorScheme: look.colorScheme, forcedColors: look.forcedColors });
    for (const provider of providers) {
      await picker.click();
      await page.getByRole("listbox", { name: PROVIDER }).getByRole("option", { name: provider, exact: true }).click();
      await expect(picker).toContainText(provider);
      await expect(rows).toHaveCount(ABILITY_COUNT);
      offTheirLine.push(...(await answersOffTheirLineAsync(page)).map(t => `${look.name}, ${provider}: ${t}`));
    }
  }
  await page.emulateMedia({ colorScheme: null, forcedColors: null });
  expect(offTheirLine, `at the window's ${WINDOW_MINIMUM.width}px minimum, every answer stays beside its ability's name`).toEqual([]);

  expect(app.unexpectedFailures).toEqual([]);
});

test("Settings search finds an ability by its title and opens the providers page scrolled to that row, marked", async ({ app }) => {
  const page = await app.openChatAsync();
  await page.getByRole("button", { name: "Settings", exact: true }).click();

  await page.getByRole("searchbox", { name: "Search settings", exact: true }).fill("plan-limit meters");
  const found = page.locator(".nol-settings-found-row-open", { hasText: "Plan-limit meters" });
  await expect(found).toBeVisible({ timeout: 30_000 });
  await found.click();

  const row = page.locator("nol-settings-page-host [data-setting='teamrun.providers.planLimits']");
  const heading = page.locator(".nol-settings-column > h2.nol-settings-group-title");
  const content = page.locator(".nol-settings-content");
  await expect(heading).toHaveText(ABILITIES_PAGE);
  await expect(row).toHaveClass(/nol-setting-row-found/u);
  await expect.poll(() => content.evaluate(t => t.scrollTop), { message: "the Settings column scrolled to the row", ...TeamRunApp.pollOf() }).toBeGreaterThan(0);

  const visible = await content.evaluate(t => {
    const box = t.getBoundingClientRect();
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { left: (box.left + t.clientLeft) / rem, right: (box.left + t.clientLeft + t.clientWidth) / rem, top: (box.top + t.clientTop) / rem,
      bottom: (box.top + t.clientTop + t.clientHeight) / rem };
  });
  const [rowBox, headingBox] = [await boxOf(row), await boxOf(heading)];
  expect(rowBox.top, "the row starts below the column's visible top").toBeGreaterThanOrEqual(Math.max(visible.top, headingBox.bottom) - TOLERANCE_REM);
  expect(rowBox.bottom, "the row ends above the column's visible bottom").toBeLessThanOrEqual(visible.bottom + TOLERANCE_REM);
  expect(rowBox.left, "the row starts inside the column").toBeGreaterThanOrEqual(visible.left - TOLERANCE_REM);
  expect(rowBox.right, "the row ends inside the column").toBeLessThanOrEqual(visible.right + TOLERANCE_REM);
  expect(Math.abs((rowBox.top + rowBox.bottom) / 2 - (visible.top + visible.bottom) / 2), "the row's centre against the column's centre")
    .toBeLessThan(CENTRE_TOLERANCE_REM);
  expect(app.unexpectedFailures).toEqual([]);
});
