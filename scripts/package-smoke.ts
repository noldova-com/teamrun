/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import timers from "node:timers/promises";

import TeamRunCommand from "./desktop/teamrun.ts";
import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import type InstalledPackage from "./packaging/installed-package.ts";
import PackageInstaller from "./packaging/package-installer.ts";
import PackageLayout from "./packaging/package-layout.ts";
import PackageTarget from "./packaging/package-target.ts";
import PackagingException from "./packaging/packaging.exception.ts";
import type ProcessResult from "./processes/process-result.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import type StartedProcess from "./processes/started-process.ts";
import TemporaryFolder from "./processes/temporary-folder.ts";

export default class PackageSmoke {
  private static readonly USAGE: string = "Usage: npm run package:smoke\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly NO_RUNTIME_EXIT_CODE: number = 3;
  private static readonly COMMAND_LIMIT: number = 30_000;
  private static readonly START_LIMIT: number = 60_000;
  private static readonly QUIT_LIMIT: number = 30_000;
  private static readonly STOP_LIMIT: number = 90_000;
  private static readonly KILL_LIMIT: number = 10_000;
  private static readonly SETTLE: number = 3_000;
  private static readonly PAUSE: number = 500;
  private static readonly ARCHIVE: string = "app.asar";
  private static readonly FOLDER_PREFIX: string = "tr-smoke-";
  private static readonly DATA_FOLDER: string = "data";
  private static readonly DESKTOP_LOG: string = "desktop.log";
  private static readonly DATA_LOG_SEGMENTS: readonly string[] = ["logs", "desktop.log"];
  private static readonly DISCOVERY_SEGMENTS: readonly string[] = ["discovery", "runtime.json"];
  private static readonly DATA_DIRECTORY_OPTION: string = "--data-dir";
  private static readonly PROCESS_ID_FIELD: string = "processId";
  private static readonly BUILD_FIELD: string = "build";
  private static readonly VERSION_FIELD: string = "productVersion";
  private static readonly DATA_DIRECTORY_FIELD: string = "dataDirectory";
  private static readonly STATUS_ARGUMENTS: readonly string[] = ["status", "--json"];
  private static readonly LOG_TAIL_LENGTH: number = 4_000;
  private static readonly SCREEN_CAPTURE: string = "screencapture";
  private static readonly SILENT_CAPTURE: string = "-x";
  private static readonly SCREENSHOT_EXTENSION: string = ".png";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly CLOSE: string = "taskkill";
  private static readonly PROCESS_OPTION: string = "/PID";
  private static readonly QUIT_SIGNAL: NodeJS.Signals = "SIGTERM";
  private static readonly KILL_SIGNAL: NodeJS.Signals = "SIGKILL";

  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly runner: ProcessRunner;
  private readonly temporaryFolder: TemporaryFolder;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private folder: string | null = null;
  private runtime: number | null = null;
  private hasRuntimeOutlived: boolean = false;
  private hasRuntimeStopped: boolean = false;

  public constructor(root: string, platform: string, architecture: string, runner: ProcessRunner, temporaryFolder: TemporaryFolder, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.runner = runner;
    this.temporaryFolder = temporaryFolder;
    this.environment = environment;
    this.output = output;
  }

  public async runAsync(smokeArguments: readonly string[]): Promise<number> {
    if (smokeArguments.length > 0) {
      this.output.write(PackageSmoke.USAGE);
      return PackageSmoke.USAGE_EXIT_CODE;
    }

    this.folder = null;
    this.runtime = null;
    this.hasRuntimeOutlived = false;
    this.hasRuntimeStopped = false;
    let hasFailed = false;
    try {
      await this.checkAsync();
    }
    catch (error) {
      const isKnown = error instanceof PackagingException || error instanceof PackageException || error instanceof ProcessException;
      if (isKnown)
        this.output.write(`${error.message}\n`);
      await this.cleanUpAsync();
      if (!isKnown)
        throw error;
      hasFailed = true;
    }
    return hasFailed || !await this.cleanUpAsync() ? 1 : 0;
  }

  private async checkAsync(): Promise<void> {
    const target = PackageTarget.fromProcess(this.platform, this.architecture);
    const manifest = await RootManifest.readAsync(this.root);
    const folder = await this.temporaryFolder.createAsync(this.platform, PackageSmoke.FOLDER_PREFIX);
    this.folder = folder;
    const installed = await new PackageInstaller(this.root, this.runner, this.environment).installAsync(target, manifest.product, folder);
    this.output.write(`Installed: ${installed.desktop}\n`);
    const data = path.join(folder, PackageSmoke.DATA_FOLDER);
    await this.requireNoRuntimeAsync(installed, data, folder, "before the start");
    this.output.write("teamrun status before the start: no runtime.\n");

    const log = path.join(folder, PackageSmoke.DESKTOP_LOG);
    const logs = [log, path.join(data, ...PackageSmoke.DATA_LOG_SEGMENTS)];
    const desktop = await this.runner.startAsync(installed.desktop, [`${PackageSmoke.DATA_DIRECTORY_OPTION}=${data}`], folder, log);
    let runtime: number;
    try {
      this.checkStarted(await this.waitForRuntimeAsync(installed, data, folder, desktop, logs), manifest.productVersion, data);
      const found = await PackageSmoke.readRuntimeIdAsync(data);
      if (found === null)
        throw new PackagingException(`The runtime's discovery file ${path.join(data, ...PackageSmoke.DISCOVERY_SEGMENTS)} names no process.`);
      runtime = found;
      this.runtime = runtime;
      if (target.platform === PackageTarget.MACOS)
        await this.captureScreenAsync(target, folder);

      await this.quitAsync(target, desktop, folder);
      if (!await desktop.waitAsync(PackageSmoke.QUIT_LIMIT))
        throw new PackagingException(`The desktop did not quit within ${PackageSmoke.QUIT_LIMIT} ms; a question on closing, such as one about work in progress, keeps it open:\n${await PackageSmoke.readTailAsync(logs)}`);
      if (desktop.exitCode !== 0)
        throw new PackagingException(`The desktop quit with exit code ${desktop.exitCode}:\n${await PackageSmoke.readTailAsync(logs)}`);
      this.output.write("The desktop quit.\n");
    }
    finally {
      if (!desktop.hasExited)
        desktop.signal(PackageSmoke.KILL_SIGNAL);
    }
    if (!await this.waitForExitAsync(runtime, PackageSmoke.STOP_LIMIT)) {
      this.hasRuntimeOutlived = true;
      throw new PackagingException(`The runtime, process ${runtime}, did not stop within ${PackageSmoke.STOP_LIMIT} ms after the desktop quit, although nothing used it:\n${await PackageSmoke.readTailAsync(logs)}`);
    }
    this.runtime = null;
    this.hasRuntimeStopped = true;
    await this.requireNoRuntimeAsync(installed, data, folder, "after the runtime stopped");
    this.output.write("The runtime stopped once idle.\n");
  }

  private async cleanUpAsync(): Promise<boolean> {
    if (this.folder === null)
      return true;
    const problems: string[] = [];
    const ending = await this.endRuntimeAsync(this.folder);
    if (ending !== null)
      problems.push(ending);
    try {
      await this.temporaryFolder.removeAsync(this.folder);
    }
    catch (error) {
      problems.push(`The smoke's folder ${this.folder} could not be removed: ${String(error)}`);
    }
    this.folder = null;
    if (problems.length > 0)
      this.output.write(`Cleaning up failed:\n${problems.join("\n")}\n`);
    return problems.length === 0;
  }

  private async endRuntimeAsync(folder: string): Promise<string | null> {
    let runtime = this.runtime;
    try {
      if (runtime === null && !this.hasRuntimeStopped)
        runtime = await PackageSmoke.readRuntimeIdAsync(path.join(folder, PackageSmoke.DATA_FOLDER));
      if (runtime === null || (!this.hasRuntimeOutlived && await this.waitForExitAsync(runtime, PackageSmoke.STOP_LIMIT)))
        return null;
      this.runner.kill(runtime);
      if (await this.waitForExitAsync(runtime, PackageSmoke.KILL_LIMIT))
        return null;
      return `The runtime, process ${runtime}, could not be ended: it was still running ${PackageSmoke.KILL_LIMIT} ms after it was killed.`;
    }
    catch (error) {
      if (runtime === null)
        return `The runtime's discovery file in ${folder} could not be read: ${String(error)}`;
      return `The runtime, process ${runtime}, could not be ended: ${String(error)}`;
    }
  }

  private static async readTailAsync(logs: readonly string[]): Promise<string> {
    const tails: string[] = [];
    for (const log of logs.filter(t => existsSync(t)))
      tails.push(`${log}:\n${(await readFile(log, "utf8")).slice(-PackageSmoke.LOG_TAIL_LENGTH).trim()}`);
    return tails.join("\n");
  }

  private static parse(text: string): unknown {
    try {
      return JSON.parse(text);
    }
    catch {
      return null;
    }
  }

  private static readField(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null ? Object.getOwnPropertyDescriptor(value, name)?.value : undefined;
  }

  private static async readRuntimeIdAsync(data: string): Promise<number | null> {
    const file = path.join(data, ...PackageSmoke.DISCOVERY_SEGMENTS);
    const value = existsSync(file) ? PackageSmoke.parse(await readFile(file, "utf8")) : null;
    const processId = PackageSmoke.readField(value, PackageSmoke.PROCESS_ID_FIELD);
    return typeof processId === "number" ? processId : null;
  }

  private queryStatusAsync(installed: InstalledPackage, data: string, folder: string): Promise<ProcessResult> {
    return this.runner.captureAsync(installed.program,
      [path.join(installed.resources, PackageSmoke.ARCHIVE, ...TeamRunCommand.ENTRY_SEGMENTS), ...PackageSmoke.STATUS_ARGUMENTS, PackageSmoke.DATA_DIRECTORY_OPTION, data],
      folder, PackageSmoke.COMMAND_LIMIT, { ...this.environment, [TeamRunCommand.RUN_AS_NODE_VARIABLE]: TeamRunCommand.RUN_AS_NODE_VALUE });
  }

  private async requireNoRuntimeAsync(installed: InstalledPackage, data: string, folder: string, moment: string): Promise<void> {
    const status = await this.queryStatusAsync(installed, data, folder);
    if (status.exitCode !== PackageSmoke.NO_RUNTIME_EXIT_CODE)
      throw new PackagingException(`teamrun status ${moment} exited with ${status.exitCode} instead of ${PackageSmoke.NO_RUNTIME_EXIT_CODE}:\n${status.text}`);
  }

  private async waitForRuntimeAsync(installed: InstalledPackage, data: string, folder: string, desktop: StartedProcess, logs: readonly string[]): Promise<string> {
    const started = Date.now();
    for (;;) {
      const status = await this.queryStatusAsync(installed, data, folder);
      if (status.isSuccessful)
        return status.output;
      if (desktop.hasExited)
        throw new PackagingException(`The desktop exited with ${desktop.exitCode} before its runtime answered:\n${await PackageSmoke.readTailAsync(logs)}`);
      if (Date.now() - started >= PackageSmoke.START_LIMIT)
        throw new PackagingException(`The desktop's runtime did not answer teamrun status within ${PackageSmoke.START_LIMIT} ms; the last answer was exit code ${status.exitCode}:\n${status.text}\n${await PackageSmoke.readTailAsync(logs)}`);
      await timers.setTimeout(PackageSmoke.PAUSE);
    }
  }

  private checkStarted(answer: string, version: string, data: string): void {
    const value = PackageSmoke.parse(answer);
    const reportedVersion = PackageSmoke.readField(PackageSmoke.readField(value, PackageSmoke.BUILD_FIELD), PackageSmoke.VERSION_FIELD);
    const directory = PackageSmoke.readField(value, PackageSmoke.DATA_DIRECTORY_FIELD);
    if (typeof reportedVersion !== "string" || typeof directory !== "string")
      throw new PackagingException(`teamrun status --json answered without a build version and a data directory:\n${answer.trim()}`);
    if (reportedVersion !== version || directory !== data)
      throw new PackagingException(`teamrun status reported version ${reportedVersion} in ${directory} instead of ${version} in ${data}.`);
    this.output.write(`teamrun status after the start: version ${reportedVersion} in ${directory}.\n`);
  }

  private async waitForExitAsync(runtime: number, limit: number): Promise<boolean> {
    const started = Date.now();
    while (this.runner.isRunning(runtime)) {
      if (Date.now() - started >= limit)
        return false;
      await timers.setTimeout(PackageSmoke.PAUSE);
    }
    return true;
  }

  private async captureScreenAsync(target: PackageTarget, folder: string): Promise<void> {
    const evidence = new PackageLayout(this.root).smoke;
    const file = path.join(evidence, `window-${target.platform}-${target.architecture}${PackageSmoke.SCREENSHOT_EXTENSION}`);
    await mkdir(evidence, { recursive: true });
    await timers.setTimeout(PackageSmoke.SETTLE);
    const result = await this.runner.captureAsync(PackageSmoke.SCREEN_CAPTURE, [PackageSmoke.SILENT_CAPTURE, file], folder, PackageSmoke.COMMAND_LIMIT);
    if (result.isSuccessful) {
      this.output.write(`The screen with the window: ${file}\n`);
      return;
    }
    const reason = `The screen could not be captured, so the run keeps no picture of the window; screencapture exited with ${result.exitCode}:\n${result.text}\n`;
    this.output.write(reason);
    const summary = this.environment[PackageSmoke.SUMMARY_VARIABLE] ?? "";
    if (summary.length > 0)
      await appendFile(summary, reason);
  }

  private async quitAsync(target: PackageTarget, desktop: StartedProcess, folder: string): Promise<void> {
    if (target.platform !== PackageTarget.WINDOWS) {
      desktop.signal(PackageSmoke.QUIT_SIGNAL);
      return;
    }
    await this.runner.requireAsync(PackageSmoke.CLOSE, [PackageSmoke.PROCESS_OPTION, String(desktop.id)], folder, PackageSmoke.COMMAND_LIMIT);
  }
}

if (import.meta.main)
  process.exitCode = await new PackageSmoke(process.cwd(), process.platform, process.arch, new ProcessRunner(), new TemporaryFolder(), process.env, process.stdout).runAsync(process.argv.slice(2));
