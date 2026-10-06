/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProcessEnder } from "../../interfaces/i-process-ender.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import type { ProcessClock } from "./process-clock.js";
import { PosixProcessEnder } from "./posix-process-ender.js";
import { PosixProcessTableReader } from "./posix-process-table.reader.js";
import { WindowsProcessEnder } from "./windows-process-ender.js";
import { WindowsProcessKiller } from "./windows-process-killer.js";
import { WindowsProcessTableReader } from "./windows-process-table.reader.js";

export class ProcessEnderFactory {
  public static create(platform: string, command: SystemCommand, windows: IWindowsProcessApi, settings: ProcessSettings, clock: ProcessClock): IProcessEnder {
    if (platform !== Resources.windowsPlatform)
      return new PosixProcessEnder(new PosixProcessTableReader(command, clock), settings);
    const reader = new WindowsProcessTableReader(windows, clock);
    return new WindowsProcessEnder(reader, new WindowsProcessKiller(windows, reader), settings, clock);
  }
}
