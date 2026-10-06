/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProcessEnder } from "../../interfaces/i-process-ender.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import type { ProcessClock } from "./process-clock.js";
import { PosixProcessEnder } from "./posix-process-ender.js";
import { PosixProcessTableReader } from "./posix-process-table.reader.js";
import { WindowsPowerShell } from "./windows-power-shell.js";
import { WindowsProcessEnder } from "./windows-process-ender.js";
import { WindowsProcessKiller } from "./windows-process-killer.js";
import { WindowsProcessTableReader } from "./windows-process-table.reader.js";

export class ProcessEnderFactory {
  public static create(platform: string, command: SystemCommand, environment: NodeJS.ProcessEnv, settings: ProcessSettings, clock: ProcessClock): IProcessEnder {
    if (platform !== Resources.windowsPlatform)
      return new PosixProcessEnder(new PosixProcessTableReader(command, clock), settings);
    const shell = new WindowsPowerShell(command, environment);
    return new WindowsProcessEnder(new WindowsProcessTableReader(shell), new WindowsProcessKiller(shell), settings, clock);
  }
}
