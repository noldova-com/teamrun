/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { win32 } from "node:path";

import type { LocatedExecutable } from "../../models/located-executable.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";

export class ArchiveUnpacker {
  public static command(extractor: LocatedExecutable, archive: string, directory: string): ProcessCommand {
    const command = extractor.toCommand();
    return win32.basename(extractor.path).toLowerCase().startsWith(Resources.tarCommandName)
      ? command.withArguments(...Resources.tarExtractArguments, archive, Resources.tarDirectoryArgument, directory)
      : command.withArguments(...Resources.unzipArguments, archive, Resources.unzipDirectoryArgument, directory);
  }
}
