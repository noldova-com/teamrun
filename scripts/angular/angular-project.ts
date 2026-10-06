/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync } from "node:fs";
import { glob, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import ContentHash from "../packages/content-hash.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";
import type NpmCommand from "../toolchain/npm-command.ts";
import AngularTestRun from "./angular-test-run.ts";
import RetriedTest from "./retried-test.ts";

export default class AngularProject {
  public static readonly LOG_FILE: string = "_build/angular-tests.log";
  public static readonly RETRY_VARIABLE: string = "TEAMRUN_TEST_RETRY";

  private static readonly FOLDER: string = "src";
  private static readonly WORKSPACE_FILE: string = "angular.json";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly LOCKFILE: string = "package-lock.json";
  private static readonly INSTALL_RECORD: string = "node_modules/.teamrun-install";
  private static readonly RECORD_ENCODING: BufferEncoding = "utf8";
  private static readonly OWN_SCOPE: string = "node_modules/@noldova";
  private static readonly DEPENDENCY_CACHE: string = "node_modules/.vite";
  private static readonly CLI: string = "node_modules/@angular/cli/bin/ng.js";
  private static readonly PLAYWRIGHT_CLI: string = "node_modules/playwright/cli.js";
  private static readonly INSTALL_ARGUMENTS: readonly string[] = ["ci", "--no-audit", "--no-fund"];
  private static readonly BROWSER_ARGUMENTS: readonly string[] = ["install", "--only-shell", "chromium"];
  private static readonly TEST_ARGUMENTS: readonly string[] = ["test", "--reporters=default", "--reporters=json"];
  private static readonly OUTPUT_FILE_OPTION: string = "--output-file";
  private static readonly INCLUDE_OPTION: string = "--include";
  private static readonly NO_COVERAGE_OPTION: string = "--no-coverage";
  private static readonly REPORT_SEGMENTS: readonly string[] = ["_build", "angular-tests.json"];
  private static readonly TEST_TARGET: string = "test";
  private static readonly PASSED_STATUS: string = "passed";
  private static readonly RETRY_ON: string = "1";
  private static readonly OPTIONS_PATH: readonly string[] = ["architect", AngularProject.TEST_TARGET, "options"];
  private static readonly BUILD_ARGUMENTS: readonly string[] = ["build"];
  private static readonly OUTPUT_PATH_OPTION: string = "--output-path";
  private static readonly OUTPUT_SEGMENTS: readonly string[] = ["_build", "window"];
  private static readonly NO_PROJECT: string = "No Angular project under src/; there is nothing to prepare.\n";
  private static readonly INSTALLING: string = "Installing the Angular project in src/...\n";
  private static readonly INSTALLING_BROWSER: string = "Installing the browser for the Angular tests...\n";
  private static readonly BUILDING: string = "Building the window...\n";

  private readonly root: string;
  private readonly directory: string;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;

  public readonly projectFile: string;
  public readonly projectName: string;

  public constructor(root: string, runner: ProcessRunner, npm: NpmCommand) {
    this.root = root;
    this.directory = path.join(root, AngularProject.FOLDER);
    this.projectFile = path.join(this.directory, AngularProject.PROJECT_FILE);
    this.projectName = this.describe(this.projectFile);
    this.runner = runner;
    this.npm = npm;
  }

  public async prepareAsync(output: Writable): Promise<void> {
    if (!this.hasProject()) {
      output.write(AngularProject.NO_PROJECT);
      return;
    }

    await rm(path.join(this.directory, AngularProject.OWN_SCOPE), { recursive: true, force: true });
    await rm(path.join(this.directory, AngularProject.DEPENDENCY_CACHE), { recursive: true, force: true });
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

  public async verifyWithoutAsync(outputPath: string | null, texts: readonly string[]): Promise<void> {
    if (!this.hasProject())
      return;

    const folder = outputPath ?? path.join(this.root, ...AngularProject.OUTPUT_SEGMENTS);
    const shown = path.relative(this.root, folder).split(path.sep).join(path.posix.sep);
    let scanned = 0;
    for await (const file of glob("**/*", { cwd: folder })) {
      if (!AngularProject.isFile(path.join(folder, file)))
        continue;
      scanned++;
      const content = await readFile(path.join(folder, file), AngularProject.RECORD_ENCODING);
      const found = texts.find(t => content.includes(t));
      if (found !== undefined)
        throw new ProcessException(`The window built in ${shown} contains ${JSON.stringify(found)} in ${file}.`);
    }
    if (scanned === 0)
      throw new ProcessException(`The window built in ${shown} has no files to check.`);
  }

  public async testAsync(include: readonly string[], isRetrying: boolean): Promise<AngularTestRun> {
    const report = path.join(this.root, ...AngularProject.REPORT_SEGMENTS);
    await rm(report, { force: true });
    await rm(path.join(this.directory, AngularProject.DEPENDENCY_CACHE), { recursive: true, force: true });
    await mkdir(path.dirname(report), { recursive: true });
    const exitCode = await this.runner.runLoggedAsync(
      process.execPath,
      [path.join(this.directory, AngularProject.CLI), ...AngularProject.TEST_ARGUMENTS, AngularProject.OUTPUT_FILE_OPTION, report, ...AngularProject.selectionArguments(include)],
      this.directory,
      path.join(this.root, AngularProject.LOG_FILE),
      process.stdout,
      process.stderr,
      isRetrying ? { ...process.env, [AngularProject.RETRY_VARIABLE]: AngularProject.RETRY_ON } : undefined);
    if (!existsSync(report))
      return new AngularTestRun(exitCode, null, []);
    const results = await this.readResultsAsync(report);
    return new AngularTestRun(exitCode, results.map(t => this.specName(path.resolve(String(AngularProject.field(t, "name"))))).sort(), results.flatMap(t => this.readRetried(t)));
  }

  public async specFilesAsync(): Promise<readonly string[]> {
    const workspace = await this.readJsonAsync(path.join(this.directory, AngularProject.WORKSPACE_FILE));
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

  public async readPathAliasesAsync(): Promise<ReadonlyMap<string, readonly string[]>> {
    if (!existsSync(this.projectFile))
      throw new ProcessException(`The Angular project has no ${this.projectName}.`);
    const paths = AngularProject.field(AngularProject.field(await this.readJsonAsync(this.projectFile), "compilerOptions"), "paths");
    const refused = new ProcessException(`${this.projectName} must map its path aliases to lists of files in compilerOptions.paths.`);
    if (typeof paths !== "object" || paths === null || Array.isArray(paths))
      throw refused;
    const aliases = new Map<string, readonly string[]>();
    for (const [alias, targets] of Object.entries(paths)) {
      if (!Array.isArray(targets) || targets.some(t => typeof t !== "string"))
        throw refused;
      aliases.set(alias, targets.map(t => path.resolve(this.directory, String(t))));
    }
    return aliases;
  }

  private async readResultsAsync(report: string): Promise<readonly unknown[]> {
    const results = AngularProject.field(await this.readJsonAsync(report), "testResults");
    if (!Array.isArray(results) || results.some(t => typeof AngularProject.field(t, "name") !== "string"))
      throw new ProcessException(`The Angular test report ${this.describe(report)} lists no test files.`);
    return results;
  }

  private readRetried(result: unknown): readonly RetriedTest[] {
    const file = this.specName(path.resolve(String(AngularProject.field(result, "name"))));
    const assertions = AngularProject.field(result, "assertionResults");
    return (Array.isArray(assertions) ? assertions : [])
      .filter(t => AngularProject.field(t, "status") === AngularProject.PASSED_STATUS && Array.isArray(AngularProject.field(t, "failureMessages")) && (AngularProject.field(t, "failureMessages") as unknown[]).length > 0)
      .map(t => new RetriedTest(file, String(AngularProject.field(t, "fullName")), String((AngularProject.field(t, "failureMessages") as unknown[])[0])));
  }

  private async readJsonAsync(file: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(file, AngularProject.RECORD_ENCODING));
    }
    catch (error) {
      throw new ProcessException(`${this.describe(file)} could not be read as JSON: ${String(error)}.`, { cause: error });
    }
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }

  private specName(file: string): string {
    return path.relative(this.directory, file).split(path.sep).join(path.posix.sep);
  }

  private static selectionArguments(include: readonly string[]): readonly string[] {
    return include.length === 0 ? [] : [AngularProject.NO_COVERAGE_OPTION, ...include.flatMap(t => [AngularProject.INCLUDE_OPTION, t])];
  }

  private static field(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>)[name] : undefined;
  }

  private static isFile(file: string): boolean {
    return statSync(file).isFile();
  }

  public hasProject(): boolean {
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
