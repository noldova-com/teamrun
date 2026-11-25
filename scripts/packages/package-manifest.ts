/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { PackageNaming } from "./package-naming.ts";
import { PackageException } from "./package.exception.ts";

export class PackageManifest {
  private static readonly FILE_NAME: string = "package.json";
  private static readonly SOURCE_PREFIX: string = "src/";
  private static readonly FOLDER_SEPARATOR: string = "/";
  private static readonly ID_SEPARATOR: string = "-";
  private static readonly VERSION_PLACEHOLDER: string = "__VERSION__";
  private static readonly NO_EXCLUSIONS: string = "[]";
  private static readonly ANGULAR_CORE: string = "@angular/core";

  public readonly directory: string;
  public readonly name: string;
  public readonly dependencies: readonly string[];
  public readonly coverageExclusions: string;
  public readonly peerDependencies: readonly string[];
  public readonly isolatedTests: readonly string[];

  public constructor(directory: string, name: string, dependencies: readonly string[], coverageExclusions: string = PackageManifest.NO_EXCLUSIONS, peerDependencies: readonly string[] = [],
    isolatedTests: readonly string[] = []) {
    const expected = PackageManifest.formatName(directory);
    if (name !== expected)
      throw new PackageException(`${directory}/${PackageManifest.FILE_NAME} must be named "${expected}", the name its folder gives.`);

    this.directory = directory;
    this.name = name;
    this.dependencies = [...dependencies].sort();
    this.coverageExclusions = coverageExclusions;
    this.peerDependencies = [...peerDependencies].sort();
    this.isolatedTests = [...isolatedTests].sort();
  }

  public static async readAsync(root: string, directory: string): Promise<PackageManifest> {
    const file = `${directory}/${PackageManifest.FILE_NAME}`;
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(path.join(root, file), "utf8"));
    }
    catch (error) {
      throw new PackageException(`${file} could not be read as JSON.`, { cause: error });
    }
    if (!Object.isObject(manifest) || !("name" in manifest) || !Object.isString(manifest.name))
      throw new PackageException(`${file} must have a name.`);
    if (!("version" in manifest) || manifest.version !== PackageManifest.VERSION_PLACEHOLDER)
      throw new PackageException(`${file} must have the version "${PackageManifest.VERSION_PLACEHOLDER}"; the build stamps the root package.json's version.`);
    if (!("private" in manifest) || manifest.private !== true)
      throw new PackageException(`${file} must be marked "private": true; TeamRun publishes no package to a registry.`);
    if ("publishConfig" in manifest)
      throw new PackageException(`${file} must have no publishConfig; TeamRun publishes no package to a registry.`);

    const dependencies = "dependencies" in manifest ? manifest.dependencies : {};
    if (!Object.isObject(dependencies))
      throw new PackageException(`${file} must list its dependencies as an object.`);
    const peers = "peerDependencies" in manifest ? manifest.peerDependencies : {};
    if (!Object.isObject(peers))
      throw new PackageException(`${file} must list its peer dependencies as an object.`);
    const own = [...Object.entries(dependencies), ...Object.entries(peers)].filter(([name]) => PackageNaming.isOwn(name));
    const unpinned = Object.entries(dependencies).filter(([name, version]) => !PackageNaming.isOwn(name) && !Object.isString(version)).map(([name]) => name);
    if (unpinned.length > 0)
      throw new PackageException(`${file} must pin ${unpinned.join(", ")} to an exact version.`);
    const unstamped = own.filter(([, version]) => version !== PackageManifest.VERSION_PLACEHOLDER).map(([name]) => name);
    if (unstamped.length > 0)
      throw new PackageException(`${file} must depend on ${unstamped.join(", ")} at version "${PackageManifest.VERSION_PLACEHOLDER}".`);

    const settings = "noldova" in manifest ? manifest.noldova : {};
    if (!Object.isObject(settings))
      throw new PackageException(`${file} must keep its noldova settings in an object.`);
    const exclusions = "coverageExclusions" in settings ? settings.coverageExclusions : [];
    if (!Array.isArray(exclusions))
      throw new PackageException(`${file} must list its coverage exclusions in an array.`);
    const isolated: unknown = "isolatedTests" in settings ? settings.isolatedTests : [];
    if (!Array.isArray(isolated) || isolated.some(t => !Object.isString(t)))
      throw new PackageException(`${file} must list its isolated tests as an array of paths under its tests folder.`);
    return new PackageManifest(directory, manifest.name, [...new Set(own.map(([name]) => name))], JSON.stringify(exclusions), Object.keys(peers), isolated.map(String));
  }

  public static formatName(directory: string): string {
    return PackageNaming.nameSourcePackage(directory);
  }

  public get isAngular(): boolean {
    return this.peerDependencies.includes(PackageManifest.ANGULAR_CORE);
  }

  public get id(): string {
    return this.directory.slice(PackageManifest.SOURCE_PREFIX.length).split(PackageManifest.FOLDER_SEPARATOR).join(PackageManifest.ID_SEPARATOR);
  }
}
