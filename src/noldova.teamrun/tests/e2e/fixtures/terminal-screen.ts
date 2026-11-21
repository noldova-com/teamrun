/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Locator, type Page, expect } from "playwright/test";

import { TeamRunApp } from "./teamrun-app.fixture.ts";

export class TerminalScreen {
  public static readonly PROMPT_END: RegExp = /[$#%>]$/u;
  private static readonly ECHO_TIMEOUT: number = 5_000;
  private static readonly SPACES: RegExp = /\s/gu;

  public static async rowsAsync(screen: Locator): Promise<readonly string[]> {
    return (await screen.innerText()).split("\n").map(t => t.trimEnd()).filter(t => t !== "");
  }

  public static async isAtPromptAsync(screen: Locator): Promise<boolean> {
    return TerminalScreen.PROMPT_END.test((await TerminalScreen.rowsAsync(screen)).at(-1) ?? "");
  }

  public static async expectPromptAsync(screen: Locator): Promise<void> {
    await expect.poll(() => TerminalScreen.isAtPromptAsync(screen), { ...TeamRunApp.pollOf(30_000), message: "the shell shows its prompt" }).toBe(true);
  }

  public static async enterAsync(page: Page, screen: Locator, command: string): Promise<void> {
    await TerminalScreen.expectPromptAsync(screen);
    await page.keyboard.type(command);
    if (!await TerminalScreen.isEchoedAsync(screen, command))
      throw new Error(`The shell didn't echo the whole command: ${command}\nThe terminal shows:\n${await screen.innerText()}`);
    await page.keyboard.press("Enter");
  }

  private static async isEchoedAsync(screen: Locator, command: string): Promise<boolean> {
    const typed = command.replace(TerminalScreen.SPACES, "");
    const echoed = async (): Promise<boolean> => (await TerminalScreen.rowsAsync(screen)).join("").replace(TerminalScreen.SPACES, "").includes(typed);
    try {
      await expect.poll(echoed, { ...TeamRunApp.pollOf(TerminalScreen.ECHO_TIMEOUT), message: "the shell echoes the whole command" }).toBe(true);
      return true;
    }
    catch {
      return false;
    }
  }
}
