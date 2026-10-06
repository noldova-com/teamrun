/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export default class PackageLayout {
  private static readonly FOLDER_SEGMENTS: readonly string[] = ["_build", "package"];
  private static readonly STAGE_FOLDER: string = "app";
  private static readonly NPM_CACHE_FOLDER: string = "npm-cache";
  private static readonly ELECTRON_FOLDER: string = "electron";
  private static readonly TOOL_CACHE_FOLDER: string = "tool-cache";
  private static readonly OUTPUT_FOLDER: string = "out";
  private static readonly SMOKE_FOLDER: string = "smoke";
  private static readonly COMMAND_FOLDER: string = "command";
  private static readonly CONFIGURATION_FILE: string = "electron-builder.json";

  private readonly folder: string;

  public constructor(root: string) {
    this.folder = path.join(root, ...PackageLayout.FOLDER_SEGMENTS);
  }

  public get stage(): string {
    return path.join(this.folder, PackageLayout.STAGE_FOLDER);
  }

  public get npmCache(): string {
    return path.join(this.folder, PackageLayout.NPM_CACHE_FOLDER);
  }

  public get electron(): string {
    return path.join(this.folder, PackageLayout.ELECTRON_FOLDER);
  }

  public get toolCache(): string {
    return path.join(this.folder, PackageLayout.TOOL_CACHE_FOLDER);
  }

  public get output(): string {
    return path.join(this.folder, PackageLayout.OUTPUT_FOLDER);
  }

  public get smoke(): string {
    return path.join(this.folder, PackageLayout.SMOKE_FOLDER);
  }

  public get command(): string {
    return path.join(this.folder, PackageLayout.COMMAND_FOLDER);
  }

  public get configuration(): string {
    return path.join(this.folder, PackageLayout.CONFIGURATION_FILE);
  }
}
