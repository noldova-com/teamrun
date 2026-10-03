/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { type ElectronApplication, type Page, type TestInfo, _electron, expect } from "@playwright/test";

import { DataDirectory, DiscoveryReader, RuntimeBuild } from "@noldova/teamrun-shell-runtime";

import ErrorOutputClassifier from "./error-output.classifier.ts";

export default class DesktopApplicationFixture {
  private static readonly MAIN: string = path.resolve("node_modules", "@noldova", "teamrun-shell-desktop", "main.js");
  private static readonly EXECUTABLE_RECORD: string = path.resolve("_build", "development-app", "path.txt");
  private static readonly VIEWPORT_WIDTH: number = 1920;
  private static readonly VIEWPORT_HEIGHT: number = 1080;
  private static readonly LAUNCH_ARGUMENTS: readonly string[] = ["--disable-gpu", "--disable-software-rasterizer"];
  private static readonly PLATFORM_LOG_ANNOTATION: string = "platform-log";
  private static readonly ROOT_PREFIX: string = "teamrun-ui-";
  private static readonly DATA_FOLDER: string = "data";
  private static readonly DEVICE_FOLDER: string = "device";
  private static readonly RUNTIME_STOP_TIMEOUT: number = 15_000;
  private static readonly TRACE_FILE: string = "trace.zip";
  private static readonly WINDOWS_FILE: string = "windows.json";
  private static readonly DIAGNOSTIC_TIMEOUT: number = 10_000;
  private static readonly MAIN_WINDOW: string = "main-window";

  private readonly testInfo: TestInfo;
  private readonly environment: Readonly<Record<string, string>>;
  private readonly extraArguments: readonly string[];
  private readonly output: ErrorOutputClassifier = new ErrorOutputClassifier();
  private electronApplication: ElectronApplication | null = null;
  private page: Page | null = null;
  private childProcess: ChildProcess | null = null;

  public readonly failures: string[] = [];
  public closeMilliseconds: number | null = null;
  public readonly root: string;
  public readonly dataDirectory: string;

  private constructor(testInfo: TestInfo, root: string, environment: Readonly<Record<string, string>>, extraArguments: readonly string[]) {
    this.testInfo = testInfo;
    this.extraArguments = extraArguments;
    this.root = root;
    this.dataDirectory = path.join(root, DesktopApplicationFixture.DATA_FOLDER);
    this.environment = environment;
  }

  public static async launchAsync(
    testInfo: TestInfo,
    environment: Readonly<Record<string, string>> = {},
    dataFiles: Readonly<Record<string, string>> = {},
    extraArguments: readonly string[] = []): Promise<DesktopApplicationFixture> {
    const root = await mkdtemp(path.join(os.tmpdir(), DesktopApplicationFixture.ROOT_PREFIX));
    const fixture = new DesktopApplicationFixture(testInfo, root, environment, extraArguments);
    await mkdir(fixture.dataDirectory);
    for (const [name, text] of Object.entries(dataFiles)) {
      const file = path.join(fixture.dataDirectory, name);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
    }
    try {
      await fixture.startAsync();
      await fixture.recordEnvironmentAsync();
    }
    catch (error) {
      await fixture.disposeAsync(true);
      throw error;
    }
    return fixture;
  }

  public static async stopRuntimeAsync(dataDirectory: string): Promise<void> {
    const discovery = await DiscoveryReader.readAsync(new DataDirectory(dataDirectory));
    if (discovery === null || !DesktopApplicationFixture.isAlive(discovery.processId))
      return;
    process.kill(discovery.processId);
    await expect.poll(() => DesktopApplicationFixture.isAlive(discovery.processId), { timeout: DesktopApplicationFixture.RUNTIME_STOP_TIMEOUT }).toBe(false);
  }

  public static isAlive(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
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

  public async reopenAsync(): Promise<void> {
    expect(await this.closeAsync(true)).toBe(0);
    await this.startAsync();
  }

  public async restartAsync(beforeStart?: () => Promise<void>): Promise<void> {
    expect(await this.closeAsync()).toBe(0);
    await DesktopApplicationFixture.stopRuntimeAsync(this.dataDirectory);
    await beforeStart?.();
    await this.startAsync();
  }

  public acceptFailures(pattern: RegExp): string[] {
    const accepted = this.failures.filter(t => pattern.test(t));
    this.failures.splice(0, this.failures.length, ...this.failures.filter(t => !pattern.test(t)));
    return accepted;
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

  public async closeAsync(keepRuntime: boolean = false): Promise<number | null> {
    const child = this.requireProcess();
    const exited = Object.is(child.exitCode, null) ? new Promise<number | null>(resolve => child.once("exit", resolve)) : Promise.resolve(child.exitCode);
    const started = Date.now();
    await this.application.close();
    this.closeMilliseconds = Date.now() - started;
    const exitCode = await exited;
    this.electronApplication = null;
    this.page = null;
    if (!keepRuntime)
      await DesktopApplicationFixture.stopRuntimeAsync(this.dataDirectory);
    return exitCode;
  }

  public async readRuntimeProcessIdAsync(): Promise<number | undefined> {
    return (await DiscoveryReader.readAsync(new DataDirectory(this.dataDirectory)))?.processId;
  }

  public async disposeAsync(hasFailed: boolean = this.testInfo.status !== this.testInfo.expectedStatus): Promise<void> {
    const isRunning = this.electronApplication !== null && Object.is(this.requireProcess().exitCode, null);
    if (hasFailed)
      await this.keepDiagnosticsAsync(isRunning);
    if (isRunning)
      await this.closeAsync();
    await DesktopApplicationFixture.stopRuntimeAsync(this.dataDirectory);
    await rm(this.root, { recursive: true, force: true, maxRetries: 10 });
  }

  private async keepDiagnosticsAsync(isRunning: boolean): Promise<void> {
    if (isRunning) {
      await this.keepAsync(DesktopApplicationFixture.TRACE_FILE, "application/zip", async () => {
        const trace = this.testInfo.outputPath(DesktopApplicationFixture.TRACE_FILE);
        await this.application.context().tracing.stop({ path: trace });
        return await readFile(trace);
      });
      await this.keepAsync(DesktopApplicationFixture.WINDOWS_FILE, "application/json", async () => JSON.stringify(await this.application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().map(t => ({
          id: t.id,
          isVisible: t.isVisible(),
          isDestroyed: t.isDestroyed(),
          url: t.webContents.getURL(),
          isLoading: t.webContents.isLoading(),
          isCrashed: t.webContents.isCrashed()
        }))), null, 2));
      for (const [index, page] of this.application.windows().entries()) {
        await this.keepAsync(`page-${index}.png`, "image/png", () => page.screenshot());
        await this.keepAsync(`page-${index}.html`, "text/html", () => page.content());
      }
    }
    const logs = new DataDirectory(this.dataDirectory).logsFolder;
    const files = existsSync(logs) ? (await readdir(logs)).sort() : [];
    for (const file of files)
      await this.keepAsync(file, "text/plain", () => readFile(path.join(logs, file)));
  }

  private async keepAsync(name: string, contentType: string, capture: () => Promise<Buffer | string>): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const captured = capture();
    captured.catch(() => undefined);
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`No answer within ${DesktopApplicationFixture.DIAGNOSTIC_TIMEOUT} ms.`)), DesktopApplicationFixture.DIAGNOSTIC_TIMEOUT);
    });
    try {
      await this.testInfo.attach(name, { body: await Promise.race([captured, deadline]), contentType });
    }
    catch (error) {
      await this.testInfo.attach(`${name}.unavailable.txt`, { body: String(error), contentType: "text/plain" });
    }
    finally {
      clearTimeout(timer);
    }
  }

  private async startAsync(): Promise<void> {
    const application = await _electron.launch({
      executablePath: await readFile(DesktopApplicationFixture.EXECUTABLE_RECORD, "utf8"),
      args: [
        DesktopApplicationFixture.MAIN,
        `--data-dir=${this.dataDirectory}`,
        `--device-dir=${path.join(this.root, DesktopApplicationFixture.DEVICE_FOLDER)}`,
        ...DesktopApplicationFixture.LAUNCH_ARGUMENTS,
        ...this.extraArguments
      ],
      cwd: this.root,
      env: Object.fromEntries(Object.entries({ ...process.env, ...this.environment }).filter((t): t is [string, string] => t[1] !== undefined))
    });
    this.electronApplication = application;
    this.childProcess = application.process();
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
    this.page = window;
    await expect.poll(() => this.isVisibleAsync()).toBe(true);
    await expect.poll(async () => (await DiscoveryReader.readAsync(new DataDirectory(this.dataDirectory)))?.productVersion)
      .toBe(RuntimeBuild.identity.productVersion);
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
    for (const line of this.output.classify(text))
      if (line.kind === "platform-log")
        this.testInfo.annotations.push({ type: DesktopApplicationFixture.PLATFORM_LOG_ANNOTATION, description: line.text });
      else
        this.failures.push(`main: ${line.text}`);
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
