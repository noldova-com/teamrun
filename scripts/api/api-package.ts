/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type BuildLayout from "../packages/build-layout.ts";
import type PackageManifest from "../packages/package-manifest.ts";

export default class ApiPackage {
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly PROJECT_FILE: string = "tsconfig.json";
  private static readonly IMPLEMENTATION: readonly string[] = ["api", "index.ts"];
  private static readonly DECLARATIONS: readonly string[] = ["api", "index.d.ts"];

  public readonly directory: string;
  public readonly id: string;
  public readonly project: string;
  public readonly implementation: string;
  public readonly declarations: string;

  public constructor(layout: BuildLayout, manifest: PackageManifest) {
    this.directory = manifest.directory;
    this.id = manifest.id;
    this.project = layout.locateSource(manifest, ApiPackage.SOURCE_FOLDER, ApiPackage.PROJECT_FILE);
    this.implementation = layout.locateSource(manifest, ApiPackage.SOURCE_FOLDER, ...ApiPackage.IMPLEMENTATION);
    this.declarations = path.join(layout.locateInstalled(manifest), ...ApiPackage.DECLARATIONS);
  }
}
