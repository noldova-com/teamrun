/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type PackageBuild from "../packages/package-build.ts";
import PackageException from "../packages/package.exception.ts";
import ProcessException from "../processes/process.exception.ts";
import type ICheck from "./interfaces/check.ts";

export default class PackageCheck implements ICheck {
  private static readonly NO_PACKAGES: string = "No packages under src/.\n";

  private readonly build: PackageBuild;

  public readonly title: string = "Packages";

  public constructor(build: PackageBuild) {
    this.build = build;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    try {
      const packages = await this.build.buildAsync(output);
      output.write(packages.length === 0 ? PackageCheck.NO_PACKAGES : `Packages built and installed: ${packages.length}.\n`);
      return true;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }
}
