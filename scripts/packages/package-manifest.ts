/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import PackageException from "./package.exception.ts";

export default class PackageManifest {
  private static readonly FILE_NAME: string = "package.json";
  private static readonly SOURCE_PREFIX: string = "src/";
  private static readonly NAME_PREFIX: string = "@noldova/teamrun-";
  private static readonly VERSION_PLACEHOLDER: string = "__VERSION__";

  public readonly directory: string;
  public readonly name: string;
  public readonly dependencies: readonly string[];

  public constructor(directory: string, name: string, dependencies: readonly string[]) {
    const expected = PackageManifest.formatName(directory);
    if (name !== expected)
      throw new PackageException(`${directory}/${PackageManifest.FILE_NAME} must be named "${expected}", the package's path below src/ joined with hyphens.`);

    this.directory = directory;
    this.name = name;
    this.dependencies = [...dependencies].sort();
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
      throw new PackageException(`${file} must have the version "${PackageManifest.VERSION_PLACEHOLDER}"; the build stamps the product version.`);

    const dependencies = "dependencies" in manifest ? manifest.dependencies : {};
    if (typeof dependencies !== "object" || dependencies === null)
      throw new PackageException(`${file} must list its dependencies as an object.`);
    const own = Object.entries(dependencies).filter(([name]) => name.startsWith(PackageManifest.NAME_PREFIX));
    const unstamped = own.filter(([, version]) => version !== PackageManifest.VERSION_PLACEHOLDER).map(([name]) => name);
    if (unstamped.length > 0)
      throw new PackageException(`${file} must depend on ${unstamped.join(", ")} at version "${PackageManifest.VERSION_PLACEHOLDER}".`);
    return new PackageManifest(directory, manifest.name, own.map(([name]) => name));
  }

  public get id(): string {
    return this.name.slice(PackageManifest.NAME_PREFIX.length);
  }

  private static formatName(directory: string): string {
    return `${PackageManifest.NAME_PREFIX}${directory.slice(PackageManifest.SOURCE_PREFIX.length).split("/").join("-")}`;
  }
}
