/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import PackageBuild from "./packages/package-build.ts";
import PackageException from "./packages/package.exception.ts";
import ProcessRunner from "./processes/process-runner.ts";
import ProcessException from "./processes/process.exception.ts";

export default class Build {
  private static readonly USAGE: string = "Usage: npm run build\n";
  private static readonly NO_PACKAGES: string = "No packages under src/; there is nothing to build.\n";
  private static readonly USAGE_EXIT_CODE: number = 2;

  private readonly build: PackageBuild;
  private readonly output: Writable;

  public constructor(build: PackageBuild, output: Writable) {
    this.build = build;
    this.output = output;
  }

  public async runAsync(buildArguments: readonly string[]): Promise<number> {
    if (buildArguments.length > 0) {
      this.output.write(Build.USAGE);
      return Build.USAGE_EXIT_CODE;
    }

    try {
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
  process.exitCode = await new Build(new PackageBuild(process.cwd(), new ProcessRunner(), process.env), process.stdout).runAsync(process.argv.slice(2));
