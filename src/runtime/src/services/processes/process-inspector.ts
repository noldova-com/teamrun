/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { basename } from "node:path";

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class ProcessInspector {
  private readonly platform: string;
  private readonly run: (executable: string, args: readonly string[]) => string;

  public constructor(platform: string, run: (executable: string, args: readonly string[]) => string) {
    this.platform = platform;
    this.run = run;
  }

  public static fromPlatform(platform: string): ProcessInspector {
    return new ProcessInspector(platform, (executable, args) => execFileSync(executable, [...args], { encoding: Resources.utf8Encoding, windowsHide: true }));
  }

  public imageOf(processId: number): string | null {
    let output: string;
    try {
      output = this.platform === Resources.win32Platform
        ? this.run(Resources.taskListExecutable, Resources.formatTaskListArguments(processId))
        : this.platform === Resources.linuxPlatform
          ? this.run(Resources.readLinkExecutable, Resources.formatProcessImageArguments(processId))
          : this.run(Resources.psExecutable, Resources.formatPsArguments(processId));
    }
    catch {
      return null;
    }
    const line = output.trim();
    if (this.platform === Resources.win32Platform)
      return line.startsWith(Resources.quote) ? line.slice(1, line.indexOf(Resources.quote, 1)) : null;

    return String.isNullOrWhitespace(line) ? null : basename(line);
  }
}
