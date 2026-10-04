/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const colors = {
  light: { error: "rgb(161, 38, 13)", raised: "rgb(248, 248, 248)", cardBorder: "rgb(229, 229, 229)" },
  dark: { error: "rgb(244, 135, 113)", raised: "rgb(43, 43, 43)", cardBorder: "rgb(37, 37, 38)" }
};

const tab = (desktop: DesktopApplicationFixture, key: string): ReturnType<DesktopApplicationFixture["window"]["locator"]> =>
  desktop.window.locator(`tr-tab[data-tab-key="${key}"]`);

const readKeptLayoutAsync = async (desktop: DesktopApplicationFixture): Promise<string> =>
  JSON.stringify(await desktop.window.evaluate(() => (Reflect.get(globalThis, "teamrun") as { readLayout(): Promise<unknown> }).readLayout()));

const failClockAsync = async (desktop: DesktopApplicationFixture): Promise<void> => {
  const folder = path.join(desktop.dataDirectory, "modules", "clock");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "fail-activation"), "");
  await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);
  await expect(desktop.window.locator("tr-module-failures button")).toBeVisible();
};

test.describe("modules", () => {
  test("the fixture modules' views and documents take their places and show their content", async ({ desktop }) => {
    const window = desktop.window;

    await expect(window.locator("tr-tab-group[data-side=Left] .tr-tab-label")).toHaveText(["Notes", "Outline"]);
    await expect(window.locator("tr-tab-group[data-side=Right] .tr-tab-label")).toHaveText(["Clock"]);
    await expect(tab(desktop, "document/notes.note/1").locator(".tr-tab-label")).toHaveText("Note 1");
    await expect(tab(desktop, "document/notes.note/2").locator(".tr-tab-label")).toHaveText("Note 2");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
    await expect(window.locator("[data-fixture-content=notes-note-2]")).toHaveText("Note 2");
    await expect(window.locator("tr-empty-window")).toHaveCount(0);
    await expect(window.locator("tr-module-failures button")).toHaveCount(0);

    await tab(desktop, "view/notes.outline").click();
    await tab(desktop, "document/notes.note/1").click();

    await expect(window.locator("[data-fixture-content=notes-outline]")).toBeVisible();
    await expect(window.locator("[data-fixture-content=notes-note-1]")).toHaveText("Note 1");
    await desktop.checkpointAsync("modules");
  });

  test("the clock's window part asks its runtime part for the time", async ({ desktop }) => {
    await expect(desktop.window.locator("[data-fixture-content=clock-face]")).toHaveText(/^The runtime's time is \d{4}-\d\d-\d\dT/);
  });

  test("a module that didn't start keeps its view's place, says why in the status bar and its view, and offers its details", async ({ desktop }) => {
    await expect(desktop.window.locator("[data-fixture-content=clock-face]")).toBeVisible();

    await tab(desktop, "view/notes.outline").click();
    await failClockAsync(desktop);
    const window = desktop.window;
    const item = window.locator("tr-module-failures button.tr-module-failures-item");
    await expect.poll(() => readKeptLayoutAsync(desktop)).toContain(JSON.stringify({ tabs: [{ view: "notes.list" }, { view: "notes.outline" }], active: 1 }));

    await expect(item).toHaveText(/error\s*2 modules didn't start/);
    await expect(window.locator("tr-tab-group[data-side=Right] .tr-tab-label")).toHaveText(["Clock"]);
    await expect(tab(desktop, "view/clock.face").locator(".tr-tab-icon")).toHaveText("error");
    await expect(window.locator("tr-module-failure-card")).toHaveText(/Clock didn't start\s*Its runtime part failed to activate\./);
    await expect(window.locator("tr-tab-group[data-side=Left] .tr-tab-label")).toHaveText(["Notes", "Outline"]);

    const look = await window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => getComputedStyle(document.querySelector(selector) as Element);
      const item = style(".tr-module-failures-item");
      const card = style(".tr-module-failure-card");
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        item: { height: item.height, padding: [item.paddingLeft, item.paddingRight], radius: item.borderTopLeftRadius, background: item.backgroundColor, color: item.color, isRight: (document.querySelector("tr-module-failures") as Element).closest(".tr-status-bar-right") !== null },
        icon: { color: style(".tr-module-failures-icon").color, size: style(".tr-module-failures-icon").fontSize },
        card: { border: card.borderTopWidth, borderColor: card.borderTopColor, radius: card.borderTopLeftRadius, background: card.backgroundColor, padding: card.paddingTop },
        cardIcon: style(".tr-module-failure-card-icon").color,
        barColor: style("tr-status-bar").color
      };
    });
    const palette = look.isDark ? colors.dark : colors.light;
    expect(look.item).toEqual({ height: "20px", padding: ["6px", "6px"], radius: "3px", background: "rgba(0, 0, 0, 0)", color: look.barColor, isRight: true });
    expect(look.icon).toEqual({ color: palette.error, size: "16px" });
    expect(look.card).toEqual({ border: "1px", borderColor: palette.cardBorder, radius: "6px", background: palette.raised, padding: "12px" });
    expect(look.cardIcon).toBe(palette.error);

    await item.click();
    const detail = window.locator("tr-modules .tr-modules-detail");
    await expect(window.locator("tr-modules")).toBeVisible();
    await expect(window.locator("tr-modules [aria-current=true]")).toHaveAttribute("data-module", "clock");
    await expect(detail.locator(".tr-modules-detail-title")).toHaveText("Clock");
    await expect(detail.locator(".tr-modules-fact-state")).toHaveText(/Failed\s*Its runtime part failed to activate\./);
    await desktop.checkpointAsync("module-failures");

    await detail.getByRole("button", { name: "Copy details" }).click();
    await expect(detail.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await desktop.application.evaluate(({ clipboard }) => clipboard.readText())).toBe(
      `TeamRun ${RuntimeBuild.identity.productVersion}, build ${RuntimeBuild.identity.fingerprint}\nclock: Failed: Its runtime part failed to activate.`);

    await desktop.application.evaluate(({ shell }) => {
      shell.openPath = (folder: string): Promise<string> => Promise.resolve(folder.endsWith("logs") ? "" : "unexpected folder");
    });
    await detail.getByRole("button", { name: "Open log folder" }).click();
    await expect.poll(() => existsSync(path.join(desktop.dataDirectory, "logs"))).toBe(true);
    await expect(detail.getByRole("status")).toHaveCount(0);

    await window.locator("tr-modules .tr-modules-row[data-module=notes]").click();
    await expect(detail.getByRole("button", { name: "Copy details" })).toHaveCount(0);
  });

  test("a module that didn't start when the runtime started again keeps the place it was moved to", async ({ desktop }) => {
    await expect(desktop.window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await tab(desktop, "view/clock.face").dragTo(desktop.window.locator("tr-tab-group[data-side=Left] .tr-tab-group-strip"));
    await expect(desktop.window.locator("tr-tab-group[data-side=Left] .tr-tab-label")).toHaveText(["Notes", "Outline", "Clock"]);

    await failClockAsync(desktop);

    await expect(desktop.window.locator("tr-tab-group[data-side=Left] .tr-tab-label")).toHaveText(["Notes", "Outline", "Clock"]);
    await expect(desktop.window.locator("tr-tab-group[data-side=Right]")).toHaveCount(0);
    await tab(desktop, "view/clock.face").click();
    await expect(desktop.window.locator("tr-module-failure-card")).toHaveText(/Clock didn't start/);
  });
});
