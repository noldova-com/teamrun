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
import WindowModeFixture from "./fixtures/window-mode.fixture.ts";

function band(window: Page): Locator {
  return window.locator(".tr-toolbar-band");
}

function toolbar(window: Page, name: string): Locator {
  return window.locator(`tr-toolbar[data-toolbar="${name}"]`);
}

function labelsOf(locator: Locator): Promise<readonly (string | null)[]> {
  return locator.evaluateAll(items => items.map(t => t.getAttribute("aria-label")));
}

function arrangementOf(window: Page): Promise<readonly (readonly (string | undefined)[])[]> {
  return window.locator(".tr-toolbar-row").evaluateAll(rows => rows.map(row => [...row.querySelectorAll<HTMLElement>("tr-toolbar")].map(t => t.dataset["toolbar"])));
}

function place(window: Page, name: string): Locator {
  return window.locator(`.cdk-overlay-container tr-menu[data-place="${name}"]`);
}

async function toolbarsMenuAsync(window: Page): Promise<Locator> {
  await band(window).click({ button: "right", position: { x: 2, y: 2 } });
  const menu = place(window, "shell.toolbars");
  await expect(menu).toBeVisible();
  return menu;
}

async function setShownAsync(window: Page, title: string, isShown: boolean): Promise<void> {
  const menu = await toolbarsMenuAsync(window);
  await expect(menu.getByRole("menuitemcheckbox", { name: title })).toHaveAttribute("aria-checked", String(!isShown));
  await menu.getByRole("menuitemcheckbox", { name: title }).click();
  await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
}

async function moveViaMenuAsync(window: Page, name: string, row: string): Promise<void> {
  await toolbar(window, name).locator(".tr-toolbar-item").first().focus();
  await window.keyboard.press("ContextMenu");
  const menu = place(window, "shell.toolbar");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: row }).click();
  await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
}

async function dragAsync(window: Page, name: string, destination: (rows: readonly DOMRect[]) => { x: number; y: number }): Promise<void> {
  await window.mouse.move(600, 600);
  await expect(window.locator(".cdk-overlay-container tr-tooltip")).toHaveCount(0);
  const grip = await toolbar(window, name).locator(".tr-toolbar-grip").boundingBox();
  if (grip === null)
    throw new Error(`No grip for ${name}.`);
  const rows = await window.locator(".tr-toolbar-row").evaluateAll(t => t.map(u => u.getBoundingClientRect().toJSON() as DOMRect));
  const target = destination(rows);
  await window.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await window.mouse.down();
  await window.mouse.move(grip.x + grip.width / 2 + 12, grip.y + grip.height / 2 + 12, { steps: 3 });
  await window.mouse.move(target.x, target.y, { steps: 8 });
}

function first(rows: readonly DOMRect[]): DOMRect {
  const row = rows[0];
  if (row === undefined)
    throw new Error("No toolbar row.");
  return row;
}

function clippingOf(window: Page): Promise<readonly { name: string | undefined; outside: readonly (string | null)[]; scrolls: boolean; corners: readonly string[] }[]> {
  return window.evaluate(() => {
    const radius = `${Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.25}px`;
    return [...document.querySelectorAll<HTMLElement>("tr-toolbar")].map(bar => {
      const content = bar.querySelector<HTMLElement>(".tr-toolbar-content");
      const box = content?.getBoundingClientRect();
      const items = [...bar.querySelectorAll<HTMLElement>(".tr-toolbar-content .tr-toolbar-item")];
      const last = items.at(-1);
      const style = last === undefined ? null : getComputedStyle(last);
      return {
        name: bar.dataset["toolbar"],
        outside: items.filter(t => {
          const item = t.getBoundingClientRect();
          return box === undefined || item.left < box.left - 0.5 || item.right > box.right + 0.5 || item.top < box.top - 0.5 || item.bottom > box.bottom + 0.5;
        }).map(t => t.getAttribute("aria-label")),
        scrolls: content === null || content.scrollWidth > content.clientWidth,
        corners: style === null ? [] : [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].filter(t => t !== radius)
      };
    });
  });
}

async function runCommandAsync(window: Page, title: string): Promise<void> {
  await CommandSearchFixture.searchAsync(window, title);
  await window.keyboard.press("Enter");
}

test.describe("toolbars", () => {
  test("a module's toolbars stand in rows under the window row, a button high, with their groups apart, each kind of item and nothing clipped", async ({ desktop }) => {
    const window = desktop.window;
    const main = toolbar(window, "notes.main");

    await expect(band(window)).toBeVisible();
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main"], ["notes.second"]]);
    expect(await labelsOf(main.locator(".tr-toolbar-item"))).toEqual(["New note", "New from template", "Week 1", "Week 2", "Sort by week"]);
    expect(await labelsOf(toolbar(window, "notes.second").locator(".tr-toolbar-item"))).toEqual(["Wrap lines"]);
    await expect(main.locator(".tr-toolbar-content > .tr-toolbar-separator[role=separator]")).toHaveCount(2);
    await expect(main.locator("[data-submenu=\"notes.templates\"]")).toHaveAttribute("aria-haspopup", "menu");
    await expect(main.locator("[data-submenu=\"notes.sortChoice\"]")).toHaveAttribute("aria-haspopup", "menu");
    await expect(toolbar(window, "notes.second").getByRole("button", { name: "Wrap lines" })).toHaveAttribute("aria-pressed", "false");
    const measured = await window.evaluate(() => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const rows = [...document.querySelectorAll(".tr-toolbar-row")].map(t => t.getBoundingClientRect());
      const button = document.querySelector(".tr-toolbar-item")?.getBoundingClientRect();
      return { rem, heights: rows.map(t => t.height), button: [button?.width, button?.height] };
    });
    expect(measured.heights).toEqual([measured.rem * 1.5, measured.rem * 1.5]);
    expect(measured.button).toEqual([measured.rem * 1.5, measured.rem * 1.5]);
    expect(await clippingOf(window)).toEqual(["notes.main", "notes.second"].map(name => ({ name, outside: [], scrolls: false, corners: [] })));
    await expect(window.locator(".tr-toolbar-row").first().locator("tr-toolbar").first().locator(".tr-toolbar-grip")).toHaveAttribute("aria-label", "Move toolbar");
    const grips = await window.evaluate(() => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const rows = [...document.querySelectorAll(".tr-toolbar-row")];
      const grip = rows.map(t => t.querySelector(".tr-toolbar-grip")?.getBoundingClientRect());
      const button = rows.map(t => t.querySelector(".tr-toolbar-item")?.getBoundingClientRect());
      const bounds = rows.map(t => t.getBoundingClientRect());
      return {
        rem,
        heights: grip.map(t => t?.height),
        buttons: button.map(t => t?.height),
        tops: grip.map((t, i) => (t?.top ?? 0) - bounds[i]!.top),
        bottoms: grip.map((t, i) => bounds[i]!.bottom - (t?.bottom ?? 0)),
        gap: (grip[1]?.top ?? 0) - (grip[0]?.bottom ?? 0)
      };
    });
    expect(grips.heights).toEqual(grips.buttons);
    expect(grips.tops).toEqual(grips.bottoms);
    expect(grips.gap).toBe(grips.rem * 0.25);
    const dots = await window.evaluate(() => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const grip = document.querySelector(".tr-toolbar-grip")?.getBoundingClientRect();
      const boxes = [...document.querySelectorAll(".tr-toolbar-grip")].slice(0, 1).flatMap(t => [...t.querySelectorAll(".tr-toolbar-dot")].map(u => u.getBoundingClientRect()));
      return {
        rem,
        sizes: boxes.map(t => [t.width, t.height]),
        gaps: boxes.slice(1).map((t, i) => t.top - (boxes[i]?.bottom ?? 0)),
        centres: boxes.slice(1).map((t, i) => (t.top + t.height / 2) - ((boxes[i]?.top ?? 0) + (boxes[i]?.height ?? 0) / 2)),
        above: (boxes[0]?.top ?? 0) - (grip?.top ?? 0),
        below: (grip?.bottom ?? 0) - (boxes.at(-1)?.bottom ?? 0),
        left: (boxes[0]?.left ?? 0) - (grip?.left ?? 0),
        right: (grip?.right ?? 0) - (boxes[0]?.right ?? 0)
      };
    });
    expect(dots.sizes).toEqual([[dots.rem * 0.125, dots.rem * 0.125], [dots.rem * 0.125, dots.rem * 0.125], [dots.rem * 0.125, dots.rem * 0.125]]);
    expect(dots.gaps.map(t => Math.abs(t - dots.rem * 0.2) < 0.5)).toEqual([true, true]);
    expect(dots.centres.map(t => Math.abs(t - dots.rem * 0.325) < 0.5)).toEqual([true, true]);
    expect(Math.abs(dots.above - dots.below)).toBeLessThan(0.5);
    expect(dots.above).toBeGreaterThan(dots.rem * 0.25);
    expect(Math.abs(dots.left - dots.right)).toBeLessThan(0.5);
    await desktop.checkpointAsync("toolbars");
  });

  test("the window row's controls, each toolbar row and the panels stand 0.25rem apart, with two rows, one row and none @smoke", async ({ desktop }) => {
    const window = desktop.window;
    const gapsOf = (): Promise<readonly number[]> => window.evaluate(() => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const row = document.querySelector("tr-window-row") as HTMLElement;
      const controls = [...row.querySelectorAll<HTMLElement>("button")].filter(t => t.checkVisibility({ visibilityProperty: true })).map(t => t.getBoundingClientRect().bottom);
      const bands = [...document.querySelectorAll(".tr-toolbar-row")].map(t => t.getBoundingClientRect());
      const panel = Math.min(...[...document.querySelectorAll("tr-tab-group")].map(t => t.getBoundingClientRect().top));
      const edges = [{ top: Number.NaN, bottom: Math.max(...controls) }, ...bands, { top: panel, bottom: Number.NaN }];
      return edges.slice(1).map((t, index) => Math.round((t.top - (edges[index]?.bottom ?? Number.NaN)) / rem * 1000) / 1000);
    });

    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main"], ["notes.second"]]);
    expect(await gapsOf()).toEqual([0.25, 0.25, 0.25]);
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      await desktop.checkpointAsync(`toolbars-gaps-two-rows-${mode.toLowerCase()}`);
    }
    await WindowModeFixture.setAsync(window, "Light");
    await setShownAsync(window, "Display", false);
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main"]]);
    expect(await gapsOf()).toEqual([0.25, 0.25]);
    await desktop.checkpointAsync("toolbars-gaps-one-row");
    await setShownAsync(window, "Main", false);
    await expect(band(window)).toHaveCount(0);
    expect(await gapsOf()).toEqual([0.25]);
    await desktop.checkpointAsync("toolbars-gaps-no-row");
  });

  test("a button runs its command, a dropdown opens its place, a choice shows and changes the checked row, a toggle shows its state and a dynamic group's rows run", async ({ desktop }) => {
    const window = desktop.window;
    const main = toolbar(window, "notes.main");
    const list = window.locator(".tr-notes-list-items");

    await main.getByRole("button", { name: "New note" }).click();
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
    await main.getByRole("button", { name: "New from template" }).click();
    await place(window, "notes.templates").getByRole("menuitem", { name: "New note" }).click();
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/4\"] .tr-tab-label")).toHaveText("Note 4");
    await main.getByRole("button", { name: "Week 2" }).click();
    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/week-2\"] .tr-tab-label")).toHaveText("Week 2");

    await main.getByRole("button", { name: "Sort by week" }).click();
    const choices = place(window, "notes.sortChoice");
    await expect(choices.getByRole("menuitemradio", { name: "Sort by week" })).toHaveAttribute("aria-checked", "true");
    await choices.getByRole("menuitemradio", { name: "Sort by title" }).click();
    await expect(list).toHaveAttribute("data-sort", "title");
    await expect(main.getByRole("button", { name: "Sort by title" })).toBeVisible();

    const wrap = toolbar(window, "notes.second").getByRole("button", { name: "Wrap lines" });
    await wrap.click();
    await expect(wrap).toHaveAttribute("aria-pressed", "true");
    await expect(list).toHaveClass(/tr-notes-list-wrapped/);
    await wrap.click();
    await expect(wrap).toHaveAttribute("aria-pressed", "false");
  });

  test("the toolbars are one tab stop that the Focus the toolbars command reaches, moved by the arrow keys, Home and End", async ({ desktop }) => {
    const window = desktop.window;
    await expect(toolbar(window, "notes.main").getByRole("button", { name: "New note" })).toBeVisible();

    await runCommandAsync(window, "Focus the toolbars");

    await expect(toolbar(window, "notes.main").getByRole("button", { name: "New note" })).toBeFocused();
    await window.keyboard.press("ArrowRight");
    await expect(toolbar(window, "notes.main").getByRole("button", { name: "New from template" })).toBeFocused();
    await window.keyboard.press("ArrowDown");
    await expect(place(window, "notes.templates")).toBeVisible();
    await window.keyboard.press("Escape");
    await expect.poll(() => window.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("New from template");
    await expect(toolbar(window, "notes.main").getByRole("button", { name: "New from template" })).toBeFocused();
    await window.keyboard.press("End");
    await expect(toolbar(window, "notes.main").getByRole("button", { name: "Sort by week" })).toBeFocused();
    await window.keyboard.press("Home");
    await expect(toolbar(window, "notes.main").getByRole("button", { name: "New note" })).toBeFocused();
    await expect(window.locator(".tr-toolbar-item[tabindex=\"0\"]")).toHaveCount(2);
  });

  test("the band's menu shows and hides each toolbar, a shown one stands where it was declared, and the band goes when none is shown", async ({ desktop }) => {
    const window = desktop.window;
    let menu = await toolbarsMenuAsync(window);
    await expect(menu.getByRole("menuitemcheckbox")).toHaveText([/Main/, /Display/, /Spare/]);
    await expect(menu.getByRole("menuitemcheckbox", { name: "Spare" })).toHaveAttribute("aria-checked", "false");
    await window.keyboard.press("Escape");

    await setShownAsync(window, "Spare", true);
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main", "notes.spare"], ["notes.second"]]);
    await expect.poll(() => labelsOf(toolbar(window, "notes.spare").locator(".tr-toolbar-item"))).toEqual(["Add"]);
    await setShownAsync(window, "Main", false);
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.spare"], ["notes.second"]]);
    await setShownAsync(window, "Display", false);
    await setShownAsync(window, "Spare", false);
    await expect(band(window)).toHaveCount(0);
    await expect(window.locator("tr-toolbar")).toHaveCount(0);

    await runCommandAsync(window, "Reset the layout");

    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main"], ["notes.second"]]);
    menu = await toolbarsMenuAsync(window);
    await expect(menu.getByRole("menuitemcheckbox", { name: "Spare" })).toHaveAttribute("aria-checked", "false");
    await window.keyboard.press("Escape");
  });

  test("View > Toolbars shows and hides a toolbar", async ({ desktop }) => {
    test.skip(process.platform === "darwin", "macOS shows the menus in its own menu bar.");
    const window = desktop.window;
    const toggleAsync = async (title: string, expected: string): Promise<void> => {
      await window.locator("tr-menu-bar").getByRole("menuitem", { name: "View" }).click();
      await window.locator(".cdk-overlay-container tr-menu").getByRole("menuitem", { name: "Toolbars" }).click();
      const menu = place(window, "shell.toolbars");
      await expect(menu.getByRole("menuitemcheckbox", { name: title })).toHaveAttribute("aria-checked", expected);
      await menu.getByRole("menuitemcheckbox", { name: title }).click();
      await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
    };

    await toggleAsync("Spare", "false");
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main", "notes.spare"], ["notes.second"]]);
    await toggleAsync("Main", "true");
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.spare"], ["notes.second"]]);
    await toggleAsync("Main", "false");
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.spare"], ["notes.second", "notes.main"]]);
  });

  test("a toolbar moves without a pointer from the menu its grip opens, and the focus stays on its grip", async ({ desktop }) => {
    const window = desktop.window;
    const grip = toolbar(window, "notes.second").locator(".tr-toolbar-grip");
    await expect(grip).toHaveAttribute("aria-label", "Move toolbar");
    await expect(grip).toHaveAttribute("tabindex", "-1");
    await toolbar(window, "notes.second").locator(".tr-toolbar-item").first().focus();
    await window.keyboard.press("ContextMenu");
    const menu = place(window, "shell.toolbar");
    await expect(menu.getByRole("menuitem")).toHaveText([/Move left/, /Move right/, /Move to the row above/, /Move to the row below/, /Hide toolbar/, /Toolbars/]);
    await expect(menu.getByRole("menuitem", { name: "Move left" })).toHaveAttribute("aria-disabled", "true");
    await expect(menu.getByRole("menuitem", { name: "Move to the row below" })).toHaveAttribute("aria-disabled", "true");
    await window.keyboard.press("Escape");
    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);

    await moveViaMenuAsync(window, "notes.second", "Move to the row above");
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.second", "notes.main"]]);
    await expect(grip).toBeFocused();
    await moveViaMenuAsync(window, "notes.second", "Move right");
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main", "notes.second"]]);
    await moveViaMenuAsync(window, "notes.second", "Move to the row below");
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main"], ["notes.second"]]);
    await toolbar(window, "notes.second").locator(".tr-toolbar-item").first().focus();
    await window.keyboard.press("ContextMenu");
    await place(window, "shell.toolbar").getByRole("menuitem", { name: "Toolbars" }).click();
    await expect(place(window, "shell.toolbars").getByRole("menuitemcheckbox", { name: "Spare" })).toBeVisible();
    await window.keyboard.press("Escape");
    await window.keyboard.press("Escape");
    await expect(window.locator(".cdk-overlay-container tr-menu")).toHaveCount(0);
    await moveViaMenuAsync(window, "notes.second", "Hide toolbar");
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main"]]);
    await expect(toolbar(window, "notes.main").locator(".tr-toolbar-grip")).toBeFocused();
  });

  test("a toolbar dragged by its grip moves within its row, to another row and to a new row, and Escape cancels", async ({ desktop }) => {
    const window = desktop.window;
    await setShownAsync(window, "Spare", true);

    await dragAsync(window, "notes.second", rows => ({ x: first(rows).right - 40, y: first(rows).top + first(rows).height / 2 }));
    await expect(window.locator(".tr-toolbar-drop")).toBeVisible();
    const line = await window.evaluate(() => {
      const drop = document.querySelector(".tr-toolbar-drop")?.getBoundingClientRect();
      const button = document.querySelector(".tr-toolbar-item")?.getBoundingClientRect();
      return { top: (drop?.top ?? 0) - (button?.top ?? 0), height: (drop?.height ?? 0) - (button?.height ?? 0) };
    });
    expect(Math.abs(line.top)).toBeLessThan(0.5);
    expect(Math.abs(line.height)).toBeLessThan(0.5);
    await expect(toolbar(window, "notes.second")).toHaveClass(/tr-toolbar-dragging/);
    await window.keyboard.press("Escape");
    await window.mouse.up();
    await expect(window.locator(".tr-toolbar-drop")).toHaveCount(0);
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main", "notes.spare"], ["notes.second"]]);

    await dragAsync(window, "notes.second", rows => ({ x: first(rows).right - 40, y: first(rows).top + first(rows).height / 2 }));
    await expect(window.locator(".tr-toolbar-drop")).toBeVisible();
    await window.mouse.up();
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main", "notes.spare", "notes.second"]]);

    await dragAsync(window, "notes.spare", rows => ({ x: first(rows).left + 20, y: first(rows).top + 2 }));
    await expect(window.locator(".tr-drop-line-row")).toBeVisible();
    await window.mouse.up();
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.spare"], ["notes.main", "notes.second"]]);
    await desktop.checkpointAsync("toolbars-stacked");

    await dragAsync(window, "notes.main", rows => ({ x: first(rows).left + 8, y: first(rows).top + first(rows).height / 2 }));
    await expect(window.locator(".tr-toolbar-drop")).toBeVisible();
    await window.mouse.up();
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.main", "notes.spare"], ["notes.second"]]);
  });

  test("the arrangement is kept for the window across a reopen, and Reset the layout returns the declared one", async ({ desktop }) => {
    const window = desktop.window;
    await setShownAsync(window, "Spare", true);
    await setShownAsync(window, "Display", false);
    const before = [["notes.main", "notes.spare"]];
    await expect.poll(() => arrangementOf(window)).toEqual(before);

    await desktop.reopenAsync();

    await expect.poll(() => arrangementOf(desktop.window)).toEqual(before);
    await runCommandAsync(desktop.window, "Reset the layout");
    await expect.poll(() => arrangementOf(desktop.window)).toEqual([["notes.main"], ["notes.second"]]);
  });

  test("toolbars sharing a row each keep their grip and a reachable More actions menu in a narrow window, and the row never scrolls sideways", async ({ desktop }) => {
    await expect(toolbar(desktop.window, "notes.main").locator(".tr-toolbar-overflow")).toHaveCount(0);

    await setShownAsync(desktop.window, "Spare", true);
    await moveViaMenuAsync(desktop.window, "notes.second", "Move to the row above");
    await desktop.reopenAsync();
    await desktop.useViewportAsync(400, 700);

    const window = desktop.window;
    await expect.poll(() => arrangementOf(window)).toEqual([["notes.second", "notes.main", "notes.spare"]]);
    expect(await window.evaluate(() => [document.documentElement.scrollWidth <= innerWidth, [...document.querySelectorAll(".tr-toolbar-row")].every(t => t.scrollWidth <= t.clientWidth)])).toEqual([true, true]);
    await expect(window.locator(".tr-toolbar-overflow")).not.toHaveCount(0);
    expect(await clippingOf(window)).toEqual(["notes.second", "notes.main", "notes.spare"].map(name => ({ name, outside: [], scrolls: false, corners: [] })));
    const expected: Readonly<Record<string, readonly string[]>> = {
      "notes.second": ["Wrap lines"],
      "notes.main": ["New from template", "New note", "Sort by week", "Week 1", "Week 2"],
      "notes.spare": ["Add"]
    };
    for (const [name, labels] of Object.entries(expected)) {
      const bar = toolbar(window, name);
      const hasOverflow = await bar.locator(".tr-toolbar-overflow").count() > 0;
      const [box, overflow, grip] = await Promise.all([bar.boundingBox(), hasOverflow ? bar.locator(".tr-toolbar-overflow").boundingBox() : Promise.resolve(null), bar.locator(".tr-toolbar-grip").boundingBox()]);
      const rem = await window.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(grip?.width).toBeGreaterThan(0);
      expect((box?.width ?? 0) + 0.5).toBeGreaterThanOrEqual(rem * 0.3125 + rem * 1.5);
      const shown = await labelsOf(bar.locator(".tr-toolbar-item:not(.tr-toolbar-overflow)"));
      let hidden: readonly (string | null)[] = [];
      if (overflow !== null) {
        expect((overflow.x + overflow.width) - ((box?.x ?? 0) + (box?.width ?? 0))).toBeLessThanOrEqual(0.5);
        expect(overflow.width).toBeGreaterThanOrEqual(rem * 1.5 - 0.5);
        await bar.locator(".tr-toolbar-overflow").click();
        const rows = window.locator(".cdk-overlay-container tr-menu button[tr-menu-item]");
        hidden = await rows.evaluateAll(t => t.map(u => u.querySelector(".tr-menu-item-label")?.textContent ?? null));
        await window.keyboard.press("Escape");
      }
      expect([...shown, ...hidden].sort()).toEqual([...labels].sort());
    }
  });
});
