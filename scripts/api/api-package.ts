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
  public readonly paths?: Readonly<Record<string, readonly string[]>>;

  private constructor(directory: string, id: string, project: string, files: readonly [string, string], paths?: Readonly<Record<string, readonly string[]>>) {
    this.directory = directory;
    this.id = id;
    this.project = project;
    [this.implementation, this.declarations] = files;
    if (paths !== undefined)
      this.paths = paths;
  }

  public get isInstalled(): boolean {
    return this.paths === undefined;
  }

  public static forPackage(layout: BuildLayout, manifest: PackageManifest): ApiPackage {
    const files = [
      layout.locateSource(manifest, ApiPackage.SOURCE_FOLDER, ...ApiPackage.IMPLEMENTATION),
      path.join(layout.locateInstalled(manifest), ...ApiPackage.DECLARATIONS)
    ] as const;
    return new ApiPackage(manifest.directory, manifest.id, layout.locateSource(manifest, ApiPackage.SOURCE_FOLDER, ApiPackage.PROJECT_FILE), files);
  }

  public static forPart(root: string, directory: string, project: string, paths: Readonly<Record<string, readonly string[]>>): ApiPackage {
    return new ApiPackage(directory, directory.split("/").slice(1).join("-"), project, ApiPackage.locatePart(root, directory), paths);
  }

  public static locatePart(root: string, directory: string): readonly [implementation: string, declarations: string] {
    const source = path.join(root, ...directory.split("/"), ApiPackage.SOURCE_FOLDER);
    return [path.join(source, ...ApiPackage.IMPLEMENTATION), path.join(source, ...ApiPackage.DECLARATIONS)];
  }
}
