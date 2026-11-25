/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProcessResult } from "../processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import type { NpmCommand } from "../toolchain/npm-command.ts";
import { TypeScriptCompiler } from "../toolchain/typescript-compiler.ts";
import { ArchiveReader } from "./archive.reader.ts";
import type { BuildLayout } from "./build-layout.ts";
import type { PackageManifest } from "./package-manifest.ts";
import type { PackageVersions } from "./package-versions.ts";
import { PackageException } from "./package.exception.ts";

export class PackageBuilder {
  public static readonly COMPILE_TIMEOUT: number = 300_000;
  public static readonly INPUTS_OPTION: string = "--inputs";
  private static readonly BUILD_SCRIPT_TIMEOUT: number = PackageBuilder.COMPILE_TIMEOUT + 60_000;
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly SCRIPTS_FOLDER: string = "scripts";
  private static readonly TESTS_FOLDER: string = "tests";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly PROJECT_OPTION: string = "--project";
  private static readonly ROOT_OPTION: string = "--rootDir";
  private static readonly OUTPUT_OPTION: string = "--outDir";
  private static readonly SOURCE_MAP_OPTION: string = "--sourceMap";
  private static readonly LINK_TYPE: "junction" = "junction";
  private static readonly MANIFEST_FILE: string = "package.json";
  private static readonly LICENSE_FILE: string = "LICENSE";
  private static readonly RESOURCES_FILE: string = "resources.js";
  private static readonly PROTOCOL_VERSION_PLACEHOLDER: string = "__PROTOCOL_VERSION__";
  private static readonly README_FILE: string = "README.md";
  private static readonly MODULE_FILES: readonly string[] = ["module.json", "menus.json", "settings.json", "cli.json", "webViews.json"];
  private static readonly DECLARATIONS: readonly string[] = ["api", "index.d.ts"];
  private static readonly DECLARATIONS_SUFFIX: string = ".d.ts";
  private static readonly BUILD_SCRIPT: readonly string[] = [PackageBuilder.SCRIPTS_FOLDER, "build.ts"];
  private static readonly LINE_BREAK: RegExp = /\r?\n/;
  private static readonly PACK_ARGUMENTS: readonly string[] = ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination"];
  private static readonly INSTALL_ARGUMENTS: readonly string[] = ["install", "--no-save", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];
  private static readonly ARCHIVE_FOLDER: string = "package";
  private static readonly INPUTS_RULE: string = "A build script lists with --inputs only what the build copies into the package from outside it, each under its own name.";

  private readonly layout: BuildLayout;
  private readonly versions: PackageVersions;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;
  private readonly archives: ArchiveReader = new ArchiveReader();

  public constructor(layout: BuildLayout, versions: PackageVersions, runner: ProcessRunner, npm: NpmCommand) {
    this.layout = layout;
    this.versions = versions;
    this.runner = runner;
    this.npm = npm;
  }

  public async installAsync(subject: string, folder: string, archives: readonly string[]): Promise<void> {
    const installed = archives.filter(t => existsSync(t));
    if (installed.length === 0)
      return;
    PackageBuilder.require(await this.npm.runAsync([...PackageBuilder.INSTALL_ARGUMENTS, ...installed], folder), `Installing ${subject}`);
  }

  public async listInputsAsync(manifest: PackageManifest): Promise<readonly string[]> {
    const inputs = [
      this.layout.locateSource(manifest, PackageBuilder.MANIFEST_FILE),
      this.layout.locateSource(manifest, PackageBuilder.SOURCE_FOLDER),
      ...this.listCopies(manifest).map(([source]) => source)
    ];
    const scripts = this.layout.locateSource(manifest, PackageBuilder.SCRIPTS_FOLDER);
    if (existsSync(scripts))
      inputs.push(scripts);
    const script = this.layout.locateSource(manifest, ...PackageBuilder.BUILD_SCRIPT);
    if (existsSync(script))
      inputs.push(...await this.listScriptInputsAsync(manifest, script));
    return inputs;
  }

  public async compileTestsAsync(manifest: PackageManifest): Promise<void> {
    const output = this.layout.locateTestOutput(manifest);
    await rm(output, { recursive: true, force: true });
    await this.compileAsync(manifest, PackageBuilder.TESTS_FOLDER, this.layout.locateSource(manifest), output);
    const source = path.join(output, PackageBuilder.SOURCE_FOLDER);
    await rm(source, { recursive: true, force: true });
    await symlink(this.layout.locateInstalled(manifest), source, PackageBuilder.LINK_TYPE);
  }

  private async stampResourcesAsync(output: string): Promise<void> {
    const resources = path.join(output, PackageBuilder.RESOURCES_FILE);
    if (!existsSync(resources))
      return;
    await writeFile(resources, (await readFile(resources, "utf8")).replaceAll(PackageBuilder.PROTOCOL_VERSION_PLACEHOLDER, this.versions.protocolVersion));
  }

  private static require(result: ProcessResult, operation: string): void {
    if (!result.isSuccessful)
      throw new PackageException(`${operation} failed with exit code ${result.exitCode}:\n${result.text}`);
  }

  private static async listFilesAsync(source: string, entry: string): Promise<readonly (readonly [string, string])[]> {
    if (!(await stat(source)).isDirectory())
      return [[source, entry]];
    const files: (readonly [string, string])[] = [];
    for (const name of (await readdir(source, { recursive: true })).sort()) {
      const file = path.join(source, name);
      if ((await stat(file)).isFile())
        files.push([file, `${entry}/${name.split(path.sep).join(path.posix.sep)}`]);
    }
    return files;
  }

  public async compileSourceAsync(manifest: PackageManifest): Promise<void> {
    const declarations = this.layout.locateSource(manifest, PackageBuilder.SOURCE_FOLDER, ...PackageBuilder.DECLARATIONS);
    if (!existsSync(declarations))
      throw new PackageException(`${manifest.directory} has no ${PackageBuilder.SOURCE_FOLDER}/${PackageBuilder.DECLARATIONS.join("/")}.`);

    const output = this.layout.locateOutput(manifest);
    await rm(output, { recursive: true, force: true });
    const script = this.layout.locateSource(manifest, ...PackageBuilder.BUILD_SCRIPT);
    const buildsItself = existsSync(script);
    if (buildsItself)
      await this.runBuildScriptAsync(manifest, script, output);
    else
      await this.compileAsync(manifest, PackageBuilder.SOURCE_FOLDER, this.layout.locateSource(manifest, PackageBuilder.SOURCE_FOLDER), output);
    await this.stampResourcesAsync(output);
    await writeFile(path.join(output, PackageBuilder.MANIFEST_FILE), this.versions.stampManifest(manifest, await readFile(this.layout.locateSource(manifest, PackageBuilder.MANIFEST_FILE), "utf8")));
    for (const [source, name] of this.listCopies(manifest))
      await copyFile(source, path.join(output, name));
    if (!buildsItself)
      await this.copyDeclarationsAsync(path.dirname(declarations), output);
  }

  public async packSourceAsync(manifest: PackageManifest): Promise<void> {
    await mkdir(this.layout.archivesFolder, { recursive: true });
    PackageBuilder.require(await this.npm.runAsync([...PackageBuilder.PACK_ARGUMENTS, this.layout.archivesFolder], this.layout.locateOutput(manifest)), `Packing ${manifest.name}`);
    const differences = await this.findArchiveDifferencesAsync(manifest, this.layout.locateArchive(manifest, this.versions.version));
    if (differences.length > 0)
      throw new PackageException([...differences, PackageBuilder.INPUTS_RULE].join("\n"));
  }

  public async listCopiesAsync(manifest: PackageManifest): Promise<readonly (readonly [string, string])[]> {
    const copies: (readonly [string, string])[] = [...this.listCopies(manifest)];
    const script = this.layout.locateSource(manifest, ...PackageBuilder.BUILD_SCRIPT);
    if (existsSync(script))
      for (const source of await this.listScriptInputsAsync(manifest, script))
        copies.push(...await PackageBuilder.listFilesAsync(source, path.basename(source)));
    return copies;
  }

  private async findArchiveDifferencesAsync(manifest: PackageManifest, archive: string): Promise<readonly string[]> {
    const script = this.layout.locateSource(manifest, ...PackageBuilder.BUILD_SCRIPT);
    const copies = existsSync(script) ? await this.listScriptInputsAsync(manifest, script) : [];
    if (copies.length === 0)
      return [];
    const packed = await this.archives.readAsync(archive);
    const differences: string[] = [];
    for (const source of copies)
      for (const [file, entry] of await PackageBuilder.listFilesAsync(source, `${PackageBuilder.ARCHIVE_FOLDER}/${path.basename(source)}`)) {
        const copy = packed.get(entry);
        const origin = path.relative(this.layout.root, file).split(path.sep).join(path.posix.sep);
        if (Object.isUndefined(copy))
          differences.push(`${path.basename(archive)} lacks ${entry}, the copy of ${origin}.`);
        else if (!copy.equals(await readFile(file)))
          differences.push(`${path.basename(archive)} holds a ${entry} that differs from ${origin}.`);
      }
    return differences;
  }

  private listCopies(manifest: PackageManifest): readonly (readonly [string, string])[] {
    const optional = [PackageBuilder.README_FILE, ...PackageBuilder.MODULE_FILES].map(t => [this.layout.locateSource(manifest, t), t] as const);
    return [
      [path.join(this.layout.root, PackageBuilder.LICENSE_FILE), PackageBuilder.LICENSE_FILE],
      ...optional.filter(([source]) => existsSync(source))
    ];
  }

  private async copyDeclarationsAsync(entries: string, output: string): Promise<void> {
    const folder = path.join(output, ...PackageBuilder.DECLARATIONS.slice(0, -1));
    await mkdir(folder, { recursive: true });
    for (const file of (await readdir(entries)).filter(t => t.endsWith(PackageBuilder.DECLARATIONS_SUFFIX)).sort())
      await copyFile(path.join(entries, file), path.join(folder, file));
  }

  private async listScriptInputsAsync(manifest: PackageManifest, script: string): Promise<readonly string[]> {
    const result = await this.runner.captureAsync(process.execPath, [script, PackageBuilder.INPUTS_OPTION], this.layout.root, PackageBuilder.BUILD_SCRIPT_TIMEOUT);
    PackageBuilder.require(result, `Listing the inputs of ${manifest.directory} with its ${PackageBuilder.BUILD_SCRIPT.join("/")}`);
    return result.output.split(PackageBuilder.LINE_BREAK).filter(t => t.length > 0).map(t => path.join(this.layout.root, ...t.split("/")));
  }

  private async runBuildScriptAsync(manifest: PackageManifest, script: string, output: string): Promise<void> {
    const result = await this.runner.captureAsync(process.execPath, [script, output], this.layout.root, PackageBuilder.BUILD_SCRIPT_TIMEOUT);
    PackageBuilder.require(result, `Building ${manifest.directory} with its ${PackageBuilder.BUILD_SCRIPT.join("/")}`);
  }

  private async compileAsync(manifest: PackageManifest, folder: string, rootDirectory: string, output: string): Promise<void> {
    const project = this.layout.locateSource(manifest, folder, PackageBuilder.PROJECT_FILE);
    const result = await this.runner.captureAsync(
      process.execPath,
      [
        TypeScriptCompiler.locate(),
        PackageBuilder.PROJECT_OPTION,
        project,
        PackageBuilder.ROOT_OPTION,
        rootDirectory,
        PackageBuilder.OUTPUT_OPTION,
        output,
        PackageBuilder.SOURCE_MAP_OPTION
      ],
      this.layout.root,
      PackageBuilder.COMPILE_TIMEOUT);
    PackageBuilder.require(result, `Compiling ${manifest.directory}/${folder}`);
  }
}
