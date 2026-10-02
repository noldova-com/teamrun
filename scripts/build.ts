/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import AngularProject from "./angular/angular-project.ts";
import ModuleArtifacts from "./modules/module-artifacts.ts";
import ModuleCatalog from "./modules/module-catalog.ts";
import ModuleException from "./modules/module.exception.ts";
import PackageBuild from "./packages/package-build.ts";
import PackageException from "./packages/package.exception.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";
import NpmCommand from "./toolchain/npm-command.ts";

export default class Build {
  private static readonly USAGE: string = "Usage: npm run build [-- --test [--without <module id>]...]\n";
  private static readonly NO_PACKAGES: string = "No packages under src/; there is nothing to build.\n";
  private static readonly TEST_OPTION: string = "--test";
  private static readonly WITHOUT_OPTION: string = "--without";
  private static readonly USAGE_EXIT_CODE: number = 2;

  private readonly build: PackageBuild;
  private readonly modules: ModuleCatalog;
  private readonly artifacts: ModuleArtifacts;
  private readonly angular: AngularProject;
  private readonly output: Writable;

  public constructor(build: PackageBuild, modules: ModuleCatalog, artifacts: ModuleArtifacts, angular: AngularProject, output: Writable) {
    this.build = build;
    this.modules = modules;
    this.artifacts = artifacts;
    this.angular = angular;
    this.output = output;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    const isTest = buildArguments[0] === Build.TEST_OPTION;
    const exclusions = buildArguments.slice(isTest ? 1 : 0);
    const isWellFormed = exclusions.length % 2 === 0 && exclusions.every((t, i) => i % 2 === 1 || t === Build.WITHOUT_OPTION);
    if (!isWellFormed || (!isTest && exclusions.length > 0)) {
      this.output.write(Build.USAGE);
      return Build.USAGE_EXIT_CODE;
    }

    try {
      const declarations = await this.modules.listBuildAsync(isTest, exclusions.filter((_, i) => i % 2 === 1));
      const packages = await this.build.buildAsync(this.output, isTest);
      this.output.write(packages.length === 0 ? Build.NO_PACKAGES : `Packages built and installed: ${packages.length}.\n`);
      await this.artifacts.writeAsync(declarations);
      this.output.write(`Modules in the build: ${declarations.length}.\n`);
      await this.angular.prepareAsync(this.output);
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
  const build = new Build(new PackageBuild(root, runner, process.env), new ModuleCatalog(root), new ModuleArtifacts(root), angular, process.stdout);
  process.exitCode = await build.runAsync(process.argv.slice(2));
}
