/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type PackageManifest from "./package-manifest.ts";

export default class BuildLayout {
  private static readonly BUILD_FOLDER: string = "_build";
  private static readonly PACKAGES_FOLDER: string = "packages";
  private static readonly TESTS_FOLDER: string = "tests";
  private static readonly ARCHIVES_FOLDER: string = "archives";
  private static readonly RECORDS_FOLDER: string = "records";
  private static readonly DEPENDENCY_FOLDER: string = "node_modules";
  private static readonly SCOPE_PATTERN: RegExp = /^@([^/]+)\/(.+)$/;

  public readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public get archivesFolder(): string {
    return path.join(this.root, BuildLayout.BUILD_FOLDER, BuildLayout.ARCHIVES_FOLDER);
  }

  public locateSource(manifest: PackageManifest, ...segments: readonly string[]): string {
    return path.join(this.root, ...manifest.directory.split("/"), ...segments);
  }

  public locateOutput(manifest: PackageManifest): string {
    return path.join(this.root, BuildLayout.BUILD_FOLDER, BuildLayout.PACKAGES_FOLDER, manifest.id);
  }

  public locateTestOutput(manifest: PackageManifest): string {
    return path.join(this.root, BuildLayout.BUILD_FOLDER, BuildLayout.TESTS_FOLDER, manifest.id);
  }

  public locateArchive(manifest: PackageManifest, version: string): string {
    return path.join(this.archivesFolder, `${manifest.name.replace(BuildLayout.SCOPE_PATTERN, "$1-$2")}-${version}.tgz`);
  }

  public locateRecord(manifest: PackageManifest): string {
    return path.join(this.root, BuildLayout.BUILD_FOLDER, BuildLayout.RECORDS_FOLDER, `${manifest.id}.txt`);
  }

  public locateTestRecord(manifest: PackageManifest): string {
    return path.join(this.root, BuildLayout.BUILD_FOLDER, BuildLayout.RECORDS_FOLDER, `${manifest.id}.tests.txt`);
  }

  public locateInstalled(manifest: PackageManifest): string {
    return path.join(this.root, BuildLayout.DEPENDENCY_FOLDER, ...manifest.name.split("/"));
  }
}
