/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
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
  private static readonly SETTLE: number = 3_000;
  private static readonly PAUSE: number = 500;
  private static readonly ARCHIVE: string = "app.asar";
  private static readonly FOLDER_PREFIX: string = "tr-smoke-";
  private static readonly DATA_FOLDER: string = "data";
  private static readonly DESKTOP_LOG: string = "desktop.log";
  private static readonly DATA_LOG_SEGMENTS: readonly string[] = ["logs", "desktop.log"];
  private static readonly DISCOVERY_SEGMENTS: readonly string[] = ["discovery", "runtime.json"];
  private static readonly DATA_DIRECTORY_OPTION: string = "--data-dir";
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
  private readonly folders: TemporaryFolder;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;

  public constructor(root: string, platform: string, architecture: string, runner: ProcessRunner, folders: TemporaryFolder, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.runner = runner;
    this.folders = folders;
    this.environment = environment;
    this.output = output;
  }

  public async runAsync(smokeArguments: readonly string[]): Promise<number> {
    if (smokeArguments.length > 0) {
      this.output.write(PackageSmoke.USAGE);
      return PackageSmoke.USAGE_EXIT_CODE;
    }

    try {
      const target = PackageTarget.fromProcess(this.platform, this.architecture);
      const manifest = await RootManifest.readAsync(this.root);
      const folder = await this.folders.createAsync(this.platform, PackageSmoke.FOLDER_PREFIX);
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
        runtime = await PackageSmoke.readRuntimeIdAsync(data);
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
      await this.waitForStopAsync(runtime, logs);
      await this.requireNoRuntimeAsync(installed, data, folder, "after the runtime stopped");
      this.output.write("The runtime stopped once idle.\n");
      await rm(folder, { recursive: true, force: true });
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackagingException || error instanceof PackageException || error instanceof ProcessException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
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

  private static async readRuntimeIdAsync(data: string): Promise<number> {
    const file = path.join(data, ...PackageSmoke.DISCOVERY_SEGMENTS);
    const value = existsSync(file) ? PackageSmoke.parse(await readFile(file, "utf8")) : null;
    const processId = typeof value === "object" && value !== null && "processId" in value ? value.processId : undefined;
    if (typeof processId !== "number")
      throw new PackagingException(`The runtime's discovery file ${file} names no process.`);
    return processId;
  }

  private statusAsync(installed: InstalledPackage, data: string, folder: string): Promise<ProcessResult> {
    return this.runner.captureAsync(installed.program,
      [path.join(installed.resources, PackageSmoke.ARCHIVE, ...TeamRunCommand.ENTRY_SEGMENTS), ...PackageSmoke.STATUS_ARGUMENTS, PackageSmoke.DATA_DIRECTORY_OPTION, data],
      folder, PackageSmoke.COMMAND_LIMIT, { ...this.environment, [TeamRunCommand.RUN_AS_NODE_VARIABLE]: TeamRunCommand.RUN_AS_NODE_VALUE });
  }

  private async requireNoRuntimeAsync(installed: InstalledPackage, data: string, folder: string, moment: string): Promise<void> {
    const status = await this.statusAsync(installed, data, folder);
    if (status.exitCode !== PackageSmoke.NO_RUNTIME_EXIT_CODE)
      throw new PackagingException(`teamrun status ${moment} exited with ${status.exitCode} instead of ${PackageSmoke.NO_RUNTIME_EXIT_CODE}:\n${status.text}`);
  }

  private async waitForRuntimeAsync(installed: InstalledPackage, data: string, folder: string, desktop: StartedProcess, logs: readonly string[]): Promise<string> {
    const started = Date.now();
    for (;;) {
      const status = await this.statusAsync(installed, data, folder);
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
    const build = typeof value === "object" && value !== null && "build" in value ? value.build : undefined;
    const reportedVersion = typeof build === "object" && build !== null && "productVersion" in build ? build.productVersion : undefined;
    const directory = typeof value === "object" && value !== null && "dataDirectory" in value ? value.dataDirectory : undefined;
    if (typeof reportedVersion !== "string" || typeof directory !== "string")
      throw new PackagingException(`teamrun status --json answered without a build version and a data directory:\n${answer.trim()}`);
    if (reportedVersion !== version || directory !== data)
      throw new PackagingException(`teamrun status reported version ${reportedVersion} in ${directory} instead of ${version} in ${data}.`);
    this.output.write(`teamrun status after the start: version ${reportedVersion} in ${directory}.\n`);
  }

  private async waitForStopAsync(runtime: number, logs: readonly string[]): Promise<void> {
    const started = Date.now();
    while (this.runner.isRunning(runtime)) {
      if (Date.now() - started >= PackageSmoke.STOP_LIMIT)
        throw new PackagingException(`The runtime, process ${runtime}, did not stop within ${PackageSmoke.STOP_LIMIT} ms after the desktop quit, although nothing used it:\n${await PackageSmoke.readTailAsync(logs)}`);
      await timers.setTimeout(PackageSmoke.PAUSE);
    }
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
    const closing = [PackageSmoke.PROCESS_OPTION, String(desktop.id)];
    const result = await this.runner.captureAsync(PackageSmoke.CLOSE, closing, folder, PackageSmoke.COMMAND_LIMIT);
    if (!result.isSuccessful)
      throw new PackagingException(`${PackageSmoke.CLOSE} ${closing.join(" ")} failed with exit code ${result.exitCode}:\n${result.text}`);
  }
}

if (import.meta.main)
  process.exitCode = await new PackageSmoke(process.cwd(), process.platform, process.arch, new ProcessRunner(), new TemporaryFolder(), process.env, process.stdout).runAsync(process.argv.slice(2));
