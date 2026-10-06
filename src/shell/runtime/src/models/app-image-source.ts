/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.js";

export class AppImageSource {
  public readonly file: string;
  public readonly folder: string;

  private constructor(file: string, folder: string) {
    this.file = file;
    this.folder = folder;
  }

  public get isMounted(): boolean {
    const mountPoints = readFileSync(Resources.mountTableFile, Resources.utf8Encoding).split("\n")
      .map(t => t.split(" ")[Resources.mountPointField] ?? "")
      .map(t => t.replace(Resources.mountTableEscape, (_, code: string) => String.fromCharCode(Number.parseInt(code, Resources.octalRadix))));
    return mountPoints.includes(this.folder);
  }

  public static find(environment: NodeJS.ProcessEnv, executablePath: string): AppImageSource | null {
    const file = environment[Resources.appImageVariable] ?? "";
    const folder = path.posix.normalize(environment[Resources.appImageFolderVariable] ?? "").replace(Resources.trailingSlashes, "");
    if (!path.posix.isAbsolute(file) || !path.posix.isAbsolute(folder))
      return null;
    const relative = path.posix.relative(folder, executablePath);
    return relative.length === 0 || relative === Resources.parentFolder || relative.startsWith(`${Resources.parentFolder}/`) ? null : new AppImageSource(file, folder);
  }

  public static locateProgram(environment: NodeJS.ProcessEnv, executablePath: string): string {
    return AppImageSource.find(environment, executablePath)?.file ?? executablePath;
  }
}
