/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import PackageManifest from "./package-manifest.ts";
import PackageException from "./package.exception.ts";

export default class PackageCatalog {
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly MANIFEST_NAME: string = "package.json";
  private static readonly DEPENDENCY_FOLDER: string = "node_modules";
  private static readonly PROJECT_MANIFEST: string = "src/package.json";

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async listPackagesAsync(): Promise<readonly PackageManifest[]> {
    const packages: PackageManifest[] = [];
    for (const directory of await this.listDirectoriesAsync())
      packages.push(await PackageManifest.readAsync(this.root, directory));
    return PackageCatalog.order(packages);
  }

  private static order(packages: readonly PackageManifest[]): readonly PackageManifest[] {
    const names = new Map<string, PackageManifest>(packages.map(t => [t.name, t]));
    if (names.size < packages.length)
      throw new PackageException(`Package paths produce the same name: ${packages.map(t => t.directory).join(", ")}.`);
    for (const manifest of packages) {
      const unknown = manifest.dependencies.filter(t => !names.has(t));
      if (unknown.length > 0)
        throw new PackageException(`${manifest.directory} depends on ${unknown.join(", ")}, which is not a package under src/.`);
    }

    const ordered: PackageManifest[] = [];
    const placed = new Set<string>();
    let remaining = packages;
    while (remaining.length > 0) {
      const ready = remaining.filter(t => t.dependencies.every(t => placed.has(t)));
      if (ready.length === 0)
        throw new PackageException(`The dependencies of ${remaining.map(t => t.name).join(", ")} form a cycle.`);
      for (const manifest of ready) {
        ordered.push(manifest);
        placed.add(manifest.name);
      }
      remaining = remaining.filter(t => !placed.has(t.name));
    }
    return ordered;
  }

  private async listDirectoriesAsync(): Promise<readonly string[]> {
    const source = path.join(this.root, PackageCatalog.SOURCE_FOLDER);
    if (!existsSync(source))
      return [];

    const entries = await readdir(source, { recursive: true });
    return entries
      .map(t => `${PackageCatalog.SOURCE_FOLDER}/${t.split(path.sep).join("/")}`)
      .filter(t => path.posix.basename(t) === PackageCatalog.MANIFEST_NAME && t !== PackageCatalog.PROJECT_MANIFEST)
      .filter(t => !t.split("/").includes(PackageCatalog.DEPENDENCY_FOLDER))
      .map(t => path.posix.dirname(t))
      .sort();
  }
}
