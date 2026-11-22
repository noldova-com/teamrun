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

import { type ElectronApplication, type Locator, type Page, type TestInfo, _electron, test as base, expect } from "playwright/test";

import type { IDesktopBridge } from "../interfaces/i-desktop-bridge.ts";
import { CodexDouble } from "./codex-double.ts";

declare global {
  interface Window {
    readonly desktop: IDesktopBridge;
  }
}

export interface IStartedProcess {
  readonly pid: number;
  readonly name: string;
  readonly start: string;
}

export interface IProcessStatus extends IStartedProcess {
  readonly parent: number;
  readonly session: number;
  readonly state: string;
  readonly command: string;
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
  private static readonly DESKTOP_DEFAULT_WINDOW: readonly [number, number] = [1280, 800];
  private static readonly PROCESSES: string = "/proc";
  private static readonly RUNTIME_ENTRY: string = "/desktop.runtime/services/runtime-entry.js";
  private static readonly DATA_ARGUMENT: string = "--data-dir";
  private static readonly ZOMBIE: string = "Z";
  private static readonly NO_SESSION: number = -1;
  private static readonly WINDOWS_PROCESSES_QUERY: string = "ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | ForEach-Object { " +
    "[pscustomobject]@{ pid = $_.ProcessId; parent = $_.ParentProcessId; name = $_.Name; start = [string]$_.CreationDate.ToUniversalTime().Ticks; command = [string]$_.CommandLine } })";
  private static readonly MAC_PROCESS_STATUS: string = "/bin/ps";
  private static readonly MAC_STATUS_ARGUMENTS: readonly string[] = ["-axww", "-o", "pid=,ppid=,pgid=,stat=,lstart=,ucomm="];
  private static readonly MAC_COMMAND_ARGUMENTS: readonly string[] = ["-axww", "-o", "pid=,args="];
  private static readonly MAC_STATUS_LINE: RegExp = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([A-Z][a-z]{2} [A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4})\s+(.*?)\s*$/;
  private static readonly MAC_COMMAND_LINE: RegExp = /^\s*(\d+) (.*)$/;
  private static readonly WORK_VARIABLE: string = "TEAMRUN_E2E_WORK";
  private static readonly HOLDERS_WAIT_SECONDS: number = 10;
  private static readonly HOLDERS_EXIT_MILLISECONDS: number = 5_000;
  private static readonly HOLDERS_TIMEOUT: number = 60_000;
  private static readonly UNWRITTEN_CODES: readonly string[] = ["ENOENT", "EBUSY", "EPERM"];
  private static readonly PROCESSES_BUFFER: number = 64 * 1024 * 1024;
  private static readonly HOLDERS_QUERY: string = `$ErrorActionPreference = "Stop"; $held = @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($env:${TeamRunApp.WORK_VARIABLE}, [StringComparison]::OrdinalIgnoreCase) -ge 0 })`;
  private static readonly HOLDERS_LIST: string = "$held | ForEach-Object { \"$($_.ProcessId) $($_.Name)\" }";
  private static readonly HOLDERS_END: string = [
    `if ($held.Count -gt 0) { Wait-Process -Id $held.ProcessId -Timeout ${TeamRunApp.HOLDERS_WAIT_SECONDS} -ErrorAction SilentlyContinue }`,
    "$seen = @{}",
    "function Test-Running($listed) { @(Get-CimInstance Win32_Process -Filter \"ProcessId = $($listed.ProcessId)\" | Where-Object { $_.CreationDate -eq $listed.CreationDate }).Count -gt 0 }",
    "function Stop-Listed($listed, $by) { $id = $listed.ProcessId; $key = \"$id $($listed.CreationDate.Ticks)\"; if ($seen.ContainsKey($key)) { return }; $seen[$key] = $true" +
      "; $process = Get-Process -Id $id -ErrorAction SilentlyContinue" +
      "; try { if ($process) { $null = $process.Handle; if ([Math]::Abs(($process.StartTime - $listed.CreationDate).TotalMilliseconds) -lt 1) { $process.Kill()" +
      `; if (-not $process.WaitForExit(${TeamRunApp.HOLDERS_EXIT_MILLISECONDS})) { throw "it still ran ${TeamRunApp.HOLDERS_EXIT_MILLISECONDS} ms after it was stopped" }` +
      "; \"stopped $id $($listed.Name)$by\" }" +
      " elseif (Test-Running $listed) { \"not stopped $id $($listed.Name)$($by): its start time differs from the listing's\"; return } } }" +
      " catch { if (Test-Running $listed) { \"not stopped $id $($listed.Name)$($by): $($_.Exception.Message)\"; return } }" +
      "; $near = @(Get-CimInstance Win32_Process -Filter \"ProcessId = $id OR ParentProcessId = $id\")" +
      "; $before = @($near | Where-Object { $_.ProcessId -eq $id -and $_.CreationDate -ne $listed.CreationDate } | ForEach-Object { $_.CreationDate }) + [DateTime]::MaxValue" +
      "; $near | Where-Object { $_.ParentProcessId -eq $id -and $_.CreationDate -ge $listed.CreationDate -and $_.CreationDate -lt $before[0] }" +
      " | ForEach-Object { Stop-Listed $_ \" (started by $id)\" } }",
    "$held | ForEach-Object { Stop-Listed $_ \"\" }"
  ].join("; ");

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
    if (this.application === null)
      throw new Error("The app has not started.");
    return this.application;
  }

  public get page(): Page {
    if (this.window === null)
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

  public static pollOf(timeout: number = TeamRunApp.POLL_TIMEOUT): { readonly timeout: number; readonly intervals: number[] } {
    return { timeout, intervals: [...TeamRunApp.POLL_INTERVALS] };
  }

  public static async savedLayoutAsync(page: Page): Promise<string> {
    return JSON.stringify(await page.evaluate(() => window.desktop.readLayout()));
  }

  public static homeVariablesOf(platform: NodeJS.Platform, home: string): Readonly<Record<string, string>> {
    if (platform !== "win32")
      return { HOME: home };
    return { HOME: home, USERPROFILE: home, APPDATA: path.win32.join(home, "AppData", "Roaming"), LOCALAPPDATA: path.win32.join(home, "AppData", "Local") };
  }

  public static shimsOf(platform: NodeJS.Platform, bin: string): readonly (readonly [string, string])[] {
    if (platform === "win32")
      return [[path.win32.join(bin, "codex.cmd"), `@"${process.execPath}" "${TeamRunApp.DOUBLE}" %*\r\n`]];
    return [[path.posix.join(bin, "codex"), `#!/bin/sh\nexec "${process.execPath}" "${TeamRunApp.DOUBLE}" "$@"\n`]];
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
    return Object.fromEntries([...Object.entries(inherited).filter(t => !names.has(nameOf(t[0]))), ...Object.entries(own)]
      .filter((t): t is [string, string] => t[1] !== undefined));
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
    for (const [shim, script] of TeamRunApp.shimsOf(platform, bin)) {
      writeFileSync(shim, script);
      chmodSync(shim, 0o755);
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

  public static processOf(pid: number): IStartedProcess | null {
    const status = TeamRunApp.statusesOf([pid])[0];
    return status === undefined ? null : { pid: status.pid, name: status.name, start: status.start };
  }

  public static isAlive(started: IStartedProcess): boolean {
    return TeamRunApp.aliveOf([started]).length > 0;
  }

  public static aliveOf(started: readonly IStartedProcess[]): readonly IStartedProcess[] {
    const statuses = TeamRunApp.statusesOf(started.map(t => t.pid));
    return started.filter(t => statuses.some(u => u.pid === t.pid && u.start === t.start && u.state !== TeamRunApp.ZOMBIE));
  }

  private static statusesOf(pids: readonly number[] | null): readonly IProcessStatus[] {
    if (process.platform === "win32" || process.platform === "darwin") {
      const listed = process.platform === "win32" ? TeamRunApp.windowsProcesses() : TeamRunApp.macProcesses();
      return pids === null ? listed : listed.filter(t => pids.includes(t.pid));
    }
    const all = pids ?? readdirSync(TeamRunApp.PROCESSES).filter(t => /^\d+$/.test(t)).map(Number);
    return all.map(t => TeamRunApp.statusOf(t)).filter(t => t !== null);
  }

  private static windowsProcesses(): readonly IProcessStatus[] {
    const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", TeamRunApp.WINDOWS_PROCESSES_QUERY],
      { encoding: "utf8", timeout: TeamRunApp.HOLDERS_TIMEOUT, killSignal: "SIGKILL", maxBuffer: TeamRunApp.PROCESSES_BUFFER });
    if (result.status !== 0)
      throw new Error(`Listing the processes failed with ${result.status}: ${result.error?.message ?? (result.stderr ?? "").trim()}`);
    const parsed: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(parsed))
      throw new Error("Listing the processes gave no list.");
    const listed: readonly unknown[] = parsed;
    return listed.filter(TeamRunApp.isRecord).map(t => ({ pid: Number(t["pid"]), parent: Number(t["parent"]), name: String(t["name"]), start: String(t["start"]),
      command: String(t["command"]), session: TeamRunApp.NO_SESSION, state: "" }));
  }

  private static macProcesses(): readonly IProcessStatus[] {
    const commands = new Map(TeamRunApp.macList(TeamRunApp.MAC_COMMAND_ARGUMENTS).map(t => TeamRunApp.MAC_COMMAND_LINE.exec(t))
      .filter(t => t !== null).map((t): [number, string] => [Number(t[1]), t[2] ?? ""]));
    return TeamRunApp.macList(TeamRunApp.MAC_STATUS_ARGUMENTS).map(t => TeamRunApp.MAC_STATUS_LINE.exec(t)).filter(t => t !== null).map(t => {
      const pid = Number(t[1]);
      return { pid, parent: Number(t[2]), session: Number(t[3]), state: (t[4] ?? "").charAt(0), start: String(Date.parse(t[5] ?? "") / 1_000), name: t[6] ?? "",
        command: commands.get(pid) ?? "" };
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
    return typeof value === "object" && value !== null;
  }

  private static statusOf(pid: number): IProcessStatus | null {
    let stat: string;
    try {
      stat = readFileSync(path.join(TeamRunApp.PROCESSES, String(pid), "stat"), "utf8");
    }
    catch {
      return null;
    }
    const end = stat.lastIndexOf(")");
    const fields = stat.slice(end + 2).split(" ");
    return { pid, name: stat.slice(stat.indexOf("(") + 1, end), start: fields[19] ?? "", parent: Number(fields[1]), session: Number(fields[3]), state: fields[0] ?? "",
      command: "" };
  }

  public static stopAlive(started: readonly IStartedProcess[]): void {
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
    const area = await application.evaluate(({ BrowserWindow, screen }, [width, height]) => {
      for (const shown of BrowserWindow.getAllWindows()) {
        shown.setContentSize(width, height);
        shown.center();
      }
      return screen.getPrimaryDisplay().workArea;
    }, TeamRunApp.DESKTOP_DEFAULT_WINDOW);
    await expect.poll(() => window.evaluate(() => [innerWidth, innerHeight]), {
      message: `the window at Desktop's default size, which the specs were written against, on a screen whose work area is ${area.width}×${area.height}`,
      ...TeamRunApp.pollOf(30_000) }).toEqual([...TeamRunApp.DESKTOP_DEFAULT_WINDOW]);
    return window;
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

  public runtimeProcesses(): readonly IStartedProcess[] {
    if (process.platform !== "linux" && process.platform !== "win32" && process.platform !== "darwin")
      throw new Error("The quit check reads /proc on Linux and the process list on macOS and Windows, so it runs there only.");
    const statuses = TeamRunApp.statusesOf(null);
    const runtime = statuses.filter(t => this.isRuntime(t));
    const sessions = runtime.filter(t => t.session === t.pid).map(t => t.session);
    const found = TeamRunApp.withChildren([...runtime, ...statuses.filter(t => sessions.includes(t.session) && !runtime.includes(t))], statuses);
    return (process.platform === "darwin" ? TeamRunApp.withGroups(found, statuses) : found).map(t => ({ pid: t.pid, name: t.name, start: t.start }));
  }

  private static withGroups(found: readonly IProcessStatus[], statuses: readonly IProcessStatus[]): readonly IProcessStatus[] {
    const all = [...found];
    for (const member of all)
      all.push(...statuses.filter(t => (t.session === member.session || t.parent === member.pid && BigInt(t.start) >= BigInt(member.start)) && !all.includes(t)));
    return all;
  }

  public static withChildren(found: readonly IProcessStatus[], statuses: readonly IProcessStatus[]): readonly IProcessStatus[] {
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
    if (child === null || child.exitCode !== null || child.signalCode !== null)
      return child?.exitCode ?? null;
    return TeamRunApp.withinAsync(new Promise<number | null>(resolve => child.once("exit", code => resolve(code))), TeamRunApp.EXIT_TIMEOUT, null);
  }

  public async snapshotAsync(testInfo: TestInfo, name: string): Promise<void> {
    if (this.application !== null)
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
      if (application !== null)
        await TeamRunApp.endRefusedNavigationAsync(application, window.url());
      const shot = await window.screenshot({ timeout: TeamRunApp.SNAPSHOT_TIMEOUT }).catch(() => null);
      if (shot !== null)
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
    if (application === null || this.hasExited || !this.isTracing)
      return;
    this.isTracing = false;
    const file = testInfo.outputPath(TeamRunApp.TRACE_FILE);
    const failure = await TeamRunApp.withinAsync(application.context().tracing.stop(failed ? { path: file } : {}).then(() => null, (error: unknown) => String(error)),
      TeamRunApp.SNAPSHOT_TIMEOUT, `stopping it took over ${TeamRunApp.SNAPSHOT_TIMEOUT} ms`);
    if (failure !== null)
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

  private static holdersOf(work: string, end: boolean): { readonly lines: readonly string[]; readonly failure: string | null } {
    const script = [TeamRunApp.HOLDERS_QUERY, end ? TeamRunApp.HOLDERS_END : TeamRunApp.HOLDERS_LIST].join("; ");
    const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", env: { ...process.env, [TeamRunApp.WORK_VARIABLE]: work }, timeout: TeamRunApp.HOLDERS_TIMEOUT, killSignal: "SIGKILL" });
    const lines = (result.stdout ?? "").split(/\r?\n/).map(t => t.trim()).filter(t => t !== "");
    if (result.error !== undefined)
      return { lines, failure: result.error.message };
    return { lines, failure: result.status === 0 ? null : `PowerShell ended with ${result.status}: ${(result.stderr ?? "").trim()}` };
  }

  private removeHeldWork(): void {
    if (process.platform !== "win32") {
      TeamRunApp.removeWork(this.work);
      return;
    }
    const ended = TeamRunApp.holdersOf(this.work, true);
    if (ended.lines.length > 0)
      process.stdout.write(`What still named the work folder ${TeamRunApp.HOLDERS_WAIT_SECONDS} s after the app ended, and what it started: ${ended.lines.join(", ")}\n`);
    if (ended.failure !== null)
      process.stdout.write(`Waiting for what names the work folder failed: ${ended.failure}\n`);
    try {
      TeamRunApp.removeWork(this.work);
    }
    catch (error) {
      const holders = TeamRunApp.holdersOf(this.work, false);
      const named = holders.failure === null ? holders.lines.join(", ") || "none" : `unknown, since listing them failed: ${holders.failure}`;
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
    if (application === null || this.hasExited)
      return;
    const closed = await TeamRunApp.withinAsync(application.close().then(() => true, () => false), TeamRunApp.CLOSE_TIMEOUT, false);
    const pid = this.child?.pid;
    if (!closed && !this.hasExited && pid !== undefined) {
      TeamRunApp.stop(-pid);
      TeamRunApp.stop(pid);
    }
    await this.waitForExitAsync();
  }

  private isRuntime(status: IProcessStatus): boolean {
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
      if (pid !== null && TeamRunApp.isRunning(pid) && TeamRunApp.startedBefore(pid, file))
        TeamRunApp.stop(pid);
    }
  }
}

export const test = base.extend<{ app: TeamRunApp; isAppTraced: boolean }>({
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
