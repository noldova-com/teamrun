/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type ProcessResult from "../processes/process-result.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import type NpmCommand from "../toolchain/npm-command.ts";
import TypeScriptCompiler from "../toolchain/typescript-compiler.ts";
import type BuildLayout from "./build-layout.ts";
import type PackageManifest from "./package-manifest.ts";
import type PackageVersions from "./package-versions.ts";
import PackageException from "./package.exception.ts";
import type RootManifest from "./root-manifest.ts";

export default class PackageBuilder {
  private static readonly COMPILE_TIMEOUT: number = 300_000;
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly TESTS_FOLDER: string = "tests";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly PROJECT_OPTION: string = "--project";
  private static readonly ROOT_OPTION: string = "--rootDir";
  private static readonly OUTPUT_OPTION: string = "--outDir";
  private static readonly SOURCE_MAP_OPTION: string = "--sourceMap";
  private static readonly NO_EMIT_OPTION: string = "--noEmit";
  private static readonly MANIFEST_FILE: string = "package.json";
  private static readonly RESOURCES_FILE: string = "resources.js";
  private static readonly LICENSE_FILE: string = "LICENSE";
  private static readonly DECLARATIONS: readonly string[] = ["api", "index.d.ts"];
  private static readonly VERSION_PLACEHOLDER: string = "__VERSION__";
  private static readonly PROTOCOL_VERSION_PLACEHOLDER: string = "__PROTOCOL_VERSION__";
  private static readonly BUILD_PLACEHOLDER: string = "__BUILD__";
  private static readonly PACK_ARGUMENTS: readonly string[] = ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination"];
  private static readonly INSTALL_ARGUMENTS: readonly string[] = ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error"];

  private readonly layout: BuildLayout;
  private readonly rootManifest: RootManifest;
  private readonly versions: PackageVersions;
  private readonly runner: ProcessRunner;
  private readonly npm: NpmCommand;
  private readonly fingerprint: string;

  public constructor(layout: BuildLayout, rootManifest: RootManifest, versions: PackageVersions, runner: ProcessRunner, npm: NpmCommand, fingerprint: string) {
    this.layout = layout;
    this.rootManifest = rootManifest;
    this.versions = versions;
    this.runner = runner;
    this.npm = npm;
    this.fingerprint = fingerprint;
  }

  public async buildSourceAsync(manifest: PackageManifest, archives: readonly string[]): Promise<void> {
    const declarations = this.layout.locateSource(manifest, PackageBuilder.SOURCE_FOLDER, ...PackageBuilder.DECLARATIONS);
    if (!existsSync(declarations))
      throw new PackageException(`${manifest.directory} has no ${PackageBuilder.SOURCE_FOLDER}/${PackageBuilder.DECLARATIONS.join("/")}.`);

    const output = this.layout.locateOutput(manifest);
    await rm(output, { recursive: true, force: true });
    await this.compileAsync(manifest, PackageBuilder.SOURCE_FOLDER, output);
    await writeFile(path.join(output, PackageBuilder.MANIFEST_FILE), this.stamp(this.versions.stampManifest(manifest, await readFile(this.layout.locateSource(manifest, PackageBuilder.MANIFEST_FILE), "utf8"))));
    const resources = path.join(output, PackageBuilder.RESOURCES_FILE);
    if (existsSync(resources))
      await writeFile(resources, this.stamp(await readFile(resources, "utf8")));
    await copyFile(path.join(this.layout.root, PackageBuilder.LICENSE_FILE), path.join(output, PackageBuilder.LICENSE_FILE));
    await mkdir(path.join(output, ...PackageBuilder.DECLARATIONS.slice(0, -1)), { recursive: true });
    await copyFile(declarations, path.join(output, ...PackageBuilder.DECLARATIONS));

    await mkdir(this.layout.archivesFolder, { recursive: true });
    PackageBuilder.require(await this.npm.runAsync([...PackageBuilder.PACK_ARGUMENTS, this.layout.archivesFolder], output), `Packing ${manifest.name}`);
    const installed = archives.filter(t => existsSync(t));
    PackageBuilder.require(await this.npm.runAsync([...PackageBuilder.INSTALL_ARGUMENTS, ...installed], this.layout.root), `Installing ${manifest.name}`);
  }

  public async compileTestsAsync(manifest: PackageManifest): Promise<void> {
    const output = this.layout.locateTestOutput(manifest);
    await rm(output, { recursive: true, force: true });
    await this.compileAsync(manifest, PackageBuilder.TESTS_FOLDER, output);
  }

  public async typeCheckAsync(manifest: PackageManifest): Promise<void> {
    const result = await this.runner.captureAsync(
      process.execPath,
      [TypeScriptCompiler.locate(), PackageBuilder.PROJECT_OPTION, this.layout.locateSource(manifest, PackageBuilder.SOURCE_FOLDER, PackageBuilder.PROJECT_FILE), PackageBuilder.NO_EMIT_OPTION],
      this.layout.root,
      PackageBuilder.COMPILE_TIMEOUT);
    PackageBuilder.require(result, `Type-checking ${manifest.directory}/${PackageBuilder.SOURCE_FOLDER}`);
  }

  private static require(result: ProcessResult, operation: string): void {
    if (!result.isSuccessful)
      throw new PackageException(`${operation} failed with exit code ${result.exitCode}:\n${`${result.output}${result.errorOutput}`.trim()}`);
  }

  private async compileAsync(manifest: PackageManifest, folder: string, output: string): Promise<void> {
    const project = this.layout.locateSource(manifest, folder, PackageBuilder.PROJECT_FILE);
    const result = await this.runner.captureAsync(
      process.execPath,
      [
        TypeScriptCompiler.locate(),
        PackageBuilder.PROJECT_OPTION,
        project,
        PackageBuilder.ROOT_OPTION,
        this.layout.locateSource(manifest, folder),
        PackageBuilder.OUTPUT_OPTION,
        output,
        PackageBuilder.SOURCE_MAP_OPTION
      ],
      this.layout.root,
      PackageBuilder.COMPILE_TIMEOUT);
    PackageBuilder.require(result, `Compiling ${manifest.directory}/${folder}`);
  }

  private stamp(text: string): string {
    return [...this.rootManifest.product.placeholders].reduce((stamped, [placeholder, value]) => stamped.replaceAll(placeholder, value), text)
      .replaceAll(PackageBuilder.VERSION_PLACEHOLDER, this.rootManifest.productVersion)
      .replaceAll(PackageBuilder.PROTOCOL_VERSION_PLACEHOLDER, String(this.rootManifest.protocolVersion))
      .replaceAll(PackageBuilder.BUILD_PLACEHOLDER, this.fingerprint);
  }
}
