/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { AngularProject } from "./angular/angular-project.ts";
import { CdkCopyCheck } from "./checks/cdk-copy-check.ts";
import type { ICheck } from "./checks/interfaces/i-check.ts";
import { PackageBuild } from "./packages/package-build.ts";
import { PackageException } from "./packages/package.exception.ts";
import { ProcessRunner } from "./processes/process-runner.ts";
import { ProcessException } from "./processes/process.exception.ts";
import { NpmCommand } from "./toolchain/npm-command.ts";

export class Build {
  private static readonly USAGE: string = "Usage: npm run build [-- --list-copies]\n";
  private static readonly LIST_COPIES_OPTION: string = "--list-copies";
  private static readonly LIST_COPIES_END: string = "end of copies";
  private static readonly NO_PACKAGES: string = "No packages under src/; there is nothing to build.\n";
  private static readonly USAGE_EXIT_CODE: number = 2;

  private readonly build: PackageBuild;
  private readonly angular: AngularProject;
  private readonly copies: ICheck;
  private readonly output: Writable;

  public constructor(build: PackageBuild, angular: AngularProject, copies: ICheck, output: Writable) {
    this.build = build;
    this.angular = angular;
    this.copies = copies;
    this.output = output;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    const listsCopies = buildArguments.length === 1 && buildArguments[0] === Build.LIST_COPIES_OPTION;
    if (buildArguments.length > 0 && !listsCopies) {
      this.output.write(Build.USAGE);
      return Build.USAGE_EXIT_CODE;
    }

    try {
      if (listsCopies) {
        for (const [source, name, entry] of await this.build.listCopiesAsync())
          this.output.write(`${source}\t${name}\t${entry}\n`);
        this.output.write(`${Build.LIST_COPIES_END}\n`);
        return 0;
      }
      if (this.angular.hasProject()) {
        this.angular.requireInstalled();
        if (!await this.copies.runAsync(this.output))
          return 1;
      }
      const packages = await this.build.buildAsync(this.output);
      this.output.write(packages.length === 0 ? Build.NO_PACKAGES : `Packages built and installed: ${packages.length}.\n`);
      return 0;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException))
        throw error;
      this.output.write(`${error.message}\n`);
      return 1;
    }
  }
}

if (import.meta.main)
  process.exitCode = await new Build(new PackageBuild(process.cwd(), new ProcessRunner(), process.env), new AngularProject(process.cwd(), new ProcessRunner()),
    new CdkCopyCheck(process.cwd(), new NpmCommand(new ProcessRunner(), process.env)), process.stdout).runAsync(process.argv.slice(2));
