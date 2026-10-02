/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import ContentHash from "../packages/content-hash.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";
import type NpmCommand from "../toolchain/npm-command.ts";

export default class AngularProject {
  private static readonly FOLDER: string = "src";
  private static readonly WORKSPACE_FILE: string = "angular.json";
  private static readonly LOCKFILE: string = "package-lock.json";
  private static readonly INSTALL_RECORD: string = "node_modules/.teamrun-install";
  private static readonly RECORD_ENCODING: BufferEncoding = "utf8";
  private static readonly OWN_SCOPE: string = "node_modules/@noldova";
  private static readonly CLI: string = "node_modules/@angular/cli/bin/ng.js";
  private static readonly PLAYWRIGHT_CLI: string = "node_modules/playwright/cli.js";
  private static readonly INSTALL_ARGUMENTS: readonly string[] = ["ci", "--no-audit", "--no-fund"];
  private static readonly BROWSER_ARGUMENTS: readonly string[] = ["install", "--only-shell", "chromium"];
  private static readonly TEST_ARGUMENTS: readonly string[] = ["test"];
  private static readonly BUILD_ARGUMENTS: readonly string[] = ["build"];
  private static readonly OUTPUT_PATH_OPTION: string = "--output-path";
  private static readonly NO_PROJECT: string = "No Angular project under src/; there is nothing to prepare.\n";
  private static readonly INSTALLING: string = "Installing the Angular project in src/...\n";
  private static readonly INSTALLING_BROWSER: string = "Installing the browser for the Angular tests...\n";
  private static readonly BUILDING: string = "Building the window...\n";

  private readonly directory: string;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;

  public constructor(root: string, runner: ProcessRunner, npm: NpmCommand) {
    this.directory = path.join(root, AngularProject.FOLDER);
    this.runner = runner;
    this.npm = npm;
  }

  public async prepareAsync(output: Writable): Promise<void> {
    if (!this.hasProject()) {
      output.write(AngularProject.NO_PROJECT);
      return;
    }

    await rm(path.join(this.directory, AngularProject.OWN_SCOPE), { recursive: true, force: true });
    if (await this.needsInstallAsync()) {
      output.write(AngularProject.INSTALLING);
      const result = await this.npm.runAsync(AngularProject.INSTALL_ARGUMENTS, this.directory);
      if (!result.isSuccessful)
        throw new ProcessException(`"npm ci" in src/ failed with exit code ${result.exitCode}: ${result.errorOutput.trim()}`);
      await writeFile(path.join(this.directory, AngularProject.INSTALL_RECORD), await this.describeInstallAsync(), AngularProject.RECORD_ENCODING);
    }

    output.write(AngularProject.INSTALLING_BROWSER);
    const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.directory, AngularProject.PLAYWRIGHT_CLI), ...AngularProject.BROWSER_ARGUMENTS], this.directory);
    if (exitCode !== 0)
      throw new ProcessException(`Installing the browser for the Angular tests failed with exit code ${exitCode}.`);
  }

  public async buildAsync(output: Writable, outputPath: string | null): Promise<void> {
    if (!this.hasProject())
      return;

    output.write(AngularProject.BUILDING);
    const outputArguments = outputPath === null ? [] : [AngularProject.OUTPUT_PATH_OPTION, outputPath];
    const exitCode = await this.runner.runAsync(
      process.execPath,
      [path.join(this.directory, AngularProject.CLI), ...AngularProject.BUILD_ARGUMENTS, ...outputArguments],
      this.directory);
    if (exitCode !== 0)
      throw new ProcessException(`Building the window failed with exit code ${exitCode}.`);
  }

  public async testAsync(): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, [path.join(this.directory, AngularProject.CLI), ...AngularProject.TEST_ARGUMENTS], this.directory) === 0;
  }

  private hasProject(): boolean {
    return existsSync(path.join(this.directory, AngularProject.WORKSPACE_FILE));
  }

  private async needsInstallAsync(): Promise<boolean> {
    const record = path.join(this.directory, AngularProject.INSTALL_RECORD);
    if (!existsSync(record) || !existsSync(path.join(this.directory, AngularProject.CLI)))
      return true;
    return await readFile(record, AngularProject.RECORD_ENCODING) !== await this.describeInstallAsync();
  }

  private async describeInstallAsync(): Promise<string> {
    return `${process.platform} ${process.arch} ${await ContentHash.ofFileAsync(path.join(this.directory, AngularProject.LOCKFILE))}\n`;
  }
}
