/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Locator, Page } from "@playwright/test";

import { RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import CommandSearchFixture from "./fixtures/command-search.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

const colors = {
  Light: { link: "rgb(0, 95, 184)", error: "rgb(161, 38, 13)", selected: "rgb(228, 230, 241)" },
  Dark: { link: "rgb(77, 170, 252)", error: "rgb(244, 135, 113)", selected: "rgb(55, 55, 61)" }
};

function modulesTab(window: Page): Locator {
  return window.locator("tr-tab[data-tab-key=\"document/shell.modules\"]");
}

function row(window: Page, id: string): Locator {
  return window.locator(`.tr-modules-row[data-module="${id}"]`);
}

function fact(window: Page, name: string): Locator {
  return window.locator(`.tr-modules-fact-${name}`);
}

async function openFromCommandSearchAsync(window: Page): Promise<void> {
  await CommandSearchFixture.searchAsync(window, "Modules");
  await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "shell.openModules");
  await window.keyboard.press("Enter");
  await expect(window.locator("tr-modules")).toBeVisible();
}

async function setModeAsync(window: Page, mode: string): Promise<void> {
  await window.evaluate(value => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> })
    .request("shell.setSetting", { name: "shell.mode", value }), mode);
}

test.describe("the Modules document", () => {
  test("opens from command search as one document, lists the modules in module order and shows a module's details, in light and dark", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();

    await openFromCommandSearchAsync(window);
    await openFromCommandSearchAsync(window);

    await expect(modulesTab(window)).toHaveCount(1);
    await expect(modulesTab(window)).toHaveAttribute("aria-selected", "true");
    await expect(modulesTab(window).locator(".tr-tab-label")).toHaveText("Modules");
    await expect(window.locator(".tr-modules-version")).toHaveText(`TeamRun ${RuntimeBuild.identity.productVersion}`);
    await expect(window.locator(".tr-modules-row .tr-modules-name")).toHaveText(["Clock", "Notes", "Alarm"]);
    await expect(window.locator(".tr-modules-row .tr-modules-id")).toHaveText(["clock", "notes", "alarm"]);
    await expect(window.locator(".tr-modules-row .tr-modules-state")).toHaveText(["Active", "Active", "Active"]);
    await expect(row(window, "alarm").locator(".tr-modules-description")).toHaveText("Depends on the clock, so it is blocked whenever the clock fails, for the UI workflows.");
    await expect(row(window, "clock")).toHaveAttribute("aria-current", "true");
    await expect(window.locator(".tr-modules-detail-title")).toHaveText("Clock");
    await expect(fact(window, "dependencies")).toHaveText("None");
    await expect(fact(window, "dependents")).toHaveText("Alarm");
    await expect(window.locator(".tr-modules-contributions")).toHaveCount(5);
    await expect(window.locator(".tr-modules-contributions[data-kind=commands]")).toContainText("clock.tick");
    await expect(window.locator(".tr-modules-contributions[data-kind=settings]")).toContainText("clock.tickStep");

    await fact(window, "dependents").getByRole("button", { name: "Alarm" }).click();

    await expect(row(window, "alarm")).toBeFocused();
    await expect(row(window, "alarm")).toHaveAttribute("aria-current", "true");
    await expect(fact(window, "dependencies")).toHaveText("Clock");
    await expect(window.locator(".tr-modules-none").last()).toHaveText("No commands, settings, menus, views or notification kinds.");

    await row(window, "clock").click();
    for (const mode of ["Light", "Dark"] as const) {
      await setModeAsync(window, mode);
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(mode.toLowerCase());
      const look = await window.evaluate(() => {
        const style = (selector: string): CSSStyleDeclaration => getComputedStyle(document.querySelector(selector) as Element);
        return [style(".tr-modules-link").color, style(".tr-modules-row-current").backgroundColor];
      });
      expect(look).toEqual([colors[mode].link, colors[mode].selected]);
      await desktop.checkpointAsync(`modules-document-${mode.toLowerCase()}`);
    }
  });

  test("follows a module that stops starting while open, showing its cause and the module it blocks", async ({ desktop }) => {
    const window = desktop.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await openFromCommandSearchAsync(window);
    await row(window, "alarm").click();
    await expect(row(window, "alarm")).toBeFocused();

    const folder = path.join(desktop.dataDirectory, "modules", "clock");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "fail-activation"), "");
    await DesktopApplicationFixture.stopRuntimeAsync(desktop.dataDirectory);

    await expect(window.locator(".tr-modules-row .tr-modules-state")).toHaveText([/Failed/, "Active", /Blocked/]);
    await expect(row(window, "alarm")).toHaveAttribute("aria-current", "true");
    await expect(window.locator(".tr-modules-detail-title")).toHaveText("Alarm");
    await expect(fact(window, "state")).toHaveText(/Blocked\s*It depends on clock, which is not active\./);
    await expect(fact(window, "blocker")).toHaveText("Clock");
    const icon = await row(window, "alarm").locator(".tr-modules-state-icon").evaluate(t => [t.textContent, getComputedStyle(t).color]);
    const isDark = await window.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
    expect(icon).toEqual(["error", (isDark ? colors.Dark : colors.Light).error]);
    const heads = await window.locator(".tr-modules-row-head").evaluateAll(t => t.map(u => u.getBoundingClientRect().height));
    expect(Math.max(...heads) - Math.min(...heads)).toBeLessThanOrEqual(1);
    const [label = 0, cause = 0] = await fact(window, "state").evaluate(t => [".tr-modules-state-label", ".tr-modules-cause"].map(u => (t.querySelector(u) as Element).getBoundingClientRect().bottom));
    expect(Math.abs(label - cause)).toBeLessThanOrEqual(1);

    await fact(window, "blocker").getByRole("button", { name: "Clock" }).click();

    await expect(row(window, "clock")).toBeFocused();
    await expect(fact(window, "state")).toHaveText(/Failed\s*Its runtime part failed to activate\./);
    await expect(fact(window, "dependents")).toHaveText("Alarm");
    await desktop.checkpointAsync("modules-document-failed");
  });
});

test.describe("the Modules document from the View menu on Windows and Linux", () => {
  test.skip(process.platform === "darwin", "macOS shows the menus in its own menu bar.");

  test("Modules… in the View menu opens the document", async ({ desktop }) => {
    const window = desktop.window;

    await window.locator("tr-menu-bar").getByRole("menuitem", { name: "View" }).click();
    await window.locator(".cdk-overlay-container tr-menu.tr-place-menu").last().getByRole("menuitem", { name: "Modules…" }).click();

    await expect(window.locator("tr-modules")).toBeVisible();
    await expect(modulesTab(window)).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("the Modules document from the View menu on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux show the menus in the window row.");

  test("Modules… in the application's View menu opens the document", async ({ desktop }) => {
    const item = (): Promise<readonly [string, boolean] | null> => desktop.application.evaluate(({ Menu }) => {
      const found = Menu.getApplicationMenu()?.getMenuItemById("shell.view/shell.modules/0");
      return found ? [found.label, found.enabled] as const : null;
    });

    await expect.poll(item).toEqual(["Modules…", true]);
    await desktop.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("shell.view/shell.modules/0")?.click());

    await expect(desktop.window.locator("tr-modules")).toBeVisible();
    await expect(modulesTab(desktop.window)).toHaveAttribute("aria-selected", "true");
  });
});
