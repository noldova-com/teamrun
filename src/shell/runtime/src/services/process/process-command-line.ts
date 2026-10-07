/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class ProcessCommandLine {
  public static async readAsync(processId: string): Promise<string> {
    try {
      return await readFile(path.join(Resources.processFolder, processId, Resources.commandLineFile), Resources.utf8Encoding);
    }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === Resources.missingFileCode)
        return String.empty;
      throw error;
    }
  }

  public static async isAppImageMountAsync(processId: string, image: string): Promise<boolean> {
    const separator = Resources.processArgumentSeparator;
    return `${separator}${await ProcessCommandLine.readAsync(processId)}`.endsWith(`${separator}${image}${separator}${Resources.appImageMountOption}${separator}`);
  }
}
