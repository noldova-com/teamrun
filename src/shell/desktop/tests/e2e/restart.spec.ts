/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.use({ desktopVariant: BuildVariantFixture.noModules });

test.describe("restarting", () => {
  test.use({ desktopEnvironment: { TEAMRUN_UI_PROBE: "restart" } });

  test("TeamRun opens again on the same profile and environment after a clean close @smoke", async ({ desktop }) => {
    const readLaunch = (): Promise<readonly string[]> => desktop.application.evaluate(({ app }) => [app.getPath("userData"), process.env["TEAMRUN_UI_PROBE"] ?? ""]);
    const before = await readLaunch();

    await desktop.restartAsync();

    expect(await readLaunch()).toEqual(before);
    expect(before[1]).toBe("restart");
    await expect(desktop.window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
    await desktop.checkpointAsync("restart-reopened");
  });

  test("TeamRun quit and reopened stops its idle runtime as it quits and starts a new one @smoke", async ({ desktop }) => {
    const runtime = await desktop.readRuntimeProcessIdAsync();

    await desktop.reopenAsync();

    expect(desktop.closeMilliseconds, "the close finishes without waiting for the runtime to exit").toBeLessThan(10_000);
    expect(runtime).toBeDefined();
    await expect.poll(() => DesktopApplicationFixture.isAlive(runtime ?? 0), { timeout: 30_000 }).toBe(false);
    expect(await desktop.readRuntimeProcessIdAsync()).not.toBe(runtime);
    await expect(desktop.window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
  });
});
