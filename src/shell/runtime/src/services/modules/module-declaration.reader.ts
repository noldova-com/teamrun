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
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { DeclarationsFormatException } from "../../exceptions/declarations-format.exception.js";
import { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";

export class ModuleDeclarationReader {
  public static locate(runtimeEntryPath: string): string {
    return path.join(path.dirname(runtimeEntryPath), ...Resources.installRootSegments, ...Resources.declarationsFileSegments);
  }

  public static async readAsync(file: string): Promise<readonly ModuleDeclaration[]> {
    try {
      return ModuleDeclarationReader.parse(JSON.parse(await readFile(file, Resources.utf8Encoding)));
    }
    catch (error) {
      throw new DeclarationsFormatException(Resources.formatDeclarationsUnreadable(file, String(error)), new ExceptionOptions(error));
    }
  }

  private static parse(value: unknown): readonly ModuleDeclaration[] {
    if (!Object.isObject(value) || Array.isArray(value))
      throw new DeclarationsFormatException(Resources.declarationsNotObject);
    const version = "formatVersion" in value ? value.formatVersion : undefined;
    if (version !== Resources.declarationsFormatVersion)
      throw new DeclarationsFormatException(Resources.formatDeclarationsVersion(version));
    const modules = "modules" in value ? value.modules : undefined;
    if (!Array.isArray(modules))
      throw new DeclarationsFormatException(Resources.declarationsNotObject);
    return modules.map(t => ModuleDeclaration.fromJson(t));
  }
}
