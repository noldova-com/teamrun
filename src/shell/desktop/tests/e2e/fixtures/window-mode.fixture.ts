/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Page, expect } from "@playwright/test";

export type WindowMode = "Light" | "Dark";

export default class WindowModeFixture {
  public static readonly modes: readonly WindowMode[] = ["Light", "Dark"];
  public static readonly backgrounds: Readonly<Record<WindowMode, string>> = { Light: "rgb(248, 248, 248)", Dark: "rgb(24, 24, 24)" };

  public static async setAsync(window: Page, mode: WindowMode): Promise<void> {
    await window.evaluate(value => (Reflect.get(globalThis, "teamrun") as { request(method: string, payload: unknown): Promise<unknown> })
      .request("shell.setSetting", { name: "shell.mode", value }), mode);
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WindowModeFixture.backgrounds[mode]);
  }
}
