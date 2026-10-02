/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type ElectronApplication, type Page, type TestInfo, _electron, expect } from "@playwright/test";

export default class DesktopApplicationFixture {
  private static readonly MAIN: string = path.resolve("node_modules", "@noldova", "teamrun-shell-desktop", "main.js");
  private static readonly VIEWPORT_WIDTH: number = 1920;
  private static readonly VIEWPORT_HEIGHT: number = 1080;
  private static readonly LAUNCH_ARGUMENTS: readonly string[] = ["--disable-gpu", "--disable-software-rasterizer"];
  private static readonly EXPECTED_OUTPUT: readonly RegExp[] = [/^\[\d+:\d+(?:\/\d+)?\.\d+:\w+:/, /^Debugger (?:listening|attached|ending)/, /^For help, see/];
  private static readonly PLATFORM_LOG: RegExp = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+ Electron(?: Helper(?: \([A-Za-z]+\))?)?\[\d+:\d+\] /;
  private static readonly PLATFORM_LOG_ANNOTATION: string = "platform-log";
  private static readonly PROFILE_PREFIX: string = "teamrun-ui-";
  private static readonly TRACE_FILE: string = "trace.zip";
  private static readonly MAIN_WINDOW: string = "main-window";

  private readonly testInfo: TestInfo;
  private readonly profile: string;
  private readonly environment: Readonly<Record<string, string>>;
  private electronApplication: ElectronApplication | null = null;
  private page: Page | null = null;
  private childProcess: ChildProcess | null = null;

  public readonly failures: string[] = [];

  private constructor(testInfo: TestInfo, profile: string, environment: Readonly<Record<string, string>>) {
    this.testInfo = testInfo;
    this.profile = profile;
    this.environment = environment;
  }

  public static async launchAsync(testInfo: TestInfo, environment: Readonly<Record<string, string>> = {}): Promise<DesktopApplicationFixture> {
    const profile = await mkdtemp(path.join(os.tmpdir(), DesktopApplicationFixture.PROFILE_PREFIX));
    const fixture = new DesktopApplicationFixture(testInfo, profile, environment);
    await fixture.startAsync();
    await fixture.recordEnvironmentAsync();
    return fixture;
  }

  public get application(): ElectronApplication {
    if (this.electronApplication === null)
      throw new Error("TeamRun is not running.");
    return this.electronApplication;
  }

  public get window(): Page {
    if (this.page === null)
      throw new Error("TeamRun is not running.");
    return this.page;
  }

  public async restartAsync(): Promise<void> {
    expect(await this.closeAsync()).toBe(0);
    await this.startAsync();
  }

  public async isVisibleAsync(): Promise<boolean> {
    return await this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(t => t.isVisible()));
  }

  public async useSuiteViewportAsync(): Promise<void> {
    const session = await this.window.context().newCDPSession(this.window);
    await session.send("Emulation.setDeviceMetricsOverride", {
      width: DesktopApplicationFixture.VIEWPORT_WIDTH,
      height: DesktopApplicationFixture.VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false
    });
    await expect.poll(() => this.window.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]))
      .toEqual([DesktopApplicationFixture.VIEWPORT_WIDTH, DesktopApplicationFixture.VIEWPORT_HEIGHT, 1]);
  }

  public async checkpointAsync(name: string): Promise<Buffer> {
    const image = await this.window.screenshot({ scale: "css" });
    expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([DesktopApplicationFixture.VIEWPORT_WIDTH, DesktopApplicationFixture.VIEWPORT_HEIGHT]);
    await this.testInfo.attach(name, { body: image, contentType: "image/png" });
    return image;
  }

  public async captureMainWindowAsync(): Promise<void> {
    const image = await this.checkpointAsync(DesktopApplicationFixture.MAIN_WINDOW);
    const file = `${DesktopApplicationFixture.MAIN_WINDOW}-${process.platform}-${process.arch}.png`;
    await writeFile(path.join(this.testInfo.project.outputDir, "..", file), image);
  }

  public async closeAsync(): Promise<number | null> {
    const child = this.requireProcess();
    const exited = new Promise<number | null>(resolve => child.once("exit", resolve));
    await this.application.close();
    this.electronApplication = null;
    this.page = null;
    return child.exitCode ?? await exited;
  }

  public async disposeAsync(): Promise<void> {
    const isRunning = this.electronApplication !== null && Object.is(this.requireProcess().exitCode, null);
    if (isRunning && this.testInfo.status !== this.testInfo.expectedStatus) {
      const trace = this.testInfo.outputPath(DesktopApplicationFixture.TRACE_FILE);
      await this.application.context().tracing.stop({ path: trace });
      await this.testInfo.attach(DesktopApplicationFixture.TRACE_FILE, { path: trace, contentType: "application/zip" });
    }
    if (isRunning)
      await this.application.close();
    await rm(this.profile, { recursive: true, force: true, maxRetries: 10 });
  }

  private async startAsync(): Promise<void> {
    const application = await _electron.launch({
      args: [DesktopApplicationFixture.MAIN, `--user-data-dir=${this.profile}`, ...DesktopApplicationFixture.LAUNCH_ARGUMENTS],
      env: Object.fromEntries(Object.entries({ ...process.env, ...this.environment }).filter((t): t is [string, string] => t[1] !== undefined))
    });
    application.process().stderr?.on("data", (data: Buffer) => this.readOutput(data.toString()));
    application.on("console", t => {
      if (t.type() === "error")
        this.failures.push(`main: ${t.text()}`);
    });
    await application.context().tracing.start({ screenshots: true, snapshots: true });
    const window = await application.firstWindow();
    window.on("console", t => {
      if (t.type() === "error")
        this.failures.push(`renderer: ${t.text()}`);
    });
    window.on("pageerror", t => this.failures.push(`renderer: ${t.message}`));
    this.electronApplication = application;
    this.page = window;
    this.childProcess = application.process();
    await expect.poll(() => this.isVisibleAsync()).toBe(true);
  }

  private requireProcess(): ChildProcess {
    if (this.childProcess === null)
      throw new Error("TeamRun was not started.");
    return this.childProcess;
  }

  private static readRevision(): string {
    const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "unknown";
  }

  private readOutput(text: string): void {
    for (const line of text.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0 && !DesktopApplicationFixture.EXPECTED_OUTPUT.some(pattern => pattern.test(t))))
      if (DesktopApplicationFixture.PLATFORM_LOG.test(line))
        this.testInfo.annotations.push({ type: DesktopApplicationFixture.PLATFORM_LOG_ANNOTATION, description: line });
      else
        this.failures.push(`main: ${line}`);
  }

  private async recordEnvironmentAsync(): Promise<void> {
    const electron = await this.application.evaluate(() => ({ electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome }));
    const environment = {
      os: `${os.type()} ${os.release()}`,
      cpu: `${os.arch()} ${os.cpus()[0]?.model ?? "unknown"}`,
      runner: process.env["ImageOS"] ? `${process.env["ImageOS"]} ${process.env["ImageVersion"] ?? ""}`.trim() : "local",
      revision: DesktopApplicationFixture.readRevision(),
      playwright: this.testInfo.config.version,
      electron: electron.electron,
      electronNode: electron.node,
      chrome: electron.chrome,
      hostNode: process.versions.node
    };
    this.testInfo.annotations.push({ type: "environment", description: JSON.stringify(environment) });
  }
}
