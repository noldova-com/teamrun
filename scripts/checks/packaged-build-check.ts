/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import type AngularProject from "../angular/angular-project.ts";
import type PackagedBuild from "../packaging/packaged-build.ts";
import PackagingException from "../packaging/packaging.exception.ts";
import ProcessException from "../processes/process.exception.ts";
import type ICheck from "./interfaces/i-check.ts";

export default class PackagedBuildCheck implements ICheck {
  private static readonly OUTPUT_SEGMENTS: readonly string[] = ["_build", "variants", "packaged"];

  private readonly root: string;
  private readonly build: PackagedBuild;
  private readonly angular: AngularProject;

  public readonly title: string = "Packaged build leaves out the Gallery";

  public constructor(root: string, build: PackagedBuild, angular: AngularProject) {
    this.root = root;
    this.build = build;
    this.angular = angular;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    if (!this.angular.hasProject())
      return true;

    try {
      await this.build.buildAsync(path.join(this.root, ...PackagedBuildCheck.OUTPUT_SEGMENTS));
      return true;
    }
    catch (error) {
      if (!(error instanceof PackagingException || error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }
}
