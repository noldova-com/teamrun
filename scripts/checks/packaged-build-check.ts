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
import GalleryFile from "../angular/gallery-file.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";
import type ICheck from "./interfaces/check.ts";

export default class PackagedBuildCheck implements ICheck {
  private static readonly OUTPUT_SEGMENTS: readonly string[] = ["_build", "variants", "packaged"];
  private static readonly BUILD_SCRIPT_SEGMENTS: readonly string[] = ["scripts", "build.ts"];
  private static readonly BUILD_OPTIONS: readonly string[] = ["--packaged", "--output"];
  private static readonly WINDOW_FOLDER: string = "window";
  private static readonly BUILD_FAILED: string = "The packaged build failed.\n";
  private static readonly STUB_MISSING: string = "The packaged build's Gallery file still brings in the Gallery.\n";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly gallery: GalleryFile;
  private readonly angular: AngularProject;

  public readonly title: string = "Packaged build leaves out the Gallery";

  public constructor(root: string, runner: ProcessRunner, gallery: GalleryFile, angular: AngularProject) {
    this.root = root;
    this.runner = runner;
    this.gallery = gallery;
    this.angular = angular;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    if (!this.angular.hasProject())
      return true;

    try {
      return await this.checkAsync(output);
    }
    finally {
      await this.gallery.writeAsync(false);
    }
  }

  private async checkAsync(output: Writable): Promise<boolean> {
    const outputFolder = path.join(this.root, ...PackagedBuildCheck.OUTPUT_SEGMENTS);
    try {
      const exitCode = await this.runner.runAsync(
        process.execPath,
        [path.join(this.root, ...PackagedBuildCheck.BUILD_SCRIPT_SEGMENTS), ...PackagedBuildCheck.BUILD_OPTIONS, outputFolder],
        this.root);
      if (exitCode !== 0) {
        output.write(PackagedBuildCheck.BUILD_FAILED);
        return false;
      }
      if (!await this.gallery.isPackagedAsync()) {
        output.write(PackagedBuildCheck.STUB_MISSING);
        return false;
      }
      await this.angular.verifyWithoutAsync(path.join(outputFolder, PackagedBuildCheck.WINDOW_FOLDER), GalleryFile.MARKERS);
      return true;
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }
}
