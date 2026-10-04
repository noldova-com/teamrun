/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Page, expect } from "@playwright/test";

export default class CommandSearchFixture {
  private static readonly KEY: string = "ControlOrMeta+Shift+KeyP";
  private static readonly FIELD: string = "Search commands";

  public static async searchAsync(window: Page, text: string): Promise<void> {
    await window.keyboard.press(CommandSearchFixture.KEY);
    await expect(window.getByRole("combobox", { name: CommandSearchFixture.FIELD })).toBeFocused();
    await window.keyboard.type(text);
  }
}
