/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageException from "./package.exception.ts";

export default class PackageNaming {
  public static readonly SCOPE: string = "@noldova/";

  private static readonly FOUNDATION_PREFIX: string = "@noldova/teamrun-foundation-";
  private static readonly SHELL_PREFIX: string = "@noldova/teamrun-shell-";
  private static readonly MODULES_PREFIX: string = "@noldova/teamrun-modules-";
  private static readonly FIXTURE_PREFIX: string = "@noldova/teamrun-fixture-";
  private static readonly GROUPS: readonly (readonly [string, string])[] = [
    ["src/foundation", PackageNaming.FOUNDATION_PREFIX],
    ["src/shell", PackageNaming.SHELL_PREFIX],
    ["src/modules", PackageNaming.MODULES_PREFIX]
  ];
  private static readonly PUBLISHED_PREFIXES: readonly string[] = [PackageNaming.FOUNDATION_PREFIX, PackageNaming.SHELL_PREFIX];
  private static readonly OWN_PREFIXES: readonly string[] = [...PackageNaming.GROUPS.map(([, t]) => t), PackageNaming.FIXTURE_PREFIX];
  private static readonly FOLDER_SEPARATOR: string = "/";
  private static readonly NAME_SEPARATOR: string = "-";

  public static nameSourcePackage(directory: string): string {
    for (const [group, prefix] of PackageNaming.GROUPS)
      if (directory.startsWith(`${group}${PackageNaming.FOLDER_SEPARATOR}`))
        return `${prefix}${PackageNaming.join(directory.slice(group.length + 1))}`;
    throw new PackageException(`${directory} is not inside ${PackageNaming.GROUPS.map(([t]) => t).join(", ")}, the folders that hold packages.`);
  }

  public static nameFixturePackage(folder: string): string {
    return `${PackageNaming.FIXTURE_PREFIX}${PackageNaming.join(folder)}`;
  }

  public static nameModulePackage(id: string, part: string, isFixture: boolean): string {
    return `${PackageNaming.locateModulePrefix(id, isFixture)}${part}`;
  }

  public static locateModulePrefix(id: string, isFixture: boolean): string {
    return `${isFixture ? PackageNaming.FIXTURE_PREFIX : PackageNaming.MODULES_PREFIX}${id}${PackageNaming.NAME_SEPARATOR}`;
  }

  public static isOwn(name: string): boolean {
    return PackageNaming.OWN_PREFIXES.some(t => name.startsWith(t));
  }

  public static isPublished(name: string): boolean {
    return PackageNaming.PUBLISHED_PREFIXES.some(t => name.startsWith(t));
  }

  private static join(folder: string): string {
    return folder.split(PackageNaming.FOLDER_SEPARATOR).join(PackageNaming.NAME_SEPARATOR);
  }
}
