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
import { setTimeout as delay } from "node:timers/promises";

import { type ElectronApplication, type Page, type TestInfo, _electron, expect } from "@playwright/test";

import { StopPolicy } from "@noldova/teamrun-shell-protocol";
import { DataDirectory, DiscoveryReader, Endpoint, OwnershipLock, RuntimeBuild, RuntimeClient, type RuntimeDiscovery } from "@noldova/teamrun-shell-runtime";

import ErrorOutputClassifier from "./error-output.classifier.ts";
import OffCursorPlacement from "./off-cursor-placement.ts";
import ProcessListFixture from "./process-list.fixture.ts";

interface MainProcessSilence {
  readonly action: string;
  readonly since: number;
  readonly processorMilliseconds: number | null;
}

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
  private static readonly OWNERSHIP_INTERVAL: number = 50;
  private static readonly NOT_A_DATABASE: number = 26;
  private static readonly CLIENT_NAME: string = "ui-test";
  private static readonly PROCESS_EXIT_TIMEOUT: number = 30_000;
  private static readonly REMOVE_RETRIES: number = 3;
  private static readonly LOCKED_CODES: readonly string[] = ["EBUSY", "EPERM", "ENOTEMPTY"];
  private static readonly TRACE_FILE: string = "trace.zip";
  private static readonly WINDOWS_FILE: string = "windows.json";
  private static readonly DIAGNOSTIC_TIMEOUT: number = 10_000;
  private static readonly MAIN_PROCESS_TIMEOUT: number = 10_000;
  private static readonly SILENCE_FILE: string = "main-process.txt";
  private static readonly MAIN_WINDOW: string = "main-window";
  private static readonly NO_ANSWER: unique symbol = Symbol("no answer");

  private readonly testInfo: TestInfo;
  private readonly environment: Readonly<Record<string, string>>;
  private readonly extraArguments: readonly string[];
  private readonly output: ErrorOutputClassifier = new ErrorOutputClassifier();
  private electronApplication: ElectronApplication | null = null;
  private page: Page | null = null;
  private childProcess: ChildProcess | null = null;
  private viewport: { width: number; height: number } | null;
  private readonly recorded: Set<number> = new Set();
  private placement: string = "The window had not been moved off the cursor.";
  private silence: MainProcessSilence | null = null;
  private mainProcessId: number | null = null;

  public readonly failures: string[] = [];
  public closeMilliseconds: number | null = null;
  public readonly root: string;
  public readonly dataDirectory: string;

  private constructor(testInfo: TestInfo, root: string, environment: Readonly<Record<string, string>>, extraArguments: readonly string[], placesWindow: boolean) {
    this.testInfo = testInfo;
    this.extraArguments = extraArguments;
    this.viewport = placesWindow ? null : { width: DesktopApplicationFixture.VIEWPORT_WIDTH, height: DesktopApplicationFixture.VIEWPORT_HEIGHT };
    this.root = root;
    this.dataDirectory = path.join(root, DesktopApplicationFixture.DATA_FOLDER);
    this.environment = environment;
  }

  public static async launchAsync(
    testInfo: TestInfo,
    environment: Readonly<Record<string, string>> = {},
    dataFiles: Readonly<Record<string, string>> = {},
    extraArguments: readonly string[] = [],
    placesWindow: boolean = false): Promise<DesktopApplicationFixture> {
    const root = await mkdtemp(path.join(os.tmpdir(), DesktopApplicationFixture.ROOT_PREFIX));
    const fixture = new DesktopApplicationFixture(testInfo, root, environment, extraArguments, placesWindow);
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
    const directory = new DataDirectory(dataDirectory);
    const discovery = await DiscoveryReader.readAsync(directory);
    const answer = discovery !== null && DesktopApplicationFixture.isAlive(discovery.processId)
      ? await DesktopApplicationFixture.askToStopAsync(discovery)
      : "it had already withdrawn its discovery file";
    const deadline = Date.now() + DesktopApplicationFixture.RUNTIME_STOP_TIMEOUT;
    while (DesktopApplicationFixture.isOwned(directory)) {
      if (Date.now() >= deadline) {
        const seconds = DesktopApplicationFixture.RUNTIME_STOP_TIMEOUT / 1000;
        if (discovery === null)
          throw new Error(`A runtime still owned ${dataDirectory} ${seconds} s after the test found it stopping, and it had no discovery file to name its process.`);
        process.kill(discovery.processId);
        throw new Error(`The runtime ${discovery.processId} still owned ${dataDirectory} ${seconds} s after it was asked to stop (${answer}), so the test killed it.`);
      }
      await delay(DesktopApplicationFixture.OWNERSHIP_INTERVAL);
    }
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

  public get recordedProcessIds(): readonly number[] {
    return [...this.recorded];
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
    return await this.answerAsync("say whether a window is visible", this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(t => t.isVisible())));
  }

  public async useViewportAsync(width: number, height: number): Promise<void> {
    this.viewport = { width, height };
    await this.applyViewportAsync(this.viewport);
  }

  public async checkpointAsync(name: string): Promise<Buffer> {
    const image = await this.window.screenshot({ scale: "css" });
    if (this.viewport !== null)
      expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([this.viewport.width, this.viewport.height]);
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
    try {
      await this.recordProcessesAsync();
      const started = Date.now();
      await this.answerAsync("quit", this.application.close());
      this.closeMilliseconds = Date.now() - started;
    }
    catch (error) {
      if (this.silence === null)
        throw error;
      const processId = this.readMainProcessId();
      if (DesktopApplicationFixture.isAlive(processId))
        process.kill(processId, "SIGKILL");
      child.kill("SIGKILL");
      this.failures.push(`The main process ${processId} did not answer for ${Math.round((Date.now() - this.silence.since) / 1000)} s after it was asked to ${this.silence.action}, so the test killed it.`);
    }
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
    if (isRunning && this.viewport !== null && this.silence === null)
      await this.checkGuardAsync(this.viewport).catch((error: unknown) => this.failures.push((error as Error).message));
    if (hasFailed || this.silence !== null)
      await this.keepDiagnosticsAsync(isRunning);
    if (isRunning)
      await this.closeAsync();
    await DesktopApplicationFixture.stopRuntimeAsync(this.dataDirectory);
    await this.removeFolderAsync();
  }

  private async removeFolderAsync(): Promise<void> {
    await this.failIfRunningAsync(await ProcessListFixture.waitForSignalsAsync([...this.recorded], DesktopApplicationFixture.PROCESS_EXIT_TIMEOUT));
    try {
      await rm(this.root, { recursive: true, force: true });
      return;
    }
    catch (error) {
      if (!DesktopApplicationFixture.LOCKED_CODES.includes((error as NodeJS.ErrnoException).code ?? ""))
        throw error;
    }
    await this.failIfRunningAsync(await ProcessListFixture.waitForExitAsync([...this.recorded], DesktopApplicationFixture.PROCESS_EXIT_TIMEOUT));
    await rm(this.root, { recursive: true, force: true, maxRetries: DesktopApplicationFixture.REMOVE_RETRIES });
  }

  private async recordProcessesAsync(): Promise<void> {
    const electron = await this.answerAsync("list its processes", this.application.evaluate(({ app }) => ({ main: process.pid, all: app.getAppMetrics().map(t => t.pid) })));
    this.mainProcessId = electron.main;
    const runtime = await this.readRuntimeProcessIdAsync();
    for (const processId of [...electron.all, ...runtime === undefined ? [] : [runtime]])
      this.recorded.add(processId);
  }

  private async failIfRunningAsync(running: readonly number[]): Promise<void> {
    if (running.length === 0)
      return;
    const described = await ProcessListFixture.describeAsync(running);
    throw new Error(`TeamRun's processes ${described} still run ${DesktopApplicationFixture.PROCESS_EXIT_TIMEOUT / 1000} s after it closed, so its folder ${this.root} is kept.`);
  }

  private async keepDiagnosticsAsync(isRunning: boolean): Promise<void> {
    const logs = new DataDirectory(this.dataDirectory).logsFolder;
    const files = existsSync(logs) ? (await readdir(logs)).sort() : [];
    for (const file of files)
      await this.keepAsync(file, "text/plain", () => readFile(path.join(logs, file)));
    if (!isRunning)
      return;
    const silence = this.silence;
    if (silence !== null)
      await this.keepAsync(DesktopApplicationFixture.SILENCE_FILE, "text/plain", () => this.describeSilenceAsync(silence));
    for (const [index, page] of this.application.windows().entries()) {
      await this.keepAsync(`page-${index}.png`, "image/png", () => page.screenshot());
      await this.keepAsync(`page-${index}.html`, "text/html", () => page.content());
    }
    await this.keepAsync(DesktopApplicationFixture.WINDOWS_FILE, "application/json", async () => JSON.stringify(await this.answerAsync("describe its windows", this.application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map(t => ({
        id: t.id,
        isVisible: t.isVisible(),
        isDestroyed: t.isDestroyed(),
        url: t.webContents.getURL(),
        isLoading: t.webContents.isLoading(),
        isCrashed: t.webContents.isCrashed()
      })))), null, 2));
    await this.keepAsync(DesktopApplicationFixture.TRACE_FILE, "application/zip", async () => {
      const trace = this.testInfo.outputPath(DesktopApplicationFixture.TRACE_FILE);
      await this.application.context().tracing.stop({ path: trace });
      return await readFile(trace);
    });
  }

  private async keepAsync(name: string, contentType: string, capture: () => Promise<Buffer | string>): Promise<void> {
    try {
      const body = await DesktopApplicationFixture.withinAsync(capture(), DesktopApplicationFixture.DIAGNOSTIC_TIMEOUT);
      if (body === DesktopApplicationFixture.NO_ANSWER)
        throw new Error(`No answer within ${DesktopApplicationFixture.DIAGNOSTIC_TIMEOUT} ms.`);
      await this.testInfo.attach(name, { body, contentType });
    }
    catch (error) {
      await this.testInfo.attach(`${name}.unavailable.txt`, { body: String(error), contentType: "text/plain" });
    }
  }

  private async describeSilenceAsync(silence: MainProcessSilence): Promise<string> {
    const processId = this.readMainProcessId();
    const processorMilliseconds = await ProcessListFixture.readProcessorMillisecondsAsync(processId).catch(() => null);
    const started = Date.now();
    const request = this.window.evaluate(() => (Reflect.get(globalThis, "teamrun") as { readBuild(): Promise<unknown> }).readBuild());
    const answer = await DesktopApplicationFixture.withinAsync(request.then(() => null, (error: unknown) => String(error)), DesktopApplicationFixture.MAIN_PROCESS_TIMEOUT);
    const described = answer === DesktopApplicationFixture.NO_ANSWER
      ? `had no answer within ${DesktopApplicationFixture.MAIN_PROCESS_TIMEOUT / 1000} s`
      : answer === null ? `was answered in ${Date.now() - started} ms` : `failed: ${answer}`;
    const time = (milliseconds: number | null): string => milliseconds === null ? "unknown" : `${milliseconds} ms`;
    return [
      `The main process ${processId} stopped answering when it was asked to ${silence.action}, ${Math.round((Date.now() - silence.since) / 1000)} s before this report.`,
      `Its processor time was ${time(silence.processorMilliseconds)} when it stopped answering and ${time(processorMilliseconds)} now.`,
      `The window's request to it, teamrun.readBuild(), ${described}.`,
      this.placement
    ].join("\n");
  }

  private async answerAsync<T>(action: string, evaluation: Promise<T>): Promise<T> {
    if (this.silence !== null) {
      evaluation.catch(() => undefined);
      throw new Error(`The main process has not answered since it was asked to ${this.silence.action}, so the test did not wait for it to ${action}.`);
    }
    const answer = await DesktopApplicationFixture.withinAsync(evaluation, DesktopApplicationFixture.MAIN_PROCESS_TIMEOUT);
    if (answer !== DesktopApplicationFixture.NO_ANSWER)
      return answer;
    const since = Date.now() - DesktopApplicationFixture.MAIN_PROCESS_TIMEOUT;
    const processorMilliseconds = await ProcessListFixture.readProcessorMillisecondsAsync(this.readMainProcessId()).catch(() => null);
    this.silence = { action, since, processorMilliseconds };
    throw new Error(`The main process did not answer within ${DesktopApplicationFixture.MAIN_PROCESS_TIMEOUT / 1000} s when asked to ${action}. ${this.placement}`);
  }

  private static async withinAsync<T>(work: Promise<T>, limit: number): Promise<T | typeof DesktopApplicationFixture.NO_ANSWER> {
    work.catch(() => undefined);
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<typeof DesktopApplicationFixture.NO_ANSWER>(resolve => {
      timer = setTimeout(() => resolve(DesktopApplicationFixture.NO_ANSWER), limit);
    });
    try {
      return await Promise.race([work, deadline]);
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
    this.mainProcessId = null;
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
    await this.recordProcessesAsync();
    if (this.viewport !== null)
      await this.applyViewportAsync(this.viewport);
  }

  private async applyViewportAsync(viewport: { width: number; height: number }): Promise<void> {
    await this.moveOffCursorAsync();
    const session = await this.window.context().newCDPSession(this.window);
    await session.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
    await expect.poll(() => this.window.evaluate(() => [innerWidth, innerHeight, devicePixelRatio])).toEqual([viewport.width, viewport.height, 1]);
  }

  private async checkGuardAsync(viewport: { width: number; height: number }): Promise<void> {
    const shown = await this.window.evaluate(() => [Math.round(innerWidth * devicePixelRatio), Math.round(innerHeight * devicePixelRatio)]).catch(() => null);
    if (shown !== null && (shown[0] !== viewport.width || shown[1] !== viewport.height))
      this.failures.push(`The workflow ended at a ${shown.join(" × ")} viewport instead of ${viewport.width} × ${viewport.height}, so its viewport was lost.`);
    if (await this.isCursorInsideAsync())
      this.failures.push("The real cursor came back inside the window, so its position could reach the test's pointer events.");
  }

  private async moveOffCursorAsync(): Promise<void> {
    await this.answerAsync("unmaximize the window", this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.unmaximize()));
    await expect.poll(() => this.answerAsync("say whether the window is maximized", this.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMaximized())))
      .toBe(false);
    const state = await this.answerAsync("read the cursor, the window's bounds and the displays", this.application.evaluate(({ BrowserWindow, screen }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window === undefined ? null : { cursor: screen.getCursorScreenPoint(), bounds: window.getBounds(), displays: screen.getAllDisplays().map(t => t.bounds) };
    }));
    if (state !== null) {
      this.placement = `Before the move, the cursor was at ${state.cursor.x},${state.cursor.y}, the window at ${OffCursorPlacement.describe(state.bounds)} ` +
        `and the displays at ${state.displays.map(t => OffCursorPlacement.describe(t)).join("; ")}.`;
      const placed = await OffCursorPlacement.placeAsync(state.bounds, state.cursor, state.displays, target => this.answerAsync(`move the window to ${OffCursorPlacement.describe(target)}`,
        this.application.evaluate(({ BrowserWindow }, next) => {
          const window = BrowserWindow.getAllWindows()[0];
          if (window === undefined)
            throw new Error("The window is gone.");
          window.setBounds(next);
          return window.getBounds();
        }, target)));
      this.placement += ` After the move, the window was at ${OffCursorPlacement.describe(placed)}.`;
    }
    await expect.poll(() => this.isCursorInsideAsync()).toBe(false);
    await expect.poll(() => this.window.evaluate(() => document.querySelector(":hover") === null)).toBe(true);
  }

  private async isCursorInsideAsync(): Promise<boolean> {
    return await this.answerAsync("say whether the cursor is inside the window", this.application.evaluate(({ BrowserWindow, screen }) => {
      const cursor = screen.getCursorScreenPoint();
      const bounds = BrowserWindow.getAllWindows()[0]?.getBounds();
      return bounds !== undefined && cursor.x >= bounds.x && cursor.y >= bounds.y && cursor.x < bounds.x + bounds.width && cursor.y < bounds.y + bounds.height;
    }));
  }

  private readMainProcessId(): number {
    return this.mainProcessId ?? this.requireProcess().pid ?? 0;
  }

  private requireProcess(): ChildProcess {
    if (this.childProcess === null)
      throw new Error("TeamRun was not started.");
    return this.childProcess;
  }

  private static isOwned(directory: DataDirectory): boolean {
    try {
      return OwnershipLock.isOwned(directory);
    }
    catch (error) {
      if ((error as { errcode?: unknown }).errcode === DesktopApplicationFixture.NOT_A_DATABASE)
        return false;
      throw error;
    }
  }

  private static async askToStopAsync(discovery: RuntimeDiscovery): Promise<string> {
    try {
      const client = await RuntimeClient.connectAsync(Endpoint.parse(discovery.endpoint), discovery.token, RuntimeBuild.identity, DesktopApplicationFixture.CLIENT_NAME,
        { onEvent: () => undefined, onDisconnected: () => undefined });
      try {
        const response = await client.stopAsync(StopPolicy.StopWork);
        return response.failure?.message ?? "it agreed";
      }
      finally {
        client.close();
      }
    }
    catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
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
    const electron = await this.answerAsync("report its versions",
      this.application.evaluate(() => ({ electron: process.versions.electron, node: process.versions.node, chrome: process.versions.chrome })));
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
