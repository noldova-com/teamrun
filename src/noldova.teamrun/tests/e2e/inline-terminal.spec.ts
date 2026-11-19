/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { type Locator, type Page, expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";
import { TerminalScreen } from "./fixtures/terminal-screen.ts";

interface IBlockLanguage {
  readonly language: string;
  readonly write: (file: string) => string;
  readonly type: (file: string) => string;
  readonly compute: (file: string) => string;
}

const BASH: IBlockLanguage = {
  language: "bash",
  write: file => `echo $$ > '${file.replaceAll("\\", "/")}'`,
  type: file => `echo typed > '${file.replaceAll("\\", "/")}'`,
  compute: file => `echo typed-$((6*7)) > '${file.replaceAll("\\", "/")}'`
};
const POWERSHELL: IBlockLanguage = {
  language: "powershell",
  write: file => `Set-Content -LiteralPath '${file}' -Value $PID`,
  type: file => `Set-Content -LiteralPath '${file}' -Value typed`,
  compute: file => `Set-Content -LiteralPath '${file}' -Value ("typed-" + 42)`
};
const COMPUTED: string = "typed-42";
const BASH_PROFILES: readonly string[] = [".bash_profile", ".bashrc"];
const PLAIN_PROMPT: string = "PS1='$ '\n";
const TYPED: string = "typed";
const LANGUAGES: readonly IBlockLanguage[] = process.platform === "win32" ? [BASH, POWERSHELL] : [BASH];
const EDGE_TOLERANCE: number = 1;
const MINIMUM_ROWS: number = 8;
const TERMINAL_INSET: number = 12;
const PROMPT_WINDOW: { readonly width: number; readonly height: number } = { width: 1440, height: 900 };
const SHORT_WINDOW: { readonly width: number; readonly height: number } = { width: 640, height: 720 };
const SHOWN_COMMAND: string = "echo shown-$((6*7))";
const SHOWN_OUTPUT: string = "shown-42";
const TERMINAL_ECHO_SETTLE_MS: number = 1_000;

interface IBox {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly height: number;
}

const focusOf = (): { readonly window: boolean; readonly input: boolean; readonly active: string } => {
  const active = document.activeElement;
  const path: string[] = [];
  for (let element = active; element !== null && path.length < 6; element = element.parentElement)
    path.push(`${element.tagName.toLowerCase()}.${element.classList[0] ?? ""}`);
  return {
    window: document.hasFocus(),
    input: active?.matches("nol-teamrun-inline-terminal nol-terminal-pane .xterm-helper-textarea") === true,
    active: path.join(" < ")
  };
};

const readTyped = (file: string): string => {
  try {
    return readFileSync(file, "utf8").trim();
  }
  catch {
    return "";
  }
};

const shownUnlessWrittenAsync = async (page: Page, file: string, expected: string): Promise<readonly string[]> =>
  readTyped(file) === expected ? [] : [`${path.basename(file)}: "${readTyped(file)}"`, ...await TerminalScreen.rowsAsync(page.locator("nol-teamrun-inline-terminal .xterm-rows"))];

const shownUnlessAtPromptAsync = async (page: Page, text: string): Promise<readonly string[]> => {
  const shown = await TerminalScreen.rowsAsync(page.locator("nol-teamrun-inline-terminal .xterm-rows"));
  return shown.slice(0, -1).join("").includes(text) && TerminalScreen.PROMPT_END.test(shown.at(-1) ?? "") ? [] : shown;
};

const settledAtPromptAsync = async (page: Page, text: string): Promise<void> => {
  await expect.poll(() => shownUnlessAtPromptAsync(page, text), { ...TeamRunApp.pollOf(30_000), message: `the screen shows ${text} above the next prompt` }).toEqual([]);
  await page.waitForTimeout(TERMINAL_ECHO_SETTLE_MS);
};

const boxFrom = (box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): IBox =>
  ({ top: box.y, bottom: box.y + box.height, left: box.x, right: box.x + box.width, height: box.height });

const boxOrNullAsync = async (locator: Locator): Promise<IBox | null> => {
  if (await locator.count() !== 1)
    return null;
  const box = await locator.boundingBox();
  return box === null ? null : boxFrom(box);
};

const hostsOf = (): string => JSON.stringify({
  matched: document.querySelectorAll("nol-teamrun-inline-terminal:has(.live > *)").length,
  hosts: [...document.querySelectorAll("nol-teamrun-inline-terminal")].map(t => ({ isConnected: t.isConnected, live: t.querySelector(".live")?.childElementCount ?? 0 }))
});

const boxOf = async (locator: Locator): Promise<IBox> => {
  const box = await locator.boundingBox();
  if (box === null)
    throw new Error("The element has no box.");
  return boxFrom(box);
};

for (const { language, write, compute } of LANGUAGES)
  test(`Run on a reply's ${language} block shows the chat's terminal inline under it, across its width, and the next Run, clicked after the person typed a command into it, moves the same shell under its own block, leaving the earlier Run's output under its block`,
    async ({ app }, testInfo) => {
      const page = await app.openChatAsync();
      await page.setViewportSize(PROMPT_WINDOW);
      const first = app.pidFile(`${language}-first`);
      const second = app.pidFile(`${language}-second`);
      await app.sendAsync(`${CodexDouble.REPLY_PREFIX}First:\n\n\`\`\`${language}\n${write(first)}\n\`\`\`\n\nThen:\n\n\`\`\`${language}\n${write(second)}\n\`\`\``);
      const runs = page.getByRole("button", { name: new RegExp(`^Run ${language} command`) });
      await expect(runs).toHaveCount(2, { timeout: 60_000 });
      const blocks = runs.locator("xpath=ancestor::nol-code-block");
      const inline = page.locator("nol-teamrun-inline-terminal:has(.live > *)");
      const kept = page.locator("nol-teamrun-inline-terminal nol-code-block.output");

      await runs.nth(1).click();
      await expect(inline).toHaveCount(1, { timeout: 30_000 });
      await expect.poll(() => TeamRunApp.readPid(second), TeamRunApp.pollOf(60_000)).not.toBeNull();
      await expect(runs.nth(1)).toHaveAccessibleName(`Run ${language} command again`, { timeout: 30_000 });
      await expect(runs.nth(0)).toHaveAccessibleName(`Run ${language} command`);
      await expect.poll(() => page.evaluate(focusOf), TeamRunApp.pollOf(30_000)).toEqual(expect.objectContaining({ window: true, input: true }));
      const underSecond = await boxOf(inline);
      const secondBlock = await boxOf(blocks.nth(1));
      const history = await boxOf(page.locator(".nol-virtual-list-viewport").first());
      const rowHeight = (await boxOf(page.locator("nol-teamrun-inline-terminal .xterm-rows > div").first())).height;
      await testInfo.attach(`${language}-under-second`, { body: await page.screenshot(), contentType: "image/png" });

      expect(underSecond.top).toBeGreaterThanOrEqual(secondBlock.bottom - EDGE_TOLERANCE);
      expect(Math.abs(underSecond.left - secondBlock.left)).toBeLessThanOrEqual(EDGE_TOLERANCE);
      expect(Math.abs(underSecond.right - secondBlock.right)).toBeLessThanOrEqual(EDGE_TOLERANCE);
      expect(underSecond.height).toBeGreaterThan(0);
      expect(underSecond.height).toBeLessThanOrEqual(Math.min(history.height, Math.max(history.height / 2, MINIMUM_ROWS * rowHeight) + TERMINAL_INSET) + EDGE_TOLERANCE);

      const computed = app.pidFile(`${language}-computed`);
      await page.keyboard.type(compute(computed));
      await page.keyboard.press("Enter");
      await expect.poll(() => shownUnlessWrittenAsync(page, computed, COMPUTED), { ...TeamRunApp.pollOf(30_000), message: "the typed command writes its file" }).toEqual([]);
      await settledAtPromptAsync(page, path.basename(computed));
      await runs.nth(0).click();
      await expect.poll(() => TeamRunApp.readPid(first), TeamRunApp.pollOf(60_000)).not.toBeNull();
      const isAboveSecondAsync = async (): Promise<boolean> => {
        const moved = await boxOrNullAsync(inline);
        const block = await boxOrNullAsync(blocks.nth(1));
        return moved !== null && block !== null && moved.bottom <= block.top + EDGE_TOLERANCE;
      };
      await expect.poll(isAboveSecondAsync, TeamRunApp.pollOf(30_000)).toBe(true).catch(async (error: unknown) => {
        await testInfo.attach(`${language}-inline-hosts`, { body: await page.evaluate(hostsOf), contentType: "text/plain" });
        throw error;
      });
      const underFirst = await boxOf(inline);
      const firstBlock = await boxOf(blocks.nth(0));
      await testInfo.attach(`${language}-under-first`, { body: await page.screenshot(), contentType: "image/png" });

      await expect(kept).toHaveCount(1, { timeout: 30_000 });
      const keptBox = await boxOf(kept);
      const secondBlockAfter = await boxOf(blocks.nth(1));

      expect([await inline.count(), TeamRunApp.readPid(first)]).toEqual([1, TeamRunApp.readPid(second)]);
      expect(keptBox.top).toBeGreaterThanOrEqual(secondBlockAfter.bottom - EDGE_TOLERANCE);
      expect(Math.abs(keptBox.left - secondBlockAfter.left)).toBeLessThanOrEqual(EDGE_TOLERANCE);
      expect(Math.abs(keptBox.right - secondBlockAfter.right)).toBeLessThanOrEqual(EDGE_TOLERANCE);
      expect(underFirst.top).toBeGreaterThanOrEqual(firstBlock.bottom - EDGE_TOLERANCE);
      expect(Math.abs(underFirst.left - firstBlock.left)).toBeLessThanOrEqual(EDGE_TOLERANCE);
      expect(Math.abs(underFirst.right - firstBlock.right)).toBeLessThanOrEqual(EDGE_TOLERANCE);
    });

for (const { language, write, type } of LANGUAGES)
  test(`every key typed into the inline terminal after a Run on a reply's ${language} block reaches the shell, from the first`, async ({ app }) => {
    const page = await app.openChatAsync();
    for (const profile of BASH_PROFILES)
      writeFileSync(path.join(app.home, profile), PLAIN_PROMPT);
    await page.setViewportSize({ width: 1440, height: 900 });
    const first = app.pidFile(`${language}-first`);
    const second = app.pidFile(`${language}-second`);
    const typed = app.pidFile(`${language}-typed`);
    await app.sendAsync(`${CodexDouble.REPLY_PREFIX}First:\n\n\`\`\`${language}\n${write(first)}\n\`\`\`\n\nThen:\n\n\`\`\`${language}\n${write(second)}\n\`\`\``);
    const runs = page.getByRole("button", { name: new RegExp(`^Run ${language} command`) });
    await expect(runs).toHaveCount(2, { timeout: 60_000 });

    await runs.nth(1).click();
    await expect.poll(() => TeamRunApp.readPid(second), TeamRunApp.pollOf(60_000)).not.toBeNull();
    await expect(runs.nth(1)).toHaveAccessibleName(`Run ${language} command again`, { timeout: 30_000 });
    await expect.poll(() => page.evaluate(focusOf), TeamRunApp.pollOf(30_000)).toEqual(expect.objectContaining({ window: true, input: true }));
    const screen = page.locator("nol-teamrun-inline-terminal .xterm-rows");
    await TerminalScreen.expectPromptAsync(screen);
    await page.keyboard.type(type(typed));
    await page.keyboard.press("Enter");

    await expect.poll(() => shownUnlessWrittenAsync(page, typed, TYPED), { ...TeamRunApp.pollOf(30_000), message: "the typed command writes its file" }).toEqual([]);
  });

for (const { language, write, type } of LANGUAGES)
  test(`a key typed into the inline terminal after the window is resized at the ${language} shell's prompt reaches the shell`, async ({ app }) => {
    const page = await app.openChatAsync();
    for (const profile of BASH_PROFILES)
      writeFileSync(path.join(app.home, profile), PLAIN_PROMPT);
    await page.setViewportSize({ width: 1440, height: 900 });
    const first = app.pidFile(`${language}-first`);
    const second = app.pidFile(`${language}-second`);
    const typed = app.pidFile(`${language}-typed`);
    await app.sendAsync(`${CodexDouble.REPLY_PREFIX}First:\n\n\`\`\`${language}\n${write(first)}\n\`\`\`\n\nThen:\n\n\`\`\`${language}\n${write(second)}\n\`\`\``);
    const runs = page.getByRole("button", { name: new RegExp(`^Run ${language} command`) });
    await expect(runs).toHaveCount(2, { timeout: 60_000 });
    await runs.nth(1).click();
    await expect.poll(() => TeamRunApp.readPid(second), TeamRunApp.pollOf(60_000)).not.toBeNull();
    await expect.poll(() => page.evaluate(focusOf), TeamRunApp.pollOf(30_000)).toEqual(expect.objectContaining({ window: true, input: true }));
    const screen = page.locator("nol-teamrun-inline-terminal .xterm-rows");
    const lines = (): Promise<readonly string[]> => TerminalScreen.rowsAsync(screen);
    const command = language === "bash" ? "true" : "$null";
    const ranAtPrompt = async (): Promise<boolean> => {
      const shown = await lines();
      return shown.slice(-3, -1).some(t => t.endsWith(command)) && TerminalScreen.PROMPT_END.test(shown.at(-1) ?? "");
    };
    await TerminalScreen.expectPromptAsync(screen);
    await page.keyboard.type(command);
    await page.keyboard.press("Enter");
    await expect.poll(ranAtPrompt, TeamRunApp.pollOf(30_000)).toBe(true);
    const terminal = page.locator("nol-teamrun-inline-terminal nol-terminal-pane").last();
    const widthOf = async (): Promise<number> => {
      const box = await boxOf(terminal);
      return box.right - box.left;
    };
    const wide = await widthOf();

    await page.setViewportSize({ width: 1100, height: 900 });
    await expect.poll(widthOf, TeamRunApp.pollOf(30_000)).toBeLessThan(wide);
    await TerminalScreen.expectPromptAsync(screen);
    await page.keyboard.type(type(typed));
    await page.keyboard.press("Enter");

    await expect.poll(() => shownUnlessWrittenAsync(page, typed, TYPED), { ...TeamRunApp.pollOf(30_000), message: "the typed command writes its file" }).toEqual([]);
  });

test("on a short history the inline terminal holds more than half of it, showing the command typed at the prompt and its output above the next prompt, and never runs past the history",
  async ({ app }, testInfo) => {
    const page = await app.openChatAsync();
    await page.setViewportSize(SHORT_WINDOW);
    const ran = app.pidFile("short-ran");
    await app.sendAsync(`${CodexDouble.REPLY_PREFIX}Run:\n\n\`\`\`bash\n${BASH.write(ran)}\n\`\`\``);
    const run = page.getByRole("button", { name: /^Run bash command/u });
    await expect(run).toHaveCount(1, { timeout: 60_000 });
    await run.click();
    await expect.poll(() => TeamRunApp.readPid(ran), TeamRunApp.pollOf(60_000)).not.toBeNull();
    await expect.poll(() => page.evaluate(focusOf), TeamRunApp.pollOf(30_000)).toEqual(expect.objectContaining({ window: true, input: true }));
    const screen = page.locator("nol-teamrun-inline-terminal .xterm-rows");
    await TerminalScreen.expectPromptAsync(screen);
    await page.keyboard.type(SHOWN_COMMAND);
    await page.keyboard.press("Enter");
    const shownWithOutput = async (): Promise<readonly string[]> => {
      const shown = await TerminalScreen.rowsAsync(screen);
      const text = shown.join("").replaceAll(" ", "");
      const command = SHOWN_COMMAND.replaceAll(" ", "");
      const typed = text.indexOf(command);
      return typed >= 0 && text.includes(SHOWN_OUTPUT, typed + command.length) && TerminalScreen.PROMPT_END.test(shown.at(-1) ?? "") ? [] : shown;
    };
    await expect.poll(shownWithOutput, { ...TeamRunApp.pollOf(30_000), message: "the screen shows the command, its output and the next prompt" }).toEqual([]);
    const inline = page.locator("nol-teamrun-inline-terminal:has(.live > *)");
    await inline.scrollIntoViewIfNeeded();
    const box = await boxOf(inline);
    const viewport = page.locator(".nol-virtual-list-viewport").first();
    const history = await boxOf(viewport);
    const historyHeight = await viewport.evaluate(t => t.clientHeight);
    const rowHeight = (await boxOf(screen.locator(":scope > div").first())).height;
    await testInfo.attach("short-history", { body: await page.screenshot(), contentType: "image/png" });

    expect(historyHeight).toBeGreaterThanOrEqual((MINIMUM_ROWS + 1) * rowHeight);
    expect(history.height / 2).toBeLessThan(MINIMUM_ROWS * rowHeight);
    await expect(screen.locator(":scope > div")).toHaveCount(MINIMUM_ROWS);
    expect(box.height).toBeGreaterThan(history.height / 2);
    expect(box.top).toBeGreaterThanOrEqual(history.top - EDGE_TOLERANCE);
    expect(box.bottom).toBeLessThanOrEqual(history.bottom + EDGE_TOLERANCE);
  });

const expectKeptUnderFirstAsync = async (page: Page, name: string): Promise<void> => {
  const blocks = page.getByRole("button", { name: /^Run bash command/u }).locator("xpath=ancestor::nol-code-block");
  const kept = page.locator("nol-teamrun-inline-terminal nol-code-block.output");
  await expect(kept).toHaveCount(1, { timeout: 60_000 });
  await expect.poll(async () => (await kept.innerText()).replaceAll(/\s/gu, ""), TeamRunApp.pollOf(5_000)).toContain(name);
  const keptBox = await boxOf(kept);
  const firstBlock = await boxOf(blocks.nth(0));
  const secondBlock = await boxOf(blocks.nth(1));

  expect(keptBox.top).toBeGreaterThanOrEqual(firstBlock.bottom - EDGE_TOLERANCE);
  expect(keptBox.bottom).toBeLessThanOrEqual(secondBlock.top + EDGE_TOLERANCE);
  expect(Math.abs(keptBox.left - firstBlock.left)).toBeLessThanOrEqual(EDGE_TOLERANCE);
  expect(Math.abs(keptBox.right - firstBlock.right)).toBeLessThanOrEqual(EDGE_TOLERANCE);
};

test("an earlier Run's output comes back under its block after the window reloads and after TeamRun restarts", async ({ app }, testInfo) => {
  const page = await app.openChatAsync();
  await page.setViewportSize(PROMPT_WINDOW);
  for (const profile of BASH_PROFILES)
    writeFileSync(path.join(app.home, profile), PLAIN_PROMPT);
  const first = app.pidFile("kept-first");
  const second = app.pidFile("kept-second");
  await app.sendAsync(`${CodexDouble.REPLY_PREFIX}First:\n\n\`\`\`bash\n${BASH.write(first)}\n\`\`\`\n\nThen:\n\n\`\`\`bash\n${BASH.write(second)}\n\`\`\``);
  const runs = page.getByRole("button", { name: /^Run bash command/u });
  await expect(runs).toHaveCount(2, { timeout: 60_000 });
  await runs.nth(0).click();
  await expect.poll(() => TeamRunApp.readPid(first), TeamRunApp.pollOf(60_000)).not.toBeNull();
  await settledAtPromptAsync(page, path.basename(first));
  await runs.nth(1).click();
  await expect.poll(() => TeamRunApp.readPid(second), TeamRunApp.pollOf(60_000)).not.toBeNull();
  await expectKeptUnderFirstAsync(page, path.basename(first));

  await page.reload();
  await expectKeptUnderFirstAsync(page, path.basename(first));
  await testInfo.attach("kept-after-reload", { body: await page.screenshot(), contentType: "image/png" });
  expect(app.quit()).toContain("\"outcome\":\"Quit\"");
  expect(await app.waitForExitAsync()).toBe(0);
  const restarted = await app.startAsync();
  await restarted.locator(".nol-teamrun-conversation-row").first().click({ timeout: 60_000 });

  await expectKeptUnderFirstAsync(restarted, path.basename(first));
  await testInfo.attach("kept-after-restart", { body: await restarted.screenshot(), contentType: "image/png" });
  expect(app.unexpectedFailures).toEqual([]);
});

test("Ctrl+` in the inline terminal goes to the chat's message box and leaves the dock as it was, while from the message box it still toggles a terminal", async ({ app }) => {
  const page = await app.openChatAsync();
  for (const profile of BASH_PROFILES)
    writeFileSync(path.join(app.home, profile), PLAIN_PROMPT);
  const ran = app.pidFile("bash-ran");
  await app.sendAsync(`${CodexDouble.REPLY_PREFIX}Run:\n\n\`\`\`bash\n${BASH.write(ran)}\n\`\`\``);
  const run = page.getByRole("button", { name: /^Run bash command/u });
  await expect(run).toHaveCount(1, { timeout: 60_000 });
  await run.click();
  await expect.poll(() => TeamRunApp.readPid(ran), TeamRunApp.pollOf(60_000)).not.toBeNull();
  await expect.poll(() => page.evaluate(focusOf), TeamRunApp.pollOf(30_000)).toEqual(expect.objectContaining({ window: true, input: true }));
  const composer = page.getByRole("combobox", { name: "Message", exact: true });
  const dockTabs = page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: "Activity" }) }).getByRole("tab");
  const inTerminal = (): Promise<boolean> => page.evaluate(() => document.activeElement?.matches("nol-terminal-pane .xterm-helper-textarea") === true);
  const tabsBefore = await dockTabs.allTextContents();
  const dockShownBefore = await dockTabs.first().isVisible();

  await page.keyboard.press("Control+Backquote");
  await expect(composer).toBeFocused({ timeout: 30_000 });
  const tabsAfter = await dockTabs.allTextContents();
  const dockShownAfter = await dockTabs.first().isVisible();
  await page.keyboard.press("Control+Backquote");

  await expect.poll(inTerminal, TeamRunApp.pollOf(30_000)).toBe(true);
  expect([tabsAfter, dockShownAfter]).toEqual([tabsBefore, dockShownBefore]);
});
