/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PackageException } from "./package.exception.ts";

export class PackageNaming {
  private static readonly SCOPE: string = "@noldova/";
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly FOLDER_PATTERN: RegExp = /^noldova(?:\.[a-z][a-z0-9]*)+$/;
  private static readonly GROUPS: readonly string[] = ["teamrun"];
  private static readonly LIBRARIES: readonly string[] = ["teamrun"];
  private static readonly FOLDER_SEPARATOR: string = "/";
  private static readonly SEGMENT_SEPARATOR: string = ".";
  private static readonly DESKTOP_CORE_SEPARATOR: string = ".";
  private static readonly SHARED_PREFIXES: readonly string[] = ["@noldova/desktop.", "@noldova/context."];
  private static readonly SHARED_LIBRARIES: readonly string[] = ["@noldova/desktop", "@noldova/ui.components.angular"];
  private static readonly DESKTOP_CORE: string = "@noldova/desktop";

  public static isOwn(name: string): boolean {
    return PackageNaming.GROUPS.some(t => name.startsWith(`${PackageNaming.SCOPE}${t}${PackageNaming.SEGMENT_SEPARATOR}`))
      || PackageNaming.LIBRARIES.some(t => name === `${PackageNaming.SCOPE}${t}`);
  }

  public static isShared(name: string): boolean {
    return PackageNaming.SHARED_PREFIXES.some(t => name.startsWith(t)) || PackageNaming.SHARED_LIBRARIES.includes(name);
  }

  public static isDesktopCore(name: string): boolean {
    return name === PackageNaming.DESKTOP_CORE || name.startsWith(`${PackageNaming.DESKTOP_CORE}${PackageNaming.DESKTOP_CORE_SEPARATOR}`);
  }

  public static nameSourcePackage(directory: string): string {
    const name = PackageNaming.nameFolder(directory);
    if (name === null)
      throw new PackageException(`${directory} is not a package folder directly under src/, named noldova and its package's segments such as src/noldova.teamrun.protocol.`);
    return name;
  }

  public static locatePackageFolder(filePath: string): string | null {
    const [source, folder, ...rest] = filePath.split(PackageNaming.FOLDER_SEPARATOR);
    const directory = `${source}${PackageNaming.FOLDER_SEPARATOR}${folder}`;
    return rest.length > 0 && PackageNaming.nameFolder(directory) !== null ? directory : null;
  }

  private static nameFolder(directory: string): string | null {
    const [source, folder, ...rest] = directory.split(PackageNaming.FOLDER_SEPARATOR);
    if (source !== PackageNaming.SOURCE_FOLDER || folder === undefined || rest.length > 0 || !PackageNaming.FOLDER_PATTERN.test(folder))
      return null;
    const name = `${PackageNaming.SCOPE}${folder.split(PackageNaming.SEGMENT_SEPARATOR).slice(1).join(PackageNaming.SEGMENT_SEPARATOR)}`;
    return PackageNaming.isOwn(name) ? name : null;
  }
}
