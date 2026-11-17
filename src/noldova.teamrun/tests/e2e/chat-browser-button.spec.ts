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

const ACTION: string = "nol-window-row [data-nol-item=\"teamrun.chatPage\"]";
const END_ACTIONS: string = "nol-window-row .nol-window-row-actions";
const CONTROLS: string = "nol-window-row nol-window-controls";
const SEARCH_FIELD: string = "nol-window-row .nol-window-row-search";
const SEARCH_PANE: string = ".cdk-overlay-container .nol-search-pane";
const OFFERED: string = "Open the chat's Browser page";
const UNAVAILABLE: string = "Open a chat to open its Browser page";
const PAGE_TAB: string = "New tab";
const TOLERANCE_REM: number = 0.05;
const LOOKS: readonly { readonly name: string; readonly colorScheme: "light" | "dark"; readonly forcedColors: "none" | "active" }[] = [
  { name: "light", colorScheme: "light", forcedColors: "none" },
  { name: "dark", colorScheme: "dark", forcedColors: "none" },
  { name: "forced colors", colorScheme: "light", forcedColors: "active" }
];
const FOCUS_PROPERTIES: readonly string[] = ["outline-style", "outline-width", "outline-color", "outline-offset", "box-shadow", "border-color", "background-color"];

const boxOf = (locator: Locator): Promise<IBox> => locator.evaluate(t => {
  const box = t.getBoundingClientRect();
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return { left: box.left / rem, right: box.right / rem, top: box.top / rem, bottom: box.bottom / rem };
});

const expectAt = (actual: number, expected: number, what: string): void => {
  expect(Math.abs(actual - expected), `${what}: ${actual} rem against ${expected} rem`).toBeLessThan(TOLERANCE_REM);
};

const rowEndOf = (page: Page): Promise<number> => page.evaluate(selector => {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const row = document.querySelector("nol-window-row");
  const controls = document.querySelector(selector);
  if (row === null)
    throw new Error("The window row isn't shown.");
  return (controls === null ? row.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(row).paddingRight) : controls.getBoundingClientRect().left) / rem;
}, CONTROLS);

const focusLookOf = (locator: Locator): Promise<string[]> => locator.evaluate((t, properties) => [getComputedStyle(t), getComputedStyle(t, "::before")]
  .flatMap(u => properties.map(v => u.getPropertyValue(v))), FOCUS_PROPERTIES);

interface IRowButtons {
  readonly row: IBox;
  readonly width: number;
  readonly height: number;
  readonly buttons: readonly IBox[];
}

interface IRowLayout {
  readonly mine: IBox;
  readonly theirs: IBox;
  readonly edge: number;
  readonly shown: IRowButtons;
}

const rowButtonsOf = (page: Page): Promise<IRowButtons> => page.evaluate(() => {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const inRem = (box: DOMRect): IBox => ({ left: box.left / rem, right: box.right / rem, top: box.top / rem, bottom: box.bottom / rem });
  const row = document.querySelector("nol-window-row");
  if (row === null)
    throw new Error("The window row isn't shown.");
  const buttons = [...row.querySelectorAll("button")].map(t => t.getBoundingClientRect()).filter(t => t.width > 0 && t.height > 0);
  return { row: inRem(row.getBoundingClientRect()), width: innerWidth / rem, height: innerHeight / rem, buttons: buttons.map(inRem) };
});

const nextFrameAsync = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

const layoutOf = async (page: Page, action: Locator, layout: Locator): Promise<IRowLayout> => {
  const [mine, theirs, edge, shown] = await Promise.all([boxOf(action), boxOf(layout), rowEndOf(page), rowButtonsOf(page)]);
  return { mine, theirs, edge, shown };
};

const settledLayoutAsync = async (page: Page, action: Locator, layout: Locator): Promise<IRowLayout> => {
  const found: { layout: IRowLayout | null } = { layout: null };
  await expect(async () => {
    const first = await layoutOf(page, action, layout);
    await nextFrameAsync(page);
    const second = await layoutOf(page, action, layout);
    expect(second, "the window row's layout a frame later").toEqual(first);
    found.layout = second;
  }).toPass();
  if (found.layout === null)
    throw new Error("The window row's layout didn't settle.");
  return found.layout;
};

const overlaps = (one: IBox, other: IBox): boolean =>
  one.left < other.right - TOLERANCE_REM && other.left < one.right - TOLERANCE_REM && one.top < other.bottom - TOLERANCE_REM && other.top < one.bottom - TOLERANCE_REM;

const pageTab = (page: Page): Locator => page.getByRole("tab", { name: PAGE_TAB, exact: true });

const runCommandAsync = async (page: Page, title: string): Promise<void> => {
  await page.locator(SEARCH_FIELD).click();
  await page.getByRole("combobox", { name: /^Search / }).fill(`>${title}`);
  await expect(page.locator(SEARCH_PANE).getByRole("option").first()).toContainText(title);
  await page.keyboard.press("Enter");
};

test("the top bar's Browser button stands alone at the row's end, sized and focused like the row's Layout button in light, dark and forced colors, and with its command opens the chat's Browser page or brings it forward, and says why it can't with no chat open",
  async ({ app }, testInfo) => {
    const page = await app.openChatAsync();
    const action = page.locator(ACTION);
    const end = page.locator(END_ACTIONS);
    const row = page.locator("nol-window-row");
    const layout = row.getByRole("button", { name: "Layout", exact: true });
    const settings = row.getByRole("button", { name: "Settings", exact: true });
    await expect(action).toBeEnabled({ timeout: 30_000 });
    await expect(action).toHaveAccessibleName(OFFERED);
    await expect(end.getByRole("button")).toHaveCount(1);
    await expect(row.getByRole("button", { name: "New chat", exact: true })).toHaveCount(0);

    for (const look of LOOKS) {
      await page.emulateMedia({ colorScheme: look.colorScheme, forcedColors: look.forcedColors });
      const [mine, theirs, edge] = await Promise.all([boxOf(action), boxOf(layout), rowEndOf(page)]);
      expectAt(mine.right - mine.left, theirs.right - theirs.left, `${look.name}: the Browser button's width`);
      expectAt(mine.bottom - mine.top, theirs.bottom - theirs.top, `${look.name}: the Browser button's height`);
      expectAt(mine.top, theirs.top, `${look.name}: the Browser button's top`);
      expectAt(mine.right, edge, `${look.name}: the Browser button's right edge against the row's end or its window controls`);
      const unfocused = await focusLookOf(action);
      await page.locator(SEARCH_FIELD).focus();
      await page.keyboard.press("Tab");
      await expect(action).toBeFocused();
      const focused = await focusLookOf(action);
      await settings.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(layout).toBeFocused();
      expect(focused, `${look.name}: the Browser button's focus`).toEqual(await focusLookOf(layout));
      expect(focused, `${look.name}: the Browser button's focus shows`).not.toEqual(unfocused);
      await testInfo.attach(`top-bar-${look.name.replace(" ", "-")}`, { body: await page.screenshot(), contentType: "image/png" });
    }
    await page.emulateMedia({ colorScheme: null, forcedColors: null });

    await action.click();
    await expect(pageTab(page)).toHaveAttribute("aria-selected", "true", { timeout: 60_000 });
    await page.locator("nol-tab[data-tab-key^=\"document/teamrun.conversation/\"]").click();
    await expect(pageTab(page)).toHaveAttribute("aria-selected", "false");
    await runCommandAsync(page, OFFERED);
    await expect(pageTab(page)).toHaveAttribute("aria-selected", "true", { timeout: 60_000 });
    await expect(pageTab(page)).toHaveCount(1);

    const chat = page.locator("nol-tab[data-tab-key^=\"document/teamrun.conversation/\"]");
    await chat.hover();
    await chat.getByRole("button", { name: /^Close / }).click();
    await expect(chat).toHaveCount(0);
    await expect(action).toBeDisabled();
    await expect(action).toHaveAccessibleName(UNAVAILABLE);
    await action.hover();
    await expect(page.locator(".cdk-overlay-container nol-tooltip")).toHaveText(UNAVAILABLE);
    expect(app.unexpectedFailures).toEqual([]);
  });

test("at 200% zoom the top bar's Browser button keeps its place at the row's end and the Layout button's size, inside the window, overlapping no other button of the row, in light, dark and forced colors, and opens the chat's Browser page",
  async ({ app }, testInfo) => {
    const page = await app.openChatAsync();
    const action = page.locator(ACTION);
    const layout = page.locator("nol-window-row").getByRole("button", { name: "Layout", exact: true });
    await expect(action).toBeEnabled({ timeout: 30_000 });
    const width: number = await page.evaluate(() => innerWidth);
    await app.electronApp.evaluate(({ BrowserWindow }) => {
      for (const shown of BrowserWindow.getAllWindows())
        shown.webContents.setZoomFactor(2);
    });
    await expect.poll(() => page.evaluate(() => innerWidth), TeamRunApp.pollOf()).toBeLessThanOrEqual(Math.ceil(width / 2));

    for (const look of LOOKS) {
      await page.emulateMedia({ colorScheme: look.colorScheme, forcedColors: look.forcedColors });
      const { mine, theirs, edge, shown } = await settledLayoutAsync(page, action, layout);
      expectAt(mine.right - mine.left, theirs.right - theirs.left, `${look.name}: the Browser button's width`);
      expectAt(mine.bottom - mine.top, theirs.bottom - theirs.top, `${look.name}: the Browser button's height`);
      expectAt(mine.top, theirs.top, `${look.name}: the Browser button's top`);
      expectAt(mine.right, edge, `${look.name}: the Browser button's right edge against the row's end or its window controls`);
      expect([mine.left >= -TOLERANCE_REM, mine.top >= -TOLERANCE_REM, mine.right <= shown.width + TOLERANCE_REM, mine.bottom <= shown.height + TOLERANCE_REM,
        shown.buttons.filter(t => overlaps(t, mine)).length], `${look.name}: the Browser button inside the window on all four edges, over only itself`).toEqual([true, true, true, true, 1]);
      await testInfo.attach(`top-bar-200-${look.name.replace(" ", "-")}`, { body: await page.screenshot(), contentType: "image/png" });
    }
    await page.emulateMedia({ colorScheme: null, forcedColors: null });

    await action.click();
    await expect(pageTab(page)).toHaveAttribute("aria-selected", "true", { timeout: 60_000 });
    expect(app.unexpectedFailures).toEqual([]);
  });
