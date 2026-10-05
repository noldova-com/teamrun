/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { appendFile, chmod, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import { setTimeout } from "node:timers/promises";

import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import PackageLayout from "./packaging/package-layout.ts";
import PackageTarget from "./packaging/package-target.ts";
import PackagingException from "./packaging/packaging.exception.ts";
import type ProcessResult from "./processes/process-result.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import type StartedProcess from "./processes/started-process.ts";
import TemporaryFolder from "./processes/temporary-folder.ts";

interface InstalledPackage {
  readonly desktop: string;
  readonly program: string;
  readonly resources: string;
}

interface SmokeLimits {
  readonly command: number;
  readonly start: number;
  readonly quit: number;
  readonly stop: number;
  readonly settle: number;
  readonly pause: number;
}

export default class PackageSmoke {
  private static readonly USAGE: string = "Usage: npm run package:smoke\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly NO_RUNTIME_EXIT_CODE: number = 3;
  private static readonly LIMITS: SmokeLimits = { command: 30_000, start: 60_000, quit: 30_000, stop: 90_000, settle: 3_000, pause: 500 };
  private static readonly CLI_SEGMENTS: readonly string[] = ["app.asar", "node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js"];
  private static readonly FOLDER_PREFIX: string = "tr-smoke-";
  private static readonly DATA_FOLDER: string = "data";
  private static readonly DESKTOP_LOG: string = "desktop.log";
  private static readonly DATA_LOG_SEGMENTS: readonly string[] = ["logs", "desktop.log"];
  private static readonly DISCOVERY_SEGMENTS: readonly string[] = ["discovery", "runtime.json"];
  private static readonly MOUNT_FOLDER: string = "mount";
  private static readonly EXTRACTED_FOLDER: string = "squashfs-root";
  private static readonly RESOURCES_FOLDER: string = "resources";
  private static readonly PROGRAMS_FOLDER: string = "Programs";
  private static readonly LOCAL_APP_DATA: string = "LOCALAPPDATA";
  private static readonly EXECUTABLE_MODE: number = 0o755;
  private static readonly DATA_DIRECTORY_OPTION: string = "--data-dir";
  private static readonly STATUS_ARGUMENTS: readonly string[] = ["status", "--json"];
  private static readonly RUN_AS_NODE: Readonly<Record<string, string>> = { ELECTRON_RUN_AS_NODE: "1" };
  private static readonly LOG_TAIL_LENGTH: number = 4_000;
  private static readonly WINDOWS: string = "windows";
  private static readonly MACOS: string = "macos";
  private static readonly WINDOWS_INSTALLER: string = "exe";
  private static readonly MAC_IMAGE: string = "dmg";
  private static readonly APP_IMAGE: string = "AppImage";
  private static readonly SILENT_INSTALL: readonly string[] = ["/S"];
  private static readonly EXTRACT: readonly string[] = ["--appimage-extract"];
  private static readonly DISK_IMAGES: string = "hdiutil";
  private static readonly COPY: string = "ditto";
  private static readonly SCREEN_CAPTURE: string = "screencapture";
  private static readonly SILENT_CAPTURE: string = "-x";
  private static readonly SCREENSHOT_EXTENSION: string = ".png";
  private static readonly SUMMARY_VARIABLE: string = "GITHUB_STEP_SUMMARY";
  private static readonly CLOSE: string = "taskkill";
  private static readonly PROCESS_OPTION: string = "/PID";
  private static readonly BUNDLE_SEGMENTS: readonly string[] = ["Contents", "MacOS"];
  private static readonly BUNDLE_RESOURCES_SEGMENTS: readonly string[] = ["Contents", "Resources"];
  private static readonly APPLICATION_EXTENSION: string = ".app";
  private static readonly WINDOWS_PROGRAM_EXTENSION: string = ".exe";
  private static readonly QUIT_SIGNAL: NodeJS.Signals = "SIGTERM";
  private static readonly KILL_SIGNAL: NodeJS.Signals = "SIGKILL";

  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly runner: ProcessRunner;
  private readonly folders: TemporaryFolder;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly limits: SmokeLimits;

  public constructor(root: string, platform: string, architecture: string, runner: ProcessRunner, folders: TemporaryFolder, environment: NodeJS.ProcessEnv,
    output: Writable, limits: SmokeLimits = PackageSmoke.LIMITS) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.runner = runner;
    this.folders = folders;
    this.environment = environment;
    this.output = output;
    this.limits = limits;
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
      const installed = await this.installAsync(target, manifest, folder);
      this.output.write(`Installed: ${installed.desktop}\n`);
      const data = path.join(folder, PackageSmoke.DATA_FOLDER);
      const before = await this.statusAsync(installed, data, folder);
      if (before.exitCode !== PackageSmoke.NO_RUNTIME_EXIT_CODE)
        throw new PackagingException(`teamrun status before the start exited with ${before.exitCode} instead of ${PackageSmoke.NO_RUNTIME_EXIT_CODE}:\n${`${before.output}${before.errorOutput}`.trim()}`);
      this.output.write("teamrun status before the start: no runtime.\n");

      const log = path.join(folder, PackageSmoke.DESKTOP_LOG);
      const logs = [log, path.join(data, ...PackageSmoke.DATA_LOG_SEGMENTS)];
      const desktop = await this.runner.startAsync(installed.desktop, [`${PackageSmoke.DATA_DIRECTORY_OPTION}=${data}`], folder, log);
      let runtime: number;
      try {
        const status = await this.waitForRuntimeAsync(installed, data, folder, desktop, logs);
        const reported = JSON.parse(status) as { readonly build: { readonly productVersion: string }; readonly dataDirectory: string };
        if (reported.build.productVersion !== manifest.productVersion || reported.dataDirectory !== data)
          throw new PackagingException(`teamrun status reported version ${reported.build.productVersion} in ${reported.dataDirectory} instead of ${manifest.productVersion} in ${data}.`);
        this.output.write(`teamrun status after the start: version ${reported.build.productVersion} in ${reported.dataDirectory}.\n`);
        runtime = await PackageSmoke.readRuntimeIdAsync(data);
        if (target.platform === PackageSmoke.MACOS)
          await this.captureScreenAsync(target, folder);

        await this.quitAsync(target, desktop, folder);
        if (!await desktop.waitAsync(this.limits.quit))
          throw new PackagingException(`The desktop did not quit within ${this.limits.quit} ms; a question on closing, such as one about work in progress, keeps it open:\n${await PackageSmoke.readTailAsync(logs)}`);
        if (desktop.exitCode !== 0)
          throw new PackagingException(`The desktop quit with exit code ${desktop.exitCode}:\n${await PackageSmoke.readTailAsync(logs)}`);
        this.output.write("The desktop quit.\n");
      }
      finally {
        if (!desktop.hasExited)
          desktop.signal(PackageSmoke.KILL_SIGNAL);
      }
      await this.waitForStopAsync(runtime, logs);
      const after = await this.statusAsync(installed, data, folder);
      if (after.exitCode !== PackageSmoke.NO_RUNTIME_EXIT_CODE)
        throw new PackagingException(`teamrun status after the runtime stopped exited with ${after.exitCode} instead of ${PackageSmoke.NO_RUNTIME_EXIT_CODE}:\n${`${after.output}${after.errorOutput}`.trim()}`);
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

  private async installAsync(target: PackageTarget, manifest: RootManifest, folder: string): Promise<InstalledPackage> {
    const product = manifest.product;
    const locate = (extension: string): string => path.join(new PackageLayout(this.root).output, target.formatFileName(product.name, extension));
    switch (target.platform) {
      case PackageSmoke.WINDOWS: {
        await this.requireAsync(locate(PackageSmoke.WINDOWS_INSTALLER), PackageSmoke.SILENT_INSTALL, folder);
        const program = path.join(String(this.environment[PackageSmoke.LOCAL_APP_DATA]), PackageSmoke.PROGRAMS_FOLDER, product.slug,
          `${product.name}${PackageSmoke.WINDOWS_PROGRAM_EXTENSION}`);
        PackageSmoke.requireFile(program);
        return { desktop: program, program, resources: path.join(path.dirname(program), PackageSmoke.RESOURCES_FOLDER) };
      }
      case PackageSmoke.MACOS: {
        const mount = path.join(folder, PackageSmoke.MOUNT_FOLDER);
        const bundle = `${product.name}${PackageSmoke.APPLICATION_EXTENSION}`;
        const application = path.join(folder, bundle);
        await this.requireAsync(PackageSmoke.DISK_IMAGES, ["attach", locate(PackageSmoke.MAC_IMAGE), "-nobrowse", "-readonly", "-mountpoint", mount], folder);
        try {
          await this.requireAsync(PackageSmoke.COPY, [path.join(mount, bundle), application], folder);
        }
        finally {
          await this.requireAsync(PackageSmoke.DISK_IMAGES, ["detach", mount], folder);
        }
        const program = path.join(application, ...PackageSmoke.BUNDLE_SEGMENTS, product.name);
        PackageSmoke.requireFile(program);
        return { desktop: program, program, resources: path.join(application, ...PackageSmoke.BUNDLE_RESOURCES_SEGMENTS) };
      }
      default: {
        const file = locate(PackageSmoke.APP_IMAGE);
        await chmod(file, PackageSmoke.EXECUTABLE_MODE);
        await this.requireAsync(file, PackageSmoke.EXTRACT, folder);
        const extracted = path.join(folder, PackageSmoke.EXTRACTED_FOLDER);
        const program = path.join(extracted, product.slug);
        PackageSmoke.requireFile(program);
        return { desktop: file, program, resources: path.join(extracted, PackageSmoke.RESOURCES_FOLDER) };
      }
    }
  }

  private static requireFile(file: string): void {
    if (!existsSync(file))
      throw new PackagingException(`The installed package has no ${file}.`);
  }

  private async requireAsync(command: string, commandArguments: readonly string[], folder: string): Promise<void> {
    const result = await this.runner.captureAsync(command, commandArguments, folder, this.limits.command);
    if (!result.isSuccessful)
      throw new PackagingException(`${path.basename(command)} ${commandArguments.join(" ")} failed with exit code ${result.exitCode}:\n${`${result.output}${result.errorOutput}`.trim()}`);
  }

  private statusAsync(installed: InstalledPackage, data: string, folder: string): Promise<ProcessResult> {
    return this.runner.captureAsync(installed.program, [path.join(installed.resources, ...PackageSmoke.CLI_SEGMENTS), ...PackageSmoke.STATUS_ARGUMENTS, PackageSmoke.DATA_DIRECTORY_OPTION, data],
      folder, this.limits.command, { ...this.environment, ...PackageSmoke.RUN_AS_NODE });
  }

  private async waitForRuntimeAsync(installed: InstalledPackage, data: string, folder: string, desktop: StartedProcess, logs: readonly string[]): Promise<string> {
    const started = Date.now();
    for (;;) {
      const status = await this.statusAsync(installed, data, folder);
      if (status.isSuccessful)
        return status.output;
      if (desktop.hasExited)
        throw new PackagingException(`The desktop exited with ${desktop.exitCode} before its runtime answered:\n${await PackageSmoke.readTailAsync(logs)}`);
      if (Date.now() - started >= this.limits.start)
        throw new PackagingException(`The desktop's runtime did not answer teamrun status within ${this.limits.start} ms; the last answer was exit code ${status.exitCode}:\n${`${status.output}${status.errorOutput}`.trim()}\n${await PackageSmoke.readTailAsync(logs)}`);
      await setTimeout(this.limits.pause);
    }
  }

  private static async readRuntimeIdAsync(data: string): Promise<number> {
    const file = path.join(data, ...PackageSmoke.DISCOVERY_SEGMENTS);
    const value: unknown = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null;
    const processId = typeof value === "object" && value !== null && "processId" in value ? value.processId : undefined;
    if (typeof processId !== "number")
      throw new PackagingException(`The runtime's discovery file ${file} names no process.`);
    return processId;
  }

  private async waitForStopAsync(runtime: number, logs: readonly string[]): Promise<void> {
    const started = Date.now();
    while (this.runner.isRunning(runtime)) {
      if (Date.now() - started >= this.limits.stop)
        throw new PackagingException(`The runtime, process ${runtime}, did not stop within ${this.limits.stop} ms after the desktop quit, although nothing used it:\n${await PackageSmoke.readTailAsync(logs)}`);
      await setTimeout(this.limits.pause);
    }
  }

  private async captureScreenAsync(target: PackageTarget, folder: string): Promise<void> {
    const evidence = new PackageLayout(this.root).smoke;
    const file = path.join(evidence, `window-${target.platform}-${target.architecture}${PackageSmoke.SCREENSHOT_EXTENSION}`);
    await mkdir(evidence, { recursive: true });
    await setTimeout(this.limits.settle);
    const result = await this.runner.captureAsync(PackageSmoke.SCREEN_CAPTURE, [PackageSmoke.SILENT_CAPTURE, file], folder, this.limits.command);
    if (result.isSuccessful) {
      this.output.write(`The screen with the window: ${file}\n`);
      return;
    }
    const reason = `The screen could not be captured, so the run keeps no picture of the window; screencapture exited with ${result.exitCode}:\n${`${result.output}${result.errorOutput}`.trim()}\n`;
    this.output.write(reason);
    const summary = this.environment[PackageSmoke.SUMMARY_VARIABLE] ?? "";
    if (summary.length > 0)
      await appendFile(summary, reason);
  }

  private async quitAsync(target: PackageTarget, desktop: StartedProcess, folder: string): Promise<void> {
    if (target.platform === PackageSmoke.WINDOWS)
      await this.requireAsync(PackageSmoke.CLOSE, [PackageSmoke.PROCESS_OPTION, String(desktop.id)], folder);
    else
      desktop.signal(PackageSmoke.QUIT_SIGNAL);
  }
}

if (import.meta.main)
  process.exitCode = await new PackageSmoke(process.cwd(), process.platform, process.arch, new ProcessRunner(), new TemporaryFolder(), process.env, process.stdout).runAsync(process.argv.slice(2));
