/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import ModuleCatalog from "../modules/module-catalog.ts";
import PackageNaming from "./package-naming.ts";
import PackageException from "./package.exception.ts";

export default class PackageManifest {
  private static readonly FILE_NAME: string = "package.json";
  private static readonly SOURCE_PREFIX: string = "src/";
  private static readonly FIXTURE_PREFIX: string = `${ModuleCatalog.FIXTURE_FOLDER}/`;
  private static readonly FIXTURE_ID_PREFIX: string = "fixture-";
  private static readonly FOLDER_SEPARATOR: string = "/";
  private static readonly ID_SEPARATOR: string = "-";
  private static readonly VERSION_PLACEHOLDER: string = "__VERSION__";
  private static readonly NO_EXCLUSIONS: string = "[]";
  private static readonly ADDON_NAME: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  public readonly directory: string;
  public readonly name: string;
  public readonly dependencies: readonly string[];
  public readonly coverageExclusions: string;
  public readonly windowsAddons: readonly string[];
  public readonly externalDependencies: ReadonlyMap<string, string>;

  public constructor(directory: string, name: string, dependencies: readonly string[], coverageExclusions: string = PackageManifest.NO_EXCLUSIONS, windowsAddons: readonly string[] = [],
    externalDependencies: ReadonlyMap<string, string> = new Map()) {
    const expected = PackageManifest.formatName(directory);
    if (name !== expected)
      throw new PackageException(PackageManifest.isFixtureDirectory(directory)
        ? `${directory}/${PackageManifest.FILE_NAME} must be named "${expected}", the fixture package's path below ${ModuleCatalog.FIXTURE_FOLDER}/ joined with hyphens.`
        : `${directory}/${PackageManifest.FILE_NAME} must be named "${expected}", the package's path below src/ joined with hyphens.`);

    this.directory = directory;
    this.name = name;
    this.dependencies = [...dependencies].sort();
    this.coverageExclusions = coverageExclusions;
    this.windowsAddons = windowsAddons;
    this.externalDependencies = externalDependencies;
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
    if (typeof manifest !== "object" || manifest === null || !("name" in manifest) || typeof manifest.name !== "string")
      throw new PackageException(`${file} must have a name.`);
    if (!("version" in manifest) || manifest.version !== PackageManifest.VERSION_PLACEHOLDER)
      throw new PackageException(`${file} must have the version "${PackageManifest.VERSION_PLACEHOLDER}"; the build stamps its module's version or the product version.`);

    const dependencies = "dependencies" in manifest ? manifest.dependencies : {};
    if (typeof dependencies !== "object" || dependencies === null)
      throw new PackageException(`${file} must list its dependencies as an object.`);
    const own = Object.entries(dependencies).filter(([name]) => PackageNaming.isOwn(name));
    const external = Object.entries(dependencies).filter(([name]) => !PackageNaming.isOwn(name));
    const unpinned = external.filter(([, version]) => typeof version !== "string").map(([name]) => name);
    if (unpinned.length > 0)
      throw new PackageException(`${file} must pin ${unpinned.join(", ")} to an exact version.`);
    const unstamped = own.filter(([, version]) => version !== PackageManifest.VERSION_PLACEHOLDER).map(([name]) => name);
    if (unstamped.length > 0)
      throw new PackageException(`${file} must depend on ${unstamped.join(", ")} at version "${PackageManifest.VERSION_PLACEHOLDER}".`);

    const settings = "teamrun" in manifest ? manifest.teamrun : {};
    if (typeof settings !== "object" || settings === null)
      throw new PackageException(`${file} must keep its TeamRun settings in an object.`);
    const exclusions = "coverageExclusions" in settings ? settings.coverageExclusions : [];
    if (!Array.isArray(exclusions))
      throw new PackageException(`${file} must list its coverage exclusions in an array.`);
    const addons: unknown = "windowsAddons" in settings ? settings.windowsAddons : [];
    if (!Array.isArray(addons) || !addons.every(t => typeof t === "string" && PackageManifest.ADDON_NAME.test(t)))
      throw new PackageException(`${file} must list its Windows addons in an array of kebab-case names.`);
    return new PackageManifest(directory, manifest.name, own.map(([name]) => name), JSON.stringify(exclusions), addons,
      new Map(external.map(([name, version]) => [name, String(version)])));
  }

  public get id(): string {
    const folder = this.isFixture
      ? `${PackageManifest.FIXTURE_ID_PREFIX}${this.directory.slice(PackageManifest.FIXTURE_PREFIX.length)}`
      : this.directory.slice(PackageManifest.SOURCE_PREFIX.length);
    return folder.split(PackageManifest.FOLDER_SEPARATOR).join(PackageManifest.ID_SEPARATOR);
  }

  public get isFixture(): boolean {
    return PackageManifest.isFixtureDirectory(this.directory);
  }

  private static isFixtureDirectory(directory: string): boolean {
    return directory.startsWith(PackageManifest.FIXTURE_PREFIX);
  }

  private static formatName(directory: string): string {
    return PackageManifest.isFixtureDirectory(directory)
      ? PackageNaming.nameFixturePackage(directory.slice(PackageManifest.FIXTURE_PREFIX.length))
      : PackageNaming.nameSourcePackage(directory);
  }
}
