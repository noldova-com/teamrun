/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("module data", () => {
  const recordAsync = async (desktop: DesktopApplicationFixture): Promise<number> => {
    const answer = await desktop.window.evaluate(() => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> }).request("clock.record", null));
    return (answer as { payload: { readings: number } }).payload.readings;
  };

  test("a module's own database keeps its records across a restart of TeamRun and its runtime", async ({ desktop }) => {
    await expect(desktop.window.locator("[data-fixture-content=clock-face]")).toBeVisible();

    const before = await recordAsync(desktop);
    await desktop.restartAsync();
    await expect(desktop.window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    const after = await recordAsync(desktop);

    expect([before, after]).toEqual([1, 2]);
    expect(existsSync(path.join(desktop.dataDirectory, "modules", "clock", "clock.sqlite"))).toBe(true);
    await desktop.checkpointAsync("module-data-restarted");
  });
});
