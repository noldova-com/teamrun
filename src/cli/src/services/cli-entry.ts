/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/teamrun-foundation-core";

import { CliApplication } from "./cli-application.js";
import { CommandRegistry } from "./command-registry.js";
import { TerminalConsole } from "./console/terminal-console.js";
import { LauncherConnectionFactoryBuilder } from "./launcher-connection-factory-builder.js";

export class CliEntry {
  public static get entryPath(): string {
    return fileURLToPath(import.meta.url);
  }

  public static async run(args: readonly string[]): Promise<number> {
    const console = new TerminalConsole(process.stdin, process.stdout, process.stderr);
    try {
      const application = new CliApplication(CommandRegistry.createDefault(), new LauncherConnectionFactoryBuilder(process.platform, process.execPath));
      return await application.run(args, console, process);
    }
    finally {
      console[Symbol.dispose]();
    }
  }
}

if (!Object.isUndefined(process.argv[1]) && resolve(process.argv[1]) === CliEntry.entryPath)
  process.exitCode = await CliEntry.run(process.argv.slice(2));
