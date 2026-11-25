/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { InstallArguments } from "./installs/install-arguments.ts";
import { AppLockfile } from "./packages/app-lockfile.ts";
import { BuildLayout } from "./packages/build-layout.ts";
import { PackageBuild } from "./packages/package-build.ts";
import { PackageCatalog } from "./packages/package-catalog.ts";
import { PackageException } from "./packages/package.exception.ts";
import { RootManifest } from "./packages/root-manifest.ts";
import { ProcessRunner } from "./processes/process-runner.ts";
import { ProcessException } from "./processes/process.exception.ts";
import { TemporaryFolder } from "./processes/temporary-folder.ts";
import { NpmCommand } from "./toolchain/npm-command.ts";

export class App {
  private static readonly USAGE: string = "Usage: npm run install:app | npm run lock:app | npm run build:app | npm run package:app | npm run package:smoke | npm start [-- <argument>...] | npm run seed:stress [-- --pairs <count>]\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly INSTALL_COMMAND: string = "install";
  private static readonly LOCK_COMMAND: string = "lock";
  private static readonly BUILD_COMMAND: string = "build";
  private static readonly PACKAGE_COMMAND: string = "package";
  private static readonly PACKAGE_SMOKE_COMMAND: string = "package-smoke";
  private static readonly START_COMMAND: string = "start";
  private static readonly SEED_STRESS_COMMAND: string = "seed-stress";
  private static readonly FOLDER: string = "app";
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly LOCKFILE_NAME: string = "package-lock.json";
  private static readonly CONFIGURATION_NAME: string = ".npmrc";
  private static readonly INSTALLED_LOCKFILE: string = "node_modules/.package-lock.json";
  private static readonly MODULE_PACKAGE: string = "@noldova/teamrun";
  private static readonly WINDOW_APP_FOLDER: string = path.join("src", "noldova.teamrun.window.app");
  private static readonly NPM_PATH_VARIABLE: string = "npm_execpath";
  private static readonly LOCK_ARGUMENTS: readonly string[] =
    ["install", "--package-lock-only", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];
  private static readonly LOCK_FOLDER_PREFIX: string = "teamrun-app-lock-";
  private static readonly ARCHIVES_SPEC_START: string = "file:../_packages/";
  private static readonly LISTED_UNLOCKED: number = 5;
  private static readonly WINDOW_INSTALL_ARGUMENTS: readonly string[] = ["run", "install:window"];
  private static readonly APP_BUILD_ARGUMENTS: readonly string[] = ["run", "build"];
  private static readonly APP_PACKAGE_ARGUMENTS: readonly string[] = ["run", "package"];
  private static readonly APP_PACKAGE_SMOKE_ARGUMENTS: readonly string[] = ["run", "package:smoke"];
  private static readonly APP_START_ARGUMENTS: readonly string[] = ["start", "--"];
  private static readonly APP_SEED_STRESS_ARGUMENTS: readonly string[] = ["run", "seed:stress", "--"];

  private readonly root: string;
  private readonly folder: string;
  private readonly build: PackageBuild;
  private readonly npm: NpmCommand;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.folder = path.join(root, App.FOLDER);
    this.build = new PackageBuild(root, runner, environment);
    this.npm = new NpmCommand(runner, environment);
    this.runner = runner;
    this.environment = environment;
    this.output = output;
  }

  public async runAsync(appArguments: readonly string[]): Promise<number> {
    const [command, ...rest] = appArguments;
    try {
      if (command === App.INSTALL_COMMAND && rest.length === 0)
        return await this.installAsync() ?? 1;
      if (command === App.LOCK_COMMAND && rest.length === 0)
        return await this.lockAsync();
      if (command === App.BUILD_COMMAND && rest.length === 0)
        return await this.runNpmAsync(App.APP_BUILD_ARGUMENTS) ?? 1;
      if (command === App.PACKAGE_COMMAND && rest.length === 0)
        return await this.runNpmAsync(App.APP_PACKAGE_ARGUMENTS) ?? 1;
      if (command === App.PACKAGE_SMOKE_COMMAND && rest.length === 0)
        return await this.runNpmAsync(App.APP_PACKAGE_SMOKE_ARGUMENTS) ?? 1;
      if (command === App.START_COMMAND) {
        const installed = await this.installAsync();
        if (installed !== 0)
          return installed ?? 1;
        const built = await this.runNpmAsync(App.APP_BUILD_ARGUMENTS);
        if (built !== 0)
          return built ?? 1;
        return await this.runNpmAsync([...App.APP_START_ARGUMENTS, ...rest]) ?? 1;
      }
      if (command === App.SEED_STRESS_COMMAND) {
        const installed = await this.installAsync();
        if (installed !== 0)
          return installed ?? 1;
        return await this.runNpmAsync([...App.APP_SEED_STRESS_ARGUMENTS, ...rest]) ?? 1;
      }
      this.output.write(App.USAGE);
      return App.USAGE_EXIT_CODE;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }

  private async installAsync(): Promise<number | null> {
    if (!existsSync(path.join(this.folder, App.LOCKFILE_NAME)))
      throw new PackageException(`${App.FOLDER}/${App.LOCKFILE_NAME} is missing, so the app's install would take the newest versions in range; run npm run lock:app, which writes it, and commit it.`);
    await this.build.requireCurrentAsync();
    const archives = await this.listArchivesAsync();
    this.output.write(`Installing the app in app/, with this checkout's ${archives.length} TeamRun packages.\n`);
    const result = await this.npm.runAsync(InstallArguments.APP, this.folder);
    if (!result.isSuccessful)
      throw new ProcessException(`"npm ${InstallArguments.APP.join(" ")}" in app/ failed with exit code ${result.exitCode}: ${result.errorOutput.trim()}`);
    await this.requireLockedAsync();
    return this.runNpmAsync(App.WINDOW_INSTALL_ARGUMENTS);
  }

  private async requireLockedAsync(): Promise<void> {
    const installed = path.join(this.folder, App.INSTALLED_LOCKFILE);
    if (!existsSync(installed))
      throw new ProcessException(`npm left no ${App.FOLDER}/${App.INSTALLED_LOCKFILE} after installing the app, so what it installed can't be compared with ${App.FOLDER}/${App.LOCKFILE_NAME}.`);
    const unlocked = await (await this.readLockfileAsync()).findUnlockedAsync(path.join(this.folder, App.LOCKFILE_NAME), installed);
    if (unlocked.length > 0)
      throw new PackageException(`The app's install put packages in ${App.FOLDER}/node_modules that ${App.FOLDER}/${App.LOCKFILE_NAME} doesn't lock at the version it installed, ${unlocked.length} in all, `
        + `such as ${unlocked.slice(0, App.LISTED_UNLOCKED).join(", ")}; run npm run lock:app and commit ${App.FOLDER}/${App.LOCKFILE_NAME}.`);
  }

  private async lockAsync(): Promise<number> {
    await this.build.requireCurrentAsync();
    const archives = await this.listArchivesAsync();
    const folders = new TemporaryFolder();
    const work = await folders.createAsync(process.platform, App.LOCK_FOLDER_PREFIX);
    try {
      for (const file of [App.MANIFEST_NAME, App.CONFIGURATION_NAME, App.LOCKFILE_NAME, path.join(App.WINDOW_APP_FOLDER, App.MANIFEST_NAME)])
        if (existsSync(path.join(this.folder, file))) {
          await mkdir(path.dirname(path.join(work, file)), { recursive: true });
          await copyFile(path.join(this.folder, file), path.join(work, file));
        }
      const npmArguments = [...App.LOCK_ARGUMENTS, ...archives];
      const result = await this.npm.runAsync(npmArguments, work);
      if (!result.isSuccessful)
        throw new ProcessException(`"npm ${npmArguments.join(" ")}" in a copy of app/ failed with exit code ${result.exitCode}: ${result.errorOutput.trim()}`);
      await (await this.readLockfileAsync()).writeAsync(path.join(work, App.LOCKFILE_NAME), path.join(this.folder, App.MANIFEST_NAME), path.join(this.folder, App.LOCKFILE_NAME));
    }
    finally {
      await folders.removeAsync(work);
    }
    this.output.write(`Wrote ${App.FOLDER}/${App.LOCKFILE_NAME}, which locks every package the app installs, this checkout's ${archives.length} TeamRun packages at their archives in _packages/ without a checksum.\n`);
    return 0;
  }

  private async readLockfileAsync(): Promise<AppLockfile> {
    return new AppLockfile(new Set((await new PackageCatalog(this.root).listPackagesAsync()).map(t => t.name)), App.ARCHIVES_SPEC_START);
  }

  private runNpmAsync(npmArguments: readonly string[]): Promise<number | null> {
    const npm = this.environment[App.NPM_PATH_VARIABLE];
    if (Object.isUndefined(npm) || npm.length === 0)
      throw new ProcessException(`${App.NPM_PATH_VARIABLE} is not set; run this through npm, such as npm run build:app or npm start.`);
    return this.runner.runAsync(process.execPath, [npm, ...npmArguments], this.folder, this.environment);
  }

  private async listArchivesAsync(): Promise<readonly string[]> {
    const version = (await RootManifest.readAsync(this.root)).productVersion;
    const manifest: unknown = JSON.parse(await readFile(path.join(this.folder, App.MANIFEST_NAME), "utf8"));
    const dependencies = Object.isObject(manifest) ? (manifest as Readonly<Record<string, unknown>>)["dependencies"] : undefined;
    const pin = Object.isObject(dependencies) ? (dependencies as Readonly<Record<string, unknown>>)[App.MODULE_PACKAGE] : undefined;
    if (pin !== version)
      throw new PackageException(`app/package.json pins ${App.MODULE_PACKAGE} at ${String(pin)}, but this checkout builds ${version}; pin the app at the root package.json's version.`);
    const layout = new BuildLayout(this.root);
    return (await new PackageCatalog(this.root).listPackagesAsync()).map(t => layout.locateArchive(t, version));
  }
}

if (import.meta.main)
  process.exitCode = await new App(process.cwd(), new ProcessRunner(), process.env, process.stdout).runAsync(process.argv.slice(2));
