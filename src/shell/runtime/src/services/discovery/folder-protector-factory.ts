/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFolderProtector } from "../../interfaces/i-folder-protector.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import { PosixFolderProtector } from "./posix-folder-protector.js";
import { WindowsFolderProtector } from "./windows-folder-protector.js";

export class FolderProtectorFactory {
  public static create(platform: string, command: SystemCommand, environment: NodeJS.ProcessEnv): IFolderProtector {
    return platform === Resources.windowsPlatform ? new WindowsFolderProtector(command, environment) : new PosixFolderProtector();
  }
}
