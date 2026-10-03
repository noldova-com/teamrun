/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { glob, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import ContentHash from "../packages/content-hash.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";
import type NpmCommand from "../toolchain/npm-command.ts";
import AngularTestRun from "./angular-test-run.ts";

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
  private static readonly TEST_ARGUMENTS: readonly string[] = ["test", "--reporters=default", "--reporters=json"];
  private static readonly OUTPUT_FILE_OPTION: string = "--output-file";
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "angular-tests.json"];
  private static readonly TEST_TARGET: string = "test";
  private static readonly OPTIONS_PATH: readonly string[] = ["architect", AngularProject.TEST_TARGET, "options"];
  private static readonly BUILD_ARGUMENTS: readonly string[] = ["build"];
  private static readonly OUTPUT_PATH_OPTION: string = "--output-path";
  private static readonly NO_PROJECT: string = "No Angular project under src/; there is nothing to prepare.\n";
  private static readonly INSTALLING: string = "Installing the Angular project in src/...\n";
  private static readonly INSTALLING_BROWSER: string = "Installing the browser for the Angular tests...\n";
  private static readonly BUILDING: string = "Building the window...\n";

  private readonly root: string;
  private readonly directory: string;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;

  public constructor(root: string, runner: ProcessRunner, npm: NpmCommand) {
    this.root = root;
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

  public async testAsync(): Promise<AngularTestRun> {
    const report = path.join(this.root, ...AngularProject.REPORT_SEGMENTS);
    await rm(report, { force: true });
    await mkdir(path.dirname(report), { recursive: true });
    const exitCode = await this.runner.runAsync(
      process.execPath,
      [path.join(this.directory, AngularProject.CLI), ...AngularProject.TEST_ARGUMENTS, AngularProject.OUTPUT_FILE_OPTION, report],
      this.directory);
    return new AngularTestRun(exitCode, existsSync(report) ? await this.readCollectedAsync(report) : null);
  }

  public async specFilesAsync(): Promise<readonly string[]> {
    const workspace = await AngularProject.readJsonAsync(path.join(this.directory, AngularProject.WORKSPACE_FILE));
    const projects = AngularProject.field(workspace, "projects");
    const options = (typeof projects === "object" && projects !== null ? Object.values(projects) : [])
      .map(t => AngularProject.OPTIONS_PATH.reduce<unknown>((value, name) => AngularProject.field(value, name), t))
      .find(t => t !== undefined);
    if (AngularProject.field(options, "exclude") !== undefined)
      throw new ProcessException(`src/${AngularProject.WORKSPACE_FILE} excludes files from its ${AngularProject.TEST_TARGET} target, and the check of the spec files run does not apply exclusions.`);
    const include = AngularProject.field(options, "include");
    if (!Array.isArray(include) || include.length === 0 || include.some(t => typeof t !== "string"))
      throw new ProcessException(`src/${AngularProject.WORKSPACE_FILE} names no spec files for its ${AngularProject.TEST_TARGET} target.`);
    const files: string[] = [];
    for await (const file of glob(include as string[], { cwd: this.directory }))
      files.push(this.specName(path.resolve(this.directory, file)));
    return files.sort();
  }

  private async readCollectedAsync(report: string): Promise<readonly string[]> {
    const results = AngularProject.field(await AngularProject.readJsonAsync(report), "testResults");
    if (!Array.isArray(results) || results.some(t => typeof AngularProject.field(t, "name") !== "string"))
      throw new ProcessException(`The Angular test report ${path.relative(this.root, report)} lists no test files.`);
    return results.map(t => this.specName(path.resolve(String(AngularProject.field(t, "name"))))).sort();
  }

  private specName(file: string): string {
    return path.relative(this.directory, file).split(path.sep).join(path.posix.sep);
  }

  private static async readJsonAsync(file: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(file, AngularProject.RECORD_ENCODING));
    }
    catch (error) {
      throw new ProcessException(`${path.basename(file)} could not be read as JSON.`, { cause: error });
    }
  }

  private static field(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
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
