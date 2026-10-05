/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import AngularProject from "./angular/angular-project.ts";
import GalleryFile from "./angular/gallery-file.ts";
import ModuleException from "./modules/module.exception.ts";
import PackageException from "./packages/package.exception.ts";
import RootManifest from "./packages/root-manifest.ts";
import ElectronDistribution from "./packaging/electron-distribution.ts";
import PackageConfiguration from "./packaging/package-configuration.ts";
import PackageStage from "./packaging/package-stage.ts";
import PackageTarget from "./packaging/package-target.ts";
import PackagingException from "./packaging/packaging.exception.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import NpmCommand from "./toolchain/npm-command.ts";

export default class Package {
  private static readonly USAGE: string = "Usage: npm run package\n";
  private static readonly USAGE_EXIT_CODE: number = 2;
  private static readonly OUTPUT_SEGMENTS: readonly string[] = ["_build", "package", "out"];
  private static readonly CONFIGURATION_SEGMENTS: readonly string[] = ["_build", "package", "electron-builder.json"];
  private static readonly TOOL_CACHE_SEGMENTS: readonly string[] = ["_build", "package", "tool-cache"];
  private static readonly TOOL_CACHE_MANIFEST: string = "package.json";
  private static readonly COMMONJS_SCOPE: string = `${JSON.stringify({ type: "commonjs" })}\n`;
  private static readonly BUILDER_SEGMENTS: readonly string[] = ["node_modules", "electron-builder", "cli.js"];
  private static readonly BUILDER_OPTIONS: readonly string[] = ["--publish", "never", "--config"];

  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly stage: PackageStage;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;

  public constructor(root: string, platform: string, architecture: string, stage: PackageStage, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.stage = stage;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
  }

  public async runAsync(packageArguments: readonly string[]): Promise<number> {
    if (packageArguments.length > 0) {
      this.output.write(Package.USAGE);
      return Package.USAGE_EXIT_CODE;
    }

    try {
      const target = PackageTarget.fromProcess(this.platform, this.architecture);
      await this.stage.stageAsync(this.output);
      const folder = path.join(this.root, ...Package.OUTPUT_SEGMENTS);
      await rm(folder, { recursive: true, force: true });
      const electron = new ElectronDistribution(this.root);
      await electron.copyAsync();
      const configuration = new PackageConfiguration(this.root, await RootManifest.readAsync(this.root), target, this.stage.folder, folder,
        electron.folder, await electron.readVersionAsync());
      const file = path.join(this.root, ...Package.CONFIGURATION_SEGMENTS);
      await configuration.writeAsync(file);
      const toolCache = path.join(this.root, ...Package.TOOL_CACHE_SEGMENTS);
      await mkdir(toolCache, { recursive: true });
      await writeFile(path.join(toolCache, Package.TOOL_CACHE_MANIFEST), Package.COMMONJS_SCOPE);
      const environment = { ...this.environment, ELECTRON_BUILDER_CACHE: toolCache, CSC_IDENTITY_AUTO_DISCOVERY: "false" };
      const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...Package.BUILDER_SEGMENTS), ...Package.BUILDER_OPTIONS, file], this.root, environment);
      if (exitCode !== 0)
        throw new PackagingException(`electron-builder failed with exit code ${exitCode}.`);
      const files = configuration.fileNames.map(t => path.join(folder, t));
      const missing = files.filter(t => !existsSync(t));
      if (missing.length > 0)
        throw new PackagingException(`electron-builder finished without making ${missing.join(", ")}.`);
      this.output.write(`Packages made:\n${files.map(t => `  ${t}\n`).join("")}`);
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackagingException || error instanceof PackageException || error instanceof ProcessException || error instanceof ModuleException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }
}

if (import.meta.main) {
  const runner = new ProcessRunner();
  const root = process.cwd();
  const npm = new NpmCommand(runner, process.env);
  const stage = new PackageStage(root, runner, npm, new GalleryFile(root), new AngularProject(root, runner, npm));
  process.exitCode = await new Package(root, process.platform, process.arch, stage, runner, process.env, process.stdout).runAsync(process.argv.slice(2));
}
