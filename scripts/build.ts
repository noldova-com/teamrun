/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import AngularProject from "./angular/angular-project.ts";
import GalleryFile from "./angular/gallery-file.ts";
import ProductFile from "./angular/product-file.ts";
import ElectronBinary from "./desktop/electron-binary.ts";
import BuildVariant from "./modules/build-variant.ts";
import ModuleArtifacts from "./modules/module-artifacts.ts";
import ModuleCatalog from "./modules/module-catalog.ts";
import ModuleException from "./modules/module.exception.ts";
import PackageBuild from "./packages/package-build.ts";
import PackageException from "./packages/package.exception.ts";
import UpdateFeed from "./packages/update-feed.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import NpmCommand from "./toolchain/npm-command.ts";

export default class Build {
  private static readonly USAGE: string = "Usage: npm run build [-- --test [--without <module id>]... [--output <folder>] | --packaged [--output <folder> [--update-feed <https URL, or http URL of localhost, ending in />]]]\n";
  private static readonly NO_PACKAGES: string = "No packages under src/; there is nothing to build.\n";
  private static readonly TEST_OPTION: string = "--test";
  private static readonly PACKAGED_OPTION: string = "--packaged";
  private static readonly WITHOUT_OPTION: string = "--without";
  private static readonly OUTPUT_OPTION: string = "--output";
  private static readonly WINDOW_FOLDER: string = "window";
  private static readonly USAGE_EXIT_CODE: number = 2;

  private readonly build: PackageBuild;
  private readonly modules: ModuleCatalog;
  private readonly artifacts: ModuleArtifacts;
  private readonly product: ProductFile;
  private readonly gallery: GalleryFile;
  private readonly angular: AngularProject;
  private readonly electron: ElectronBinary;
  private readonly output: Writable;

  public constructor(build: PackageBuild, modules: ModuleCatalog, artifacts: ModuleArtifacts, product: ProductFile, gallery: GalleryFile, angular: AngularProject, electron: ElectronBinary, output: Writable) {
    this.build = build;
    this.modules = modules;
    this.artifacts = artifacts;
    this.product = product;
    this.gallery = gallery;
    this.angular = angular;
    this.electron = electron;
    this.output = output;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    const isTest = buildArguments[0] === Build.TEST_OPTION;
    const isPackaged = buildArguments[0] === Build.PACKAGED_OPTION;
    const options = buildArguments.slice(isTest || isPackaged ? 1 : 0);
    const names = options.filter((_, i) => i % 2 === 0);
    const values = options.filter((_, i) => i % 2 === 1);
    const isWellFormed = options.length % 2 === 0
      && names.every(t => t === Build.OUTPUT_OPTION || (isTest && t === Build.WITHOUT_OPTION) || (isPackaged && t === UpdateFeed.OPTION))
      && names.filter(t => t === Build.OUTPUT_OPTION).length < 2
      && names.filter(t => t === UpdateFeed.OPTION).length < 2
      && values.every((t, i) => names[i] !== UpdateFeed.OPTION || UpdateFeed.isValid(t))
      && (!names.includes(UpdateFeed.OPTION) || names.includes(Build.OUTPUT_OPTION));
    if (!isWellFormed || (!isTest && !isPackaged && options.length > 0)) {
      this.output.write(Build.USAGE);
      return Build.USAGE_EXIT_CODE;
    }

    try {
      const feedIndex = names.indexOf(UpdateFeed.OPTION);
      const variant = new BuildVariant(isTest, values.filter((_, i) => names[i] === Build.WITHOUT_OPTION), isPackaged, feedIndex < 0 ? null : String(values[feedIndex]));
      const outputIndex = names.indexOf(Build.OUTPUT_OPTION);
      const outputFolder = outputIndex < 0 ? null : path.resolve(String(values[outputIndex]));
      const declarations = await this.modules.listBuildAsync(variant.isTest, variant.excluded);
      const packages = await this.build.buildAsync(this.output, variant, outputFolder);
      this.output.write(packages.length === 0 ? Build.NO_PACKAGES : `Packages built and installed: ${packages.length}.\n`);
      await this.artifacts.writeAsync(declarations, outputFolder);
      this.output.write(`Modules in the build: ${declarations.length}.\n`);
      await this.product.writeAsync();
      await this.gallery.writeAsync(variant.isPackaged);
      await this.angular.prepareAsync(this.output);
      await this.electron.installAsync(this.output);
      const windowFolder = outputFolder === null ? null : path.join(outputFolder, Build.WINDOW_FOLDER);
      await this.angular.buildAsync(this.output, windowFolder);
      if (variant.isPackaged)
        await this.angular.verifyWithoutAsync(windowFolder, GalleryFile.MARKERS);
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException || error instanceof ModuleException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }
}

if (import.meta.main) {
  const runner = new ProcessRunner();
  const root = process.cwd();
  const angular = new AngularProject(root, runner, new NpmCommand(runner, process.env));
  const build = new Build(new PackageBuild(root, runner, process.env, process.platform, process.arch), new ModuleCatalog(root), new ModuleArtifacts(root), new ProductFile(root), new GalleryFile(root), angular, new ElectronBinary(root, runner), process.stdout);
  process.exitCode = await build.runAsync(process.argv.slice(2));
}
