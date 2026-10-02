/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import OlderRuntimeFixture from "./fixtures/older-runtime.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("data from before the shell", () => {
  test.use({ desktopDataFiles: { "conversations.json": "[]" } });

  test("TeamRun explains the refusal and moves the data aside when asked", async ({ desktop }) => {
    await desktop.useSuiteViewportAsync();
    const window = desktop.window;

    await expect(window.getByRole("heading", { name: "Data from an earlier TeamRun" })).toBeVisible();
    await expect(window.locator("tr-workspace")).toHaveCount(0);
    await desktop.checkpointAsync("pre-shell-refusal");
    await window.getByRole("button", { name: "Move aside" }).click();

    await expect(window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
    const siblings = (await readdir(desktop.root)).filter(t => t !== "data" && t !== "profile" && t !== "device");
    expect(siblings.length).toBe(1);
    expect(existsSync(path.join(desktop.root, siblings[0] ?? "", "conversations.json"))).toBe(true);
    expect(existsSync(path.join(desktop.dataDirectory, "conversations.json"))).toBe(false);
  });
});

test.describe("builds", () => {
  test("a newer build takes over the data directory from an older build's runtime", async ({ desktop }) => {
    await expect(desktop.window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
    const older: OlderRuntimeFixture[] = [];
    try {
      await desktop.restartAsync(async () => {
        older.push(await OlderRuntimeFixture.startAsync(desktop.dataDirectory));
      });

      await expect(desktop.window.locator("tr-empty-window")).toHaveText(/TeamRun\s*No modules/);
      await expect.poll(() => older.every(t => t.hasExited) && older.length === 1).toBe(true);
    }
    finally {
      for (const runtime of older)
        await runtime.disposeAsync();
    }
  });
});

test.describe("requests from the window", () => {
  test("the window asks the runtime for its modules and may not stop it", async ({ desktop }) => {
    await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
    const request = (method: string, payload: unknown): Promise<unknown> =>
      desktop.window.evaluate(([name, value]) => (Reflect.get(globalThis, "teamrun") as { request(method: unknown, payload: unknown): Promise<unknown> }).request(name, value), [method, payload] as const);

    const modules = await request("shell.modules", null) as { payload: { modules: unknown[] } };
    const stop = await request("shell.stop", { policy: "IfIdle" }) as { failure: { code: string } };

    expect(Array.isArray(modules.payload.modules)).toBe(true);
    expect(stop.failure.code).toBe("Unauthorized");
    expect(await desktop.readRuntimeProcessIdAsync()).toBeDefined();
  });
});
