/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";
import type { Browser, Frame, Page } from "playwright";

export class ProfiledApp {
  private static readonly MAIN: readonly string[] = ["node_modules", "@noldova", "desktop.electron", "main.js"];
  private static readonly RUNTIME_ENTRY: string = "runtime-entry";
  private static readonly EXPLORER: string = ".nol-teamrun-projects";
  private static readonly WELCOME: string = "Welcome to TeamRun";
  private static readonly SKIP: string = "Skip for now";
  private static readonly PROVIDERS: string = "nol-teamrun-providers-view";
  private static readonly VIEWPORT: { readonly width: number; readonly height: number } = { width: 1920, height: 1080 };
  private static readonly HOST: string = "127.0.0.1";
  private static readonly START_LIMIT: number = 180_000;
  private static readonly WELCOME_LIMIT: number = 60_000;
  private static readonly EXIT_LIMIT: number = 60_000;
  private static readonly RUNTIME_LIMIT: number = 90_000;
  private static readonly TERMINATED_LIMIT: number = 20_000;
  private static readonly POLL: number = 1000;
  private static readonly FRAME_POLL: number = 500;
  private static readonly OUTPUT_LENGTH: number = 300;

  public readonly page: Page;
  public readonly frame: Frame;
  private readonly child: ChildProcess;
  private readonly browser: Browser;
  private readonly data: string;
  private readonly log: (text: string) => void;
  private exited: boolean = false;

  private constructor(child: ChildProcess, browser: Browser, page: Page, frame: Frame, data: string, log: (text: string) => void) {
    this.child = child;
    this.browser = browser;
    this.page = page;
    this.frame = frame;
    this.data = data;
    this.log = log;
    child.once("exit", code => {
      this.exited = true;
      log(`app exited ${code}`);
    });
  }

  public static async startAsync(root: string, data: string, device: string, nodeProfiles: string | null, log: (text: string) => void): Promise<ProfiledApp> {
    const appFolder = path.join(root, "app");
    const electron = String(createRequire(path.join(appFolder, "package.json"))("electron"));
    const playwright: typeof import("playwright") = createRequire(path.join(root, "package.json"))("playwright");
    const { chromium } = playwright;
    const environment = Object.fromEntries(Object.entries(process.env).filter(t => t[0] !== "ELECTRON_RUN_AS_NODE"));
    if (!Object.isNull(nodeProfiles))
      environment["NODE_OPTIONS"] = `--cpu-prof --cpu-prof-dir=${nodeProfiles}`;
    const port = await ProfiledApp.findFreePortAsync();
    const child = spawn(electron, [path.join(appFolder, ...ProfiledApp.MAIN), `--data-dir=${data}`, `--device-dir=${device}`, `--remote-debugging-port=${port}`],
      { cwd: appFolder, env: environment, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    let exited = false;
    child.once("exit", () => exited = true);
    const tail = (output: Buffer): void => {
      const text = output.toString().trim();
      if (text.length > 0)
        log(`app: ${text.slice(0, ProfiledApp.OUTPUT_LENGTH)}`);
    };
    child.stdout?.on("data", tail);
    child.stderr?.on("data", tail);
    log(`launched ${electron} with debugging port ${port}`);

    const started = Date.now();
    let browser: Browser | null = null;
    try {
      while (Date.now() - started < ProfiledApp.START_LIMIT && Object.isNull(browser) && !exited) {
        browser = await fetch(`http://${ProfiledApp.HOST}:${port}/json/version`)
          .then(t => t.ok ? chromium.connectOverCDP(`http://${ProfiledApp.HOST}:${port}`) : null, () => null);
        if (Object.isNull(browser))
          await delay(ProfiledApp.POLL);
      }
      const found = Object.isNull(browser) ? null : await ProfiledApp.findExplorerAsync(browser, started);
      if (Object.isNull(browser) || Object.isNull(found))
        throw new Error(`TeamRun's explorer didn't show within ${ProfiledApp.START_LIMIT / 1000} s; connected: ${!Object.isNull(browser)}, exited: ${exited}.`);
      await found[0].setViewportSize(ProfiledApp.VIEWPORT);
      log(`ready in ${Date.now() - started} ms; frames: ${found[0].frames().length}; viewport ${ProfiledApp.VIEWPORT.width}x${ProfiledApp.VIEWPORT.height}`);
      return new ProfiledApp(child, browser, found[0], found[1], data, log);
    }
    catch (error) {
      log("the start failed; stopping the app and its runtime");
      await browser?.close().catch(() => undefined);
      ProfiledApp.stopTree(child, exited);
      await ProfiledApp.sweepRuntimesAsync(data, log);
      throw error;
    }
  }

  public async skipWelcomeAsync(expected: boolean): Promise<void> {
    if (!expected)
      return;
    const providers = this.frame.locator(ProfiledApp.PROVIDERS);
    const welcome = providers.getByRole("note", { name: ProfiledApp.WELCOME });
    await welcome.waitFor({ timeout: ProfiledApp.WELCOME_LIMIT });
    await providers.getByRole("button", { name: ProfiledApp.SKIP, exact: true }).click({ timeout: ProfiledApp.WELCOME_LIMIT });
    await welcome.waitFor({ state: "hidden" });
    this.log("skipped the welcome");
  }

  public async stopAsync(): Promise<void> {
    const session = await this.page.context().newCDPSession(this.page).catch(() => null);
    await session?.send("Browser.close").catch(() => undefined);
    for (let waited = 0; waited < ProfiledApp.EXIT_LIMIT && !this.exited; waited += ProfiledApp.POLL)
      await delay(ProfiledApp.POLL);
    if (!this.exited) {
      this.log("app still running after Browser.close; stopping it");
      ProfiledApp.stopTree(this.child, false);
    }
    await this.browser.close().catch(() => undefined);
    await ProfiledApp.sweepRuntimesAsync(this.data, this.log);
  }

  private static findFreePortAsync(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, ProfiledApp.HOST, () => {
        const address = server.address();
        server.close(() => Object.isObject(address) ? resolve(address.port) : reject(new Error("No free port for the debugging protocol.")));
      });
    });
  }

  private static async findExplorerAsync(browser: Browser, started: number): Promise<[Page, Frame] | null> {
    while (Date.now() - started < ProfiledApp.START_LIMIT) {
      for (const page of browser.contexts().flatMap(t => t.pages()))
        for (const frame of page.frames())
          if (await frame.locator(ProfiledApp.EXPLORER).count().catch(() => 0) > 0)
            return [page, frame];
      await delay(ProfiledApp.FRAME_POLL);
    }
    return null;
  }

  private static stopTree(child: ChildProcess, exited: boolean): void {
    if (exited || Object.isUndefined(child.pid))
      return;
    try {
      if (process.platform === "win32")
        execFileSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { stdio: "ignore" });
      else
        process.kill(-child.pid, "SIGTERM");
    }
    catch { }
  }

  private static async sweepRuntimesAsync(data: string, log: (text: string) => void): Promise<void> {
    for (let waited = 0; waited < ProfiledApp.RUNTIME_LIMIT && ProfiledApp.runtimeIds(data).length > 0; waited += ProfiledApp.POLL)
      await delay(ProfiledApp.POLL);
    for (const id of ProfiledApp.runtimeIds(data)) {
      log(`runtime ${id} still running; ending it`);
      try {
        process.kill(id, "SIGTERM");
      }
      catch { }
    }
    for (let waited = 0; waited < ProfiledApp.TERMINATED_LIMIT && ProfiledApp.runtimeIds(data).length > 0; waited += ProfiledApp.POLL)
      await delay(ProfiledApp.POLL);
    log(`runtime processes left: ${ProfiledApp.runtimeIds(data).join(", ") || "none"}`);
  }

  private static runtimeIds(data: string): readonly number[] {
    const own = (commandLine: string): boolean => commandLine.includes(ProfiledApp.RUNTIME_ENTRY) && commandLine.includes(data);
    try {
      if (process.platform === "win32") {
        const listed = execFileSync("powershell", ["-NoProfile", "-Command",
          "Get-CimInstance Win32_Process | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"], { encoding: "utf8" });
        return listed.split(/\r?\n/).map(t => t.split("\t")).filter(t => own(t.slice(1).join("\t"))).map(t => Number(t[0])).filter(t => t > 0 && t !== process.pid);
      }
      const listed = execFileSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
      return listed.split("\n").map(t => t.trim()).filter(t => own(t)).map(t => Number.parseInt(t, 10)).filter(t => t > 0 && t !== process.pid);
    }
    catch {
      return [];
    }
  }
}
