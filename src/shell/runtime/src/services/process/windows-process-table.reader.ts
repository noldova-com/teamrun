/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";

import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import type { IProcessTableReader } from "../../interfaces/process-table-reader.js";
import { ProcessTable } from "../../models/process-table.js";
import { ProcessTableEntry } from "../../models/process-table-entry.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";

export class WindowsProcessTableReader implements IProcessTableReader {
  private readonly command: SystemCommand;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(command: SystemCommand, environment: NodeJS.ProcessEnv) {
    this.command = command;
    this.environment = environment;
  }

  public async readAsync(): Promise<ProcessTable> {
    const systemRoot = this.environment[Resources.systemRootVariable];
    if (Object.isUndefined(systemRoot) || String.isNullOrWhitespace(systemRoot))
      throw new SystemCommandException(Resources.systemRootMissing);

    const shellEnvironment = Object.fromEntries(Object.entries(this.environment).filter(([t]) => t.toUpperCase() !== Resources.moduleSearchPathVariable.toUpperCase()));
    const output = await this.command.runAsync(
      path.win32.join(systemRoot, ...Resources.windowsShellSegments),
      [...Resources.windowsShellArguments, Buffer.from(Resources.windowsProcessTableScript, Resources.windowsScriptEncoding).toString(Resources.base64Encoding)],
      shellEnvironment);
    return new ProcessTable(output.split(Resources.lineBreakPattern).filter(t => !String.isNullOrWhitespace(t)).map(t => WindowsProcessTableReader.parse(t)));
  }

  private static parse(row: string): ProcessTableEntry {
    const match = Resources.windowsProcessTableRowPattern.exec(row);
    if (Object.isNull(match))
      throw new SystemCommandException(Resources.formatProcessTableRowUnreadable(row));
    const [, processId, parentId, started, executable] = match;
    return new ProcessTableEntry(Number(processId), Number(parentId), null, Number(started), String.isNullOrEmpty(executable) ? null : String(executable));
  }
}
