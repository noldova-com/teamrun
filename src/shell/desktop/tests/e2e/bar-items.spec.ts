/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("the status bar and the top bar", () => {
  test("the fixture modules' items take their sides, run their commands when clicked and follow their updates", async ({ desktop }) => {
    const window = desktop.window;
    const count = window.locator(".tr-status-bar-left tr-status-bar-item[data-tr-item=\"notes.count\"]");
    const ticks = window.locator(".tr-status-bar-right tr-status-bar-item[data-tr-item=\"clock.ticks\"]");
    const compose = window.locator(".tr-window-row-actions button[data-tr-item=\"notes.compose\"]");
    await expect(count).toHaveText("2 notes");
    await expect(ticks).toHaveText(/No ticks/);
    await expect(compose).toBeEnabled();

    await ticks.getByRole("button").click();
    await expect(ticks).toHaveText(/Ticks: 1/);
    await compose.click();

    await expect(window.locator("tr-tab[data-tab-key=\"document/notes.note/3\"] .tr-tab-label")).toHaveText("Note 3");
    await expect(count).toHaveText("3 notes");
    await expect(count.getByRole("button")).toHaveCount(0);
    await expect(compose).toHaveAttribute("aria-label", "New note");
    await expect(window.locator(".tr-status-bar-right > *")).toHaveCount(2);
    expect(await window.locator(".tr-status-bar-right > *").evaluateAll(t => t.map(u => u.getAttribute("data-tr-item") ?? u.tagName.toLowerCase())))
      .toEqual(["clock.ticks", "tr-module-failures"]);

    const look = await window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => getComputedStyle(document.querySelector(selector) as Element);
      const pill = style("tr-status-bar-item[data-tr-item=\"clock.ticks\"] .tr-status-bar-item");
      const row = document.querySelector("tr-window-row") as Element;
      const action = document.querySelector("button[data-tr-item=\"notes.compose\"]") as Element;
      return {
        pill: { height: style("tr-status-bar-item[data-tr-item=\"clock.ticks\"]").height, padding: [pill.paddingLeft, pill.paddingRight], radius: pill.borderTopLeftRadius },
        row: { height: getComputedStyle(row).height, region: getComputedStyle(action).getPropertyValue("app-region") },
        isInRow: action.getBoundingClientRect().top >= row.getBoundingClientRect().top && action.getBoundingClientRect().bottom <= row.getBoundingClientRect().bottom
      };
    });
    expect(look).toEqual({ pill: { height: "20px", padding: ["6px", "6px"], radius: "3px" }, row: { height: "35px", region: "no-drag" }, isInRow: true });
  });

  test("a module that did not start shows no items, and the failures item stays at the status bar's right end", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("tr-status-bar-item[data-tr-item=\"clock.ticks\"]")).toHaveCount(1);
    const folder = path.join(desktop.dataDirectory, "modules", "clock");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "fail-activation"), "");

    await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);

    await expect(window.locator("tr-module-failures button")).toBeVisible();
    await expect(window.locator("tr-status-bar-item[data-tr-item=\"clock.ticks\"]")).toHaveCount(0);
    await expect(window.locator("tr-status-bar-item[data-tr-item=\"notes.count\"]")).toHaveText("2 notes");
    expect(await window.locator(".tr-status-bar-right > *").evaluateAll(t => t.map(u => u.tagName.toLowerCase()))).toEqual(["tr-module-failures"]);
  });
});
