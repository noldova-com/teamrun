/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { type Locator, type Page, expect } from "playwright/test";

import { CodexDouble } from "./fixtures/codex-double.ts";
import { PowershellCommands } from "./fixtures/powershell-commands.ts";
import { TeamRunApp, test } from "./fixtures/teamrun-app.fixture.ts";
import { TerminalScreen } from "./fixtures/terminal-screen.ts";

interface IRunningCommand {
  readonly page: Page;
  readonly shell: number;
  readonly program: number;
  readonly beat: string;
  readonly tab: Locator;
  readonly name: string;
}

const BEATS_TO_WAIT: number = 5;

const pidOf = (file: string): number => {
  const pid = TeamRunApp.readPid(file);
  if (pid === null)
    throw new Error(`${file} holds no process id.`);
  return pid;
};

const beatOf = (file: string): number => TeamRunApp.readPid(file) ?? 0;

const beatFileOf = (app: TeamRunApp): string => path.join(app.work, "program.beat");

const topOf = async (locator: Locator): Promise<number> => (await locator.boundingBox())?.y ?? Number.NaN;

interface IShellCommands {
  readonly run: (shellFile: string, programFile: string, beatFile: string) => string;
  readonly writePid: (file: string) => string;
}

const SH: IShellCommands = {
  run: (shellFile, programFile, beatFile) =>
    `echo e2e-ran; echo $$ > ${shellFile}; sh -c 'echo $$ > ${programFile}; i=0; while :; do i=$((i+1)); echo $i > ${beatFile}.tmp && mv ${beatFile}.tmp ${beatFile}; sleep 0.2; done'`,
  writePid: file => `echo $$ > ${file}`
};

const powerShellProgramOf = (programFile: string, beatFile: string): string => Buffer.from([PowershellCommands.write(programFile, "$PID"), "$i = 0",
  `while ($true) { $i++; ${PowershellCommands.write(`${beatFile}.tmp`, "$i")}; ${PowershellCommands.move(`${beatFile}.tmp`, beatFile)}; ${PowershellCommands.pause(200)} }`]
  .join("; "), "utf16le").toString("base64");

const POWERSHELL: IShellCommands = {
  run: (shellFile, programFile, beatFile) => [PowershellCommands.say("e2e-ran"), PowershellCommands.write(shellFile, "$PID"),
    `powershell -NoProfile -EncodedCommand ${powerShellProgramOf(programFile, beatFile)}`].join("; "),
  writePid: file => PowershellCommands.write(file, "$PID")
};

const SHELL: IShellCommands = process.platform === "win32" ? POWERSHELL : SH;

const WINDOWS_SHELL_NAMES: Readonly<Record<string, string>> = { pwsh: "PowerShell", powershell: "Windows PowerShell", cmd: "Command Prompt", "git-bash": "Git Bash" };

const shellNameOf = (id: string | undefined): string | undefined => process.platform === "win32" && id !== undefined ? WINDOWS_SHELL_NAMES[id] ?? id : id;

const commandOf = (shellFile: string, programFile: string, beatFile: string): string => SHELL.run(shellFile, programFile, beatFile);

const dockTabsOf = (page: Page): Locator =>
  page.getByRole("tablist").filter({ has: page.getByRole("tab", { name: "Activity" }) }).getByRole("tab");

const terminalTabsOf = (page: Page): Locator => dockTabsOf(page).filter({ hasNotText: /Activity|Changes/ });

const sendAsync = async (app: TeamRunApp, command: string, variables: Readonly<Record<string, string>> = {}): Promise<Page> => {
  const page = await app.openChatAsync(variables);
  await app.sendAsync(`${CodexDouble.RUN_PREFIX}${command}`);

  for (const tool of ["terminal_open", "terminal_run"]) {
    await page.getByRole("button", { name: /^Allow/ }).first().click({ timeout: 60_000 });
    await expect.poll(() => existsSync(app.codexLog) && readFileSync(app.codexLog, "utf8").includes(`${tool}: `), TeamRunApp.pollOf(30_000)).toBe(true);
  }
  await expect(page.getByRole("button", { name: /^Worked for / }).first()).toHaveAttribute("aria-expanded", "false", { timeout: 60_000 });
  return page;
};

const runAsync = async (app: TeamRunApp): Promise<IRunningCommand> => {
  const shellFile = app.pidFile("shell");
  const programFile = app.pidFile("program");
  const beat = beatFileOf(app);
  const page = await sendAsync(app, commandOf(shellFile, programFile, beat));
  await expect.poll(() => TeamRunApp.readPid(programFile), TeamRunApp.pollOf(30_000)).not.toBeNull();
  const tab = terminalTabsOf(page).first();
  await expect(tab).toBeVisible({ timeout: 30_000 });
  const name = await tab.getAttribute("aria-label") ?? "";
  expect(name).not.toBe("");
  const running = { page, shell: pidOf(shellFile), program: pidOf(programFile), beat, tab: page.getByRole("tab", { name, exact: true }), name };
  expect([TeamRunApp.isRunning(running.shell), TeamRunApp.isRunning(running.program)]).toEqual([true, true]);
  return running;
};

const closeTabAsync = async (tab: Locator, name: string): Promise<void> => {
  await tab.hover();
  await tab.getByRole("button", { name: `Close ${name}`, exact: true }).click();
};

const focusTerminalAsync = async (page: Page, tab: Locator): Promise<void> => {
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await page.locator("nol-terminal-pane .xterm-screen").click();
  await expect(page.locator("nol-terminal-pane .xterm-helper-textarea")).toBeFocused();
};

const stopProgramAsync = async (page: Page, program: number): Promise<void> => {
  await page.keyboard.press("Control+C");
  await expect.poll(() => TeamRunApp.isRunning(program), TeamRunApp.pollOf(30_000)).toBe(false);
};

const expectBeatingAsync = async (file: string): Promise<void> => {
  const beat = beatOf(file);
  await expect.poll(() => beatOf(file), TeamRunApp.pollOf(30_000)).toBeGreaterThan(beat + BEATS_TO_WAIT);
};

const expectShellAnswersAsync = async (app: TeamRunApp, page: Page, shell: number): Promise<void> => {
  const file = app.pidFile("alive");
  await TerminalScreen.enterAsync(page, page.locator("nol-terminal-pane .xterm-rows"), SHELL.writePid(file));
  try {
    await expect.poll(() => TeamRunApp.readPid(file), TeamRunApp.pollOf(30_000)).toBe(shell);
  }
  catch (error) {
    const screen = await page.locator("nol-terminal-pane .xterm-rows").innerText().catch((reason: unknown) => `unread: ${String(reason)}`);
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nThe terminal shows:\n${screen}`, { cause: error });
  }
};

const quitAsync = async (app: TeamRunApp, pids: readonly number[]): Promise<void> => {
  const runtime = app.runtimeProcesses();
  expect(runtime.map(t => t.name)).not.toEqual([]);
  const known = new Set(runtime.map(t => t.pid));
  const started = [...pids.map(t => TeamRunApp.processOf(t)).filter(t => t !== null).filter(t => !known.has(t.pid)), ...runtime];
  expect(app.quit()).toContain("\"outcome\":\"Quit\"");
  expect(await app.waitForExitAsync()).toBe(0);
  try {
    await expect.poll(() => TeamRunApp.aliveOf(started).map(t => `${t.name} (${t.pid})`), TeamRunApp.pollOf(30_000)).toEqual([]);
  }
  finally {
    TeamRunApp.stopAlive(started);
  }
  expect(app.unexpectedFailures).toEqual([]);
};

test("an agent's command runs in a terminal tied to its chat, shows in the panel and as a step, and quitting ends it", async ({ app }, testInfo) => {
  const shellFile = app.pidFile("shell");
  const programFile = app.pidFile("program");
  const command = commandOf(shellFile, programFile, beatFileOf(app));
  const page = await sendAsync(app, command);

  await page.getByRole("button", { name: /^Worked for / }).first().click();
  const step = page.getByRole("button", { name: /^Run in / }).first();
  await expect(step).toBeVisible({ timeout: 60_000 });
  await expect.poll(() => TeamRunApp.readPid(programFile), TeamRunApp.pollOf(30_000)).not.toBeNull();
  await step.click();
  await expect(page.getByText(command, { exact: false }).first()).toBeVisible();
  await expect(page.getByText("e2e-ran").first()).toBeVisible();

  const activity = page.getByRole("tab", { name: "Activity" });
  const dockTabs = dockTabsOf(page);
  await expect.soft(dockTabs).toHaveCount(3, { timeout: 30_000 });
  const tab = terminalTabsOf(page).first();
  if (await tab.isVisible()) {
    const shellName = shellNameOf(/"shell":"([^"]+)"/.exec(readFileSync(app.codexLog, "utf8"))?.[1]) ?? "";
    expect.soft(shellName).not.toBe("");
    await expect.soft(tab.locator(".nol-tab-label")).toHaveText(shellName);
    expect(Math.abs(await topOf(tab) - await topOf(activity))).toBeLessThan(2);
  }
  expect(readFileSync(app.codexLog, "utf8")).toContain("transport: http");
  await testInfo.attach("chat-terminal", { body: await page.screenshot(), contentType: "image/png" });
  await app.snapshotAsync(testInfo, "before-quit");

  const shell = pidOf(shellFile);
  const program = pidOf(programFile);
  expect(TeamRunApp.isRunning(shell)).toBe(true);
  expect(TeamRunApp.isRunning(program)).toBe(true);
  await quitAsync(app, [shell, program]);
});

test("with TEAMRUN_MCP_ENDPOINT=off, which no longer turns it off, an agent reaches its terminal through the packaged endpoint, and quitting ends it", async ({ app }) => {
  const shellFile = app.pidFile("shell");
  const programFile = app.pidFile("program");
  await sendAsync(app, commandOf(shellFile, programFile, beatFileOf(app)), { TEAMRUN_MCP_ENDPOINT: "off" });
  await expect.poll(() => TeamRunApp.readPid(programFile), TeamRunApp.pollOf(30_000)).not.toBeNull();

  expect(readFileSync(app.codexLog, "utf8")).toContain("transport: http");
  const shell = pidOf(shellFile);
  const program = pidOf(programFile);
  expect([TeamRunApp.isRunning(shell), TeamRunApp.isRunning(program)]).toEqual([true, true]);
  await quitAsync(app, [shell, program]);
});

test("the person stops an agent's command with Ctrl+C in its terminal in the panel, and the terminal's shell keeps running", async ({ app }) => {
  const { page, shell, program, tab } = await runAsync(app);

  await focusTerminalAsync(page, tab);
  await stopProgramAsync(page, program);

  await expectShellAnswersAsync(app, page, shell);
  await expect(tab).toBeVisible();
  await quitAsync(app, [shell]);
});

test("the person closes an agent's terminal from the panel, and its tab goes and its shell and program end", async ({ app }) => {
  const { page, shell, program, tab, name } = await runAsync(app);

  await closeTabAsync(tab, name);

  await expect(tab).toBeHidden();
  await expect(dockTabsOf(page)).toHaveCount(2);
  await expect(terminalTabsOf(page)).toHaveCount(0);
  await expect.poll(() => [TeamRunApp.isRunning(shell), TeamRunApp.isRunning(program)], TeamRunApp.pollOf(30_000)).toEqual([false, false]);
  await quitAsync(app, []);
});

test("closing a chat while its terminal runs a program hides the tab, and opening the chat again shows it with the program still running", async ({ app }) => {
  const { page, shell, program, beat, tab, name } = await runAsync(app);
  const title = (await page.locator(".nol-teamrun-conversation-row[aria-selected='true'] .nol-teamrun-conversation-title").innerText()).trim();
  const chat = page.getByRole("tab", { name: title, exact: true });
  await expect(chat).toBeVisible();

  await closeTabAsync(chat, title);
  await expect(chat).toBeHidden();
  await expect(tab).toBeHidden();
  await expectBeatingAsync(beat);

  await page.getByRole("tree").locator(".nol-teamrun-conversation-title", { hasText: title }).first().click();
  await expect(chat).toBeVisible({ timeout: 30_000 });
  await expect(tab).toBeVisible({ timeout: 30_000 });
  await expectBeatingAsync(beat);
  await focusTerminalAsync(page, tab);
  await stopProgramAsync(page, program);
  await expectShellAnswersAsync(app, page, shell);
  await quitAsync(app, [shell]);
});
