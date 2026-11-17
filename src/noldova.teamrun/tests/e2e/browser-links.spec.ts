/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Locator, type Page, expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";

interface IBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

interface IChoiceRow {
  readonly title: string;
  readonly options: readonly string[];
  readonly chosen: string;
}

const BROWSER_PAGE: string = "Browser";
const LINK: string = "https://teamrun-e2e.invalid/reply-link";
const LINK_TEXT: string = "the linked page";
const LINKS_GROUP: string = "Links";
const OTHER_PAGE: string = "Appearance";
const PAGES: string = "Settings pages";
const RESET: string = "Reset";
const CHOICE_ROWS: readonly IChoiceRow[] = [
  { title: "Open a link you click", options: ["In the app's browser", "In your browser"], chosen: "In the app's browser" },
  { title: "Middle-click a link", options: ["Like Ctrl+click", "Like a click"], chosen: "Like Ctrl+click" }
];
const SITES_ROW: string = "Always open in your browser";
const SITES_MAX_LENGTH: string = "4000";
const TOLERANCE_REM: number = 0.05;
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

const contentEndOf = (locator: Locator): Promise<number> => locator.evaluate(t => {
  const style = getComputedStyle(t);
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return (t.getBoundingClientRect().right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth)) / rem;
});

const windowWidthOf = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.clientWidth / Number.parseFloat(getComputedStyle(document.documentElement).fontSize));

const columnOverflowOf = async (page: Page, column: Locator): Promise<number> => {
  const [box, windowWidth] = await Promise.all([boxOf(column), windowWidthOf(page)]);
  return box.right - windowWidth;
};

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

const linksOf = (page: Page): Locator => page.locator(`nol-settings section.nol-settings-group[aria-label="${LINKS_GROUP}"]`);

const rowOf = (page: Page, title: string): Locator => linksOf(page).locator("nol-setting-row").filter({ has: page.locator(".nol-setting-row-title", { hasText: title }) });

const controlsOutsideTheirRowAsync = (page: Page): Promise<string[]> => linksOf(page).locator("nol-setting-row").evaluateAll(rows => rows.flatMap(row => {
  const title = row.querySelector(".nol-setting-row-title");
  const parts = [...row.querySelectorAll(".nol-choice-pill, .nol-setting-row-control input")];
  if (title === null || parts.length === 0)
    return [`a row has no title or control`];
  const style = getComputedStyle(row);
  const titleBox = title.getBoundingClientRect();
  const end = row.getBoundingClientRect().right - Number.parseFloat(style.paddingRight) - Number.parseFloat(style.borderRightWidth);
  return parts.flatMap(t => {
    const box = t.getBoundingClientRect();
    return box.left >= titleBox.left - 0.5 && box.right <= end + 0.5 ? [] : [`${title.textContent}: ${t.textContent?.trim() || "its field"} spans ${box.left}px to ${box.right}px in a row whose content spans ${titleBox.left}px to ${end}px`];
  });
}));

test("Settings' Browser Links page lines up with Settings' other pages and keeps each row's control under its description, in light, dark and forced colors", async ({ app }) => {
  const page = await app.openChatAsync();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const column = page.locator(".nol-settings-column");
  const links = linksOf(page);
  const rows = links.locator("nol-setting-row");

  for (const look of LOOKS) {
    await page.emulateMedia({ colorScheme: look.colorScheme, forcedColors: look.forcedColors });
    await choosePageAsync(page, OTHER_PAGE);
    const setting = page.locator("nol-setting-row").first();
    await expect(setting).toBeVisible({ timeout: 30_000 });
    const [appearanceColumn, groupTitle, settingBox, settingTitle] = await Promise.all([boxOf(column), boxOf(page.locator(".nol-settings-group > .nol-settings-group-title").first()),
      boxOf(setting), boxOf(setting.locator(".nol-setting-row-title").first())]);

    await choosePageAsync(page, BROWSER_PAGE);
    await expect(links.locator(".nol-settings-group-title")).toHaveText(LINKS_GROUP, { timeout: 30_000 });
    await expect(rows.locator(".nol-setting-row-title")).toHaveText([...CHOICE_ROWS.map(t => t.title), SITES_ROW]);
    const [ownColumn, linksTitle] = await Promise.all([boxOf(column), boxOf(links.locator(".nol-settings-group-title"))]);
    expectAt(ownColumn.left, appearanceColumn.left, `${look.name}: the column's start against Appearance's`);
    expectAt(ownColumn.right, appearanceColumn.right, `${look.name}: the column's end against Appearance's`);
    expectAt(linksTitle.left, groupTitle.left, `${look.name}: the Links heading against Appearance's first heading`);

    for (const row of await rows.all()) {
      const name = (await row.locator(".nol-setting-row-title").textContent())?.trim() ?? "";
      const [rowBox, title, description, control] = await Promise.all([boxOf(row), boxOf(row.locator(".nol-setting-row-title")),
        boxOf(row.locator(".nol-setting-row-description")), boxOf(row.locator(".nol-setting-row-control"))]);
      const what = `${look.name}, ${name}`;
      expectAt(rowBox.left, settingBox.left, `${what}: the row's start against Appearance's first row`);
      expectAt(rowBox.right, settingBox.right, `${what}: the row's end against Appearance's first row`);
      expectAt(title.left - rowBox.left, settingTitle.left - settingBox.left, `${what}: the title in its row against a setting's title`);
      expectAt(description.left, title.left, `${what}: the description against the title`);
      expectAt(control.left, title.left, `${what}: the control against the title`);
      expect(description.top, `${what}: the description sits under the title`).toBeGreaterThanOrEqual(title.bottom);
      expect(control.top, `${what}: the control sits under the description`).toBeGreaterThanOrEqual(description.bottom);
      expect(control.bottom, `${what}: the control ends inside its row`).toBeLessThanOrEqual(rowBox.bottom);
    }

    for (const choice of CHOICE_ROWS) {
      const row = rowOf(page, choice.title);
      const group = row.getByRole("radiogroup", { name: choice.title });
      await expect(group.getByRole("radio")).toHaveText([...choice.options]);
      await expect(group.getByRole("radio", { checked: true })).toHaveText(choice.chosen);
      const [title, pills] = await Promise.all([boxOf(row.locator(".nol-setting-row-title")), Promise.all((await group.getByRole("radio").all()).map(boxOf))]);
      expectAt(pills[0]?.left ?? Number.NaN, title.left, `${look.name}, ${choice.title}: the first option against the title`);
      expect(pills.map(t => t.top), `${look.name}, ${choice.title}: the options share one line`).toEqual(pills.map(() => pills[0]?.top));
    }

    const sites = rowOf(page, SITES_ROW).getByRole("textbox", { name: SITES_ROW });
    await expect(sites).toHaveValue("");
    await expect(sites).toHaveAttribute("maxlength", SITES_MAX_LENGTH);
    const [sitesEnd, sitesTitle, field] = await Promise.all([contentEndOf(rowOf(page, SITES_ROW)), boxOf(rowOf(page, SITES_ROW).locator(".nol-setting-row-title")), boxOf(sites)]);
    expectAt(field.left, sitesTitle.left, `${look.name}: the sites field against its title`);
    expect(field.right, `${look.name}: the sites field ends inside its row's padding`).toBeLessThanOrEqual(sitesEnd + TOLERANCE_REM);

    const [first] = CHOICE_ROWS;
    const firstRow = rowOf(page, first?.title ?? "");
    const other = first?.options.find(t => t !== first.chosen) ?? "";
    await firstRow.getByRole("radio", { name: other, exact: true }).click();
    await expect(firstRow.getByRole("radio", { checked: true })).toHaveText(other);
    const reset = firstRow.getByRole("button", { name: new RegExp(`^${RESET}`, "u") });
    await expect(reset).toBeVisible();
    const [contentEnd, heading, resetBox] = await Promise.all([contentEndOf(firstRow), boxOf(firstRow.locator(".nol-setting-row-heading")), boxOf(reset)]);
    expectAt(heading.right, contentEnd, `${look.name}: the row heading's end against the row's content end`);
    expectAt(resetBox.right, heading.right, `${look.name}: the Reset button against the row heading's end`);
    await reset.click();
    await expect(firstRow.getByRole("radio", { checked: true })).toHaveText(first?.chosen ?? "");
    await expect(reset).toHaveCount(0);
  }

  await page.setViewportSize(WINDOW_MINIMUM);
  await expect.poll(() => columnOverflowOf(page, column), { message: `the column settles inside the window at its ${WINDOW_MINIMUM.width}px minimum`, ...TeamRunApp.pollOf() }).toBeLessThanOrEqual(TOLERANCE_REM);
  const outside: string[] = [];
  for (const look of LOOKS) {
    await page.emulateMedia({ colorScheme: look.colorScheme, forcedColors: look.forcedColors });
    await expect(rows).toHaveCount(CHOICE_ROWS.length + 1);
    outside.push(...(await controlsOutsideTheirRowAsync(page)).map(t => `${look.name}: ${t}`));
    const [ownColumn, windowWidth] = await Promise.all([boxOf(column), windowWidthOf(page)]);
    if (ownColumn.right > windowWidth + TOLERANCE_REM)
      outside.push(`${look.name}: the column ends at ${ownColumn.right} rem, past the window's ${windowWidth} rem`);
    for (const row of await rows.all()) {
      const box = await boxOf(row);
      if (box.right > ownColumn.right + TOLERANCE_REM)
        outside.push(`${look.name}: a row ends at ${box.right} rem, past the column's ${ownColumn.right} rem`);
    }
  }
  await page.emulateMedia({ colorScheme: null, forcedColors: null });
  expect(outside, `at the window's ${WINDOW_MINIMUM.width}px minimum, every control stays inside its row, each row inside the column and the column inside the window`).toEqual([]);

  expect(app.unexpectedFailures).toEqual([]);
});

test("a link clicked in a reply opens in the app's browser as the Links settings say by default, and Ctrl+click opens it in the person's browser", async ({ app }) => {
  const page = await app.openChatAsync();
  await app.electronApp.evaluate(({ shell }) => {
    const opened: string[] = [];
    Reflect.set(globalThis, "openedLinks", opened);
    shell.openExternal = (url: string): Promise<void> => {
      opened.push(url);
      return Promise.resolve();
    };
  });
  const openedAsync = (): Promise<unknown> => app.electronApp.evaluate(() => Reflect.get(globalThis, "openedLinks"));
  await app.sendAsync(`${CodexDouble.REPLY_PREFIX}See [${LINK_TEXT}](${LINK}).`);
  const links = page.getByRole("link", { name: LINK_TEXT, exact: true });
  await expect(links).toHaveCount(2, { timeout: 60_000 });
  const link = links.last();

  await link.click({ modifiers: ["ControlOrMeta"] });
  await expect.poll(openedAsync, TeamRunApp.pollOf(30_000)).toEqual([LINK]);
  await expect(link).toBeVisible();

  await link.click();
  await expect(page.getByRole("tab", { name: /teamrun-e2e[.]invalid/u })).toHaveCount(1, { timeout: 30_000 });
  expect(await openedAsync()).toEqual([LINK]);
  expect(app.unexpectedFailures).toEqual([]);
});
