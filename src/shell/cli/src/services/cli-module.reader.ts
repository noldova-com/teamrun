/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { DeclarationsFormatException } from "@noldova/teamrun-shell-runtime";

import { CliModule } from "../models/cli-module.js";
import { Resources } from "../resources.js";

export class CliModuleReader {
  public static async readAsync(file: string): Promise<readonly CliModule[]> {
    try {
      const reader = JsonReader.parse(await readFile(file, Resources.utf8Encoding));
      const version = reader.readInteger("formatVersion");
      if (version !== Resources.declarationsFormatVersion)
        throw new DeclarationsFormatException(Resources.formatDeclarationsVersion(version));
      return reader.readObjectArray("modules").map(t => CliModule.fromJson(t));
    }
    catch (error) {
      throw new DeclarationsFormatException(Resources.formatDeclarationsUnreadable(file, (error as Error).message), new ExceptionOptions(error));
    }
  }
}
