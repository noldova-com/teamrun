/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";
import { DeclarationsFormatException, ModuleDeclarationReader } from "@noldova/teamrun-shell-runtime";

import { CliModule } from "../models/cli-module.js";
import { Resources } from "../resources.js";

export class CliModuleReader {
  public static async readAsync(runtimeEntryPath: string): Promise<readonly CliModule[]> {
    const file = ModuleDeclarationReader.locate(runtimeEntryPath);
    const declarations = await ModuleDeclarationReader.readAsync(file);
    try {
      return declarations.map(t => CliModule.fromDeclaration(t));
    }
    catch (error) {
      throw new DeclarationsFormatException(Resources.formatCliCommandsUnreadable(file, Resources.formatReason(error)), new ExceptionOptions(error));
    }
  }
}
