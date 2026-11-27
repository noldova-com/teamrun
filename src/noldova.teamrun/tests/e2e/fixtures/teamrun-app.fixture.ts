/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { type ElectronApplication, type Locator, type Page, type TestInfo, _electron, test as base, expect } from "playwright/test";

import type { IDesktopBridge } from "../interfaces/i-desktop-bridge.ts";
import type { ITeamRunFixtures } from "../interfaces/i-team-run-fixtures.ts";
import { CodexDouble } from "./codex-double.ts";
import { CodexShim } from "./codex-shim.ts";
import { PollTiming } from "./poll-timing.ts";
import { ProcessStatus } from "./process-status.ts";
import { StartedProcess } from "./started-process.ts";
import { WindowSize } from "./window-size.ts";
import { WindowsProcesses } from "./windows-processes.ts";

declare global {
  interface Window {
    readonly desktop: IDesktopBridge;
  }
}

export class TeamRunApp {
  private static readonly POLL_INTERVALS: readonly number[] = [50, 100, 250];
  private static readonly POLL_TIMEOUT: number = 5_000;
  private static readonly ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
  private static readonly APP_ROOT: string = path.join(TeamRunApp.ROOT, "app");
  private static readonly MAIN: string = path.join(TeamRunApp.APP_ROOT, "node_modules", "@noldova", "desktop.electron", "main.js");
  private static readonly CLI: string = path.join(TeamRunApp.APP_ROOT, "node_modules", "@noldova", "desktop.cli", "services", "cli-entry.js");
  private static readonly DOUBLE: string = path.join(import.meta.dirname, "codex-double.ts");
  private static readonly REGISTRY_DOUBLE: string = path.join(import.meta.dirname, "acp-registry-double.cjs");
  private static readonly REGISTRY_LOG_VARIABLE: string = "TEAMRUN_ACP_REGISTRY_DOUBLE_LOG";
  private static readonly REFUSED_PREFIX: string = "refused ";
  private static readonly WORK_PREFIX: string = "tre-";
  private static readonly QUIT_TIMEOUT: number = 90_000;
  private static readonly CLOSE_TIMEOUT: number = 30_000;
  private static readonly EXIT_TIMEOUT: number = 60_000;
  private static readonly SNAPSHOT_TIMEOUT: number = 10_000;
  private static readonly TRACE_FILE: string = "trace.zip";
  private static readonly PID_SUFFIX: string = ".pid";
  private static readonly REMOVE_RETRIES: number = 5;
  private static readonly REMOVE_RETRY_DELAY: number = 200;
  private static readonly LAUNCH_ARGUMENTS: readonly string[] = ["--disable-gpu", "--disable-software-rasterizer", "--host-resolver-rules=MAP *.test 127.0.0.1"];
  private static readonly LINUX_PASSWORD_STORE: string = "--password-store=gnome-libsecret";
  private static readonly MAC_MOCK_KEYCHAIN: string = "--use-mock-keychain";
  private static readonly SHOW_ALL_TABS: string = "Show all tabs";
  private static readonly OVERFLOW_MENU: string = ".nol-tab-group-overflow-menu";
  private static readonly TAB_TIMEOUT: number = 60_000;
  private static readonly TAB_STEP_TIMEOUT: number = 1_000;
  private static readonly DESKTOP_DEFAULT_WIDTH: number = 1280;
  private static readonly DESKTOP_DEFAULT_HEIGHT: number = 800;
  private static readonly PROCESSES: string = "/proc";
  private static readonly RUNTIME_ENTRY: string = "/desktop.runtime/services/runtime-entry.js";
  private static readonly DATA_ARGUMENT: string = "--data-dir";
  private static readonly ZOMBIE: string = "Z";
  private static readonly MAC_PROCESS_STATUS: string = "/bin/ps";
  private static readonly MAC_STATUS_ARGUMENTS: readonly string[] = ["-axww", "-o", "pid=,ppid=,pgid=,stat=,lstart=,ucomm="];
  private static readonly MAC_COMMAND_ARGUMENTS: readonly string[] = ["-axww", "-o", "pid=,args="];
  private static readonly MAC_STATUS_LINE: RegExp = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([A-Z][a-z]{2} [A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\s+(.*?)\s*$/;
  private static readonly MAC_COMMAND_LINE: RegExp = /^\s*(\d+) (.*)$/;
  private static readonly HOLDERS_TIMEOUT: number = 60_000;
  private static readonly UNWRITTEN_CODES: readonly string[] = ["ENOENT", "EBUSY", "EPERM"];
  private static readonly PROCESSES_BUFFER: number = 64 * 1024 * 1024;

  public readonly work: string;
  public readonly home: string;
  private readonly data: string;
  private readonly device: string;
  private readonly bin: string;
  private readonly failures: string[] = [];
  private readonly output: string[] = [];
  private readonly console: string[] = [];
  private readonly isTraced: boolean;
  private hasExited: boolean = false;
  private isTracing: boolean = false;
  private application: ElectronApplication | null = null;
  private child: ChildProcess | null = null;
  private window: Page | null = null;
  private reached: readonly string[] = [];

  public constructor(isTraced: boolean = false) {
    this.isTraced = isTraced;
    this.work = TeamRunApp.makeWork(process.platform === "win32" ? tmpdir() : "/tmp", work => TeamRunApp.prepareWork(process.platform, work));
    this.home = path.join(this.work, "home");
    this.data = path.join(this.work, "data");
    this.device = path.join(this.work, "device");
    this.bin = path.join(this.work, "bin");
  }

  public get electronApp(): ElectronApplication {
    if (Object.isNull(this.application))
      throw new Error("The app has not started.");
    return this.application;
  }

  public get page(): Page {
    if (Object.isNull(this.window))
      throw new Error("The app has not started.");
    return this.window;
  }

  public get composer(): Locator {
    return this.page.getByRole("combobox", { name: "Message", exact: true });
  }

  public get codexLog(): string {
    return path.join(this.work, "codex.log");
  }

  public get registryLog(): string {
    return path.join(this.work, "acp-registry.log");
  }

  public get liveRegistryRequests(): readonly string[] {
    return this.reached;
  }

  public get dataFolder(): string {
    return this.data;
  }

  public get unexpectedFailures(): readonly string[] {
    return this.failures;
  }

  public static pollOf(timeout: number = TeamRunApp.POLL_TIMEOUT): PollTiming {
    return new PollTiming(timeout, TeamRunApp.POLL_INTERVALS);
  }

  public static async savedLayoutAsync(page: Page): Promise<string> {
    return JSON.stringify(await page.evaluate(() => window.desktop.readLayout()));
  }

  public static tabOf(page: Page, name: string): Locator {
    return page.getByRole("tab", { name, exact: true, includeHidden: true });
  }

  public static groupOf(page: Page, name: string): Locator {
    return page.locator("nol-tab-group").filter({ has: TeamRunApp.tabOf(page, name) });
  }

  public static async selectTabAsync(page: Page, name: string, item: string = name, timeout: number = TeamRunApp.TAB_TIMEOUT): Promise<void> {
    const tab = TeamRunApp.tabOf(page, name);
    if (await tab.isVisible()) {
      await tab.click({ timeout });
      return;
    }
    await TeamRunApp.groupOf(page, name).getByRole("button", { name: TeamRunApp.SHOW_ALL_TABS, exact: true }).click({ timeout });
    await page.locator(TeamRunApp.OVERFLOW_MENU).getByRole("menuitem", { name: item, exact: true }).click({ timeout });
  }

  public static async showTabAsync(page: Page, name: string, item: string = name): Promise<void> {
    const tab = TeamRunApp.tabOf(page, name);
    const menu = page.locator(TeamRunApp.OVERFLOW_MENU);
    await expect(async () => {
      if (await menu.isVisible())
        await page.keyboard.press("Escape");
      await TeamRunApp.selectTabAsync(page, name, item, TeamRunApp.TAB_STEP_TIMEOUT);
      await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: TeamRunApp.TAB_STEP_TIMEOUT });
      await expect(tab).toBeVisible({ timeout: TeamRunApp.TAB_STEP_TIMEOUT });
    }, `${name}'s tab shows`).toPass({ timeout: TeamRunApp.TAB_TIMEOUT });
  }

  public static async listTabsAsync(page: Page, name: string): Promise<readonly string[]> {
    return await TeamRunApp.groupOf(page, name).locator("nol-tab").evaluateAll(tabs => tabs.map(t => t.getAttribute("aria-label") ?? ""));
  }

  public static async expectWholeTabsAsync(page: Page, name: string): Promise<void> {
    const group = TeamRunApp.groupOf(page, name);
    await expect(async () => {
      const row = await group.locator(".nol-tab-group-scroller").boundingBox();
      if (Object.isNull(row))
        throw new Error(`${name}'s tab row shows no box.`);
      for (const tab of await group.getByRole("tab").all()) {
        const box = await tab.boundingBox();
        const label = await tab.getAttribute("aria-label");
        if (Object.isNull(box))
          throw new Error(`${label}'s tab shows no box.`);
        expect(box.x >= row.x && box.x + box.width <= row.x + row.width, `${label} shows whole in its row`).toBe(true);
      }
    }).toPass({ timeout: TeamRunApp.TAB_TIMEOUT });
  }

  public static homeVariablesOf(platform: NodeJS.Platform, home: string): Readonly<Record<string, string>> {
    if (platform !== "win32")
      return { HOME: home };
    return { HOME: home, USERPROFILE: home, APPDATA: path.win32.join(home, "AppData", "Roaming"), LOCALAPPDATA: path.win32.join(home, "AppData", "Local") };
  }

  public static shimsOf(platform: NodeJS.Platform, bin: string): readonly CodexShim[] {
    if (platform === "win32")
      return [new CodexShim(path.win32.join(bin, "codex.cmd"), `@"${process.execPath}" "${TeamRunApp.DOUBLE}" %*\r\n`)];
    return [new CodexShim(path.posix.join(bin, "codex"), `#!/bin/sh\nexec "${process.execPath}" "${TeamRunApp.DOUBLE}" "$@"\n`)];
  }

  public static environmentOf(platform: NodeJS.Platform, inherited: Readonly<Record<string, string | undefined>>, variables: Readonly<Record<string, string>>,
    home: string, bin: string, codexLog: string): Record<string, string> {
    const nameOf = (name: string): string => platform === "win32" ? name.toUpperCase() : name;
    const searchPath = Object.entries(inherited).find(t => nameOf(t[0]) === "PATH")?.[1] ?? "";
    const own: Record<string, string | undefined> = {
      ...variables,
      ...TeamRunApp.homeVariablesOf(platform, home),
      CODEX_HOME: undefined,
      PATH: `${bin}${platform === "win32" ? path.win32.delimiter : path.posix.delimiter}${searchPath}`,
      [CodexDouble.LOG_VARIABLE]: codexLog
    };
    const names = new Set(Object.keys(own).map(t => nameOf(t)));
    const environment: Record<string, string> = {};
    for (const [name, value] of [...Object.entries(inherited).filter(t => !names.has(nameOf(t[0]))), ...Object.entries(own)])
      if (!Object.isUndefined(value))
        environment[name] = value;
    return environment;
  }

  public static makeWork(root: string, prepare: (work: string) => void, remove: (work: string) => void = t => TeamRunApp.removeWork(t)): string {
    const work = mkdtempSync(path.join(root, TeamRunApp.WORK_PREFIX));
    try {
      prepare(work);
    }
    catch (error) {
      try {
        remove(work);
      }
      catch {
        throw error;
      }
      throw error;
    }
    return work;
  }

  private static removeWork(work: string): void {
    rmSync(work, { recursive: true, force: true, maxRetries: TeamRunApp.REMOVE_RETRIES, retryDelay: TeamRunApp.REMOVE_RETRY_DELAY });
  }

  private static prepareWork(platform: NodeJS.Platform, work: string): void {
    const home = path.join(work, "home");
    const bin = path.join(work, "bin");
    for (const folder of [...Object.values(TeamRunApp.homeVariablesOf(platform, home)), path.join(home, ".codex"), path.join(work, "data"), path.join(work, "device"), bin])
      mkdirSync(folder, { recursive: true });
    writeFileSync(path.join(home, ".codex", "config.toml"), "");
    for (const shim of TeamRunApp.shimsOf(platform, bin)) {
      writeFileSync(shim.file, shim.script);
      chmodSync(shim.file, 0o755);
    }
  }

  public static readPid(file: string): number | null {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    }
    catch (error) {
      if (TeamRunApp.isUnwritten(error))
        return null;
      throw error;
    }
    const pid = Number.parseInt(text.trim(), 10);
    return Number.isInteger(pid) ? pid : null;
  }

  public static isRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    }
    catch (error) {
      return !(error instanceof Error && "code" in error && error.code === "ESRCH");
    }
  }

  public static processOf(pid: number): StartedProcess | null {
    const status = TeamRunApp.statusesOf([pid])[0];
    return Object.isUndefined(status) ? null : new StartedProcess(status.pid, status.name, status.start);
  }

  public static isAlive(started: StartedProcess): boolean {
    return TeamRunApp.aliveOf([started]).length > 0;
  }

  public static aliveOf(started: readonly StartedProcess[]): readonly StartedProcess[] {
    const statuses = TeamRunApp.statusesOf(started.map(t => t.pid));
    return started.filter(t => statuses.some(u => u.pid === t.pid && u.start === t.start && u.state !== TeamRunApp.ZOMBIE));
  }

  private static statusesOf(pids: readonly number[] | null): readonly ProcessStatus[] {
    if (process.platform === "win32" || process.platform === "darwin") {
      const listed = process.platform === "win32" ? WindowsProcesses.list() : TeamRunApp.macProcesses();
      return Object.isNull(pids) ? listed : listed.filter(t => pids.includes(t.pid));
    }
    const all = pids ?? readdirSync(TeamRunApp.PROCESSES).filter(t => /^\d+$/.test(t)).map(Number);
    return all.map(t => TeamRunApp.statusOf(t)).filter(t => !Object.isNull(t));
  }

  private static macProcesses(): readonly ProcessStatus[] {
    const commands = new Map<number, string>(TeamRunApp.macList(TeamRunApp.MAC_COMMAND_ARGUMENTS).map(t => TeamRunApp.MAC_COMMAND_LINE.exec(t))
      .filter(t => !Object.isNull(t)).map(t => [Number(t[1]), t[2] ?? ""]));
    return TeamRunApp.macList(TeamRunApp.MAC_STATUS_ARGUMENTS).map(t => TeamRunApp.MAC_STATUS_LINE.exec(t)).filter(t => !Object.isNull(t)).map(t => {
      const pid = Number(t[1]);
      return new ProcessStatus(pid, t[6] ?? "", String(Date.parse(t[5] ?? "") / 1_000), Number(t[2]), Number(t[3]), (t[4] ?? "").charAt(0),
        commands.get(pid) ?? "");
    });
  }

  private static macList(args: readonly string[]): readonly string[] {
    const result = spawnSync(TeamRunApp.MAC_PROCESS_STATUS, args, { encoding: "utf8", env: { ...process.env, LC_ALL: "C" }, timeout: TeamRunApp.HOLDERS_TIMEOUT,
      killSignal: "SIGKILL", maxBuffer: TeamRunApp.PROCESSES_BUFFER });
    if (result.status !== 0)
      throw new Error(`Listing the processes failed with ${result.status}: ${result.error?.message ?? (result.stderr ?? "").trim()}`);
    return result.stdout.split("\n");
  }

  public static isUnwritten(error: unknown): boolean {
    return TeamRunApp.isRecord(error) && TeamRunApp.UNWRITTEN_CODES.includes(String(error["code"]));
  }

  private static isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return Object.isObject(value) && !Object.isFunction(value);
  }

  private static statusOf(pid: number): ProcessStatus | null {
    let stat: string;
    try {
      stat = readFileSync(path.join(TeamRunApp.PROCESSES, String(pid), "stat"), "utf8");
    }
    catch {
      return null;
    }
    const end = stat.lastIndexOf(")");
    const fields = stat.slice(end + 2).split(" ");
    return new ProcessStatus(pid, stat.slice(stat.indexOf("(") + 1, end), fields[19] ?? "", Number(fields[1]), Number(fields[3]), fields[0] ?? "", "");
  }

  public static stopAlive(started: readonly StartedProcess[]): void {
    for (const alive of TeamRunApp.aliveOf(started))
      TeamRunApp.stop(alive.pid);
  }

  private static argumentsOf(pid: number): readonly string[] {
    try {
      return readFileSync(path.join(TeamRunApp.PROCESSES, String(pid), "cmdline"), "utf8").split("\0");
    }
    catch {
      return [];
    }
  }

  private static get electron(): string {
    return String(createRequire(path.join(TeamRunApp.APP_ROOT, "package.json"))("electron"));
  }

  public async startAsync(variables: Readonly<Record<string, string>> = {}, preloads: readonly string[] = []): Promise<Page> {
    const environment = TeamRunApp.environmentOf(process.platform, process.env, { ...variables, [TeamRunApp.REGISTRY_LOG_VARIABLE]: this.registryLog }, this.home, this.bin,
      this.codexLog);
    const application = await _electron.launch({
      executablePath: TeamRunApp.electron,
      args: [...[...preloads, TeamRunApp.REGISTRY_DOUBLE].flatMap(t => ["-r", t]), TeamRunApp.MAIN, `--data-dir=${this.data}`, `--device-dir=${this.device}`, ...TeamRunApp.LAUNCH_ARGUMENTS,
        ...process.platform === "linux" ? [TeamRunApp.LINUX_PASSWORD_STORE] : [], ...process.platform === "darwin" ? [TeamRunApp.MAC_MOCK_KEYCHAIN] : []],
      cwd: TeamRunApp.APP_ROOT,
      env: environment
    });
    this.application = application;
    const child = application.process();
    this.child = child;
    this.hasExited = false;
    child.stdout?.on("data", (data: Buffer) => this.output.push(data.toString()));
    child.stderr?.on("data", (data: Buffer) => this.output.push(data.toString()));
    child.once("exit", () => {
      if (this.child === child)
        this.hasExited = true;
    });
    if (this.isTraced) {
      await application.context().tracing.start({ screenshots: true, snapshots: true });
      this.isTracing = true;
    }
    const window = await application.firstWindow();
    window.on("pageerror", t => this.failures.push(`renderer: ${t.message}`));
    window.on("console", t => this.console.push(`${t.type()}: ${t.text()}`));
    this.window = window;
    const wanted = new WindowSize(TeamRunApp.DESKTOP_DEFAULT_WIDTH, TeamRunApp.DESKTOP_DEFAULT_HEIGHT);
    const area = await application.evaluate(({ BrowserWindow, screen }, { width, height }) => {
      for (const shown of BrowserWindow.getAllWindows()) {
        shown.setContentSize(width, height);
        shown.center();
      }
      return screen.getPrimaryDisplay().workArea;
    }, wanted);
    let previous = String.empty;
    const unsettled = async (): Promise<string> => {
      const sizes = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(t => ({ content: t.getContentSize(), bounds: t.getBounds() })));
      const inner = await window.evaluate(() => [innerWidth, innerHeight]);
      const shown = JSON.stringify([sizes, inner]);
      const isSettled = shown === previous;
      previous = shown;
      const misfits = sizes.filter(t => !TeamRunApp.fits(t.content[0] ?? 0, wanted.width, t.bounds.width, area.width)
        || !TeamRunApp.fits(t.content[1] ?? 0, wanted.height, t.bounds.height, area.height));
      return isSettled && misfits.length === 0 && sizes.some(t => t.content[0] === inner[0] && t.content[1] === inner[1]) ? String.empty : shown;
    };
    await expect.poll(unsettled, {
      message: `the window at Desktop's default size, which the specs were written against, or as near it as a screen whose work area is ${area.width}×${area.height} allows`,
      ...TeamRunApp.pollOf(30_000) }).toBe(String.empty);
    return window;
  }

  private static fits(content: number, wanted: number, bound: number, room: number): boolean {
    return content === wanted || (content < wanted && bound >= room);
  }

  public async openChatAsync(variables: Readonly<Record<string, string>> = {}, preloads: readonly string[] = []): Promise<Page> {
    const page = await this.startAsync(variables, preloads);
    const providers = page.locator("nol-teamrun-providers-view");
    await expect(providers.getByRole("note", { name: "Welcome to TeamRun" })).toBeVisible({ timeout: 60_000 });
    const found = providers.getByRole("button", { name: /^Add (?![Pp]rovider$)/ });
    await found.click({ timeout: 60_000 });
    await expect(found).toBeHidden({ timeout: 60_000 });
    await providers.getByRole("button", { name: "Continue", exact: true }).click({ timeout: 60_000 });
    const teammate = providers.getByRole("form", { name: "Your first teammate" });
    await teammate.getByRole("button", { name: "Start chatting", exact: true }).click();
    await expect(teammate).toBeHidden();
    await expect(page.getByRole("button", { name: "Add files", exact: true })).toBeEnabled({ timeout: 60_000 });
    return page;
  }

  public async nameLocalSitesAsync(origins: string): Promise<void> {
    const search = this.page.getByRole("searchbox", { name: "Search settings", exact: true });
    const sitesAsync = async (): Promise<Locator> => {
      await this.page.getByRole("button", { name: "Settings", exact: true }).click();
      await search.fill("browser.localSites");
      return this.page.getByRole("textbox", { name: "Sites on this computer or network", exact: true });
    };
    const sites = await sitesAsync();
    await sites.fill(origins);
    await sites.blur();
    await search.fill("no such setting");
    await expect(sites).toBeHidden();
    await expect(await sitesAsync()).toHaveValue(origins, { timeout: 30_000 });
    await this.page.getByRole("tree").locator(".nol-teamrun-conversation-row[aria-selected='true'] .nol-teamrun-conversation-title").click();
  }

  public async sendAsync(text: string): Promise<void> {
    await this.submitAsync(text);
    await expect(this.composer).toHaveValue("");
  }

  public async submitAsync(text: string): Promise<void> {
    await this.composer.fill(text);
    const send = this.page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toBeEnabled({ timeout: 60_000 });
    await send.click();
  }

  public quit(): string {
    return this.run(["quit", "--json", "--timeout", "30"]);
  }

  public run(args: readonly string[]): string {
    const result = spawnSync(TeamRunApp.electron, [TeamRunApp.CLI, ...args, `--device-dir=${this.device}`, `--data-dir=${this.data}`],
      { encoding: "utf8", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, timeout: TeamRunApp.QUIT_TIMEOUT });
    return `${result.status} ${`${result.stdout ?? ""}${result.stderr ?? ""}`.trim()}`;
  }

  public runtimeProcesses(): readonly StartedProcess[] {
    if (process.platform !== "linux" && process.platform !== "win32" && process.platform !== "darwin")
      throw new Error("The quit check reads /proc on Linux and the process list on macOS and Windows, so it runs there only.");
    const statuses = TeamRunApp.statusesOf(null);
    const runtime = statuses.filter(t => this.isRuntime(t));
    const sessions = runtime.filter(t => t.session === t.pid).map(t => t.session);
    const found = TeamRunApp.withChildren([...runtime, ...statuses.filter(t => sessions.includes(t.session) && !runtime.includes(t))], statuses);
    return (process.platform === "darwin" ? TeamRunApp.withGroups(found, statuses) : found).map(t => new StartedProcess(t.pid, t.name, t.start));
  }

  private static withGroups(found: readonly ProcessStatus[], statuses: readonly ProcessStatus[]): readonly ProcessStatus[] {
    const all = [...found];
    for (const member of all)
      all.push(...statuses.filter(t => (t.session === member.session || t.parent === member.pid && BigInt(t.start) >= BigInt(member.start)) && !all.includes(t)));
    return all;
  }

  public static withChildren(found: readonly ProcessStatus[], statuses: readonly ProcessStatus[]): readonly ProcessStatus[] {
    const all = [...found];
    for (const parent of all)
      all.push(...statuses.filter(t => t.parent === parent.pid && BigInt(t.start) >= BigInt(parent.start) && !all.includes(t)));
    return all;
  }

  public pidFile(name: string): string {
    return path.join(this.work, `${name}${TeamRunApp.PID_SUFFIX}`);
  }

  public async waitForExitAsync(): Promise<number | null> {
    const child = this.child;
    if (Object.isNull(child) || !Object.isNull(child.exitCode) || !Object.isNull(child.signalCode))
      return child?.exitCode ?? null;
    return TeamRunApp.withinAsync(new Promise<number | null>(resolve => child.once("exit", code => resolve(code))), TeamRunApp.EXIT_TIMEOUT, null);
  }

  public async snapshotAsync(testInfo: TestInfo, name: string): Promise<void> {
    if (!Object.isNull(this.application))
      await TeamRunApp.endRefusedNavigationAsync(this.application, this.page.url());
    const tree = await this.page.locator("body").ariaSnapshot({ timeout: TeamRunApp.SNAPSHOT_TIMEOUT }).catch((error: unknown) => String(error));
    await testInfo.attach(`${name}.txt`, { body: tree, contentType: "text/plain" });
    if (testInfo.errors.length === 0)
      return;
    const chats = this.run(["teamrun", "list-chats", "--json"]);
    const messages = [...chats.matchAll(/"id":"([0-9a-f-]{36})"/g)].flatMap(t => t.slice(1)).map(t => this.run(["teamrun", "list-messages", t, "--json"]));
    process.stdout.write(`${name}:\n${tree}\nconsole:\n${this.console.join("\n")}\nchats:\n${chats}\nmessages:\n${messages.join("\n")}\n`);
  }

  public async attachAsync(testInfo: TestInfo, failed: boolean): Promise<void> {
    const application = this.application;
    for (const [index, window] of (application?.windows() ?? []).entries()) {
      if (window.isClosed())
        continue;
      if (!Object.isNull(application))
        await TeamRunApp.endRefusedNavigationAsync(application, window.url());
      const shot = await window.screenshot({ timeout: TeamRunApp.SNAPSHOT_TIMEOUT }).catch(() => null);
      if (!Object.isNull(shot))
        await testInfo.attach(`window-${index}`, { body: shot, contentType: "image/png" });
      const tree = await window.locator("body").ariaSnapshot({ timeout: TeamRunApp.SNAPSHOT_TIMEOUT }).catch((error: unknown) => String(error));
      await testInfo.attach(`window-${index}.txt`, { body: `${window.url()}\n${tree}`, contentType: "text/plain" });
      if (failed)
        process.stdout.write(`window ${index}, ${window.url()}:\n${tree}\n`);
    }
    await testInfo.attach("main-output.txt", { body: this.output.join(""), contentType: "text/plain" });
    await testInfo.attach("console.txt", { body: this.console.join("\n"), contentType: "text/plain" });
    for (const file of [this.codexLog, this.registryLog, path.join(this.data, "logs", "runtime.log"), path.join(this.data, "logs", "main.log")])
      if (existsSync(file)) {
        await testInfo.attach(path.basename(file), { body: readFileSync(file), contentType: "text/plain" });
        if (failed)
          process.stdout.write(`${path.basename(file)}:\n${readFileSync(file, "utf8")}\n`);
      }
  }

  public async keepTraceAsync(testInfo: TestInfo, failed: boolean): Promise<void> {
    const application = this.application;
    if (Object.isNull(application) || this.hasExited || !this.isTracing)
      return;
    this.isTracing = false;
    const file = testInfo.outputPath(TeamRunApp.TRACE_FILE);
    const failure = await TeamRunApp.withinAsync(application.context().tracing.stop(failed ? { path: file } : {}).then(() => null, (error: unknown) => String(error)),
      TeamRunApp.SNAPSHOT_TIMEOUT, `stopping it took over ${TeamRunApp.SNAPSHOT_TIMEOUT} ms`);
    if (!Object.isNull(failure))
      process.stdout.write(`The app's trace wasn't kept: ${failure}\n`);
  }

  public async closeAsync(failed: boolean): Promise<void> {
    try {
      await this.endAppAsync();
      if (failed)
        this.stopStartedPrograms();
    }
    finally {
      this.reached = TeamRunApp.liveRequestsOf(this.registryLog);
      this.removeHeldWork();
    }
  }

  public static liveRequestsOf(log: string): readonly string[] {
    if (!existsSync(log))
      return [];
    return readFileSync(log, "utf8").split(/\r?\n/).filter(t => t.startsWith(TeamRunApp.REFUSED_PREFIX)).map(t => t.slice(TeamRunApp.REFUSED_PREFIX.length));
  }

  private removeHeldWork(): void {
    if (process.platform !== "win32") {
      TeamRunApp.removeWork(this.work);
      return;
    }
    const ended = WindowsProcesses.holdersOf(this.work, true);
    if (ended.lines.length > 0)
      process.stdout.write(`What still named the work folder ${WindowsProcesses.HOLDERS_WAIT_SECONDS} s after the app ended, and what it started: ${ended.lines.join(", ")}\n`);
    if (!Object.isNull(ended.failure))
      process.stdout.write(`Waiting for what names the work folder failed: ${ended.failure}\n`);
    try {
      TeamRunApp.removeWork(this.work);
    }
    catch (error) {
      const holders = WindowsProcesses.holdersOf(this.work, false);
      const named = Object.isNull(holders.failure) ? holders.lines.join(", ") || "none" : `unknown, since listing them failed: ${holders.failure}`;
      throw new Error(`${error instanceof Error ? error.message : String(error)}; the processes that still name the folder: ${named}`, { cause: error });
    }
  }

  private static async endRefusedNavigationAsync(application: ElectronApplication, address: string): Promise<void> {
    const ended = application.evaluate(({ webContents }, shown) => Promise.all(webContents.getAllWebContents()
      .filter(t => !t.isDestroyed() && t.getURL() === shown)
      .map(t => t.executeJavaScript("history.replaceState(history.state, '', location.href)").then(() => null, () => null))), address);
    await TeamRunApp.withinAsync(ended.then(() => null, () => null), TeamRunApp.SNAPSHOT_TIMEOUT, null);
  }

  private static async withinAsync<T>(promise: Promise<T>, limit: number, fallback: T): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([promise, new Promise<T>(resolve => {
        timer = setTimeout(() => resolve(fallback), limit);
      })]);
    }
    finally {
      clearTimeout(timer);
    }
  }

  private static stop(pid: number): void {
    try {
      process.kill(pid, "SIGKILL");
    }
    catch (error) {
      if (TeamRunApp.isRunning(pid))
        throw error;
    }
  }

  private static startedBefore(pid: number, file: string): boolean {
    const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } });
    const started = Date.parse((result.stdout ?? "").trim());
    return Number.isFinite(started) && started <= statSync(file).mtimeMs;
  }

  private async endAppAsync(): Promise<void> {
    const application = this.application;
    if (Object.isNull(application) || this.hasExited)
      return;
    const closed = await TeamRunApp.withinAsync(application.close().then(() => true, () => false), TeamRunApp.CLOSE_TIMEOUT, false);
    const pid = this.child?.pid;
    if (!closed && !this.hasExited && !Object.isUndefined(pid)) {
      TeamRunApp.stop(-pid);
      TeamRunApp.stop(pid);
    }
    await this.waitForExitAsync();
  }

  private isRuntime(status: ProcessStatus): boolean {
    if (process.platform === "win32") {
      const command = status.command.replaceAll("\\", "/").toLowerCase();
      return command.includes(TeamRunApp.RUNTIME_ENTRY) && command.includes(TeamRunApp.DATA_ARGUMENT) && command.includes(this.data.replaceAll("\\", "/").toLowerCase());
    }
    if (process.platform === "darwin")
      return status.command.includes(TeamRunApp.RUNTIME_ENTRY) && ["=", " "].some(t => `${status.command} `.includes(` ${TeamRunApp.DATA_ARGUMENT}${t}${this.data} `));
    const args = TeamRunApp.argumentsOf(status.pid);
    return args.some(t => t.endsWith(TeamRunApp.RUNTIME_ENTRY))
      && args.some((t, index) => t === `${TeamRunApp.DATA_ARGUMENT}=${this.data}` || (t === this.data && args[index - 1] === TeamRunApp.DATA_ARGUMENT));
  }

  private stopStartedPrograms(): void {
    for (const file of readdirSync(this.work).filter(t => t.endsWith(TeamRunApp.PID_SUFFIX)).map(t => path.join(this.work, t))) {
      const pid = TeamRunApp.readPid(file);
      if (!Object.isNull(pid) && TeamRunApp.isRunning(pid) && TeamRunApp.startedBefore(pid, file))
        TeamRunApp.stop(pid);
    }
  }
}

export const test = base.extend<ITeamRunFixtures>({
  isAppTraced: [false, { option: true }],
  app: async ({ isAppTraced }, use, testInfo) => {
    const app = new TeamRunApp(isAppTraced);
    try {
      await use(app);
    }
    finally {
      const failed = testInfo.status !== testInfo.expectedStatus;
      try {
        await app.keepTraceAsync(testInfo, failed);
        await app.attachAsync(testInfo, failed);
      }
      finally {
        await app.closeAsync(failed);
      }
    }
    expect(app.liveRegistryRequests, "the requests the run made to the live ACP registry's host, which the ACP registry double refused").toEqual([]);
  }
});
