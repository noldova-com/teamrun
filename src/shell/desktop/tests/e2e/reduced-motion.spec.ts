/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import SettingsFixture from "./fixtures/settings.fixture.ts";

async function findMotionAsync(window: Page): Promise<{ transitions: string[]; animations: string[] }> {
  return await window.evaluate(() => {
    const name = (t: Element): string => [t.tagName.toLowerCase(), ...t.classList].join(".");
    const moving = [...document.querySelectorAll("*")].filter(t => getComputedStyle(t).transitionDuration.split(",").some(u => parseFloat(u) > 0));
    const running = document.getAnimations().filter(t => t.playState === "running");
    return {
      transitions: [...new Set(moving.map(name))].sort(),
      animations: [...new Set(running.map(t => t instanceof CSSAnimation ? t.animationName : "a script animation"))].sort()
    };
  });
}

async function finishStartedAnimationsAsync(window: Page): Promise<void> {
  await window.evaluate(async () => {
    const finite = document.getAnimations().filter(t => t.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.all(finite.map(t => t.finished.catch(() => undefined)));
  });
}

test.describe("reduced motion", () => {
  test("stops every transition and animation in the window, also the spinners, progress bars and working tabs the Gallery shows, which move without it", async ({ desktop }) => {
    const window = desktop.window;
    await SettingsFixture.openGalleryAsync(window);
    await expect(window.locator("tr-gallery tr-tab.tr-tab-working tr-spinner").first()).toBeVisible();
    await expect(window.locator("tr-gallery tr-progress").first()).toBeVisible();

    const moving = await findMotionAsync(window);
    await finishStartedAnimationsAsync(window);
    await window.emulateMedia({ reducedMotion: "reduce" });
    await window.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    const reduced = await findMotionAsync(window);

    expect(moving.animations.map(t => t.replace(/^.*_(?=tr-)/, ""))).toEqual(expect.arrayContaining(["tr-progress-slide", "tr-spinner-turn"]));
    expect(moving.transitions.length).toBeGreaterThan(0);
    expect(reduced).toEqual({ transitions: [], animations: [] });
    await desktop.checkpointAsync("reduced-motion-gallery");
  });
});
