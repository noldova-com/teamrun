/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ModuleCatalog from "../modules/module-catalog.ts";
import type PackageManifest from "./package-manifest.ts";
import PackageException from "./package.exception.ts";

export default class PackageVersions {
  private static readonly VERSION_FIELD: string = "version";
  private static readonly DEPENDENCIES_FIELD: string = "dependencies";

  private readonly productVersion: string;
  private readonly moduleVersions: ReadonlyMap<string, string>;

  public constructor(productVersion: string, moduleVersions: ReadonlyMap<string, string>) {
    this.productVersion = productVersion;
    this.moduleVersions = new Map(moduleVersions);
  }

  public static async readAsync(modules: ModuleCatalog, productVersion: string, packages: readonly PackageManifest[]): Promise<PackageVersions> {
    const inventory = await modules.readAllAsync();
    if (inventory.problems.length > 0)
      throw new PackageException(`The build cannot version the module packages: ${inventory.problems.join(" ")}`);
    const parts = new Map<string, string>(inventory.declarations.flatMap(t => t.parts.map(u => [`${t.folder}/${u}`, t.version] as const)));
    const moduleVersions = new Map<string, string>();
    for (const manifest of packages) {
      const version = parts.get(manifest.directory);
      if (version !== undefined)
        moduleVersions.set(manifest.name, version);
    }
    return new PackageVersions(productVersion, moduleVersions);
  }

  public of(name: string): string {
    return this.moduleVersions.get(name) ?? this.productVersion;
  }

  public stampManifest(manifest: PackageManifest, text: string): string {
    const fields = JSON.parse(text) as Readonly<Record<string, unknown>>;
    const dependencies = Object.entries((fields[PackageVersions.DEPENDENCIES_FIELD] ?? {}) as Readonly<Record<string, string>>)
      .map(([name, version]) => [name, manifest.dependencies.includes(name) ? this.of(name) : version]);
    return JSON.stringify({
      ...fields,
      [PackageVersions.VERSION_FIELD]: this.of(manifest.name),
      ...(PackageVersions.DEPENDENCIES_FIELD in fields ? { [PackageVersions.DEPENDENCIES_FIELD]: Object.fromEntries(dependencies) } : {})
    }, null, 2);
  }
}
