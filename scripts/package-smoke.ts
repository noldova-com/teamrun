/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import timers from "node:timers/promises";

import TeamRunCommand from "./desktop/teamrun.ts";
import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import type InstalledPackage from "./packaging/installed-package.ts";
import PackageConfiguration from "./packaging/package-configuration.ts";
import PackageInstaller from "./packaging/package-installer.ts";
import PackageLayout from "./packaging/package-layout.ts";
import PackageTarget from "./packaging/package-target.ts";
import PackagingException from "./packaging/packaging.exception.ts";
import UserPath from "./packaging/user-path.ts";
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
  private static readonly SECOND: number = 1_000;
  private static readonly ARCHIVE: string = "app.asar";
  private static readonly FOLDER_PREFIX: string = "tr-smoke-";
  private static readonly DATA_FOLDER: string = "data";
  private static readonly DEVICE_FOLDER: string = "device";
  private static readonly DESKTOP_LOG: string = "desktop.log";
  private static readonly DATA_LOG_SEGMENTS: readonly string[] = ["logs", "desktop.log"];
  private static readonly DISCOVERY_SEGMENTS: readonly string[] = ["discovery", "runtime.json"];
  private static readonly DATA_DIRECTORY_OPTION: string = "--data-dir";
  private static readonly DEVICE_DIRECTORY_OPTION: string = "--device-dir";
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
  private static readonly COMMAND_SHELL: string = "cmd.exe";
  private static readonly COMMAND_SHELL_OPTIONS: readonly string[] = ["/d", "/c"];
  private static readonly POWERSHELL: string = "pwsh";
  private static readonly POWERSHELL_OPTIONS: readonly string[] = ["-NoProfile", "-NonInteractive", "-Command"];
  private static readonly PATH_VARIABLE: string = "PATH";
  private static readonly LINK: string = "ln";
  private static readonly SYMBOLIC_OPTION: string = "-s";
  private static readonly LOGS_FOLDER: string = "logs";
  private static readonly COPY_RECORD: RegExp = /^copy-[0-9a-f-]{36}\.log$/;
  private static readonly MOUNT_RECORD: RegExp = /^teamrun-copy mount \d+ (\d+) .+$/;
  private static readonly EXTRACTION_RECORD: RegExp = /^teamrun-copy extraction \d+ (.+)$/;
  private static readonly EXTRACT_AND_RUN_VARIABLE: string = "APPIMAGE_EXTRACT_AND_RUN";
  private static readonly EXTRACT_AND_RUN_VALUE: string = "1";
  private static readonly MEBIBYTE: number = 1_048_576;

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

  private get extractsAndRuns(): boolean {
    return this.environment[PackageSmoke.EXTRACT_AND_RUN_VARIABLE] === PackageSmoke.EXTRACT_AND_RUN_VALUE;
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
    const installer = new PackageInstaller(this.root, this.runner, this.environment);
    const userPath = new UserPath(this.runner, folder);
    const pathBefore = target.platform === PackageTarget.WINDOWS ? await userPath.readAsync() : null;
    const started = Date.now();
    const installed = await installer.installAsync(target, manifest.product, folder);
    this.output.write(`Installed in ${((Date.now() - started) / PackageSmoke.SECOND).toFixed(1)} s: ${installed.desktop}\n`);
    if (installed.command !== null)
      await this.requireOnPathAsync(userPath, installed.command, "The user's Path holds");
    const data = path.join(folder, PackageSmoke.DATA_FOLDER);
    await this.requireNoRuntimeAsync(installed, data, folder, "before the start");
    this.output.write("teamrun status before the start: no runtime.\n");

    const log = path.join(folder, PackageSmoke.DESKTOP_LOG);
    const logs = [log, path.join(data, ...PackageSmoke.DATA_LOG_SEGMENTS)];
    const desktop = await this.runner.startAsync(installed.desktop,
      [`${PackageSmoke.DEVICE_DIRECTORY_OPTION}=${path.join(folder, PackageSmoke.DEVICE_FOLDER)}`, `${PackageSmoke.DATA_DIRECTORY_OPTION}=${data}`], folder, log);
    let runtime: number;
    let copy: readonly [string, string] | null = null;
    try {
      this.checkStarted(await this.waitForRuntimeAsync(installed, data, folder, desktop, logs), manifest.productVersion, data, "after the start");
      if (installed.command !== null)
        await this.checkPowerShellAsync(installed.command, manifest.productVersion, data, folder);
      const found = await PackageSmoke.readRuntimeIdAsync(data);
      if (found === null)
        throw new PackagingException(`The runtime's discovery file ${path.join(data, ...PackageSmoke.DISCOVERY_SEGMENTS)} names no process.`);
      runtime = found;
      this.runtime = runtime;
      if (target.platform === PackageTarget.LINUX)
        copy = await this.requireCopyAsync(data);
      if (target.platform === PackageTarget.MACOS) {
        await this.checkLinkedCommandAsync(path.join(installed.resources, PackageConfiguration.COMMAND_FOLDER, manifest.product.slug), manifest.productVersion, data, folder);
        await this.captureScreenAsync(target, folder);
      }

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
    if (copy !== null)
      await this.requireCopyEndedAsync(copy);
    if (installed.command === null)
      return;
    await installer.installAsync(target, manifest.product, folder);
    await this.requireOnPathAsync(userPath, installed.command, "Installed again over itself, the user's Path still holds");
    await installer.uninstallWindowsAsync(manifest.product, folder);
    const pathAfter = await userPath.readAsync();
    if (pathAfter !== pathBefore)
      throw new PackagingException(`After the uninstall the user's Path is ${JSON.stringify(pathAfter)} instead of ${JSON.stringify(pathBefore)}, as it was before the install.`);
    this.output.write("Uninstalled: the program and its command are gone, and the user's Path is as it was before the install.\n");
  }

  private async requireOnPathAsync(userPath: UserPath, command: string, intro: string): Promise<void> {
    const entry = path.dirname(command);
    const value = await userPath.readAsync();
    const count = UserPath.count(value, entry);
    if (count !== 1)
      throw new PackagingException(`The user's Path holds ${entry} ${count} times instead of once: ${JSON.stringify(value)}`);
    this.output.write(`${intro} ${entry} once.\n`);
  }

  private async checkPowerShellAsync(command: string, version: string, data: string, folder: string): Promise<void> {
    const line = ["&", path.parse(command).name, ...PackageSmoke.STATUS_ARGUMENTS, PackageSmoke.DEVICE_DIRECTORY_OPTION, `'${path.join(folder, PackageSmoke.DEVICE_FOLDER)}'`,
      PackageSmoke.DATA_DIRECTORY_OPTION, `'${data}';`, "exit", "$LASTEXITCODE"].join(" ");
    const status = await this.runner.captureAsync(PackageSmoke.POWERSHELL, [...PackageSmoke.POWERSHELL_OPTIONS, line], folder, PackageSmoke.COMMAND_LIMIT, this.createCommandEnvironment(command));
    if (!status.isSuccessful)
      throw new PackagingException(`teamrun status through PowerShell exited with ${status.exitCode}:\n${status.text}`);
    this.checkStarted(status.output, version, data, "through PowerShell");
  }

  private async checkLinkedCommandAsync(command: string, version: string, data: string, folder: string): Promise<void> {
    const link = path.join(folder, path.basename(command));
    await this.runner.requireAsync(PackageSmoke.LINK, [PackageSmoke.SYMBOLIC_OPTION, command, link], folder, PackageSmoke.COMMAND_LIMIT);
    const status = await this.runner.captureAsync(link, PackageSmoke.formatStatusArguments(data, folder), folder, PackageSmoke.COMMAND_LIMIT, this.environment);
    if (!status.isSuccessful)
      throw new PackagingException(`teamrun status through a link to ${command} exited with ${status.exitCode}:\n${status.text}`);
    this.checkStarted(status.output, version, data, "through a link to the app's command");
  }

  private createCommandEnvironment(command: string): NodeJS.ProcessEnv {
    const isPath = ([name]: readonly [string, unknown]): boolean => name.toUpperCase() === PackageSmoke.PATH_VARIABLE;
    const paths = Object.entries(this.environment).filter(t => isPath(t)).map(([, value]) => String(value));
    const others = Object.entries(this.environment).filter(t => !isPath(t));
    return { ...Object.fromEntries(others), [PackageSmoke.PATH_VARIABLE]: [path.dirname(command), ...paths].join(path.win32.delimiter) };
  }

  private async requireCopyAsync(data: string): Promise<readonly [string, string]> {
    const logs = path.join(data, PackageSmoke.LOGS_FOLDER);
    const records = (await readdir(logs)).filter(t => PackageSmoke.COPY_RECORD.test(t));
    const [name = ""] = records;
    if (records.length !== 1)
      throw new PackagingException(`While the desktop ran, ${logs} held ${records.length} copy records of the runtime's AppImage instead of one.`);
    const record = path.join(logs, name);
    const line = (await readFile(record, "utf8")).trim();
    if (this.extractsAndRuns) {
      const [, extraction = ""] = PackageSmoke.EXTRACTION_RECORD.exec(line) ?? [];
      if (!existsSync(extraction))
        throw new PackagingException(`The runtime's copy record ${record} names no extraction of the AppImage that is still there: ${line}`);
      this.output.write(`The runtime holds its own extraction of the AppImage in ${extraction}, ${(await PackageSmoke.measureAsync(extraction) / PackageSmoke.MEBIBYTE).toFixed(1)} MiB.\n`);
      return [record, line];
    }
    const [, mounter = ""] = PackageSmoke.MOUNT_RECORD.exec(line) ?? [];
    if (mounter.length === 0 || !this.runner.isRunning(Number(mounter)))
      throw new PackagingException(`The runtime's copy record ${record} names no mount of the AppImage that is still running: ${line}`);
    this.output.write(`The runtime holds its own mount of the AppImage, process ${mounter}.\n`);
    return [record, line];
  }

  private static async measureAsync(folder: string): Promise<number> {
    let size = 0;
    for (const entry of (await readdir(folder, { recursive: true, withFileTypes: true })).filter(t => t.isFile()))
      size += (await stat(path.join(entry.parentPath, entry.name))).size;
    return size;
  }

  private async requireCopyEndedAsync([record, line]: readonly [string, string]): Promise<void> {
    const [, mounter = ""] = PackageSmoke.MOUNT_RECORD.exec(line) ?? [];
    const [, extraction = ""] = PackageSmoke.EXTRACTION_RECORD.exec(line) ?? [];
    const started = Date.now();
    while (existsSync(record) || (mounter.length > 0 && this.runner.isRunning(Number(mounter))) || existsSync(extraction)) {
      if (Date.now() - started >= PackageSmoke.KILL_LIMIT)
        throw new PackagingException(`The runtime's copy of the AppImage was still there ${PackageSmoke.KILL_LIMIT} ms after the runtime stopped: ${line}`);
      await timers.setTimeout(PackageSmoke.PAUSE);
    }
    this.output.write("The runtime's copy of the AppImage ended with it.\n");
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
    if (installed.command !== null) {
      return this.runner.captureAsync(PackageSmoke.COMMAND_SHELL,
        [...PackageSmoke.COMMAND_SHELL_OPTIONS, path.parse(installed.command).name, ...PackageSmoke.formatStatusArguments(data, folder)],
        folder, PackageSmoke.COMMAND_LIMIT, this.createCommandEnvironment(installed.command));
    }
    return this.runner.captureAsync(installed.program,
      [path.join(installed.resources, PackageSmoke.ARCHIVE, ...TeamRunCommand.ENTRY_SEGMENTS), ...PackageSmoke.formatStatusArguments(data, folder)],
      folder, PackageSmoke.COMMAND_LIMIT, { ...this.environment, [TeamRunCommand.RUN_AS_NODE_VARIABLE]: TeamRunCommand.RUN_AS_NODE_VALUE });
  }

  private static formatStatusArguments(data: string, folder: string): readonly string[] {
    return [...PackageSmoke.STATUS_ARGUMENTS, PackageSmoke.DEVICE_DIRECTORY_OPTION, path.join(folder, PackageSmoke.DEVICE_FOLDER), PackageSmoke.DATA_DIRECTORY_OPTION, data];
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

  private checkStarted(answer: string, version: string, data: string, moment: string): void {
    const value = PackageSmoke.parse(answer);
    const reportedVersion = PackageSmoke.readField(PackageSmoke.readField(value, PackageSmoke.BUILD_FIELD), PackageSmoke.VERSION_FIELD);
    const directory = PackageSmoke.readField(value, PackageSmoke.DATA_DIRECTORY_FIELD);
    if (typeof reportedVersion !== "string" || typeof directory !== "string")
      throw new PackagingException(`teamrun status --json answered without a build version and a data directory:\n${answer.trim()}`);
    if (reportedVersion !== version || directory !== data)
      throw new PackagingException(`teamrun status reported version ${reportedVersion} in ${directory} instead of ${version} in ${data}.`);
    this.output.write(`teamrun status ${moment}: version ${reportedVersion} in ${directory}.\n`);
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
    if (target.platform === PackageTarget.WINDOWS) {
      await this.runner.requireAsync(PackageSmoke.CLOSE, [PackageSmoke.PROCESS_OPTION, String(desktop.id)], folder, PackageSmoke.COMMAND_LIMIT);
      return;
    }
    if (target.platform === PackageTarget.LINUX && this.extractsAndRuns) {
      for (const child of this.runner.listChildren(desktop.id))
        this.runner.end(child);
      return;
    }
    desktop.signal(PackageSmoke.QUIT_SIGNAL);
  }
}

if (import.meta.main)
  process.exitCode = await new PackageSmoke(process.cwd(), process.platform, process.arch, new ProcessRunner(), new TemporaryFolder(), process.env, process.stdout).runAsync(process.argv.slice(2));
