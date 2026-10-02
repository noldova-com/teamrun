/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type ElectronApplication, type Page, type TestInfo, _electron, expect } from "@playwright/test";

export default class DesktopApplicationFixture {
  private static readonly MAIN: string = path.resolve("node_modules", "@noldova", "teamrun-shell-desktop", "main.js");
  private static readonly VIEWPORT_WIDTH: number = 1920;
  private static readonly VIEWPORT_HEIGHT: number = 1080;
  private static readonly LAUNCH_ARGUMENTS: readonly string[] = ["--disable-gpu", "--disable-software-rasterizer"];
  private static readonly EXPECTED_OUTPUT: readonly RegExp[] = [/^\[\d+:\d+(?:\/\d+)?\.\d+:\w+:/, /^Debugger (?:listening|attached|ending)/, /^For help, see/];
  private static readonly PROFILE_PREFIX: string = "teamrun-ui-";
  private static readonly TRACE_FILE: string = "trace.zip";

  private readonly testInfo: TestInfo;
  private readonly profile: string;
  private readonly process: ChildProcess;

  public readonly application: ElectronApplication;
  public readonly window: Page;
  public readonly failures: string[];

  private constructor(testInfo: TestInfo, profile: string, application: ElectronApplication, window: Page, failures: string[]) {
    this.testInfo = testInfo;
    this.profile = profile;
    this.application = application;
    this.window = window;
    this.failures = failures;
    this.process = application.process();
  }

  public static async launchAsync(testInfo: TestInfo): Promise<DesktopApplicationFixture> {
    const profile = await mkdtemp(path.join(os.tmpdir(), DesktopApplicationFixture.PROFILE_PREFIX));
    const application = await _electron.launch({
      args: [DesktopApplicationFixture.MAIN, `--user-data-dir=${profile}`, ...DesktopApplicationFixture.LAUNCH_ARGUMENTS]
    });
    const failures: string[] = [];
    application.process().stderr?.on("data", (data: Buffer) => failures.push(...DesktopApplicationFixture.unexpectedLines(data.toString())));
    application.on("console", t => {
      if (t.type() === "error")
        failures.push(`main: ${t.text()}`);
    });
    await application.context().tracing.start({ screenshots: true, snapshots: true });
    const window = await application.firstWindow();
    window.on("console", t => {
      if (t.type() === "error")
        failures.push(`renderer: ${t.text()}`);
    });
    window.on("pageerror", t => failures.push(`renderer: ${t.message}`));
    const fixture = new DesktopApplicationFixture(testInfo, profile, application, window, failures);
    await fixture.recordEnvironmentAsync();
    await expect.poll(() => fixture.isVisibleAsync()).toBe(true);
    return fixture;
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

  public async checkpointAsync(name: string): Promise<void> {
    const image = await this.window.screenshot({ scale: "css" });
    expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([DesktopApplicationFixture.VIEWPORT_WIDTH, DesktopApplicationFixture.VIEWPORT_HEIGHT]);
    await this.testInfo.attach(name, { body: image, contentType: "image/png" });
  }

  public async closeAsync(): Promise<number | null> {
    const exited = new Promise<number | null>(resolve => this.process.once("exit", resolve));
    await this.application.close();
    return this.process.exitCode ?? await exited;
  }

  public async disposeAsync(): Promise<void> {
    const isRunning = Object.is(this.process.exitCode, null);
    if (isRunning && this.testInfo.status !== this.testInfo.expectedStatus) {
      const trace = this.testInfo.outputPath(DesktopApplicationFixture.TRACE_FILE);
      await this.application.context().tracing.stop({ path: trace });
      await this.testInfo.attach(DesktopApplicationFixture.TRACE_FILE, { path: trace, contentType: "application/zip" });
    }
    if (isRunning)
      await this.application.close();
    await rm(this.profile, { recursive: true, force: true, maxRetries: 10 });
  }

  private static readRevision(): string {
    const result = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
    return result.status === 0 ? result.stdout.trim() : "unknown";
  }

  private static unexpectedLines(text: string): string[] {
    return text.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0 && !DesktopApplicationFixture.EXPECTED_OUTPUT.some(pattern => pattern.test(t))).map(t => `main: ${t}`);
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
