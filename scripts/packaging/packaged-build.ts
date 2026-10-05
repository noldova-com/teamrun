/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type AngularProject from "../angular/angular-project.ts";
import GalleryFile from "../angular/gallery-file.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import PackagingException from "./packaging.exception.ts";

export default class PackagedBuild {
  private static readonly BUILD_SCRIPT_SEGMENTS: readonly string[] = ["scripts", "build.ts"];
  private static readonly BUILD_OPTIONS: readonly string[] = ["--packaged", "--output"];
  private static readonly WINDOW_FOLDER: string = "window";
  private static readonly STUB_MISSING: string = "The packaged build's Gallery file still brings in the Gallery.";

  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly gallery: GalleryFile;
  private readonly angular: AngularProject;

  public constructor(root: string, runner: ProcessRunner, gallery: GalleryFile, angular: AngularProject) {
    this.root = root;
    this.runner = runner;
    this.gallery = gallery;
    this.angular = angular;
  }

  public async buildAsync(folder: string): Promise<void> {
    try {
      const exitCode = await this.runner.runAsync(process.execPath, [path.join(this.root, ...PackagedBuild.BUILD_SCRIPT_SEGMENTS), ...PackagedBuild.BUILD_OPTIONS, folder], this.root);
      if (exitCode !== 0)
        throw new PackagingException(`The packaged build failed with exit code ${exitCode}.`);
      if (!await this.gallery.isPackagedAsync())
        throw new PackagingException(PackagedBuild.STUB_MISSING);
    }
    finally {
      await this.gallery.writeAsync(false);
    }
    await this.angular.verifyWithoutAsync(path.join(folder, PackagedBuild.WINDOW_FOLDER), GalleryFile.MARKERS);
  }
}
